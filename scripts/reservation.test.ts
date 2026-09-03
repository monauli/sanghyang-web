// node --test scripts/reservation.test.ts   (Node >= 22, strip types bawaan)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReservationForm, todayJakarta } from '../lib/reservation.ts';

const SERVICE = '11111111-2222-3333-4444-555555555555';

function form(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const base: Record<string, string> = {
    customer_name: 'Budi Santoso',
    customer_email: 'budi@example.com',
    customer_phone: '0812 3456 7890',
    service_id: SERVICE,
    reservation_date: todayJakarta(),
    guests: '2',
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) if (v !== '') fd.set(k, v);
  return fd;
}

test('form yang benar lolos', () => {
  const r = parseReservationForm(form());
  assert.ok(r.ok);
  assert.equal(r.data.customer_name, 'Budi Santoso');
  assert.equal(r.data.service_item_id, null);
  assert.equal(r.data.exely_room_type_id, null);
});

test('tanggal di masa lalu ditolak', () => {
  const r = parseReservationForm(form({ reservation_date: '2020-01-01' }));
  assert.equal(r.ok, false);
  assert.match(r.errors.reservation_date!, /masa lalu/);
});

test('checkout harus setelah checkin', () => {
  const r = parseReservationForm(form({ checkout_date: '2020-01-01' }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.checkout_date);
});

test('email dan telepon ngawur ditolak', () => {
  const r = parseReservationForm(form({ customer_email: 'bukan-email', customer_phone: 'abc' }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.customer_email && r.errors.customer_phone);
});

test('jumlah tamu di luar 1-50 ditolak', () => {
  for (const g of ['0', '51', '2.5']) {
    assert.equal(parseReservationForm(form({ guests: g })).ok, false, `guests=${g}`);
  }
});

test('service_id bukan uuid ditolak', () => {
  assert.equal(parseReservationForm(form({ service_id: 'rooms' })).ok, false);
});

test('data kamar Exely hanya ikut kalau room type id ada', () => {
  const withRoom = parseReservationForm(
    form({ exely_room_type_id: '42', exely_room_name: 'Baduy Suite', exely_total_price: '1800000' })
  );
  assert.ok(withRoom.ok);
  assert.equal(withRoom.data.exely_total_price, 1800000);

  // Harga tanpa kamar = sampah dari form yang dioprek; jangan disimpan.
  const noRoom = parseReservationForm(form({ exely_total_price: '999' }));
  assert.ok(noRoom.ok);
  assert.equal(noRoom.data.exely_total_price, null);
});

test('kolom exely dipotong ke batas DB, harga di luar akal dibuang', () => {
  const r = parseReservationForm(
    form({ exely_room_type_id: 'x'.repeat(200), exely_room_name: 'Suite', exely_total_price: '1e30' })
  );
  assert.ok(r.ok);
  assert.equal(r.data.exely_room_type_id!.length, 64);
  assert.equal(r.data.exely_total_price, null);
});
