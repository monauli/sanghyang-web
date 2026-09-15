// node --conditions=react-server --test scripts/admin-scope.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionFromAdminRow } from '../lib/admin/row-to-session.ts';

test('akun tanpa outlet_id -> sesi pemilik', () => {
  const sesi = sessionFromAdminRow({
    id: 'admin-1',
    email: 'owner@sanghyang.com',
    outlet_id: null,
    outlet: null,
  });
  assert.deepEqual(sesi, {
    sub: 'admin-1',
    email: 'owner@sanghyang.com',
    role: 'owner',
    outletId: null,
    serviceId: null,
  });
});

test('akun dengan outlet -> sesi captain', () => {
  const sesi = sessionFromAdminRow({
    id: 'admin-2',
    email: 'dbc@sanghyang.com',
    outlet_id: 'outlet-dbc',
    outlet: { id: 'outlet-dbc', service_id: 'service-dbc' },
  });
  assert.deepEqual(sesi, {
    sub: 'admin-2',
    email: 'dbc@sanghyang.com',
    role: 'captain',
    outletId: 'outlet-dbc',
    serviceId: 'service-dbc',
  });
});

test('outlet_id terisi tapi outletnya hilang -> null, bukan sesi pemilik', () => {
  const sesi = sessionFromAdminRow({
    id: 'admin-3',
    email: 'spa@sanghyang.com',
    outlet_id: 'outlet-hilang',
    outlet: null,
  });
  assert.equal(sesi, null);
});

import { canAccessService } from '../lib/admin/scope.ts';

const OWNER = {
  sub: 'a1',
  email: 'owner@sanghyang.com',
  role: 'owner' as const,
  outletId: null,
  serviceId: null,
};
const CAPTAIN_DBC = {
  sub: 'a2',
  email: 'dbc@sanghyang.com',
  role: 'captain' as const,
  outletId: 'outlet-dbc',
  serviceId: 'service-dbc',
};

test('pemilik boleh mengakses outlet mana pun', () => {
  assert.equal(canAccessService(OWNER, 'service-dbc'), true);
  assert.equal(canAccessService(OWNER, 'service-bistro'), true);
});

test('captain DBC boleh mengakses outletnya sendiri', () => {
  assert.equal(canAccessService(CAPTAIN_DBC, 'service-dbc'), true);
});

test('captain DBC TIDAK boleh mengakses outlet lain', () => {
  assert.equal(canAccessService(CAPTAIN_DBC, 'service-bistro'), false);
});

test('captain ditolak untuk serviceId kosong', () => {
  assert.equal(canAccessService(CAPTAIN_DBC, ''), false);
});

import { reservationQuery } from '../lib/admin/scope.ts';

function fakeSupabase() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const builder = {
    select: (...args: unknown[]) => { calls.push({ method: 'select', args }); return builder; },
    eq: (...args: unknown[]) => { calls.push({ method: 'eq', args }); return builder; },
  };
  return { from: () => builder, calls };
}

test('reservationQuery: captain difilter ke outletnya sendiri', () => {
  const fake = fakeSupabase();
  reservationQuery(CAPTAIN_DBC, fake as never);
  const eqCall = fake.calls.find((c) => c.method === 'eq');
  assert.deepEqual(eqCall?.args, ['service_id', CAPTAIN_DBC.serviceId]);
});

test('reservationQuery: pemilik tidak difilter sama sekali', () => {
  const fake = fakeSupabase();
  reservationQuery(OWNER, fake as never);
  assert.equal(fake.calls.some((c) => c.method === 'eq'), false);
});
