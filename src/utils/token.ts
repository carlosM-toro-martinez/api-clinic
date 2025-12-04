import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import { isTokenRevoked } from '../lib/tokenManager';

/**
 * Verify a JWT and return payload or throw error from jwt.verify
 */
export function verifyToken(token: string, secret: string): JwtPayload | string {
  return jwt.verify(token, secret);
}

/**
 * Decode token (no verify) and return payload or null
 */
export function decodeToken(token: string): JwtPayload | null {
  const decoded = jwt.decode(token);
  return (decoded as JwtPayload) ?? null;
}

/**
 * Check whether token is expired by reading `exp` in payload
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload) return true;
  const exp = typeof payload.exp === 'number' ? payload.exp : undefined;
  if (!exp) return true; // treat tokens without exp as expired
  const now = Math.floor(Date.now() / 1000);
  return exp <= now;
}

/**
 * Returns true if token is valid (signature + not expired + not revoked)
 */
export function isTokenValid(token: string, secret: string): boolean {
  try {
    // check revoked first (cheaper)
    if (isTokenRevoked(token)) return false;
    // verify signature and exp
    jwt.verify(token, secret);
    return true;
  } catch (err) {
    return false;
  }
}

export function getTokenExpiry(token: string): number | null {
  const payload = decodeToken(token);
  if (!payload) return null;
  return typeof payload.exp === 'number' ? payload.exp : null;
}
