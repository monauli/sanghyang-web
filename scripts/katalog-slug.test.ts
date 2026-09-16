// node --conditions=react-server --test scripts/katalog-slug.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, uniqueSlug } from '../lib/katalog/slug.ts';

test('slugify: nama biasa jadi lowercase-kebab', () => {
  assert.equal(slugify('Kids Club'), 'kids-club');
});

test('slugify: buang karakter aneh & spasi ganda', () => {
  assert.equal(slugify("D'Bistro & Bar!!"), 'd-bistro-bar');
});

test('slugify: nama kosong/simbol semua -> fallback "kategori"', () => {
  assert.equal(slugify('!!!'), 'kategori');
});

test('slugify: dipotong maksimal 60 karakter', () => {
  const panjang = 'a'.repeat(100);
  assert.equal(slugify(panjang).length, 60);
});

test('uniqueSlug: slug belum dipakai -> dipakai apa adanya', () => {
  assert.equal(uniqueSlug('kids-club', ['rooms', 'd-bistro']), 'kids-club');
});

test('uniqueSlug: slug sudah dipakai -> tambah -2', () => {
  assert.equal(uniqueSlug('kids-club', ['kids-club']), 'kids-club-2');
});

test('uniqueSlug: -2 juga sudah dipakai -> lanjut -3', () => {
  assert.equal(uniqueSlug('kids-club', ['kids-club', 'kids-club-2']), 'kids-club-3');
});
