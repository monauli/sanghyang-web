// node --test scripts/admin-auth.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../lib/admin/password.ts';
import { SignJWT } from 'jose';
import { createSessionToken, verifySessionToken } from '../lib/admin/session.ts';

process.env.ADMIN_SESSION_SECRET ||= 'rahasia-test-admin-session-panjang-banget';

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

test('createSessionToken lalu verifySessionToken -> payload sesuai', async () => {
  const token = await createSessionToken({
    sub: 'admin-1',
    email: 'staff@sanghyang.com',
    role: 'owner',
    outletId: null,
    serviceId: null,
  });
  const payload = await verifySessionToken(token);
  assert.deepEqual(payload, {
    sub: 'admin-1',
    email: 'staff@sanghyang.com',
    role: 'owner',
    outletId: null,
    serviceId: null,
  });
});

test('token kadaluarsa -> verifySessionToken menolak', async () => {
  const secret = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET);
  const expired = await new SignJWT({ sub: 'admin-1', email: 'staff@sanghyang.com' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('-10s')
    .sign(secret);
  assert.equal(await verifySessionToken(expired), null);
});

test('token dengan secret berbeda -> verifySessionToken menolak', async () => {
  const wrongSecret = new TextEncoder().encode('secret-yang-salah-sama-sekali');
  const token = await new SignJWT({ sub: 'admin-1', email: 'staff@sanghyang.com' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(wrongSecret);
  assert.equal(await verifySessionToken(token), null);
});

test('sesi pemilik: role owner, outletId null', async () => {
  const token = await createSessionToken({
    sub: 'admin-1',
    email: 'owner@sanghyang.com',
    role: 'owner',
    outletId: null,
    serviceId: null,
  });
  assert.deepEqual(await verifySessionToken(token), {
    sub: 'admin-1',
    email: 'owner@sanghyang.com',
    role: 'owner',
    outletId: null,
    serviceId: null,
  });
});

test('sesi captain: role captain, outletId & serviceId terisi', async () => {
  const token = await createSessionToken({
    sub: 'admin-2',
    email: 'dbc@sanghyang.com',
    role: 'captain',
    outletId: 'outlet-dbc',
    serviceId: 'service-dbc',
  });
  const payload = await verifySessionToken(token);
  assert.equal(payload?.role, 'captain');
  assert.equal(payload?.outletId, 'outlet-dbc');
  assert.equal(payload?.serviceId, 'service-dbc');
});

test('sesi lama tanpa role -> ditolak', async () => {
  const secret = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET);
  const lama = await new SignJWT({ sub: 'admin-1', email: 'staff@sanghyang.com' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
  assert.equal(await verifySessionToken(lama), null);
});

test('role di luar owner/captain -> ditolak', async () => {
  const secret = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET);
  const aneh = await new SignJWT({
    sub: 'admin-1',
    email: 'staff@sanghyang.com',
    role: 'superadmin',
    outletId: null,
    serviceId: null,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
  assert.equal(await verifySessionToken(aneh), null);
});

test('captain tanpa serviceId -> ditolak', async () => {
  const secret = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET);
  const cacat = await new SignJWT({
    sub: 'admin-2',
    email: 'dbc@sanghyang.com',
    role: 'captain',
    outletId: 'outlet-dbc',
    serviceId: null,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
  assert.equal(await verifySessionToken(cacat), null);
});
