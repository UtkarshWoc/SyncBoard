import { sceneCoordsToViewportCoords, viewportCoordsToSceneCoords } from '@excalidraw/excalidraw';
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { LIMITS, type CommentThread, type Role } from '@syncboard/shared';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { HiCheck, HiOutlineArrowUturnLeft, HiOutlineTrash, HiXMark } from 'react-icons/hi2';
import { Avatar } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { emitWithAck, type AppSocket } from '../../lib/socket';
import { timeAgo } from '../../lib/util';

type View = Pick<AppState, 'scrollX' | 'scrollY' | 'zoom' | 'offsetLeft' | 'offsetTop'>;

interface Props {
  socket: AppSocket;
  api: ExcalidrawImperativeAPI;
  initial: CommentThread[];
  /** Bumps whenever the canvas scrolls/zooms so pins can re-project. */
  viewVersion: number;
  placing: boolean;
  onPlaced: () => void;
  showResolved: boolean;
  myUserId: string;
  role: Role;
  onCountChange: (open: number) => void;
}

export function CommentsLayer({
  socket,
  api,
  initial,
  viewVersion,
  placing,
  onPlaced,
  showResolved,
  myUserId,
  role,
  onCountChange,
}: Props) {
  const toast = useToast();
  const [threads, setThreads] = useState<CommentThread[]>(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onUpsert = (t: CommentThread) =>
      setThreads((prev) => (prev.some((p) => p.id === t.id) ? prev.map((p) => (p.id === t.id ? t : p)) : [...prev, t]));
    const onRemove = ({ threadId }: { threadId: string }) => {
      setThreads((prev) => prev.filter((p) => p.id !== threadId));
      setActiveId((id) => (id === threadId ? null : id));
    };
    socket.on('comments:upsert', onUpsert);
    socket.on('comments:remove', onRemove);
    return () => {
      socket.off('comments:upsert', onUpsert);
      socket.off('comments:remove', onRemove);
    };
  }, [socket]);

  useEffect(() => {
    onCountChange(threads.filter((t) => !t.resolved).length);
  }, [threads, onCountChange]);

  // viewVersion is the dependency that makes this re-run on pan/zoom.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const view: View = useMemo(() => api.getAppState(), [api, viewVersion]);

  const project = (x: number, y: number) => {
    const p = sceneCoordsToViewportCoords({ sceneX: x, sceneY: y }, view);
    return { left: p.x - view.offsetLeft, top: p.y - view.offsetTop };
  };

  const onPlace = (e: React.MouseEvent) => {
    const p = viewportCoordsToSceneCoords({ clientX: e.clientX, clientY: e.clientY }, view);
    setDraft(p);
    setActiveId(null);
    onPlaced();
  };

  const visible = threads.filter((t) => showResolved || !t.resolved || t.id === activeId);
  const active = threads.find((t) => t.id === activeId) ?? null;

  const act = async <T,>(event: string, payload: unknown): Promise<T | null> => {
    const res = await emitWithAck<T>(socket, event, payload);
    if (!res.ok) {
      toast(res.error.message, 'error');
      return null;
    }
    return res.data;
  };

  return (
    <div className={`comments-layer ${placing ? 'placing' : ''}`} onClick={placing ? onPlace : undefined}>
      {visible.map((t, i) => (
        <button
          key={t.id}
          className={`comment-pin ${t.resolved ? 'resolved' : ''} ${t.id === activeId ? 'active' : ''}`}
          style={project(t.x, t.y)}
          onClick={(e) => {
            e.stopPropagation();
            setDraft(null);
            setActiveId(t.id === activeId ? null : t.id);
          }}
          aria-label={`Comment by ${t.createdBy.displayName}`}
        >
          {t.resolved ? <HiCheck /> : i + 1}
        </button>
      ))}

      {draft && (
        <NewThread
          position={project(draft.x, draft.y)}
          onCancel={() => setDraft(null)}
          onSubmit={async (text) => {
            const created = await act<CommentThread>('comment:create', { ...draft, text });
            if (created) {
              setDraft(null);
              setActiveId(created.id);
            }
          }}
        />
      )}

      {active && (
        <ThreadPopover
          thread={active}
          position={project(active.x, active.y)}
          canModerate={role === 'owner'}
          myUserId={myUserId}
          onClose={() => setActiveId(null)}
          onReply={(text) => act('comment:reply', { threadId: active.id, text })}
          onResolve={(resolved) => act('comment:resolve', { threadId: active.id, resolved })}
          onDelete={() => act('comment:delete', { threadId: active.id })}
        />
      )}
    </div>
  );
}

function NewThread({
  position,
  onSubmit,
  onCancel,
}: {
  position: { left: number; top: number };
  onSubmit: (text: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) await onSubmit(text.trim());
  };
  return (
    <form className="comment-popover" style={position} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
      <textarea
        autoFocus
        className="input"
        rows={3}
        placeholder="Ask a question or leave feedback…"
        value={text}
        maxLength={LIMITS.COMMENT_MAX}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit(e);
        }}
      />
      <div className="row gap end">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary btn-sm" disabled={!text.trim()}>
          Comment
        </button>
      </div>
    </form>
  );
}

function ThreadPopover({
  thread,
  position,
  canModerate,
  myUserId,
  onClose,
  onReply,
  onResolve,
  onDelete,
}: {
  thread: CommentThread;
  position: { left: number; top: number };
  canModerate: boolean;
  myUserId: string;
  onClose: () => void;
  onReply: (text: string) => Promise<unknown>;
  onResolve: (resolved: boolean) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}) {
  const [reply, setReply] = useState('');
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    if (await onReply(reply.trim())) setReply('');
  };
  const canDelete = canModerate || thread.createdBy.id === myUserId;

  return (
    <div className="comment-popover thread" style={position} onClick={(e) => e.stopPropagation()}>
      <header className="row gap">
        <span className="muted small">{thread.resolved ? 'Resolved' : 'Open'}</span>
        <span className="spacer" />
        <button
          className="icon-btn icon-btn-sm"
          onClick={() => void onResolve(!thread.resolved)}
          title={thread.resolved ? 'Reopen' : 'Resolve'}
          aria-label={thread.resolved ? 'Reopen thread' : 'Resolve thread'}
        >
          {thread.resolved ? <HiOutlineArrowUturnLeft /> : <HiCheck />}
        </button>
        {canDelete && (
          <button
            className="icon-btn icon-btn-sm danger-hover"
            onClick={() => void onDelete()}
            aria-label="Delete thread"
          >
            <HiOutlineTrash />
          </button>
        )}
        <button className="icon-btn icon-btn-sm" onClick={onClose} aria-label="Close">
          <HiXMark />
        </button>
      </header>
      <ul className="comment-list">
        {thread.comments.map((c) => (
          <li key={c.id}>
            <Avatar user={c.author} size={22} />
            <div>
              <div className="row gap">
                <strong className="small">{c.author.displayName}</strong>
                <span className="muted tiny">{timeAgo(c.createdAt)}</span>
              </div>
              <p className="comment-text">{c.text}</p>
            </div>
          </li>
        ))}
      </ul>
      <form className="row gap" onSubmit={send}>
        <input
          className="input input-sm"
          placeholder="Reply…"
          value={reply}
          maxLength={LIMITS.COMMENT_MAX}
          onChange={(e) => setReply(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" disabled={!reply.trim()}>
          Reply
        </button>
      </form>
    </div>
  );
}
