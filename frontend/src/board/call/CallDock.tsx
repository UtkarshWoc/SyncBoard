import type { Participant } from '@syncboard/shared';
import { useEffect, useRef } from 'react';
import {
  HiOutlineMicrophone,
  HiOutlinePhoneXMark,
  HiOutlineVideoCamera,
  HiOutlineVideoCameraSlash,
} from 'react-icons/hi2';
import { Avatar } from '../../components/ui';
import type { useCall } from './useCall';

type Call = ReturnType<typeof useCall>;

function VideoTile({
  stream,
  muted,
  label,
  showVideo,
  audioOn,
  participant,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  label: string;
  showVideo: boolean;
  audioOn: boolean;
  participant?: Participant;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="video-tile">
      {/* The element always plays so remote audio is heard even with the camera off. */}
      <video ref={ref} autoPlay playsInline muted={muted} className={showVideo ? '' : 'hidden-video'} />
      {!showVideo && participant && (
        <div className="video-placeholder">
          <Avatar user={participant.user} size={40} color={participant.color} />
        </div>
      )}
      <span className="video-label">
        {!audioOn && <HiOutlineMicrophone className="muted-icon" aria-label="Muted" />}
        {label}
      </span>
    </div>
  );
}

export function CallDock({
  call,
  participants,
  mySocketId,
}: {
  call: Call;
  participants: Participant[];
  mySocketId: string | null;
}) {
  if (!call.inCall) return null;
  const bySocket = new Map(participants.map((p) => [p.socketId, p]));
  const me = mySocketId ? bySocket.get(mySocketId) : undefined;

  return (
    <div className="call-dock glass" role="region" aria-label="Voice and video call">
      <div className="video-grid">
        <VideoTile
          stream={call.localStream}
          muted
          label="You"
          showVideo={call.media.video}
          audioOn={call.media.audio}
          participant={me}
        />
        {call.peers.map((p) => {
          const participant = bySocket.get(p.socketId);
          return (
            <VideoTile
              key={p.socketId}
              stream={p.stream}
              label={participant?.user.displayName ?? 'Connecting…'}
              showVideo={p.media.video}
              audioOn={p.media.audio}
              participant={participant}
            />
          );
        })}
      </div>
      <div className="call-controls">
        <button
          className={`call-btn ${call.media.audio ? '' : 'off'}`}
          onClick={() => call.toggle('audio')}
          aria-label={call.media.audio ? 'Mute microphone' : 'Unmute microphone'}
          title={call.media.audio ? 'Mute' : 'Unmute'}
        >
          <HiOutlineMicrophone />
        </button>
        <button
          className={`call-btn ${call.media.video ? '' : 'off'}`}
          onClick={() => call.toggle('video')}
          aria-label={call.media.video ? 'Turn camera off' : 'Turn camera on'}
          title={call.media.video ? 'Camera off' : 'Camera on'}
          disabled={!call.localStream?.getVideoTracks().length}
        >
          {call.media.video ? <HiOutlineVideoCamera /> : <HiOutlineVideoCameraSlash />}
        </button>
        <button className="call-btn leave" onClick={call.leave} aria-label="Leave call" title="Leave call">
          <HiOutlinePhoneXMark />
        </button>
      </div>
    </div>
  );
}
