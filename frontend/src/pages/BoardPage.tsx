import type { JoinedBoard } from '@syncboard/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { BoardWorkspace } from '../board/BoardWorkspace';
import { PresenceSync } from '../board/sync/PresenceSync';
import { SceneSync } from '../board/sync/SceneSync';
import { useBoardSession } from '../board/useBoardSession';
import { FullPageMessage, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { atLeastEditor } from '../board/roles';

export default function BoardPage() {
  const { boardId: rawId = '' } = useParams();
  const boardId = rawId.toUpperCase();
  const { socket } = useSocket();
  const { user } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const template = (location.state as { template?: string } | null)?.template ?? null;

  const roleRef = useRef<string | null>(null);
  const syncRef = useRef<SceneSync | null>(null);
  const [sync, setSync] = useState<SceneSync | null>(null);
  const [presence, setPresence] = useState<PresenceSync | null>(null);

  // Created before the join is sent so no scene update can slip past unbuffered.
  useEffect(() => {
    if (!socket) return;
    const s = new SceneSync(socket, boardId, {
      canEdit: () => atLeastEditor(roleRef.current),
      onError: (message) => toast(message, 'error'),
    });
    const p = new PresenceSync(socket);
    syncRef.current = s;
    setSync(s);
    setPresence(p);
    return () => {
      s.dispose();
      p.dispose();
      syncRef.current = null;
      setSync(null);
      setPresence(null);
    };
  }, [socket, boardId, toast]);

  const session = useBoardSession(socket, boardId, {
    onRejoin: (joined: JoinedBoard) => syncRef.current?.init(joined.elements, joined.fileIds, true),
  });
  roleRef.current = session.role;

  const { status } = session;
  if (status.kind === 'password')
    return <PasswordPrompt boardId={boardId} status={status} onSubmit={session.submitPassword} />;
  if (status.kind === 'not-found') {
    return (
      <FullPageMessage title="Board not found">
        <p className="muted">
          There's no board with the code <strong>{boardId}</strong>. Check the code and try again.
        </p>
        <Link to="/" className="btn btn-primary">
          Back to my boards
        </Link>
      </FullPageMessage>
    );
  }
  if (status.kind === 'forbidden') {
    return (
      <FullPageMessage title="You don't have access">
        <p className="muted">{status.message}. Ask the board owner for an invite link.</p>
        <Link to="/" className="btn btn-primary">
          Back to my boards
        </Link>
      </FullPageMessage>
    );
  }
  if (status.kind === 'removed') {
    return (
      <FullPageMessage title={status.reason === 'deleted' ? 'This board was deleted' : 'Your access was removed'}>
        <p className="muted">
          {status.reason === 'deleted' ? 'The owner deleted this board.' : 'The owner changed who can open this board.'}
        </p>
        <Link to="/" className="btn btn-primary">
          Back to my boards
        </Link>
      </FullPageMessage>
    );
  }
  if (status.kind === 'error') {
    return (
      <FullPageMessage title="Couldn't open the board">
        <p className="muted">{status.message}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </FullPageMessage>
    );
  }

  if (!session.initial || !socket || !sync || !presence || !user || !session.role || !session.board) {
    return <Spinner label="Opening board…" />;
  }

  return (
    <BoardWorkspace
      key={boardId}
      socket={socket}
      session={session}
      initial={session.initial}
      board={session.board}
      role={session.role}
      sync={sync}
      presence={presence}
      user={user}
      initialTemplate={template}
    />
  );
}

function PasswordPrompt({
  boardId,
  status,
  onSubmit,
}: {
  boardId: string;
  status: { error?: string };
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (password) onSubmit(password);
  };
  return (
    <FullPageMessage title="This board is password protected">
      <form className="auth-form" onSubmit={submit}>
        <p className="muted">
          Enter the password for board <strong>{boardId}</strong>. Your tutor can share it with you.
        </p>
        <input
          className="input"
          type="password"
          autoFocus
          placeholder="Board password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label="Board password"
        />
        <button className="btn btn-primary btn-block" disabled={!password}>
          Open board
        </button>
        {status.error && <p className="error">{status.error}</p>}
        <Link to="/" className="link-sm center">
          Back to my boards
        </Link>
      </form>
    </FullPageMessage>
  );
}
