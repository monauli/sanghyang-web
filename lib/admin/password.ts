import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LENGTH = 64;

/**
 * Format: scrypt:<salt-hex>:<hash-hex>. Salt unik per password, digabung
 * dalam satu string supaya tidak perlu kolom terpisah di database.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hashHex] = parts;

  try {
    const hash = scryptSync(password, salt, KEY_LENGTH);
    const storedHash = Buffer.from(hashHex, 'hex');
    if (hash.length !== storedHash.length) return false;
    return timingSafeEqual(hash, storedHash);
  } catch {
    return false;
  }
}
