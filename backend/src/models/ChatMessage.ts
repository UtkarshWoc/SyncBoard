import { Schema, model } from 'mongoose';

const chatMessageSchema = new Schema(
  {
    boardId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Author name/avatar are snapshotted so history renders without a join.
    displayName: { type: String, required: true },
    avatarUrl: { type: String, default: null },
    text: { type: String, required: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

chatMessageSchema.index({ boardId: 1, _id: -1 });
chatMessageSchema.index({ userId: 1 });

export const ChatMessage = model('ChatMessage', chatMessageSchema);
