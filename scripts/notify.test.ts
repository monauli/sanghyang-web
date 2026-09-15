// node --test scripts/notify.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, waLink } from '../lib/notify/wa-link.ts';

test('08xx -> 628xx', () => {
  assert.equal(normalizePhone('0812 3456 7890'), '6281234567890');
  assert.equal(normalizePhone('0812-3456-7890'), '6281234567890');
});

test('+62 dan 62 dipertahankan', () => {
  assert.equal(normalizePhone('+62 812 3456 7890'), '6281234567890');
  assert.equal(normalizePhone('6281234567890'), '6281234567890');
});

test('nomor tanpa 0 di depan dianggap lokal', () => {
  assert.equal(normalizePhone('81234567890'), '6281234567890');
});

test('nomor tidak valid -> null', () => {
  assert.equal(normalizePhone(''), null);
  assert.equal(normalizePhone('abc'), null);
  assert.equal(normalizePhone('0812'), null); // terlalu pendek
  assert.equal(normalizePhone('0812345678901234567890'), null); // terlalu panjang
});

test('waLink membentuk URL dengan pesan ter-encode', () => {
  const link = waLink('0812 3456 7890', 'Halo Budi, terima kasih & salam');
  assert.equal(
    link,
    'https://wa.me/6281234567890?text=Halo%20Budi%2C%20terima%20kasih%20%26%20salam'
  );
});

test('waLink -> null kalau nomor tidak bisa dinormalkan', () => {
  assert.equal(waLink('abc', 'Halo'), null);
});
