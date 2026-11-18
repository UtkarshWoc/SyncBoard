import type { RtcMediaState, RtcSignalData } from '@syncboard/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { env } from '../../lib/env';
import { emitWithAck, type AppSocket } from '../../lib/socket';

export interface RemotePeer {
  socketId: string;
  stream: MediaStream | null;
  media: RtcMediaState;
}

interface PeerConn {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
}

/**
 * Small-group voice/video over a WebRTC mesh (fine for a tutor and a handful of
 * students). Uses the "perfect negotiation" pattern so either side may start
 * negotiating without glare. The server only relays signals between sockets
 * that are in the same board's call.
 */
export function useCall(socket: AppSocket | null) {
  const [inCall, setInCall] = useState(false);
  const [joining, setJoining] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [media, setMedia] = useState<RtcMediaState>({ audio: false, video: false });
  const [peers, setPeers] = useState<Map<string, RemotePeer>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const conns = useRef(new Map<string, PeerConn>());
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRef = useRef(media);
  mediaRef.current = media;

  const updatePeer = useCallback((socketId: string, patch: Partial<RemotePeer>) => {
    setPeers((prev) => {
      const next = new Map(prev);
      const current = next.get(socketId) ?? { socketId, stream: null, media: { audio: false, video: false } };
      next.set(socketId, { ...current, ...patch });
      return next;
    });
  }, []);

  const closePeer = useCallback((socketId: string) => {
    conns.current.get(socketId)?.pc.close();
    conns.current.delete(socketId);
    setPeers((prev) => {
      const next = new Map(prev);
      next.delete(socketId);
      return next;
    });
  }, []);

  const signal = useCallback((to: string, data: RtcSignalData) => socket?.emit('rtc:signal', { to, data }), [socket]);

  const connect = useCallback(
    (socketId: string): PeerConn => {
      const existing = conns.current.get(socketId);
      if (existing) return existing;
      const pc = new RTCPeerConnection({ iceServers: env.ICE_SERVERS });
      // Deterministic roles: the lexically larger id yields on collisions.
      const conn: PeerConn = { pc, polite: (socket?.id ?? '') > socketId, makingOffer: false, ignoreOffer: false };
      conns.current.set(socketId, conn);

      streamRef.current?.getTracks().forEach((track) => pc.addTrack(track, streamRef.current!));

      pc.onnegotiationneeded = async () => {
        try {
          conn.makingOffer = true;
          await pc.setLocalDescription();
          if (pc.localDescription)
            signal(socketId, {
              description: pc.localDescription.toJSON() as RTCSessionDescriptionInit & { type: 'offer' },
            });
        } catch (err) {
          console.warn('Negotiation failed', err);
        } finally {
          conn.makingOffer = false;
        }
      };
      pc.onicecandidate = ({ candidate }) =>
        signal(socketId, { candidate: candidate ? candidate.toJSON() : null } as RtcSignalData);
      pc.ontrack = ({ streams }) => updatePeer(socketId, { stream: streams[0] ?? null });
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') pc.restartIce();
      };
      updatePeer(socketId, {});
      return conn;
    },
    [socket, signal, updatePeer],
  );

  // Incoming call events.
  useEffect(() => {
    if (!socket || !inCall) return;

    const onPeerJoined = ({ socketId, media: m }: { socketId: string; media: RtcMediaState }) => {
      connect(socketId);
      updatePeer(socketId, { media: m });
    };
    const onPeerLeft = ({ socketId }: { socketId: string }) => closePeer(socketId);
    const onMedia = ({ socketId, media: m }: { socketId: string; media: RtcMediaState }) =>
      updatePeer(socketId, { media: m });
    const onSignal = async ({ from, data }: { from: string; data: RtcSignalData }) => {
      const conn = connect(from);
      const { pc } = conn;
      try {
        if ('description' in data) {
          const description = data.description as RTCSessionDescriptionInit;
          const collision = description.type === 'offer' && (conn.makingOffer || pc.signalingState !== 'stable');
          conn.ignoreOffer = !conn.polite && collision;
          if (conn.ignoreOffer) return;
          await pc.setRemoteDescription(description);
          if (description.type === 'offer') {
            await pc.setLocalDescription();
            if (pc.localDescription)
              signal(from, {
                description: pc.localDescription.toJSON() as RTCSessionDescriptionInit & { type: 'answer' },
              });
          }
        } else if ('candidate' in data) {
          try {
            await pc.addIceCandidate(data.candidate ?? undefined);
          } catch (err) {
            if (!conn.ignoreOffer) throw err;
          }
        }
      } catch (err) {
        console.warn('Signal handling failed', err);
      }
    };

    socket.on('rtc:peer-joined', onPeerJoined);
    socket.on('rtc:peer-left', onPeerLeft);
    socket.on('rtc:media', onMedia);
    socket.on('rtc:signal', onSignal);
    return () => {
      socket.off('rtc:peer-joined', onPeerJoined);
      socket.off('rtc:peer-left', onPeerLeft);
      socket.off('rtc:media', onMedia);
      socket.off('rtc:signal', onSignal);
    };
  }, [socket, inCall, connect, closePeer, updatePeer, signal]);

  const teardown = useCallback(() => {
    for (const id of [...conns.current.keys()]) closePeer(id);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLocalStream(null);
    setInCall(false);
    setMedia({ audio: false, video: false });
  }, [closePeer]);

  const join = useCallback(
    async (withVideo: boolean) => {
      if (!socket || inCall || joining) return;
      setJoining(true);
      setError(null);
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } },
          });
        } catch {
          // No camera, or camera blocked — fall back to voice only.
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        const hasVideo = stream.getVideoTracks().length > 0;
        stream.getVideoTracks().forEach((t) => (t.enabled = withVideo));
        streamRef.current = stream;
        setLocalStream(stream);

        const initial = { audio: true, video: withVideo && hasVideo };
        setMedia(initial);
        const res = await emitWithAck<{ peers: string[] }>(socket, 'rtc:join', initial);
        if (!res.ok) throw new Error(res.error.message);
        setInCall(true);
        // We're the newcomer: open a connection to everyone already in the call.
        for (const peer of res.data.peers) connect(peer);
      } catch (err) {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setLocalStream(null);
        setError(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Microphone access was blocked. Allow it in your browser to join the call.'
            : err instanceof Error
              ? err.message
              : 'Could not join the call',
        );
      } finally {
        setJoining(false);
      }
    },
    [socket, inCall, joining, connect],
  );

  const leave = useCallback(() => {
    socket?.emit('rtc:leave');
    teardown();
  }, [socket, teardown]);

  const toggle = useCallback(
    (kind: 'audio' | 'video') => {
      const tracks = kind === 'audio' ? streamRef.current?.getAudioTracks() : streamRef.current?.getVideoTracks();
      if (!tracks?.length) return;
      const next = { ...mediaRef.current, [kind]: !mediaRef.current[kind] };
      tracks.forEach((t) => (t.enabled = next[kind]));
      setMedia(next);
      socket?.emit('rtc:media', next);
    },
    [socket],
  );

  // Rejoin after a reconnect; leave cleanly on unmount.
  useEffect(() => {
    if (!socket) return;
    const onDisconnect = () => {
      if (streamRef.current) {
        for (const id of [...conns.current.keys()]) closePeer(id);
      }
    };
    const onConnect = () => {
      if (!streamRef.current) return;
      void emitWithAck<{ peers: string[] }>(socket, 'rtc:join', mediaRef.current).then((res) => {
        if (res.ok) for (const peer of res.data.peers) connect(peer);
      });
    };
    socket.on('disconnect', onDisconnect);
    socket.on('connect', onConnect);
    return () => {
      socket.off('disconnect', onDisconnect);
      socket.off('connect', onConnect);
    };
  }, [socket, connect, closePeer]);

  useEffect(() => () => teardown(), [teardown]);

  return { inCall, joining, localStream, media, peers: [...peers.values()], error, join, leave, toggle };
}
