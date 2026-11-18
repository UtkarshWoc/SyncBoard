/**
 * Local MongoDB for development without installing MongoDB or Docker.
 * Data lives in ./.dev-db so it survives restarts.
 *
 *   npm run dev:memory-db -w @syncboard/backend
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

const dbPath = process.env.DEV_DB_PATH ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.dev-db');
mkdirSync(dbPath, { recursive: true });

const port = Number(process.env.DEV_DB_PORT ?? 27017);
const server = await MongoMemoryServer.create({ instance: { port, dbPath, storageEngine: 'wiredTiger' } });
console.log(`MongoDB ready at ${server.getUri('syncboard')}  (data: ${dbPath})`);
console.log('Press Ctrl+C to stop.');

const stop = async () => {
  await server.stop({ doCleanup: false });
  process.exit(0);
};
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
