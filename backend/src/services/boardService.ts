import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import type {
  BoardDetails,
  BoardLists,
  BoardSummary,
  GeneralAccess,
  InvitePreview,
  MemberRole,
  PublicUser,
  Role,
  UpdateBoardInput,
} from '@syncboard/shared';
import { env } from '../config/env.js';
import { AttemptLimiter } from '../lib/attemptLimiter.js';
import { newBoardId, randomToken } from '../lib/crypto.js';
import { HttpError, badRequest, forbidden, notFound } from '../lib/errors.js';
import { iso, toPublicUser } from '../lib/serialize.js';
import { Board, type BoardDoc } from '../models/Board.js';
import { BoardElement } from '../models/BoardElement.js';
import { BoardFile } from '../models/BoardFile.js';
import { BoardVersion } from '../models/BoardVersion.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { CommentThread } from '../models/CommentThread.js';
import { User } from '../models/User.js';

const PASSWORD_ROUNDS = env.isTest ? 4 : 10;
const ROLE_RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };

export const atLeast = (role: Role | null | undefined, min: Role) => !!role && ROLE_RANK[role] >= ROLE_RANK[min];

export interface Access {
  role: Role | null;
  /** True when the general-access role is gated behind the board password. */
  needsPassword: boolean;
}

const sameId = (a: Types.ObjectId | null | undefined, b: string) => !!a && a.toString() === b;

export function resolveAccess(board: BoardDoc, userId: string): Access {
  if (sameId(board.ownerId, userId)) return { role: 'owner', needsPassword: false };
  const member = board.members.find((m) => sameId(m.userId, userId));
  if (member) return { role: member.role as MemberRole, needsPassword: false };
  if (board.generalAccess !== 'restricted') {
    if (board.passwordHash) return { role: null, needsPassword: true };
    return { role: board.generalAccess as MemberRole, needsPassword: false };
  }
  return { role: null, needsPassword: false };
}

export async function getBoard(boardId: string): Promise<BoardDoc> {
  const board = await Board.findById(boardId.toUpperCase());
  if (!board) throw notFound('Board not found');
  return board;
}

/** Load a board and assert the caller has at least `min`. Password-gated access counts as no access. */
export async function getBoardWithRole(boardId: string, userId: string, min: Role) {
  const board = await getBoard(boardId);
  const { role, needsPassword } = resolveAccess(board, userId);
  if (!atLeast(role, min)) {
    if (!role && needsPassword) throw new HttpError(403, 'PASSWORD_REQUIRED', 'This board is password protected');
    throw forbidden(min === 'owner' ? 'Only the board owner can do that' : 'You do not have access to this board');
  }
  return { board, role: role! };
}

async function usersById(ids: (Types.ObjectId | null | undefined)[]): Promise<Map<string, PublicUser>> {
  const unique = [...new Set(ids.filter(Boolean).map((id) => id!.toString()))];
  if (unique.length === 0) return new Map();
  const users = await User.find({ _id: { $in: unique } }, { displayName: 1, avatarUrl: 1 });
  return new Map(users.map((u) => [u.id as string, toPublicUser(u)]));
}

export function toSummary(board: BoardDoc, userId: string, owner: PublicUser | null, liveCount?: number): BoardSummary {
  return {
    id: board._id,
    name: board.name,
    owner,
    role: resolveAccess(board, userId).role,
    listed: board.listed,
    generalAccess: board.generalAccess as GeneralAccess,
    hasPassword: Boolean(board.passwordHash),
    background: board.background as BoardSummary['background'],
    thumbnail: board.thumbnail ?? null,
    createdAt: iso(board.get('createdAt'))!,
    lastActivityAt: iso(board.lastActivityAt)!,
    ...(liveCount !== undefined && { liveCount }),
  };
}

export async function summaryFor(board: BoardDoc, userId: string, liveCount?: number): Promise<BoardSummary> {
  const owners = await usersById([board.ownerId]);
  return toSummary(board, userId, board.ownerId ? (owners.get(board.ownerId.toString()) ?? null) : null, liveCount);
}

export async function details(board: BoardDoc, userId: string): Promise<BoardDetails> {
  const users = await usersById([board.ownerId, ...board.members.map((m) => m.userId)]);
  const role = resolveAccess(board, userId).role;
  const base = toSummary(board, userId, board.ownerId ? (users.get(board.ownerId.toString()) ?? null) : null);
  return {
    ...base,
    members: board.members
      .filter((m) => users.has(m.userId.toString()))
      .map((m) => ({ user: users.get(m.userId.toString())!, role: m.role as MemberRole, addedAt: iso(m.addedAt)! })),
    mutedUserIds: board.mutedUserIds.map((id) => id.toString()),
    ...(role === 'owner' && {
      invites: board.invites
        .filter((i) => !i.expiresAt || i.expiresAt > new Date())
        .map((i) => ({
          token: i.token,
          role: i.role as MemberRole,
          createdAt: iso(i.createdAt)!,
          expiresAt: iso(i.expiresAt),
          uses: i.uses,
        })),
    }),
  };
}

export async function listBoards(
  userId: string,
  liveCounts: (ids: string[]) => Promise<Map<string, number>>,
): Promise<BoardLists> {
  const uid = new Types.ObjectId(userId);
  const [owned, shared, listed] = await Promise.all([
    Board.find({ ownerId: uid }).sort({ lastActivityAt: -1 }).limit(200),
    Board.find({ 'members.userId': uid }).sort({ lastActivityAt: -1 }).limit(200),
    Board.find({ listed: true, ownerId: { $ne: uid }, 'members.userId': { $ne: uid } })
      .sort({ lastActivityAt: -1 })
      .limit(50),
  ]);
  const all = [...owned, ...shared, ...listed];
  const [owners, counts] = await Promise.all([usersById(all.map((b) => b.ownerId)), liveCounts(all.map((b) => b._id))]);
  const map = (boards: BoardDoc[]) =>
    boards.map((b) =>
      toSummary(b, userId, b.ownerId ? (owners.get(b.ownerId.toString()) ?? null) : null, counts.get(b._id) ?? 0),
    );
  return { owned: map(owned), shared: map(shared), public: map(listed) };
}

export async function createBoard(
  userId: string,
  input: { name: string; listed: boolean; generalAccess: GeneralAccess; background: BoardSummary['background'] },
): Promise<BoardDoc> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const board = await Board.create({ _id: newBoardId(), ownerId: new Types.ObjectId(userId), ...input });
      await User.updateOne({ _id: userId }, { $inc: { 'stats.boardsCreated': 1 } });
      return board;
    } catch (err) {
      // Duplicate code — astronomically rare, but retry rather than fail.
      if ((err as { code?: number }).code !== 11000) throw err;
    }
  }
  throw new Error('Could not allocate a board code');
}

export async function updateBoard(board: BoardDoc, input: UpdateBoardInput): Promise<BoardDoc> {
  if (input.name !== undefined) board.name = input.name;
  if (input.listed !== undefined) board.listed = input.listed;
  if (input.generalAccess !== undefined) board.generalAccess = input.generalAccess;
  if (input.background !== undefined) board.background = input.background;
  if (input.password !== undefined) {
    board.passwordHash = input.password === null ? null : await bcrypt.hash(input.password, PASSWORD_ROUNDS);
  }
  await board.save();
  return board;
}

export async function deleteBoard(boardId: string): Promise<void> {
  await Promise.all([
    BoardElement.deleteMany({ boardId }),
    BoardFile.deleteMany({ boardId }),
    BoardVersion.deleteMany({ boardId }),
    ChatMessage.deleteMany({ boardId }),
    CommentThread.deleteMany({ boardId }),
  ]);
  await Board.deleteOne({ _id: boardId });
}

/**
 * Unlock a password-protected board. On success the user becomes a member with
 * the board's general-access role, so they aren't asked again.
 */
// Board passwords are short and shared out loud in class, so guesses are tightly capped:
// per user per board, and per board across all users (to blunt multi-account guessing).
const userBoardAttempts = new AttemptLimiter(5, 15 * 60_000);
const boardAttempts = new AttemptLimiter(50, 60 * 60_000);

export async function unlockWithPassword(board: BoardDoc, userId: string, password: string): Promise<Role> {
  if (!board.passwordHash || board.generalAccess === 'restricted') throw forbidden();
  const userKey = `${userId}:${board._id}`;
  const tooMany = 'Too many incorrect passwords — try again later or ask the owner for an invite link';
  userBoardAttempts.assertAllowed(userKey, tooMany);
  boardAttempts.assertAllowed(board._id, tooMany);
  if (!(await bcrypt.compare(password, board.passwordHash))) {
    userBoardAttempts.fail(userKey);
    boardAttempts.fail(board._id);
    throw new HttpError(403, 'INVALID_PASSWORD', 'Incorrect board password');
  }
  userBoardAttempts.reset(userKey);
  const role = board.generalAccess as MemberRole;
  await Board.updateOne(
    { _id: board._id, 'members.userId': { $ne: new Types.ObjectId(userId) } },
    { $push: { members: { userId: new Types.ObjectId(userId), role, addedAt: new Date() } } },
  );
  return role;
}

export async function setMemberRole(board: BoardDoc, memberId: string, role: MemberRole): Promise<void> {
  const res = await Board.updateOne(
    { _id: board._id, 'members.userId': new Types.ObjectId(memberId) },
    { $set: { 'members.$.role': role } },
  );
  if (res.matchedCount === 0) throw notFound('Member not found');
}

export async function removeMember(board: BoardDoc, memberId: string): Promise<void> {
  if (sameId(board.ownerId, memberId)) throw badRequest('The owner cannot be removed from their board');
  await Board.updateOne({ _id: board._id }, { $pull: { members: { userId: new Types.ObjectId(memberId) } } });
}

export async function createInvite(
  board: BoardDoc,
  userId: string,
  role: MemberRole,
  expiresInDays: number | null,
): Promise<string> {
  if (board.invites.length >= 50) throw badRequest('Too many invite links — revoke some first');
  const token = randomToken(18);
  await Board.updateOne(
    { _id: board._id },
    {
      $push: {
        invites: {
          token,
          role,
          createdBy: new Types.ObjectId(userId),
          createdAt: new Date(),
          expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000) : null,
          uses: 0,
        },
      },
    },
  );
  return token;
}

export async function revokeInvite(board: BoardDoc, token: string): Promise<void> {
  await Board.updateOne({ _id: board._id }, { $pull: { invites: { token } } });
}

async function findInvite(token: string) {
  const board = await Board.findOne({ 'invites.token': token });
  const invite = board?.invites.find((i) => i.token === token);
  if (!board || !invite || (invite.expiresAt && invite.expiresAt <= new Date())) {
    throw notFound('This invite link is invalid or has expired');
  }
  return { board, invite };
}

export async function previewInvite(token: string): Promise<InvitePreview> {
  const { board, invite } = await findInvite(token);
  const owners = await usersById([board.ownerId]);
  return {
    boardId: board._id,
    boardName: board.name,
    role: invite.role as MemberRole,
    owner: board.ownerId ? (owners.get(board.ownerId.toString()) ?? null) : null,
  };
}

/** Accepting never downgrades someone who already has a higher role. */
export async function acceptInvite(token: string, userId: string): Promise<{ boardId: string; role: Role }> {
  const { board, invite } = await findInvite(token);
  const current = resolveAccess(board, userId);
  const inviteRole = invite.role as MemberRole;
  const isMember = board.members.some((m) => sameId(m.userId, userId));

  await Board.updateOne({ _id: board._id, 'invites.token': token }, { $inc: { 'invites.$.uses': 1 } });

  if (current.role === 'owner') return { boardId: board._id, role: 'owner' };
  if (isMember) {
    if (!atLeast(current.role, inviteRole)) await setMemberRole(board, userId, inviteRole);
    return { boardId: board._id, role: atLeast(current.role, inviteRole) ? current.role! : inviteRole };
  }
  await Board.updateOne(
    { _id: board._id, 'members.userId': { $ne: new Types.ObjectId(userId) } },
    { $push: { members: { userId: new Types.ObjectId(userId), role: inviteRole, addedAt: new Date() } } },
  );
  return { boardId: board._id, role: inviteRole };
}

export async function setMuted(board: BoardDoc, userId: string, muted: boolean): Promise<string[]> {
  if (sameId(board.ownerId, userId)) throw badRequest('The owner cannot be muted');
  const uid = new Types.ObjectId(userId);
  const updated = await Board.findByIdAndUpdate(
    board._id,
    muted ? { $addToSet: { mutedUserIds: uid } } : { $pull: { mutedUserIds: uid } },
    { returnDocument: 'after' },
  );
  return (updated?.mutedUserIds ?? []).map((id) => id.toString());
}

export async function setThumbnail(boardId: string, dataURL: string): Promise<void> {
  await Board.updateOne({ _id: boardId }, { $set: { thumbnail: dataURL } });
}

const lastTouch = new Map<string, number>();

/** Bump activity timestamps, at most every 10s per board per instance. */
export async function touchBoard(boardId: string, edited: boolean): Promise<void> {
  const key = `${boardId}:${edited ? 'e' : 'a'}`;
  const now = Date.now();
  if (now - (lastTouch.get(key) ?? 0) < 10_000) return;
  lastTouch.set(key, now);
  if (lastTouch.size > 10_000) lastTouch.clear();
  const date = new Date(now);
  await Board.updateOne(
    { _id: boardId },
    { $set: edited ? { lastActivityAt: date, lastEditedAt: date } : { lastActivityAt: date } },
  );
}
