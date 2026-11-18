import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, beforeAll, inject } from 'vitest';

beforeAll(async () => {
  const url = new URL(inject('mongoUri'));
  url.pathname = `/sb_test_${randomUUID().slice(0, 8)}`;
  await mongoose.connect(url.toString());
  await mongoose.connection.syncIndexes();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.disconnect();
});
