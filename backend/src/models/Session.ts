import type { Types } from 'mongoose';
import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * A refresh-token session. Tokens rotate on every refresh; all tokens issued
 * from one login share a `familyId`, so reuse of a rotated token (a sign of
 * theft) can revoke the whole family.
 */
const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    rotatedAt: { type: Date, default: null },
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: true },
);

// Expired sessions clean themselves up.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionFields = InferSchemaType<typeof sessionSchema> & { userId: Types.ObjectId };
export const Session = model('Session', sessionSchema);
