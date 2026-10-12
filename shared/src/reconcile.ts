/**
 * Last-writer-wins reconciliation for versioned scene elements.
 *
 * Every edit bumps `version` and picks a random `versionNonce`. When two
 * clients produce the same version concurrently, the lower nonce wins — the
 * same rule Excalidraw uses, so client and server always converge on the same
 * element regardless of the order updates arrive in.
 */
export interface Versioned {
  id: string;
  version: number;
  versionNonce: number;
}

export function isNewer(incoming: Versioned, existing: Versioned | undefined | null): boolean {
  if (!existing) return true;
  if (incoming.version !== existing.version) return incoming.version > existing.version;
  return incoming.versionNonce < existing.versionNonce;
}

export interface MergeResult<T extends Versioned> {
  /** Resulting element set (input order preserved, new ids appended). */
  merged: T[];
  /** Incoming elements that replaced or added to the current set. */
  accepted: T[];
  /** Incoming elements that lost to what was already there. */
  rejected: T[];
}

export function mergeElements<T extends Versioned>(current: readonly T[], incoming: readonly T[]): MergeResult<T> {
  const byId = new Map<string, T>();
  for (const el of current) byId.set(el.id, el);

  const accepted: T[] = [];
  const rejected: T[] = [];
  for (const el of incoming) {
    if (isNewer(el, byId.get(el.id))) {
      byId.set(el.id, el);
      accepted.push(el);
    } else {
      rejected.push(el);
    }
  }
  return { merged: [...byId.values()], accepted, rejected };
}

/**
 * Elements whose version moved past what we last synced. Used by clients to
 * send only what changed, and on reconnect to push offline edits.
 */
export function changedSince<T extends Versioned>(elements: readonly T[], synced: ReadonlyMap<string, number>): T[] {
  return elements.filter((el) => (synced.get(el.id) ?? -1) < el.version);
}

/** Split a list into chunks that stay under a count and an approximate serialized size. */
export function chunkBySize<T>(items: readonly T[], maxCount: number, maxBytes: number): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  let bytes = 0;
  for (const item of items) {
    const size = JSON.stringify(item).length;
    if (current.length > 0 && (current.length >= maxCount || bytes + size > maxBytes)) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(item);
    bytes += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}
