import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, default: null },
    displayName: { type: String, required: true, trim: true },
    googleId: { type: String, default: undefined, sparse: true, unique: true },
    avatarUrl: { type: String, default: null },
    emailVerified: { type: Boolean, default: false },
    stats: {
      boardsCreated: { type: Number, default: 0 },
      messagesSent: { type: Number, default: 0 },
      timeCollaboratingMs: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

export type UserFields = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserFields>;
export const User = model('User', userSchema);
