import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, type RedisClientType } from 'redis';
import { logger } from '../lib/logger.js';
import type { IO } from '../socket/types.js';

export interface RedisHandle {
  ready: () => Promise<boolean>;
  close: () => Promise<void>;
}

/**
 * Attach the Redis adapter so several API instances share rooms and broadcasts.
 * Scene state already lives in MongoDB, so instances need nothing else in common.
 */
export async function attachRedisAdapter(io: IO, url: string): Promise<RedisHandle> {
  const pub = createClient({ url }) as RedisClientType;
  const sub = pub.duplicate();
  for (const [name, client] of [
    ['pub', pub],
    ['sub', sub],
  ] as const) {
    client.on('error', (err) => logger.error({ err, client: name }, 'Redis error'));
  }
  await Promise.all([pub.connect(), sub.connect()]);
  io.adapter(createAdapter(pub, sub));
  logger.info('Socket.IO Redis adapter attached');

  return {
    ready: async () => {
      try {
        return pub.isReady && (await pub.ping()) === 'PONG';
      } catch {
        return false;
      }
    },
    close: async () => {
      await Promise.allSettled([pub.quit(), sub.quit()]);
    },
  };
}
