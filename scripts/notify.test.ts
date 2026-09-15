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

import { buildReservationNotice } from '../lib/notify/reservation-notice.ts';

const RESERVASI = {
  id: 'res-1',
  customer_name: 'Budi Santoso',
  customer_email: 'budi@example.com',
  customer_phone: '0812 3456 7890',
  reservation_date: '2026-10-12',
  checkout_date: null,
  guests: 4,
  notes: 'Minta meja dekat pantai',
  item_name: 'Paket BBQ',
};

test('subjek memuat nama outlet dan tanggal', () => {
  const notice = buildReservationNotice({
    outletName: 'Dragon Beach Club',
    dashboardUrl: 'https://contoh.test/panel-sanghyang/reservasi',
    reservation: RESERVASI,
  });
  assert.match(notice.subject, /Dragon Beach Club/);
  assert.match(notice.subject, /12 Okt(ober)? 2026/);
});

test('badan email memuat seluruh data tamu', () => {
  const { html, text } = buildReservationNotice({
    outletName: 'Dragon Beach Club',
    dashboardUrl: 'https://contoh.test/panel-sanghyang/reservasi',
    reservation: RESERVASI,
  });
  for (const isi of ['Budi Santoso', 'budi@example.com', '0812 3456 7890', '4', 'Paket BBQ', 'Minta meja dekat pantai']) {
    assert.ok(html.includes(isi), `html harus memuat ${isi}`);
    assert.ok(text.includes(isi), `text harus memuat ${isi}`);
  }
});

test('tombol WhatsApp memakai nomor yang sudah dinormalkan', () => {
  const { html } = buildReservationNotice({
    outletName: 'Dragon Beach Club',
    dashboardUrl: 'https://contoh.test/panel-sanghyang/reservasi',
    reservation: RESERVASI,
  });
  assert.ok(html.includes('https://wa.me/6281234567890?text='));
});

test('nomor tidak valid -> tombol WhatsApp tidak muncul, email tetap jadi', () => {
  const { html } = buildReservationNotice({
    outletName: 'D\'Spa',
    dashboardUrl: 'https://contoh.test/panel-sanghyang/reservasi',
    reservation: { ...RESERVASI, customer_phone: 'abc' },
  });
  assert.ok(!html.includes('wa.me'));
  assert.ok(html.includes('Budi Santoso'));
});

test('data tamu di-escape supaya tidak jadi HTML', () => {
  const { html } = buildReservationNotice({
    outletName: 'Dragon Beach Club',
    dashboardUrl: 'https://contoh.test/panel-sanghyang/reservasi',
    reservation: { ...RESERVASI, customer_name: '<script>x</script>' },
  });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('checkout_date ikut ditampilkan kalau ada', () => {
  const { text } = buildReservationNotice({
    outletName: 'Dragon Beach Club',
    dashboardUrl: 'https://contoh.test/panel-sanghyang/reservasi',
    reservation: { ...RESERVASI, checkout_date: '2026-10-14' },
  });
  assert.match(text, /14 Okt(ober)? 2026/);
});
