import { logger } from '../lib/logger.js';
import type { Realtime } from '../lib/realtime.js';
import { runAutoSnapshots } from '../services/versionService.js';

/** Periodically snapshot edited boards into version history. Safe to run on every instance. */
export function startSnapshotJob(realtime: Realtime, everyMs = 60_000): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    runAutoSnapshots((boardId) => realtime.versionsUpdated(boardId))
      .then((count) => {
        if (count) logger.debug({ count }, 'Auto snapshots taken');
      })
      .catch((err: unknown) => logger.error({ err }, 'Snapshot job failed'))
      .finally(() => {
        running = false;
      });
  }, everyMs);
  timer.unref();
  return () => clearInterval(timer);
}
