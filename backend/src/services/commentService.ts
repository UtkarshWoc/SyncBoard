import { Types, isValidObjectId } from 'mongoose';
import { LIMITS, type CommentThread as CommentThreadDTO, type PublicUser } from '@syncboard/shared';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { CommentThread } from '../models/CommentThread.js';

type ThreadDoc = InstanceType<typeof CommentThread>;

const author = (d: { authorId: Types.ObjectId; authorName: string; authorAvatarUrl?: string | null }): PublicUser => ({
  id: d.authorId.toString(),
  displayName: d.authorName,
  avatarUrl: d.authorAvatarUrl ?? null,
});

function toDTO(doc: ThreadDoc): CommentThreadDTO {
  return {
    id: doc.id as string,
    boardId: doc.boardId,
    x: doc.x,
    y: doc.y,
    resolved: doc.resolved,
    createdBy: author(doc),
    createdAt: (doc.get('createdAt') as Date).toISOString(),
    comments: doc.comments.map((c) => ({
      id: c._id.toString(),
      author: author(c),
      text: c.text,
      createdAt: (c.get('createdAt') as Date).toISOString(),
    })),
  };
}

const authorFields = (user: PublicUser) => ({
  authorId: new Types.ObjectId(user.id),
  authorName: user.displayName,
  authorAvatarUrl: user.avatarUrl,
});

async function findThread(boardId: string, threadId: string): Promise<ThreadDoc> {
  if (!isValidObjectId(threadId)) throw notFound('Comment not found');
  const doc = await CommentThread.findOne({ _id: threadId, boardId });
  if (!doc) throw notFound('Comment not found');
  return doc;
}

export async function listThreads(boardId: string): Promise<CommentThreadDTO[]> {
  const docs = await CommentThread.find({ boardId }).sort({ createdAt: 1 }).limit(500);
  return docs.map(toDTO);
}

export async function createThread(boardId: string, user: PublicUser, x: number, y: number, text: string) {
  const doc = await CommentThread.create({
    boardId,
    x,
    y,
    ...authorFields(user),
    comments: [{ ...authorFields(user), text }],
  });
  return toDTO(doc);
}

export async function reply(boardId: string, threadId: string, user: PublicUser, text: string) {
  const doc = await findThread(boardId, threadId);
  if (doc.comments.length >= LIMITS.COMMENT_REPLIES_MAX) throw badRequest('This thread has too many replies');
  doc.comments.push({ ...authorFields(user), text });
  // Replying to a resolved thread reopens it.
  doc.resolved = false;
  await doc.save();
  return toDTO(doc);
}

export async function setResolved(boardId: string, threadId: string, resolved: boolean) {
  const doc = await findThread(boardId, threadId);
  doc.resolved = resolved;
  await doc.save();
  return toDTO(doc);
}

export async function deleteThread(boardId: string, threadId: string, userId: string, canModerate: boolean) {
  const doc = await findThread(boardId, threadId);
  if (!canModerate && doc.authorId.toString() !== userId) throw forbidden('You can only delete your own comments');
  await doc.deleteOne();
}
