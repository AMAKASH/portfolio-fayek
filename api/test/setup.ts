import { afterAll, afterEach, beforeAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';

// env.ts validates at import time, so set everything before any app import.
Object.assign(process.env, {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://placeholder',
  JWT_ACCESS_SECRET: 'test-access-secret-0123456789-0123456789',
  JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789-0123456789',
  AWS_REGION: 'us-east-1',
  AWS_ACCESS_KEY_ID: 'AKIATESTTESTTEST',
  AWS_SECRET_ACCESS_KEY: 'testsecrettestsecrettestsecret',
  S3_BUCKET: 'test-bucket',
  CLOUDFRONT_URL: 'https://cdn.test',
  MAX_IMAGE_MB: '1',
  MAX_VIDEO_MB: '10',
  CORS_ORIGINS: 'http://localhost:4200',
});

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  const { default: mongoose } = await import('mongoose');
  await mongoose.connect(mongo.getUri());
  // Ensure unique indexes exist before tests rely on them.
  const { ProjectModel } = await import('../src/modules/projects/project.model.js');
  const { UserModel } = await import('../src/modules/users/user.model.js');
  const { MediaModel } = await import('../src/modules/media/media.model.js');
  await Promise.all([ProjectModel.init(), UserModel.init(), MediaModel.init()]);
});

afterEach(async () => {
  const { default: mongoose } = await import('mongoose');
  const { cache } = await import('../src/lib/cache.js');
  cache.clear();
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  const { default: mongoose } = await import('mongoose');
  await mongoose.disconnect();
  await mongo?.stop();
});
