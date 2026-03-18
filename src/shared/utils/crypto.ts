import { createHash, randomBytes } from 'crypto';

/**
 * Hash a value with SHA-256. Used for storing API keys and refresh tokens.
 * Never store raw tokens — always store the hash.
 */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Generate a cryptographically random hex string of the given byte length.
 */
export function randomHex(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Generate a random API key with the given prefix.
 * Returns { raw, hashed } — store only hashed, return raw once to the caller.
 */
export function generateApiKey(prefix: string): { raw: string; hashed: string } {
  const raw = `${prefix}${randomHex(32)}`;
  const hashed = sha256(raw);
  return { raw, hashed };
}

/**
 * Safe string comparison to prevent timing attacks.
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
