import { HttpError } from './errors.js';

interface Window {
  failures: number;
  resetAt: number;
}

/**
 * Counts failed attempts per key within a fixed window. Used for secrets that
 * are short by design (board passwords), where request-level rate limits alone
 * would still allow a meaningful number of guesses.
 *
 * In-memory, so limits apply per server instance; with N instances an attacker
 * gets at most N times the budget, which is still far too few for guessing.
 */
export class AttemptLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number,
  ) {}

  private current(key: string): Window | undefined {
    const w = this.windows.get(key);
    if (w && w.resetAt <= Date.now()) {
      this.windows.delete(key);
      return undefined;
    }
    return w;
  }

  /** Throws 429 when the key has used up its failures for this window. */
  assertAllowed(key: string, message: string): void {
    const w = this.current(key);
    if (w && w.failures >= this.maxFailures) {
      const retryAfterSec = Math.ceil((w.resetAt - Date.now()) / 1000);
      throw new HttpError(429, 'RATE_LIMITED', message, { retryAfterSec });
    }
  }

  fail(key: string): void {
    const w = this.current(key) ?? { failures: 0, resetAt: Date.now() + this.windowMs };
    w.failures += 1;
    this.windows.set(key, w);
    if (this.windows.size > 50_000) this.prune();
  }

  reset(key: string): void {
    this.windows.delete(key);
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, w] of this.windows) if (w.resetAt <= now) this.windows.delete(key);
  }
}
