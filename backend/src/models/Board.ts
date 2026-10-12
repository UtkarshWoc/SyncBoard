import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const memberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['editor', 'viewer'], required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const inviteSchema = new Schema(
  {
    token: { type: String, required: true },
    role: { type: String, enum: ['editor', 'viewer'], required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    uses: { type: Number, default: 0 },
  },
  { _id: false },
);

/**
 * A board is identified by its short shareable code (`_id`). Scene contents
 * live in BoardElement/BoardFile so this document stays small.
 */
const boardSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    /** Null only for boards migrated from the legacy anonymous rooms. */
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    listed: { type: Boolean, default: false },
    generalAccess: { type: String, enum: ['restricted', 'viewer', 'editor'], default: 'restricted' },
    passwordHash: { type: String, default: null },
    background: { type: String, enum: ['plain', 'grid', 'dots'], default: 'plain' },
    members: { type: [memberSchema], default: [] },
    invites: { type: [inviteSchema], default: [] },
    mutedUserIds: { type: [Schema.Types.ObjectId], default: [] },
    thumbnail: { type: String, default: null },
    lastActivityAt: { type: Date, default: Date.now },
    lastEditedAt: { type: Date, default: null },
    lastSnapshotAt: { type: Date, default: null },
  },
  { timestamps: true },
);

boardSchema.index({ 'members.userId': 1 });
boardSchema.index({ listed: 1, lastActivityAt: -1 });
boardSchema.index({ 'invites.token': 1 });
boardSchema.index({ lastEditedAt: 1, lastSnapshotAt: 1 });

export type BoardFields = InferSchemaType<typeof boardSchema>;
export type BoardDoc = HydratedDocument<BoardFields>;
export const Board = model('Board', boardSchema);
