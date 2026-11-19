import { z } from 'zod';

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const stripSlash = (v: string) => v.replace(/\/+$/, '');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  LOG_LEVEL: z.string().default('info'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:4200')
    .transform((v) =>
      v
        .split(',')
        .map((s) => stripSlash(s.trim()))
        .filter(Boolean),
    ),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGO_MAX_POOL: z.coerce.number().int().positive().default(10),
  MONGO_AUTO_INDEX: bool,

  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'must be at least 32 characters'),
  ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  COOKIE_DOMAIN: optionalString,

  ADMIN_EMAIL: optionalString.pipe(z.string().email().optional()),
  ADMIN_PASSWORD: optionalString,

  AWS_REGION: z.string().default('ap-south-1'),
  AWS_ACCESS_KEY_ID: optionalString,
  AWS_SECRET_ACCESS_KEY: optionalString,
  AWS_SESSION_TOKEN: optionalString,
  S3_BUCKET: optionalString,
  S3_PREFIX: z
    .string()
    .default('uploads')
    .transform((v) => v.replace(/^\/+|\/+$/g, '')),
  CLOUDFRONT_URL: optionalString.transform((v) => (v ? stripSlash(v) : undefined)),

  MAX_IMAGE_MB: z.coerce.number().positive().default(20),
  MAX_VIDEO_MB: z.coerce.number().positive().default(500),

  PUBLIC_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(60),
  PUBLIC_SITE_URL: z.string().default('http://localhost:4200').transform(stripSlash),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export type Env = typeof env;
