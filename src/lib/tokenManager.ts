// Simple in-memory token blacklist manager
// NOTE: This is suitable for single-instance deployments or local dev.
// For production (multiple instances), use Redis or a shared store.

type RevokedEntry = {
  expiresAt: number; // unix seconds
};

const revokedTokens = new Map<string, RevokedEntry>();

// Periodically clean up expired entries
const CLEANUP_INTERVAL_MS = 1000 * 60 * 5; // 5 minutes
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [token, entry] of revokedTokens.entries()) {
    if (entry.expiresAt <= now) revokedTokens.delete(token);
  }
}, CLEANUP_INTERVAL_MS).unref();

export function revokeToken(token: string, expiresAtUnix?: number) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = expiresAtUnix ?? now + 60 * 60 * 24 * 7; // default 7 days
  revokedTokens.set(token, { expiresAt });
}

export function isTokenRevoked(token: string): boolean {
  const entry = revokedTokens.get(token);
  if (!entry) return false;
  const now = Math.floor(Date.now() / 1000);
  if (entry.expiresAt <= now) {
    revokedTokens.delete(token);
    return false;
  }
  return true;
}

export function clearRevokedTokens() {
  revokedTokens.clear();
}
