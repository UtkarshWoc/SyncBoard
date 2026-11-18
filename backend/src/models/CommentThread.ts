import { Schema, model } from 'mongoose';

const authorFields = {
  authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  authorAvatarUrl: { type: String, default: null },
};

const commentSchema = new Schema(
  {
    ...authorFields,
    text: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

/** A comment pinned to a point on the canvas (scene coordinates), with replies. */
const commentThreadSchema = new Schema(
  {
    boardId: { type: String, required: true, index: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    resolved: { type: Boolean, default: false },
    ...authorFields,
    comments: { type: [commentSchema], default: [] },
  },
  { timestamps: true },
);

export const CommentThread = model('CommentThread', commentThreadSchema);
