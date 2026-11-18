import { createServer } from 'node:http';
import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { env } from './config/env.js';
import { attachRedisAdapter, type RedisHandle } from './config/redis.js';
import { startSnapshotJob } from './jobs/snapshots.js';
import { logger } from './lib/logger.js';
import { createSocketServer } from './socket/index.js';
import { createRealtime } from './socket/realtime.js';

async function main() {
  await connectDB(env.MONGODB_URI);

  const httpServer = createServer();
  const io = createSocketServer(httpServer);
  let redis: RedisHandle | null = null;
  if (env.REDIS_URL) redis = await attachRedisAdapter(io, env.REDIS_URL);

  const realtime = createRealtime(io);
  const app = createApp({ realtime, redisReady: async () => (redis ? redis.ready() : null) });
  httpServer.on('request', app);

  const stopSnapshots = startSnapshotJob(realtime);

  httpServer.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, origins: env.corsOrigins, redis: Boolean(redis) },
      'SyncBoard API listening',
    );
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    stopSnapshots();
    // io.close() also closes the HTTP server; disconnects trigger the usual leave cleanup.
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await redis?.close();
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'Unhandled promise rejection'));

main().catch((err: unknown) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
