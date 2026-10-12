import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
// src/config → backend root (works from both src/ and dist/)
dotenv.config({ path: path.resolve(here, '../../.env'), quiet: true });

const DEV_SECRET = 'syncboard-dev-secret-change-me-in-production-0000';

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),

    /** Comma-separated list of allowed browser origins. */
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    /** Public URL of the web app, used in email links. Defaults to the first CORS origin. */
    APP_URL: z.string().url().optional(),
    /** Express `trust proxy` setting — set to 1 behind a single load balancer so rate limits see real IPs. */
    TRUST_PROXY: z.string().optional(),

    MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/syncboard'),
    REDIS_URL: z.string().optional(),

    /** `JWT_SECRET` is accepted for backwards compatibility with older .env files. */
    JWT_ACCESS_SECRET: z.string().optional(),
    JWT_SECRET: z.string().optional(),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .default(15 * 60),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(30),
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    COOKIE_SECURE: bool.optional(),
    COOKIE_DOMAIN: z.string().optional(),

    GOOGLE_CLIENT_ID: z.string().optional(),

    /** e.g. smtps://user:pass@smtp.example.com:465 — when unset, emails are written to the log. */
    SMTP_URL: z.string().optional(),
    MAIL_FROM: z.string().default('SyncBoard <no-reply@syncboard.local>'),

    SENTRY_DSN: z.string().optional(),
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
    /** Bearer token required to scrape /metrics. Without it, /metrics is disabled in production. */
    METRICS_TOKEN: z.string().optional(),

    SOCKET_PING_TIMEOUT: z.coerce.number().int().positive().default(20_000),
    SOCKET_PING_INTERVAL: z.coerce.number().int().positive().default(25_000),
    SNAPSHOT_INTERVAL_MINUTES: z.coerce.number().int().min(1).default(10),
    SNAPSHOT_KEEP_AUTO: z.coerce.number().int().min(1).default(30),
  })
  .transform((raw) => {
    const isProd = raw.NODE_ENV === 'production';
    const corsOrigins = raw.CORS_ORIGIN.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const placeholderGoogle = !raw.GOOGLE_CLIENT_ID || raw.GOOGLE_CLIENT_ID === 'your-google-client-id-here';
    return {
      ...raw,
      isProd,
      isTest: raw.NODE_ENV === 'test',
      corsOrigins,
      appUrl: (raw.APP_URL ?? corsOrigins[0] ?? 'http://localhost:5173').replace(/\/$/, ''),
      jwtSecret: raw.JWT_ACCESS_SECRET ?? raw.JWT_SECRET ?? DEV_SECRET,
      cookieSecure: raw.COOKIE_SECURE ?? isProd,
      googleClientId: placeholderGoogle ? undefined : raw.GOOGLE_CLIENT_ID,
      logLevel: raw.LOG_LEVEL ?? (raw.NODE_ENV === 'test' ? 'silent' : isProd ? 'info' : 'debug'),
      trustProxy: parseTrustProxy(raw.TRUST_PROXY),
    };
  })
  .superRefine((env, ctx) => {
    if (!env.isProd) return;
    if (
      env.jwtSecret === DEV_SECRET ||
      env.jwtSecret.length < 32 ||
      /change[-_ ]?(me|in[-_ ]?production)/i.test(env.jwtSecret)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_ACCESS_SECRET'],
        message: 'Set a random JWT_ACCESS_SECRET of at least 32 characters in production',
      });
    }
    if (env.COOKIE_SAMESITE === 'none' && !env.cookieSecure) {
      ctx.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'SameSite=None cookies must be Secure' });
    }
  });

function parseTrustProxy(value: string | undefined): boolean | number | string {
  if (value === undefined || value === '') return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  const n = Number(value);
  return Number.isInteger(n) ? n : value;
}

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    // Logger depends on env, so this is the one place we write to stderr directly.
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = load();
export type Env = typeof env;
