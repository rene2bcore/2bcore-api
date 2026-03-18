/**
 * Script: generate RSA-2048 key pair for JWT RS256 signing.
 * Usage: npm run generate:keys
 *
 * Outputs:
 *   keys/private.pem  — KEEP SECRET, never commit
 *   keys/public.pem   — Safe to share / embed in services that only verify
 */
import { generateKeyPairSync } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const KEYS_DIR = join(process.cwd(), 'keys');

mkdirSync(KEYS_DIR, { recursive: true });

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

writeFileSync(join(KEYS_DIR, 'private.pem'), privateKey, { mode: 0o600 });
writeFileSync(join(KEYS_DIR, 'public.pem'), publicKey, { mode: 0o644 });

console.log('✔ RSA key pair generated:');
console.log('  keys/private.pem  (secret — never commit)');
console.log('  keys/public.pem   (safe to distribute)');
