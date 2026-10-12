import { LIMITS, type BoardLists, type BoardSummary, type GeneralAccess } from '@syncboard/shared';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  HiOutlineArrowRightOnRectangle,
  HiOutlineGlobeAlt,
  HiOutlineLockClosed,
  HiOutlinePlus,
  HiOutlineSquares2X2,
  HiOutlineTrash,
  HiOutlineUserGroup,
} from 'react-icons/hi2';
import { AppHeader } from '../components/AppHeader';
import { Avatar, Field, Modal, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { TEMPLATES, type TemplateId } from '../board/templates/templates';
import { api, errorMessage } from '../lib/api';
import { timeAgo } from '../lib/util';

type Tab = 'owned' | 'shared' | 'public';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [lists, setLists] = useState<BoardLists | null>(null);
  const [tab, setTab] = useState<Tab>('owned');
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  const load = useCallback(async () => {
    try {
      setLists(await api.listBoards());
    } catch (err) {
      toast(errorMessage(err, 'Could not load your boards'), 'error');
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const onJoin = (e: FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code) navigate(`/board/${code}`);
  };

  const onDelete = async (board: BoardSummary) => {
    if (!window.confirm(`Delete “${board.name}” for everyone? This cannot be undone.`)) return;
    try {
      await api.deleteBoard(board.id);
      toast('Board deleted', 'success');
      void load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const boards = lists?.[tab] ?? [];

  return (
    <div className="page">
      <AppHeader />
      <main className="dashboard">
        <section className="dashboard-hero">
          <div>
            <h1>Hi {user?.displayName.split(' ')[0]} 👋</h1>
            <p className="muted">Start a lesson board, or jump into one with a code from your tutor.</p>
          </div>
          <div className="dashboard-actions">
            <form className="join-form" onSubmit={onJoin}>
              <input
                className="input code-input"
                placeholder="Board code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={12}
                aria-label="Board code"
              />
              <button className="btn btn-ghost" disabled={!joinCode.trim()}>
                <HiOutlineArrowRightOnRectangle /> Join
              </button>
            </form>
            <button className="btn btn-primary" onClick={() => setCreating(true)} id="new-board-btn">
              <HiOutlinePlus /> New board
            </button>
          </div>
        </section>

        <div className="tabs tabs-inline" role="tablist">
          {(
            [
              ['owned', 'My boards', HiOutlineSquares2X2],
              ['shared', 'Shared with me', HiOutlineUserGroup],
              ['public', 'Public', HiOutlineGlobeAlt],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={`tab ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
            >
              <Icon /> {label}
              {lists && <span className="tab-count">{lists[id].length}</span>}
            </button>
          ))}
        </div>

        {!lists ? (
          <Spinner />
        ) : boards.length === 0 ? (
          <EmptyState tab={tab} onCreate={() => setCreating(true)} />
        ) : (
          <div className="board-grid">
            {boards.map((b) => (
              <BoardCard key={b.id} board={b} onOpen={() => navigate(`/board/${b.id}`)} onDelete={() => onDelete(b)} />
            ))}
          </div>
        )}
      </main>

      {creating && (
        <CreateBoardModal
          onClose={() => setCreating(false)}
          onCreated={(id, template) => navigate(`/board/${id}`, { state: template ? { template } : undefined })}
        />
      )}
    </div>
  );
}

function EmptyState({ tab, onCreate }: { tab: Tab; onCreate: () => void }) {
  const copy = {
    owned: ["You haven't created a board yet.", 'Create one for your next lesson — try a template.'],
    shared: ['No boards shared with you yet.', 'Ask your tutor for an invite link or a board code.'],
    public: ['No public boards right now.', 'Boards that owners list publicly appear here.'],
  }[tab];
  return (
    <div className="empty-state glass">
      <h3>{copy[0]}</h3>
      <p className="muted">{copy[1]}</p>
      {tab === 'owned' && (
        <button className="btn btn-primary" onClick={onCreate}>
          <HiOutlinePlus /> New board
        </button>
      )}
    </div>
  );
}

function BoardCard({ board, onOpen, onDelete }: { board: BoardSummary; onOpen: () => void; onDelete: () => void }) {
  return (
    <article className="board-card" data-board-id={board.id}>
      <button className="board-thumb" onClick={onOpen} aria-label={`Open ${board.name}`}>
        {board.thumbnail ? (
          <img src={board.thumbnail} alt="" />
        ) : (
          <span className="board-thumb-empty">{board.name[0]}</span>
        )}
        {!!board.liveCount && <span className="live-badge">● {board.liveCount} live</span>}
      </button>
      <div className="board-card-body">
        <div className="board-card-title">
          <button className="link-btn" onClick={onOpen}>
            {board.name}
          </button>
          {board.role === 'owner' && (
            <button
              className="icon-btn icon-btn-sm danger-hover"
              onClick={onDelete}
              aria-label={`Delete ${board.name}`}
            >
              <HiOutlineTrash />
            </button>
          )}
        </div>
        <div className="board-card-meta">
          {board.owner && board.role !== 'owner' && <Avatar user={board.owner} size={18} />}
          <span className="code-chip">{board.id}</span>
          <AccessBadge access={board.generalAccess} hasPassword={board.hasPassword} />
          {board.role && board.role !== 'owner' && <span className="role-chip">{board.role}</span>}
          <span className="muted small">{timeAgo(board.lastActivityAt)}</span>
        </div>
      </div>
    </article>
  );
}

export function AccessBadge({ access, hasPassword }: { access: GeneralAccess; hasPassword: boolean }) {
  if (access === 'restricted') {
    return (
      <span className="access-chip" title="Only invited people">
        <HiOutlineLockClosed /> Private
      </span>
    );
  }
  return (
    <span className="access-chip open" title={`Anyone with the code can ${access === 'editor' ? 'edit' : 'view'}`}>
      <HiOutlineGlobeAlt /> Link{hasPassword ? ' + password' : ''}
    </span>
  );
}

function CreateBoardModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string, template: TemplateId | null) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [generalAccess, setGeneralAccess] = useState<GeneralAccess>('restricted');
  const [listed, setListed] = useState(false);
  const [grid, setGrid] = useState(false);
  const [template, setTemplate] = useState<TemplateId | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const board = await api.createBoard({
        name: name.trim(),
        generalAccess,
        listed: generalAccess !== 'restricted' && listed,
        background: grid ? 'grid' : 'plain',
      });
      onCreated(board.id, template);
    } catch (err) {
      toast(errorMessage(err), 'error');
      setBusy(false);
    }
  };

  return (
    <Modal
      title="New board"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="btn btn-primary" form="create-board-form" disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create board'}
          </button>
        </>
      }
    >
      <form id="create-board-form" onSubmit={onSubmit} className="stack">
        <Field label="Board name" htmlFor="board-name">
          <input
            id="board-name"
            className="input"
            placeholder="e.g. Algebra — Week 3"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={LIMITS.BOARD_NAME_MAX}
            required
          />
        </Field>

        <Field label="Who can open it with the code or link">
          <div className="segmented">
            {(
              [
                ['restricted', 'Only invited people'],
                ['viewer', 'Anyone can view'],
                ['editor', 'Anyone can edit'],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={generalAccess === value ? 'active' : ''}
                onClick={() => setGeneralAccess(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        <div className="toggles">
          <label className="check">
            <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} /> Graph-paper grid
          </label>
          <label className={`check ${generalAccess === 'restricted' ? 'disabled' : ''}`}>
            <input
              type="checkbox"
              checked={listed && generalAccess !== 'restricted'}
              disabled={generalAccess === 'restricted'}
              onChange={(e) => setListed(e.target.checked)}
            />{' '}
            List on the public page
          </label>
        </div>

        <Field label="Start from a template (optional)">
          <div className="template-grid">
            <button
              type="button"
              className={`template-card ${template === null ? 'active' : ''}`}
              onClick={() => setTemplate(null)}
            >
              <span className="template-emoji">⬜</span>
              <span>Blank</span>
            </button>
            {TEMPLATES.map((t) => (
              <button
                type="button"
                key={t.id}
                className={`template-card ${template === t.id ? 'active' : ''}`}
                onClick={() => setTemplate(t.id)}
                title={t.description}
              >
                <span className="template-emoji">{t.emoji}</span>
                <span>{t.name}</span>
              </button>
            ))}
          </div>
        </Field>
      </form>
    </Modal>
  );
}
