// node --test scripts/antispam.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSubmission, createFormToken, clientIp, withinRateLimit } from '../lib/antispam.ts';
import { HONEYPOT_FIELD, TOKEN_FIELD } from '../lib/antispam.shared.ts';

process.env.RESERVATION_FORM_SECRET ||= 'rahasia-untuk-test';

/** Token dengan umur tertentu, ditandatangani seperti aslinya. */
function agedToken(ageMs: number) {
  const real = createFormToken();
  const [issued] = real.split('.');
  // Tanda tangan hanya sah untuk timestamp-nya sendiri, jadi tidak bisa
  // digeser tanpa memalsukan HMAC — itu justru yang mau kita buktikan.
  return { real, forged: `${Number(issued) - ageMs}.${real.split('.')[1]}` };
}

function form(token: string, honeypot = '') {
  const fd = new FormData();
  fd.set(TOKEN_FIELD, token);
  fd.set(HONEYPOT_FIELD, honeypot);
  return fd;
}

test('honeypot terisi -> ditolak', () => {
  const r = checkSubmission(form(createFormToken(), 'http://spam.example'), '1.1.1.1');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'honeypot');
});

test('token kosong atau ngawur -> ditolak', () => {
  for (const t of ['', 'bukan-token', '123.abc']) {
    const r = checkSubmission(form(t), '2.2.2.2');
    assert.equal(r.ok, false, `token=${t}`);
    assert.equal(r.reason, 'token');
  }
});

test('timestamp yang digeser tanpa tanda tangan baru -> ditolak', () => {
  const { forged } = agedToken(10_000);
  const r = checkSubmission(form(forged), '3.3.3.3');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'token');
});

test('submit lebih cepat dari 3 detik -> ditolak', () => {
  const r = checkSubmission(form(createFormToken()), '4.4.4.4');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'token');
});

test('token sah + jeda manusiawi -> lolos, lalu kena rate limit di ke-6', async () => {
  const tokens = Array.from({ length: 6 }, createFormToken);
  await new Promise((r) => setTimeout(r, 3_100));

  for (let i = 0; i < 5; i++) {
    assert.equal(checkSubmission(form(tokens[i]), '5.5.5.5').ok, true, `submit ke-${i + 1}`);
  }
  const sixth = checkSubmission(form(tokens[5]), '5.5.5.5');
  assert.equal(sixth.ok, false);
  assert.equal(sixth.reason, 'rate-limit');

  // IP lain tidak ikut kena.
  assert.equal(checkSubmission(form(tokens[0]), '6.6.6.6').ok, true);
});

test('clientIp ambil IP pertama dari x-forwarded-for', () => {
  const h = new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' });
  assert.equal(clientIp(h), '203.0.113.9');
  assert.equal(clientIp(new Headers()), 'unknown');
});

test('withinRateLimit memisahkan jatah per kunci', () => {
  for (let i = 0; i < 3; i++) assert.equal(withinRateLimit('a:1.2.3.4', 3, 60_000), true);
  assert.equal(withinRateLimit('a:1.2.3.4', 3, 60_000), false);
  assert.equal(withinRateLimit('b:1.2.3.4', 3, 60_000), true, 'kunci lain tidak ikut habis');
});
