import type { CookieOptions, Request, Response } from 'express';
import { env, isProd } from '../../config/env.js';
import * as auth from './auth.service.js';

export const REFRESH_COOKIE = 'pf_rt';

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/v1/auth',
    domain: env.COOKIE_DOMAIN,
    maxAge: env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

function sendSession(res: Response, s: auth.SessionTokens) {
  res.cookie(REFRESH_COOKIE, s.refreshToken, cookieOptions());
  res.json({ accessToken: s.accessToken, user: s.user });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email: string; password: string };
  sendSession(res, await auth.login(email, password));
}

export async function refresh(req: Request, res: Response) {
  try {
    sendSession(res, await auth.refresh(req.cookies?.[REFRESH_COOKIE]));
  } catch (e) {
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
    throw e;
  }
}

export async function logout(req: Request, res: Response) {
  // Best effort: revoke if the refresh cookie is still valid, always clear it.
  try {
    const s = await auth.refresh(req.cookies?.[REFRESH_COOKIE]);
    await auth.revokeAll(s.user.id);
  } catch {
    /* already invalid */
  }
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  res.json(await auth.me(req.auth!.userId));
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  sendSession(res, await auth.changePassword(req.auth!.userId, currentPassword, newPassword));
}
