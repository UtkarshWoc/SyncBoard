import { Schema, model } from 'mongoose';

/** A point-in-time snapshot of a board's live (non-deleted) elements, gzipped. */
const boardVersionSchema = new Schema(
  {
    boardId: { type: String, required: true },
    kind: { type: String, enum: ['auto', 'manual', 'pre-restore'], required: true },
    label: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    elementCount: { type: Number, required: true },
    elementsGz: { type: Buffer, required: true },
    thumbnail: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

boardVersionSchema.index({ boardId: 1, createdAt: -1 });

export const BoardVersion = model('BoardVersion', boardVersionSchema);
