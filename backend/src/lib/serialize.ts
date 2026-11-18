import type { AuthUser, PublicUser } from '@syncboard/shared';
import type { UserDoc } from '../models/User.js';

type UserLike = Pick<UserDoc, '_id' | 'displayName' | 'avatarUrl'>;

export function toPublicUser(user: UserLike): PublicUser {
  return { id: user._id.toString(), displayName: user.displayName, avatarUrl: user.avatarUrl ?? null };
}

export function toAuthUser(user: UserDoc): AuthUser {
  return {
    ...toPublicUser(user),
    email: user.email,
    emailVerified: user.emailVerified,
    hasPassword: Boolean(user.passwordHash),
    hasGoogle: Boolean(user.googleId),
    createdAt: (user.get('createdAt') as Date).toISOString(),
  };
}

export const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
