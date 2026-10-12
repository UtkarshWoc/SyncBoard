import { Schema, model } from 'mongoose';

/**
 * One document per scene element. Writes are conditional on the element's
 * version, which makes the database the single source of truth for
 * reconciliation and lets any server instance accept updates.
 */
const boardElementSchema = new Schema(
  {
    boardId: { type: String, required: true },
    elementId: { type: String, required: true },
    version: { type: Number, required: true },
    versionNonce: { type: Number, required: true },
    isDeleted: { type: Boolean, default: false },
    data: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: false, updatedAt: true }, minimize: false },
);

boardElementSchema.index({ boardId: 1, elementId: 1 }, { unique: true });

export const BoardElement = model('BoardElement', boardElementSchema);
