import type { LightMyRequestResponse } from 'fastify';
import { REFRESH_TOKEN_COOKIE } from '../../../src/shared/constants/index.js';

export function extractRefreshCookie(response: LightMyRequestResponse): string | null {
  const raw = response.headers['set-cookie'];
  if (!raw) return null;

  const cookies = Array.isArray(raw) ? raw : [raw];
  for (const cookie of cookies) {
    const match = cookie.match(new RegExp(`^${REFRESH_TOKEN_COOKIE}=([^;]+)`));
    if (match?.[1]) return match[1];
  }
  return null;
}

export function cookiesFor(refreshToken: string): Record<string, string> {
  return { [REFRESH_TOKEN_COOKIE]: refreshToken };
}
