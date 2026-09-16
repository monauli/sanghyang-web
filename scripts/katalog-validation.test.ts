// node --conditions=react-server --test scripts/katalog-validation.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrice } from '../lib/katalog/validation.ts';

test('parsePrice: angka polos', () => {
  assert.equal(parsePrice('50000'), 50000);
});

test('parsePrice: dengan titik ribuan', () => {
  assert.equal(parsePrice('150.000'), 150000);
});

test('parsePrice: dengan prefix "Rp "', () => {
  assert.equal(parsePrice('Rp 75.000'), 75000);
});

test('parsePrice: nol boleh (item gratis)', () => {
  assert.equal(parsePrice('0'), 0);
});

test('parsePrice: kosong -> null', () => {
  assert.equal(parsePrice(''), null);
});

test('parsePrice: bukan angka sama sekali -> null', () => {
  assert.equal(parsePrice('gratis'), null);
});
