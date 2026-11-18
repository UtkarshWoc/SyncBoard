import { Types } from 'mongoose';
import type { AuthUser, UserStats } from '@syncboard/shared';
import { notFound } from '../lib/errors.js';
import { toAuthUser } from '../lib/serialize.js';
import { AuthToken } from '../models/AuthToken.js';
import { Board } from '../models/Board.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { CommentThread } from '../models/CommentThread.js';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import { deleteBoard } from './boardService.js';

export async function getUser(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');
  return user;
}

export async function getProfile(userId: string): Promise<{ user: AuthUser; stats: UserStats }> {
  const user = await getUser(userId);
  const boardsJoined = await Board.countDocuments({ 'members.userId': user._id });
  return {
    user: toAuthUser(user),
    stats: {
      boardsCreated: user.stats?.boardsCreated ?? 0,
      boardsJoined,
      messagesSent: user.stats?.messagesSent ?? 0,
      timeCollaboratingMs: user.stats?.timeCollaboratingMs ?? 0,
    },
  };
}

export async function updateDisplayName(userId: string, displayName: string): Promise<AuthUser> {
  const user = await getUser(userId);
  user.displayName = displayName;
  await user.save();
  return toAuthUser(user);
}

export async function addCollaborationTime(userId: string, ms: number): Promise<void> {
  if (ms <= 0) return;
  // Cap a single session at 12h so a tab left open over a weekend doesn't skew stats.
  await User.updateOne({ _id: userId }, { $inc: { 'stats.timeCollaboratingMs': Math.min(ms, 12 * 3_600_000) } });
}

/**
 * Delete the account and everything it owns. Messages and comments left on
 * other people's boards are kept but anonymised so conversations still make sense.
 */
export async function deleteAccount(userId: string): Promise<string[]> {
  const uid = new Types.ObjectId(userId);
  const owned = await Board.find({ ownerId: uid }, { _id: 1 });
  for (const board of owned) await deleteBoard(board._id);

  await Promise.all([
    Board.updateMany({ 'members.userId': uid }, { $pull: { members: { userId: uid } } }),
    Board.updateMany({ mutedUserIds: uid }, { $pull: { mutedUserIds: uid } }),
    ChatMessage.updateMany({ userId: uid }, { $set: { displayName: 'Deleted user', avatarUrl: null } }),
    CommentThread.updateMany({ authorId: uid }, { $set: { authorName: 'Deleted user', authorAvatarUrl: null } }),
    CommentThread.updateMany(
      { 'comments.authorId': uid },
      { $set: { 'comments.$[c].authorName': 'Deleted user', 'comments.$[c].authorAvatarUrl': null } },
      { arrayFilters: [{ 'c.authorId': uid }] },
    ),
    Session.deleteMany({ userId: uid }),
    AuthToken.deleteMany({ userId: uid }),
  ]);
  await User.deleteOne({ _id: uid });
  return owned.map((b) => b._id);
}
