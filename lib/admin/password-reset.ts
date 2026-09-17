import { randomBytes } from 'crypto';
import { hashPassword, verifyPassword } from './password.ts';

const TOKEN_BYTES = 32;
const EXPIRY_MINUTES = 30;

/** Token asli — cuma pernah ada di URL email, TIDAK PERNAH disimpan polos di DB. */
export function generateResetToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** Reuse format hash password (scrypt:<salt>:<hash>) — token juga rahasia,
 *  aturan penyimpanannya sama. */
export function hashResetToken(token: string): string {
  return hashPassword(token);
}

export function verifyResetToken(token: string, stored: string): boolean {
  return verifyPassword(token, stored);
}

export function resetTokenExpiresAt(): string {
  return new Date(Date.now() + EXPIRY_MINUTES * 60_000).toISOString();
}

export function isResetTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}
