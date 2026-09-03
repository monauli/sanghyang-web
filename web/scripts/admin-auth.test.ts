// node --test scripts/admin-auth.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../lib/admin/password.ts';

test('hashPassword lalu verifyPassword dengan password benar -> lolos', () => {
  const hash = hashPassword('supersecret123');
  assert.equal(verifyPassword('supersecret123', hash), true);
});

test('verifyPassword dengan password salah -> gagal', () => {
  const hash = hashPassword('supersecret123');
  assert.equal(verifyPassword('password-salah', hash), false);
});

test('dua hash dari password yang sama harus beda (salt unik)', () => {
  const a = hashPassword('supersecret123');
  const b = hashPassword('supersecret123');
  assert.notEqual(a, b);
  assert.equal(verifyPassword('supersecret123', a), true);
  assert.equal(verifyPassword('supersecret123', b), true);
});

test('verifyPassword menolak string yang bukan format scrypt kita', () => {
  assert.equal(verifyPassword('apa saja', 'bukan-hash-scrypt'), false);
  assert.equal(verifyPassword('apa saja', 'scrypt:cuma-dua-bagian'), false);
});
