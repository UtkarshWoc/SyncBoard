import { Types, isValidObjectId } from 'mongoose';
import { LIMITS, type ChatMessage as ChatMessageDTO, type PublicUser } from '@syncboard/shared';
import { HttpError, forbidden, notFound } from '../lib/errors.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { User } from '../models/User.js';

type ChatDoc = InstanceType<typeof ChatMessage>;

function toDTO(doc: ChatDoc): ChatMessageDTO {
  return {
    id: doc.id as string,
    boardId: doc.boardId,
    user: { id: doc.userId.toString(), displayName: doc.displayName, avatarUrl: doc.avatarUrl ?? null },
    text: doc.text,
    createdAt: (doc.get('createdAt') as Date).toISOString(),
  };
}

export async function sendMessage(
  boardId: string,
  user: PublicUser,
  text: string,
  mutedUserIds: string[],
): Promise<ChatMessageDTO> {
  if (mutedUserIds.includes(user.id)) throw new HttpError(403, 'MUTED', 'You have been muted on this board');
  const doc = await ChatMessage.create({
    boardId,
    userId: new Types.ObjectId(user.id),
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    text,
  });
  await User.updateOne({ _id: user.id }, { $inc: { 'stats.messagesSent': 1 } });
  return toDTO(doc);
}

/** Newest-first page, returned oldest-first for display. */
export async function history(
  boardId: string,
  before?: string,
): Promise<{ messages: ChatMessageDTO[]; hasMore: boolean }> {
  const filter: Record<string, unknown> = { boardId, deletedAt: null };
  if (before && isValidObjectId(before)) filter._id = { $lt: new Types.ObjectId(before) };
  const docs = await ChatMessage.find(filter)
    .sort({ _id: -1 })
    .limit(LIMITS.CHAT_PAGE_SIZE + 1);
  const hasMore = docs.length > LIMITS.CHAT_PAGE_SIZE;
  return { messages: docs.slice(0, LIMITS.CHAT_PAGE_SIZE).reverse().map(toDTO), hasMore };
}

export async function deleteMessage(boardId: string, messageId: string, byUserId: string, isOwner: boolean) {
  if (!isValidObjectId(messageId)) throw notFound('Message not found');
  const doc = await ChatMessage.findOne({ _id: messageId, boardId, deletedAt: null });
  if (!doc) throw notFound('Message not found');
  if (!isOwner && doc.userId.toString() !== byUserId) throw forbidden('You can only delete your own messages');
  doc.deletedAt = new Date();
  doc.deletedBy = new Types.ObjectId(byUserId);
  await doc.save();
}
