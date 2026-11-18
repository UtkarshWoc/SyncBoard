import { MongoMemoryServer } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

let mongo: MongoMemoryServer | undefined;

export async function setup(project: TestProject) {
  // CI can point at a real MongoDB service instead of downloading a binary.
  const external = process.env.TEST_MONGODB_URI;
  if (external) {
    project.provide('mongoUri', external);
    return;
  }
  mongo = await MongoMemoryServer.create();
  project.provide('mongoUri', mongo.getUri());
}

export async function teardown() {
  await mongo?.stop();
}
