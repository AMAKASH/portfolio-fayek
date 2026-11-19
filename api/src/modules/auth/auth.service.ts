import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { HttpError } from '../../lib/http-error.js';
import { logger } from '../../lib/logger.js';
import { UserModel } from '../users/user.model.js';

const BCRYPT_COST = 12;

let _dummy: string | undefined;
/** A real hash to compare against when the email doesn't exist (constant-ish timing). */
function dummyHash(): string {
  return (_dummy ??= bcrypt.hashSync('timing-equaliser', BCRYPT_COST));
}

interface AccessPayload {
  sub: string;
  email: string;
  typ: 'access';
}
interface RefreshPayload {
  sub: string;
  ver: number;
  typ: 'refresh';
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string };
}

function signAccess(userId: string, email: string): string {
  const payload: AccessPayload = { sub: userId, email, typ: 'access' };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TTL as SignOptions['expiresIn'] });
}

function signRefresh(userId: string, tokenVersion: number): string {
  const payload: RefreshPayload = { sub: userId, ver: tokenVersion, typ: 'refresh' };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: `${env.REFRESH_TTL_DAYS}d` });
}

export function verifyAccess(token: string): AccessPayload {
  try {
    const p = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
    if (p.typ !== 'access') throw new Error('wrong token type');
    return p;
  } catch {
    throw HttpError.unauthorized('Invalid or expired access token');
  }
}

export async function login(email: string, password: string): Promise<SessionTokens> {
  const user = await UserModel.findOne({ email }).select('+passwordHash');
  // Always run a compare so response time doesn't reveal whether the email exists.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? dummyHash());
  if (!user || !ok) throw HttpError.unauthorized('Invalid email or password');

  user.lastLoginAt = new Date();
  await user.save();
  const id = user.id as string;
  return {
    accessToken: signAccess(id, user.email),
    refreshToken: signRefresh(id, user.tokenVersion),
    user: { id, email: user.email },
  };
}

/**
 * Validates the refresh token and issues a new pair. The refresh token is
 * rotated on every call; logout/password-change bumps tokenVersion which
 * invalidates every previously issued refresh token at once.
 */
export async function refresh(refreshToken: string | undefined): Promise<SessionTokens> {
  if (!refreshToken) throw HttpError.unauthorized('No refresh token');
  let payload: RefreshPayload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as RefreshPayload;
    if (payload.typ !== 'refresh') throw new Error('wrong token type');
  } catch {
    throw HttpError.unauthorized('Invalid or expired session');
  }
  const user = await UserModel.findById(payload.sub).lean();
  if (!user || user.tokenVersion !== payload.ver) throw HttpError.unauthorized('Session revoked');
  const id = String(user._id);
  return {
    accessToken: signAccess(id, user.email),
    refreshToken: signRefresh(id, user.tokenVersion),
    user: { id, email: user.email },
  };
}

export async function revokeAll(userId: string): Promise<void> {
  await UserModel.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
}

export async function me(userId: string) {
  const user = await UserModel.findById(userId).lean();
  if (!user) throw HttpError.unauthorized('User no longer exists');
  return { id: String(user._id), email: user.email, lastLoginAt: user.lastLoginAt ?? null };
}

export async function changePassword(userId: string, current: string, next: string): Promise<SessionTokens> {
  const user = await UserModel.findById(userId).select('+passwordHash');
  if (!user) throw HttpError.unauthorized();
  if (!(await bcrypt.compare(current, user.passwordHash))) throw HttpError.badRequest('Current password is incorrect');
  user.passwordHash = await bcrypt.hash(next, BCRYPT_COST);
  user.tokenVersion += 1; // log out every other session
  await user.save();
  const id = user.id as string;
  return {
    accessToken: signAccess(id, user.email),
    refreshToken: signRefresh(id, user.tokenVersion),
    user: { id, email: user.email },
  };
}

/** Upsert the single admin. Used by the CLI script and by first-boot bootstrap. */
export async function setAdmin(email: string, password: string): Promise<'created' | 'updated'> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const existing = await UserModel.findOne();
  if (existing) {
    existing.email = email.toLowerCase();
    existing.passwordHash = passwordHash;
    existing.tokenVersion += 1;
    await existing.save();
    return 'updated';
  }
  await UserModel.create({ email, passwordHash });
  return 'created';
}

/** On boot: if no admin exists and ADMIN_EMAIL/ADMIN_PASSWORD are set, create it. Never overwrites. */
export async function bootstrapAdmin(): Promise<void> {
  if ((await UserModel.estimatedDocumentCount()) > 0) return;
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    logger.warn('No admin user exists. Set ADMIN_EMAIL and ADMIN_PASSWORD or run `npm run admin:create`.');
    return;
  }
  if (env.ADMIN_PASSWORD.length < 10) {
    logger.error('ADMIN_PASSWORD must be at least 10 characters; admin not created.');
    return;
  }
  await setAdmin(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
  logger.info({ email: env.ADMIN_EMAIL }, 'Admin user created from env');
}
