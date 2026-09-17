import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateResetToken,
  hashResetToken,
  verifyResetToken,
  resetTokenExpiresAt,
  isResetTokenExpired,
} from '../lib/admin/password-reset.ts';

test('generateResetToken menghasilkan token unik tiap panggilan', () => {
  const a = generateResetToken();
  const b = generateResetToken();
  assert.notEqual(a, b);
  assert.ok(a.length > 20);
});

test('hashResetToken lalu verifyResetToken cocok untuk token yang sama', () => {
  const token = generateResetToken();
  const hash = hashResetToken(token);
  assert.equal(verifyResetToken(token, hash), true);
});

test('verifyResetToken gagal untuk token yang salah', () => {
  const hash = hashResetToken(generateResetToken());
  assert.equal(verifyResetToken('token-salah', hash), false);
});

test('resetTokenExpiresAt menghasilkan waktu 30 menit ke depan', () => {
  const expires = new Date(resetTokenExpiresAt()).getTime();
  const now = Date.now();
  assert.ok(expires > now + 29 * 60_000);
  assert.ok(expires < now + 31 * 60_000);
});

test('isResetTokenExpired true untuk waktu di masa lalu', () => {
  assert.equal(isResetTokenExpired(new Date(Date.now() - 1000).toISOString()), true);
});

test('isResetTokenExpired false untuk waktu di masa depan', () => {
  assert.equal(isResetTokenExpired(new Date(Date.now() + 1000).toISOString()), false);
});
