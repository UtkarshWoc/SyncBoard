import type { BoardDetails, GeneralAccess, MemberRole, Role } from '@syncboard/shared';
import { LIMITS } from '@syncboard/shared';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { HiOutlineClipboardDocument, HiOutlineLink, HiOutlineTrash } from 'react-icons/hi2';
import { Avatar, Field, Modal, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { api, errorMessage } from '../../lib/api';
import { emitWithAck, type AppSocket } from '../../lib/socket';
import { boardUrl, copyText, inviteUrl, timeAgo } from '../../lib/util';

interface Props {
  boardId: string;
  role: Role;
  myUserId: string;
  socket: AppSocket;
  mutedUserIds: string[];
  onClose: () => void;
}

export function ShareDialog({ boardId, role, myUserId, socket, mutedUserIds, onClose }: Props) {
  const toast = useToast();
  const navigate = useNavigate();
  const [details, setDetails] = useState<BoardDetails | null>(null);
  const isOwner = role === 'owner';

  const reload = useCallback(async () => {
    try {
      setDetails(await api.getBoard(boardId));
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }, [boardId, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    try {
      const result = await fn();
      if (result && typeof result === 'object' && 'members' in result) setDetails(result as BoardDetails);
      else await reload();
      if (success) toast(success, 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const copy = async (text: string, what: string) => {
    toast((await copyText(text)) ? `${what} copied` : 'Could not copy — select and copy it manually', 'info');
  };

  const toggleMute = async (userId: string, muted: boolean) => {
    const res = await emitWithAck(socket, 'chat:mute', { userId, muted });
    if (!res.ok) toast(res.error.message, 'error');
  };

  return (
    <Modal title="Share board" onClose={onClose} wide>
      {!details ? (
        <Spinner />
      ) : (
        <div className="stack share-dialog">
          <div className="share-link-row">
            <div>
              <span className="label">Board code</span>
              <div className="code-big">{details.id}</div>
            </div>
            <div className="row gap">
              <button className="btn btn-ghost btn-sm" onClick={() => void copy(details.id, 'Code')}>
                <HiOutlineClipboardDocument /> Copy code
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => void copy(boardUrl(details.id), 'Link')}>
                <HiOutlineLink /> Copy link
              </button>
            </div>
          </div>

          {isOwner ? (
            <OwnerSettings details={details} onSave={(input, msg) => run(() => api.updateBoard(boardId, input), msg)} />
          ) : (
            <p className="muted">
              You are {role === 'editor' ? 'an editor' : 'a viewer'} on this board.{' '}
              {details.generalAccess !== 'restricted' &&
                `Anyone with the code can ${details.generalAccess === 'editor' ? 'edit' : 'view'}.`}
            </p>
          )}

          {isOwner && <InviteLinks details={details} onChanged={reload} copy={copy} />}

          <section>
            <h3 className="section-title">People</h3>
            <ul className="member-list">
              {details.owner && (
                <li>
                  <Avatar user={details.owner} size={30} />
                  <span className="member-name">
                    {details.owner.displayName} {details.owner.id === myUserId && <span className="muted">(you)</span>}
                  </span>
                  <span className="role-chip">owner</span>
                </li>
              )}
              {details.members.map((m) => {
                const muted = mutedUserIds.includes(m.user.id);
                return (
                  <li key={m.user.id}>
                    <Avatar user={m.user} size={30} />
                    <span className="member-name">
                      {m.user.displayName} {m.user.id === myUserId && <span className="muted">(you)</span>}
                      <span className="muted tiny"> · joined {timeAgo(m.addedAt)}</span>
                    </span>
                    {isOwner ? (
                      <>
                        <label className="check small" title="Prevent this person from sending chat messages">
                          <input
                            type="checkbox"
                            checked={muted}
                            onChange={(e) => void toggleMute(m.user.id, e.target.checked)}
                          />{' '}
                          Mute chat
                        </label>
                        <select
                          className="input input-sm select"
                          value={m.role}
                          onChange={(e) =>
                            void run(
                              () => api.setMemberRole(boardId, m.user.id, e.target.value as MemberRole),
                              'Role updated',
                            )
                          }
                          aria-label={`Role for ${m.user.displayName}`}
                        >
                          <option value="editor">Can edit</option>
                          <option value="viewer">Can view</option>
                        </select>
                        <button
                          className="icon-btn icon-btn-sm danger-hover"
                          onClick={() => void run(() => api.removeMember(boardId, m.user.id), 'Removed from board')}
                          aria-label={`Remove ${m.user.displayName}`}
                        >
                          <HiOutlineTrash />
                        </button>
                      </>
                    ) : (
                      <span className="role-chip">{m.role}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {details.members.length === 0 && <p className="muted small">No one else has joined yet.</p>}
          </section>

          {!isOwner && details.members.some((m) => m.user.id === myUserId) && (
            <button
              className="btn btn-ghost danger-text"
              onClick={() =>
                void run(async () => {
                  await api.removeMember(boardId, myUserId);
                  navigate('/', { replace: true });
                })
              }
            >
              Leave this board
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}

function OwnerSettings({
  details,
  onSave,
}: {
  details: BoardDetails;
  onSave: (input: Parameters<typeof api.updateBoard>[1], message: string) => Promise<void>;
}) {
  const [name, setName] = useState(details.name);
  const [password, setPassword] = useState('');

  return (
    <section className="stack">
      <Field label="Board name" htmlFor="share-name">
        <div className="row gap">
          <input
            id="share-name"
            className="input"
            value={name}
            maxLength={LIMITS.BOARD_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="btn btn-ghost"
            disabled={!name.trim() || name.trim() === details.name}
            onClick={() => void onSave({ name: name.trim() }, 'Renamed')}
          >
            Rename
          </button>
        </div>
      </Field>

      <Field label="Anyone with the code or link">
        <div className="segmented">
          {(
            [
              ['restricted', 'No access'],
              ['viewer', 'Can view'],
              ['editor', 'Can edit'],
            ] as [GeneralAccess, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              className={details.generalAccess === value ? 'active' : ''}
              onClick={() =>
                void onSave(
                  { generalAccess: value, ...(value === 'restricted' && { listed: false }) },
                  'Access updated',
                )
              }
            >
              {label}
            </button>
          ))}
        </div>
      </Field>

      {details.generalAccess !== 'restricted' && (
        <>
          <Field
            label="Board password"
            htmlFor="share-password"
            hint={
              details.hasPassword
                ? 'People opening the link must enter the password once.'
                : 'Optional. Handy for a class: share the code out loud and write the password on the board.'
            }
          >
            <div className="row gap">
              <input
                id="share-password"
                className="input"
                type="text"
                placeholder={details.hasPassword ? '•••••• (set)' : 'No password'}
                value={password}
                minLength={4}
                maxLength={LIMITS.BOARD_PASSWORD_MAX}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
              />
              <button
                className="btn btn-ghost"
                disabled={password.length < 4}
                onClick={() => void onSave({ password }, 'Password set').then(() => setPassword(''))}
              >
                Set
              </button>
              {details.hasPassword && (
                <button className="btn btn-ghost" onClick={() => void onSave({ password: null }, 'Password removed')}>
                  Remove
                </button>
              )}
            </div>
          </Field>
          <label className="check">
            <input
              type="checkbox"
              checked={details.listed}
              onChange={(e) =>
                void onSave({ listed: e.target.checked }, e.target.checked ? 'Listed publicly' : 'Unlisted')
              }
            />{' '}
            List this board on the public page
          </label>
        </>
      )}

      <label className="check">
        <input
          type="checkbox"
          checked={details.background === 'grid'}
          onChange={(e) => void onSave({ background: e.target.checked ? 'grid' : 'plain' }, 'Background updated')}
        />{' '}
        Graph-paper grid for everyone
      </label>
    </section>
  );
}

function InviteLinks({
  details,
  onChanged,
  copy,
}: {
  details: BoardDetails;
  onChanged: () => Promise<void>;
  copy: (text: string, what: string) => Promise<void>;
}) {
  const toast = useToast();
  const [role, setRole] = useState<MemberRole>('editor');
  const [expiry, setExpiry] = useState<string>('7');

  const create = async () => {
    try {
      const { token } = await api.createInvite(details.id, role, expiry === 'never' ? null : Number(expiry));
      await copy(inviteUrl(token), 'Invite link');
      await onChanged();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const revoke = async (token: string) => {
    try {
      await api.revokeInvite(details.id, token);
      await onChanged();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <section>
      <h3 className="section-title">Invite links</h3>
      <p className="muted small">Invite links add people as members, even when link access is off.</p>
      <div className="row gap wrap">
        <select
          className="input input-sm select"
          value={role}
          onChange={(e) => setRole(e.target.value as MemberRole)}
          aria-label="Invite role"
        >
          <option value="editor">Can edit</option>
          <option value="viewer">Can view</option>
        </select>
        <select
          className="input input-sm select"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          aria-label="Invite expiry"
        >
          <option value="1">Expires in 1 day</option>
          <option value="7">Expires in 7 days</option>
          <option value="30">Expires in 30 days</option>
          <option value="never">Never expires</option>
        </select>
        <button className="btn btn-primary btn-sm" onClick={() => void create()}>
          Create & copy link
        </button>
      </div>
      {!!details.invites?.length && (
        <ul className="invite-list">
          {details.invites.map((inv) => (
            <li key={inv.token}>
              <span className="role-chip">{inv.role}</span>
              <span className="muted small">
                {inv.uses} use{inv.uses === 1 ? '' : 's'} ·{' '}
                {inv.expiresAt ? `expires ${timeAgo(inv.expiresAt)}` : 'no expiry'}
              </span>
              <span className="spacer" />
              <button className="btn btn-ghost btn-sm" onClick={() => void copy(inviteUrl(inv.token), 'Invite link')}>
                Copy
              </button>
              <button className="btn btn-ghost btn-sm danger-text" onClick={() => void revoke(inv.token)}>
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
