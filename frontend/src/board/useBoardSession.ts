import type { BoardSummary, JoinedBoard, Participant, Role } from '@syncboard/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { emitWithAck, type AppSocket } from '../lib/socket';

export type SessionStatus =
  | { kind: 'connecting' }
  | { kind: 'password'; error?: string; boardName?: string }
  | { kind: 'forbidden'; message: string }
  | { kind: 'not-found' }
  | { kind: 'removed'; reason: 'deleted' | 'access-revoked' }
  | { kind: 'error'; message: string }
  | { kind: 'ready' };

export interface BoardSession {
  status: SessionStatus;
  /** First successful join — used as Excalidraw's initial data. */
  initial: JoinedBoard | null;
  board: BoardSummary | null;
  role: Role | null;
  me: Participant | null;
  participants: Participant[];
  mutedUserIds: string[];
  submitPassword: (password: string) => void;
}

interface Options {
  /** Called on every successful join after the first (i.e. after reconnects). */
  onRejoin: (joined: JoinedBoard) => void;
}

export function useBoardSession(socket: AppSocket | null, boardId: string, { onRejoin }: Options): BoardSession {
  const [status, setStatus] = useState<SessionStatus>({ kind: 'connecting' });
  const [initial, setInitial] = useState<JoinedBoard | null>(null);
  const [board, setBoard] = useState<BoardSummary | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [me, setMe] = useState<Participant | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [mutedUserIds, setMutedUserIds] = useState<string[]>([]);

  const joinedOnce = useRef(false);
  const password = useRef<string | undefined>(undefined);
  const onRejoinRef = useRef(onRejoin);
  onRejoinRef.current = onRejoin;

  const join = useCallback(async () => {
    if (!socket?.connected) return;
    const res = await emitWithAck<JoinedBoard>(socket, 'board:join', { boardId, password: password.current });
    if (res.ok) {
      const data = res.data;
      setBoard(data.board);
      setRole(data.role);
      setMe(data.me);
      setParticipants(data.participants);
      setMutedUserIds(data.mutedUserIds);
      if (!joinedOnce.current) {
        joinedOnce.current = true;
        setInitial(data);
      } else {
        onRejoinRef.current(data);
      }
      setStatus({ kind: 'ready' });
      return;
    }
    const { code, message } = res.error;
    if (code === 'PASSWORD_REQUIRED') setStatus({ kind: 'password' });
    else if (code === 'INVALID_PASSWORD' || (code === 'RATE_LIMITED' && password.current)) {
      setStatus({ kind: 'password', error: message });
    } else if (code === 'NOT_FOUND' || code === 'VALIDATION') setStatus({ kind: 'not-found' });
    else if (code === 'FORBIDDEN') setStatus({ kind: 'forbidden', message });
    else setStatus({ kind: 'error', message });
  }, [socket, boardId]);

  useEffect(() => {
    if (!socket) return;
    const onConnect = () => void join();
    const onDisconnect = () => setParticipants([]);
    const onBoardUpdated = (b: BoardSummary) => setBoard(b);
    const onRoleChanged = ({ role: r }: { role: Role }) => {
      setRole(r);
      setMe((m) => (m ? { ...m, role: r } : m));
    };
    const onRemoved = ({ reason }: { reason: 'deleted' | 'access-revoked' }) => setStatus({ kind: 'removed', reason });
    const onMuted = ({ mutedUserIds: ids }: { mutedUserIds: string[] }) => setMutedUserIds(ids);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('participants', setParticipants);
    socket.on('board:updated', onBoardUpdated);
    socket.on('board:role-changed', onRoleChanged);
    socket.on('board:removed', onRemoved);
    socket.on('board:muted', onMuted);
    if (socket.connected) void join();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('participants', setParticipants);
      socket.off('board:updated', onBoardUpdated);
      socket.off('board:role-changed', onRoleChanged);
      socket.off('board:removed', onRemoved);
      socket.off('board:muted', onMuted);
      if (socket.connected) socket.emit('board:leave');
    };
  }, [socket, join]);

  const submitPassword = useCallback(
    (pw: string) => {
      password.current = pw;
      setStatus({ kind: 'connecting' });
      void join();
    },
    [join],
  );

  return { status, initial, board, role, me, participants, mutedUserIds, submitPassword };
}
