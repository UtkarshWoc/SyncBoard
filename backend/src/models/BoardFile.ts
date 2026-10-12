import { Schema, model } from 'mongoose';

/** Binary files (images) referenced by image elements. Excalidraw file ids are content hashes. */
const boardFileSchema = new Schema(
  {
    boardId: { type: String, required: true },
    fileId: { type: String, required: true },
    mimeType: { type: String, required: true },
    data: { type: Buffer, required: true },
    size: { type: Number, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

boardFileSchema.index({ boardId: 1, fileId: 1 }, { unique: true });

export const BoardFile = model('BoardFile', boardFileSchema);
