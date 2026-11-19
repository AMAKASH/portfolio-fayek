import { S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';
import { HttpError } from './http-error.js';

let client: S3Client | null = null;

export function s3Configured(): boolean {
  return Boolean(env.S3_BUCKET && env.CLOUDFRONT_URL);
}

export function getS3(): S3Client {
  if (!s3Configured()) {
    throw HttpError.unavailable('File storage is not configured (set S3_BUCKET and CLOUDFRONT_URL)');
  }
  if (!client) {
    client = new S3Client({
      region: env.AWS_REGION,
      // Without explicit keys the SDK default chain (instance role, etc.) is used.
      ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: env.AWS_ACCESS_KEY_ID,
              secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
              ...(env.AWS_SESSION_TOKEN ? { sessionToken: env.AWS_SESSION_TOKEN } : {}),
            },
          }
        : {}),
    });
  }
  return client;
}

/** Test hook: inject a fake client. */
export function setS3(c: S3Client | null): void {
  client = c;
}

export function bucket(): string {
  if (!env.S3_BUCKET) throw HttpError.unavailable('S3_BUCKET is not configured');
  return env.S3_BUCKET;
}

export function publicUrlForKey(key: string): string {
  return `${env.CLOUDFRONT_URL}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
