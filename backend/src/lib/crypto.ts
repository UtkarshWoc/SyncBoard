import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { customAlphabet } from 'nanoid';
import { BOARD_ID_ALPHABET, BOARD_ID_LENGTH } from '@syncboard/shared';

/** URL-safe random token for refresh tokens, email links and invites. */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

/** Tokens are stored hashed so a database leak doesn't hand out live sessions. */
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export const safeEqual = (a: string, b: string) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
};

export const newBoardId = customAlphabet(BOARD_ID_ALPHABET, BOARD_ID_LENGTH);
