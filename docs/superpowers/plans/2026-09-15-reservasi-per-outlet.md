# Reservasi per Outlet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lima outlet self-service punya link reservasi sendiri, notifikasi email otomatis ke captain outlet, dan dashboard yang hanya menampilkan reservasi outlet milik akun yang login.

**Architecture:** Tabel `outlets` baru relasi 1:1 ke `services`; `admin_users` dapat kolom `outlet_id` (null = pemilik). Sesi JWT yang sudah ada diperluas membawa `role`, `outletId`, dan `serviceId`. Pemisahan data ditegakkan lewat satu modul `lib/admin/scope.ts` karena panel admin memakai `service_role` yang menembus RLS. Notifikasi disusun oleh modul murni dan dikirim lewat SMTP Gmail di dalam `after()` supaya tamu tidak menunggu SMTP.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (`@supabase/supabase-js`), `jose`, `nodemailer`, `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-15-reservasi-per-outlet-design.md`

## Global Constraints

- File SQL **ditulis, tidak dijalankan**. User yang menjalankan manual di Supabase SQL Editor. Pola sama seperti `db/001`–`db/006`.
- Setiap tabel baru butuh `GRANT ... TO service_role` eksplisit. Di project Supabase ini `service_role` tidak otomatis mendapat privilege tabel baru.
- Tidak ada GRANT untuk `anon`/`authenticated` pada tabel admin. Default-deny, sama seperti `admin_users` dan `reservation_requests`.
- Env rahasia tidak boleh berprefix `NEXT_PUBLIC_`. Env baru: `SMTP_USER`, `SMTP_PASSWORD`.
- Notifikasi tidak boleh pernah menggagalkan reservasi yang sudah tersimpan.
- Dependency baru hanya `nodemailer` (+ `@types/nodemailer` sebagai devDependency).
- Test tidak menyentuh database dan tidak mengirim email sungguhan. Logika yang perlu diuji ditulis sebagai fungsi murni.
- Test dijalankan dengan `npm test` (`node --conditions=react-server --test scripts/*.test.ts`). Impor antar file memakai ekstensi `.ts` eksplisit, mengikuti `scripts/admin-auth.test.ts`.
- Komentar dan teks UI dalam bahasa Indonesia, mengikuti kode yang sudah ada.
- Status reservasi memakai nilai yang sudah ada: `baru`, `dihubungi`, `dikonfirmasi`, `batal`.
- Tampilan dibuat fungsional seperlunya. Polish visual di luar lingkup.

---

### Task 1: Migration `outlets` + kolom `outlet_id`

**Files:**
- Create: `db/007_outlets.sql`
- Create: `db/008_admin_users_outlet.sql`
- Create: `scripts/create-outlets.ts`
- Modify: `lib/types.ts` (tambah tipe `Outlet` setelah tipe `Service`)

**Interfaces:**
- Consumes: tabel `services` (kolom `id`, `type`, `name`) dan `admin_users` yang sudah ada.
- Produces: tipe `Outlet = { id: string; service_id: string; name: string; notify_email: string | null; is_active: boolean }`. Tabel `outlets` dan kolom `admin_users.outlet_id`.

- [ ] **Step 1: Tulis `db/007_outlets.sql`**

```sql
-- Fase 6 Checkpoint 2 — outlet yang menerima reservasi dari web/barcode.
-- BELUM DIJALANKAN. Review dulu, lalu paste ke Supabase SQL Editor.
--
-- Dipisah dari `services` dengan sengaja: `services` adalah katalog yang
-- dibaca tamu (role anon). Email captain dan pengaturan notifikasi bukan
-- urusan tamu, jadi tidak boleh ikut terbaca dari halaman publik.

create table if not exists public.outlets (
  id uuid primary key default gen_random_uuid(),

  -- 1:1 ke services. unique supaya satu kategori tidak bisa punya dua outlet.
  service_id uuid not null unique references public.services(id),

  name text not null check (length(btrim(name)) between 2 and 100),

  -- Tujuan notifikasi. Boleh null: outlet yang emailnya belum diisi tetap
  -- menerima reservasi, hanya tidak mengirim notifikasi (dicatat di log).
  notify_email text
    check (notify_email is null
           or notify_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$'),

  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.outlets is
  'Outlet self-service yang menerima reservasi dari web. Hanya diakses lewat service_role di server.';

-- Sengaja TIDAK ada GRANT untuk anon/authenticated (default-deny).
-- service_role di project ini tidak otomatis dapat privilege tabel baru.
grant select, insert, update, delete on public.outlets to service_role;
```

- [ ] **Step 2: Tulis `db/008_admin_users_outlet.sql`**

```sql
-- Fase 6 Checkpoint 2 — hubungkan akun admin ke outlet.
-- BELUM DIJALANKAN. Review dulu, lalu paste ke Supabase SQL Editor.
--
-- outlet_id null  = akun pemilik: lihat semua outlet, kelola katalog & akun.
-- outlet_id terisi = akun captain: hanya outlet tersebut.

alter table public.admin_users
  add column if not exists outlet_id uuid references public.outlets(id);

comment on column public.admin_users.outlet_id is
  'null = pemilik (lihat semua). Terisi = captain outlet tersebut.';
```

- [ ] **Step 3: Tulis `scripts/create-outlets.ts`**

Script mencetak SQL siap-tempel untuk lima outlet. Nama outlet dicocokkan ke `services` lewat kolom `type` (slug), bukan id, supaya SQL-nya bisa ditempel tanpa user perlu menyalin uuid.

```ts
// Cetak SQL siap-tempel untuk mengisi tabel outlets.
// Jalankan sekali secara lokal, lalu tempel hasilnya ke Supabase SQL Editor
// (setelah db/007_outlets.sql dijalankan).
//
// Pemakaian: node scripts/create-outlets.ts

/** Slug di services.type -> nama outlet yang tampil di dashboard. */
const OUTLETS: Array<{ slug: string; name: string }> = [
  { slug: 'dbistro', name: "D'Bistro" },
  { slug: 'sunset-grill', name: 'Sunset Grill' },
  { slug: 'dspa', name: "D'Spa" },
  { slug: 'dbar-karaoke', name: "D'Bar & Karaoke" },
  { slug: 'dragon-beach-club', name: 'Dragon Beach Club' },
];

console.log('-- Cek dulu slug di bawah cocok dengan services.type:');
console.log('--   select type, name from public.services where is_bookable;');
console.log('');
console.log('insert into public.outlets (service_id, name)');
console.log('select s.id, v.name');
console.log('from (values');
console.log(
  OUTLETS.map((o) => `  ('${o.slug}', '${o.name.replace(/'/g, "''")}')`).join(',\n')
);
console.log(') as v(slug, name)');
console.log('join public.services s on s.type = v.slug');
console.log('on conflict (service_id) do nothing;');
```

- [ ] **Step 4: Jalankan script, periksa hasilnya**

Run: `node scripts/create-outlets.ts`
Expected: mencetak satu blok `insert ... select ... join` yang memuat lima baris values. Tidak ada uuid hardcode.

- [ ] **Step 5: Tambah tipe `Outlet` di `lib/types.ts`**

Sisipkan tepat setelah `export type Service = { ... };`

```ts
export type Outlet = {
  id: string;
  service_id: string;
  name: string;
  notify_email: string | null;
  is_active: boolean;
};
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 7: Commit**

```bash
git add db/007_outlets.sql db/008_admin_users_outlet.sql scripts/create-outlets.ts lib/types.ts
git commit -m "Tambah migration outlets dan kolom admin_users.outlet_id"
```

- [ ] **Step 8: Minta user menjalankan migration**

Sampaikan ke user: jalankan `db/007_outlets.sql`, lalu `db/008_admin_users_outlet.sql`, lalu output `node scripts/create-outlets.ts` — urutannya harus begitu karena `008` mereferensikan tabel dari `007`. Setelah itu cek `select type, name from public.services where is_bookable;` cocok dengan slug di script. Task berikutnya tidak butuh migration ini sudah jalan, jadi implementasi bisa lanjut sambil menunggu.

---

### Task 2: Sesi admin membawa `role`, `outletId`, `serviceId`

**Files:**
- Modify: `lib/admin/session.ts` (tipe `SessionPayload` dan `verifySessionToken`)
- Modify: `scripts/admin-auth.test.ts` (tambah test di bagian bawah)

**Interfaces:**
- Consumes: `createSessionToken`, `verifySessionToken` yang sudah ada.
- Produces: `SessionPayload = { sub: string; email: string; role: 'owner' | 'captain'; outletId: string | null; serviceId: string | null }`. Sesi yang tidak memuat `role` yang sah ditolak (`verifySessionToken` mengembalikan `null`).

Kenapa `serviceId` ikut disimpan: yang dipakai memfilter `reservation_requests` adalah `service_id`, bukan `outlet_id`. Relasinya 1:1 dan tidak berubah, jadi menyimpannya di sesi menghemat satu query di tiap request.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di akhir `scripts/admin-auth.test.ts`:

```ts
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
```

Test terakhir penting: captain tanpa `serviceId` berarti filter outlet tidak punya nilai. Kalau sesi seperti itu lolos, filternya bisa jadi kosong dan captain melihat semua data.

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npm test`
Expected: FAIL. Error TypeScript pada argumen `createSessionToken` (properti `role` tidak ada di tipe), dan test "sesi lama tanpa role" gagal karena sesi lama masih diterima.

- [ ] **Step 3: Ubah `lib/admin/session.ts`**

```ts
export type AdminRole = 'owner' | 'captain';

export type SessionPayload = {
  sub: string;
  email: string;
  role: AdminRole;
  /** null untuk pemilik. */
  outletId: string | null;
  /** services.id milik outlet tersebut; null untuk pemilik. Dipakai memfilter
   *  reservation_requests. */
  serviceId: string | null;
};
```

Ganti isi `verifySessionToken` dengan validasi lengkap:

```ts
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: [ALG] });
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null;

    const role = payload.role;
    if (role !== 'owner' && role !== 'captain') return null;

    const outletId = payload.outletId ?? null;
    const serviceId = payload.serviceId ?? null;
    if (outletId !== null && typeof outletId !== 'string') return null;
    if (serviceId !== null && typeof serviceId !== 'string') return null;

    // Captain wajib punya keduanya: tanpa serviceId, filter outlet tidak punya
    // nilai dan captain bisa melihat semua reservasi.
    if (role === 'captain' && (!outletId || !serviceId)) return null;

    return { sub: payload.sub, email: payload.email, role, outletId, serviceId };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npm test`
Expected: PASS semua. Jumlah test bertambah 5 dari sebelumnya.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: error di `app/actions/admin-auth.ts` karena `createSessionToken` sekarang butuh field baru. Ini wajar — diperbaiki di Task 3. Catat errornya, jangan diperbaiki sekarang.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/session.ts scripts/admin-auth.test.ts
git commit -m "Sesi admin membawa role, outletId, dan serviceId"
```

---

### Task 3: Login mengisi `role` dan outlet dari database

**Files:**
- Create: `lib/admin/row-to-session.ts`
- Create: `scripts/admin-scope.test.ts`
- Modify: `app/actions/admin-auth.ts` (tipe `AdminRow`, query select, pemanggilan `createSessionToken`)

**Interfaces:**
- Consumes: `SessionPayload` dari Task 2.
- Produces: `sessionFromAdminRow(row: AdminRowWithOutlet): SessionPayload | null` — mengubah satu baris `admin_users` (dengan outlet hasil join) menjadi payload sesi. Mengembalikan `null` kalau barisnya tidak bisa dipakai. Tipe `AdminRowWithOutlet = { id: string; email: string; outlet_id: string | null; outlet: { id: string; service_id: string } | null }`.

Fungsi ini dipisah dari Server Action supaya bisa diuji tanpa database.

- [ ] **Step 1: Tulis test yang gagal**

Buat `scripts/admin-scope.test.ts`:

```ts
// node --test scripts/admin-scope.test.ts
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
```

Test ketiga menutup kesalahan paling berbahaya di task ini: kalau outlet captain terhapus dan kode salah menganggapnya pemilik, captain mendadak melihat semua outlet.

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `node --conditions=react-server --test scripts/admin-scope.test.ts`
Expected: FAIL, modul `../lib/admin/row-to-session.ts` tidak ditemukan.

- [ ] **Step 3: Tulis `lib/admin/row-to-session.ts`**

```ts
import type { SessionPayload } from './session.ts';

export type AdminRowWithOutlet = {
  id: string;
  email: string;
  outlet_id: string | null;
  outlet: { id: string; service_id: string } | null;
};

/**
 * Baris admin_users (dengan outlet hasil join) -> payload sesi.
 *
 * Mengembalikan null kalau barisnya tidak konsisten. Perhatikan kasus
 * outlet_id terisi tapi outletnya tidak ada: itu TIDAK boleh diperlakukan
 * sebagai pemilik, karena artinya captain mendadak bisa melihat semua outlet.
 */
export function sessionFromAdminRow(row: AdminRowWithOutlet): SessionPayload | null {
  if (row.outlet_id === null) {
    return { sub: row.id, email: row.email, role: 'owner', outletId: null, serviceId: null };
  }

  if (!row.outlet || row.outlet.id !== row.outlet_id) return null;

  return {
    sub: row.id,
    email: row.email,
    role: 'captain',
    outletId: row.outlet.id,
    serviceId: row.outlet.service_id,
  };
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `node --conditions=react-server --test scripts/admin-scope.test.ts`
Expected: PASS 3 test.

- [ ] **Step 5: Sambungkan ke `app/actions/admin-auth.ts`**

Tambah impor:

```ts
import { sessionFromAdminRow } from '@/lib/admin/row-to-session';
```

Ubah tipe `AdminRow` — tambah dua field:

```ts
type AdminRow = {
  id: string;
  email: string;
  password_hash: string;
  failed_attempts: number;
  locked_until: string | null;
  outlet_id: string | null;
  outlet: { id: string; service_id: string } | null;
};
```

Ubah query select (join ke `outlets` lewat foreign key `outlet_id`):

```ts
  const { data } = await supabase
    .from('admin_users')
    .select(
      'id, email, password_hash, failed_attempts, locked_until, outlet_id, outlet:outlets(id, service_id)'
    )
    .eq('email', email)
    .maybeSingle();
```

Ganti blok pembuatan token (yang sekarang memanggil `createSessionToken({ sub, email })`):

```ts
  const sesi = sessionFromAdminRow(admin);
  if (!sesi) {
    console.error(`[admin] akun ${admin.id} punya outlet_id tanpa outlet yang sah`);
    return { error: 'Akun Anda belum lengkap. Hubungi pengelola.' };
  }

  const token = await createSessionToken(sesi);
```

- [ ] **Step 6: Typecheck & test penuh**

Run: `npx tsc --noEmit`
Expected: tidak ada error. Error dari Task 2 Step 5 hilang di sini.

Run: `npm test`
Expected: PASS semua.

- [ ] **Step 7: Commit**

```bash
git add lib/admin/row-to-session.ts scripts/admin-scope.test.ts app/actions/admin-auth.ts
git commit -m "Login mengisi role dan outlet ke dalam sesi"
```

---

### Task 4: Modul pembatas akses `lib/admin/scope.ts`

**Files:**
- Create: `lib/admin/scope.ts`
- Modify: `scripts/admin-scope.test.ts` (tambah test)

**Interfaces:**
- Consumes: `SessionPayload` (Task 2), `requireAdminSession` dari `lib/admin/auth.ts`, `getAdminClient` dari `lib/supabase/admin.ts`.
- Produces:
  - `canAccessService(session: SessionPayload, serviceId: string): boolean` — fungsi murni, diuji.
  - `reservationQuery(session: SessionPayload, supabase: SupabaseClient)` — mengembalikan query `reservation_requests` yang sudah tersaring.
  - `requireScopedClient()` — mengambil sesi + client sekaligus: `Promise<{ session: SessionPayload; supabase: SupabaseClient }>`. Semua Server Action admin memanggil ini, bukan `getAdminClient()` langsung.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di `scripts/admin-scope.test.ts`:

```ts
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
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `node --conditions=react-server --test scripts/admin-scope.test.ts`
Expected: FAIL, modul `../lib/admin/scope.ts` tidak ditemukan.

- [ ] **Step 3: Tulis `lib/admin/scope.ts`**

```ts
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdminSession } from './auth';
import type { SessionPayload } from './session';

/**
 * Satu-satunya tempat pemisahan data antar outlet ditegakkan.
 *
 * Panel admin memakai service_role yang menembus RLS (lihat
 * lib/supabase/admin.ts), jadi policy database tidak menolong di jalur ini.
 * Aturannya: TIDAK ADA Server Action / Route Handler admin yang memanggil
 * getAdminClient() langsung untuk data reservasi — semuanya lewat sini.
 *
 * Filter selalu berasal dari sesi, bukan dari request. Captain yang mengubah
 * URL atau id di request tetap tidak bisa menjangkau outlet lain.
 */

export function canAccessService(session: SessionPayload, serviceId: string): boolean {
  if (session.role === 'owner') return true;
  if (!serviceId) return false;
  return session.serviceId === serviceId;
}

export async function requireScopedClient(): Promise<{
  session: SessionPayload;
  supabase: SupabaseClient;
}> {
  const session = await requireAdminSession();
  const supabase = getAdminClient();
  if (!supabase) throw new Error('Supabase admin client belum siap (env belum diisi)');
  return { session, supabase };
}

const RESERVATION_COLUMNS =
  'id, customer_name, customer_email, customer_phone, service_id, service_item_id, ' +
  'reservation_date, checkout_date, guests, notes, status, created_at';

/** Query reservation_requests yang sudah tersaring sesuai sesi. */
export function reservationQuery(session: SessionPayload, supabase: SupabaseClient) {
  const query = supabase.from('reservation_requests').select(RESERVATION_COLUMNS);
  return session.role === 'owner' ? query : query.eq('service_id', session.serviceId);
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `node --conditions=react-server --test scripts/admin-scope.test.ts`
Expected: PASS 7 test (3 dari Task 3 + 4 baru).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/scope.ts scripts/admin-scope.test.ts
git commit -m "Tambah modul scope yang menegakkan pemisahan data antar outlet"
```

---

### Task 5: Normalisasi nomor telepon & link WhatsApp

**Files:**
- Create: `lib/notify/wa-link.ts`
- Create: `scripts/notify.test.ts`

**Interfaces:**
- Consumes: tidak ada.
- Produces:
  - `normalizePhone(raw: string): string | null` — `08xx`/`+62xx`/`62xx` menjadi `628xx`. `null` kalau tidak bisa dinormalkan.
  - `waLink(raw: string, message: string): string | null` — `https://wa.me/<nomor>?text=<pesan ter-encode>`. `null` kalau nomornya tidak bisa dinormalkan.

Kolom `customer_phone` di database sengaja longgar (`^\+?[0-9][0-9 .-]{7,19}$`), jadi normalisasi wajib dilakukan sebelum dipakai di link `wa.me`.

- [ ] **Step 1: Tulis test yang gagal**

Buat `scripts/notify.test.ts`:

```ts
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
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `node --conditions=react-server --test scripts/notify.test.ts`
Expected: FAIL, modul `../lib/notify/wa-link.ts` tidak ditemukan.

- [ ] **Step 3: Tulis `lib/notify/wa-link.ts`**

```ts
/**
 * Nomor telepon tamu disimpan apa adanya (kolom customer_phone sengaja
 * longgar: "+62", "08xx", spasi, strip). wa.me butuh format internasional
 * tanpa tanda apa pun, jadi dinormalkan di sini — satu tempat.
 */

const MIN_DIGITS = 9;
const MAX_DIGITS = 15;

export function normalizePhone(raw: string): string | null {
  const digits = (raw ?? '').replace(/[^\d+]/g, '');
  if (!digits) return null;

  let local: string;
  if (digits.startsWith('+62')) local = digits.slice(3);
  else if (digits.startsWith('62')) local = digits.slice(2);
  else if (digits.startsWith('0')) local = digits.slice(1);
  else local = digits;

  local = local.replace(/\D/g, '');
  if (local.length < MIN_DIGITS - 2 || local.length > MAX_DIGITS - 2) return null;

  return `62${local}`;
}

export function waLink(raw: string, message: string): string | null {
  const phone = normalizePhone(raw);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `node --conditions=react-server --test scripts/notify.test.ts`
Expected: PASS 6 test. Kalau batas panjang membuat salah satu kasus gagal, sesuaikan `MIN_DIGITS`/`MAX_DIGITS` — jangan ubah testnya.

- [ ] **Step 5: Commit**

```bash
git add lib/notify/wa-link.ts scripts/notify.test.ts
git commit -m "Tambah normalisasi nomor telepon dan pembentuk link WhatsApp"
```

---

### Task 6: Penyusun isi email notifikasi

**Files:**
- Create: `lib/notify/reservation-notice.ts`
- Modify: `scripts/notify.test.ts` (tambah test)

**Interfaces:**
- Consumes: `waLink` (Task 5).
- Produces: `buildReservationNotice(input: NoticeInput): { subject: string; html: string; text: string }`, dengan
  `NoticeInput = { outletName: string; dashboardUrl: string; reservation: { id: string; customer_name: string; customer_email: string; customer_phone: string; reservation_date: string; checkout_date: string | null; guests: number; notes: string | null; item_name: string | null } }`.

Fungsi murni: tidak menyentuh database, env, maupun SMTP.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di `scripts/notify.test.ts`:

```ts
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
    outletName: 'D’Spa',
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
```

Test escape HTML wajib ada: `notes` dan `customer_name` datang dari form publik, jadi masuk email tanpa disaring berarti HTML asing ikut terkirim.

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `node --conditions=react-server --test scripts/notify.test.ts`
Expected: FAIL, modul `../lib/notify/reservation-notice.ts` tidak ditemukan.

- [ ] **Step 3: Tulis `lib/notify/reservation-notice.ts`**

```ts
import { waLink } from './wa-link.ts';

export type NoticeReservation = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  reservation_date: string;
  checkout_date: string | null;
  guests: number;
  notes: string | null;
  item_name: string | null;
};

export type NoticeInput = {
  outletName: string;
  dashboardUrl: string;
  reservation: NoticeReservation;
};

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** '2026-10-12' -> '12 Okt 2026'. Tanggal datang sebagai date polos dari
 *  Postgres, jadi dipecah manual — jangan lewat new Date() yang menggeser
 *  tanggal karena zona waktu. */
function formatDate(iso: string): string {
  const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const [y, m, d] = iso.split('-');
  const bulan = BULAN[Number(m) - 1];
  if (!bulan) return iso;
  return `${Number(d)} ${bulan} ${y}`;
}

export function buildReservationNotice(input: NoticeInput): {
  subject: string;
  html: string;
  text: string;
} {
  const r = input.reservation;
  const tanggal = formatDate(r.reservation_date);
  const subject = `Reservasi baru — ${input.outletName}, ${tanggal}`;

  const baris: Array<[string, string]> = [
    ['Nama', r.customer_name],
    ['Telepon', r.customer_phone],
    ['Email', r.customer_email],
    ['Tanggal', r.checkout_date ? `${tanggal} s/d ${formatDate(r.checkout_date)}` : tanggal],
    ['Jumlah tamu', String(r.guests)],
  ];
  if (r.item_name) baris.push(['Pilihan', r.item_name]);
  if (r.notes) baris.push(['Catatan tamu', r.notes]);

  const sapaan =
    `Halo ${r.customer_name}, terima kasih sudah mengirim permintaan reservasi ` +
    `di ${input.outletName} untuk ${tanggal}. Kami ingin mengonfirmasi beberapa hal.`;
  const wa = waLink(r.customer_phone, sapaan);

  const text = [
    `Reservasi baru di ${input.outletName}.`,
    '',
    ...baris.map(([label, value]) => `${label}: ${value}`),
    '',
    `Buka dashboard: ${input.dashboardUrl}`,
  ].join('\n');

  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#1c1917">
  <h2 style="margin:0 0 4px;font-size:18px">Reservasi baru</h2>
  <p style="margin:0 0 16px;color:#57534e">${esc(input.outletName)}</p>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    ${baris
      .map(
        ([label, value]) =>
          `<tr><td style="padding:4px 16px 4px 0;color:#57534e;vertical-align:top">${esc(label)}</td>` +
          `<td style="padding:4px 0"><strong>${esc(value)}</strong></td></tr>`
      )
      .join('\n    ')}
  </table>
  <p style="margin:20px 0 0">
    ${
      wa
        ? `<a href="${esc(wa)}" style="display:inline-block;padding:10px 18px;margin-right:8px;background:#128c7e;color:#fff;border-radius:999px;text-decoration:none">Chat via WhatsApp</a>`
        : ''
    }
    <a href="${esc(input.dashboardUrl)}" style="display:inline-block;padding:10px 18px;background:#f5f5f4;color:#1c1917;border-radius:999px;text-decoration:none">Buka dashboard</a>
  </p>
</div>`;

  return { subject, html, text };
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `node --conditions=react-server --test scripts/notify.test.ts`
Expected: PASS 12 test (6 dari Task 5 + 6 baru).

- [ ] **Step 5: Commit**

```bash
git add lib/notify/reservation-notice.ts scripts/notify.test.ts
git commit -m "Tambah penyusun isi email notifikasi reservasi"
```

---

### Task 7: Kirim email lewat SMTP Gmail & sambungkan ke form reservasi

**Files:**
- Create: `lib/notify/mailer.ts`
- Create: `lib/notify/send-reservation-notice.ts`
- Modify: `scripts/notify.test.ts` (tambah test)
- Modify: `app/actions/reservation.ts` (panggil notifikasi lewat `after()`)
- Modify: `.env.example` (tambah `SMTP_USER`, `SMTP_PASSWORD`)
- Modify: `package.json` (dependency `nodemailer`)

**Interfaces:**
- Consumes: `buildReservationNotice` (Task 6), `getAdminClient`.
- Produces:
  - `sendMail(input: { to: string; subject: string; html: string; text: string }): Promise<void>` — melempar error kalau gagal.
  - `sendReservationNotice(reservationId: string, deps?: Deps): Promise<void>` — mengambil data reservasi + outlet dari database, menyusun email, mengirim. **Tidak pernah melempar**: setiap kegagalan dicatat ke log. `Deps = { sendMail?: typeof sendMail; loadReservation?: (id: string) => Promise<NoticeRow | null> }` — dua titik suntik supaya jalur gagal-kirim bisa diuji tanpa database dan tanpa SMTP.

- [ ] **Step 1: Pasang dependency**

Run: `npm install nodemailer && npm install -D @types/nodemailer`
Expected: `package.json` memuat `nodemailer` di `dependencies` dan `@types/nodemailer` di `devDependencies`.

- [ ] **Step 2: Tulis test yang gagal**

Tambahkan di `scripts/notify.test.ts`:

```ts
import { sendReservationNotice } from '../lib/notify/send-reservation-notice.ts';

const ROW_LENGKAP = {
  id: 'res-1',
  service_id: 'service-dbc',
  customer_name: 'Budi Santoso',
  customer_email: 'budi@example.com',
  customer_phone: '0812 3456 7890',
  reservation_date: '2026-10-12',
  checkout_date: null,
  guests: 4,
  notes: null,
  item: null,
  outlet: { name: 'Dragon Beach Club', notify_email: 'dbc@sanghyang.com', is_active: true },
};

test('kegagalan kirim email tidak melempar keluar', async () => {
  const gagal = () => Promise.reject(new Error('SMTP mati'));
  await assert.doesNotReject(() =>
    sendReservationNotice('res-1', {
      sendMail: gagal,
      loadReservation: () => Promise.resolve(ROW_LENGKAP),
    })
  );
});

test('email dikirim ke notify_email outlet', async () => {
  const terkirim: Array<{ to: string; subject: string }> = [];
  await sendReservationNotice('res-1', {
    sendMail: async ({ to, subject }) => {
      terkirim.push({ to, subject });
    },
    loadReservation: () => Promise.resolve(ROW_LENGKAP),
  });
  assert.equal(terkirim.length, 1);
  assert.equal(terkirim[0].to, 'dbc@sanghyang.com');
  assert.match(terkirim[0].subject, /Dragon Beach Club/);
});

test('notify_email kosong -> tidak mengirim, tidak melempar', async () => {
  let dipanggil = 0;
  await assert.doesNotReject(() =>
    sendReservationNotice('res-1', {
      sendMail: async () => {
        dipanggil += 1;
      },
      loadReservation: () =>
        Promise.resolve({ ...ROW_LENGKAP, outlet: { ...ROW_LENGKAP.outlet, notify_email: null } }),
    })
  );
  assert.equal(dipanggil, 0);
});

test('env SMTP kosong -> tidak melempar', async () => {
  const sebelumnya = process.env.SMTP_USER;
  delete process.env.SMTP_USER;
  await assert.doesNotReject(() => sendReservationNotice('res-1'));
  if (sebelumnya !== undefined) process.env.SMTP_USER = sebelumnya;
});
```

Dua test ini menjaga janji paling penting di spec: notifikasi tidak boleh pernah menggagalkan reservasi. Keduanya berjalan tanpa database dan tanpa SMTP — `sendReservationNotice` keluar lebih awal saat env atau client Supabase tidak tersedia.

- [ ] **Step 3: Jalankan test, pastikan gagal**

Run: `node --conditions=react-server --test scripts/notify.test.ts`
Expected: FAIL, modul `../lib/notify/send-reservation-notice.ts` tidak ditemukan.

- [ ] **Step 4: Tulis `lib/notify/mailer.ts`**

```ts
import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Pengirim email. SATU-SATUNYA file yang tahu caranya mengirim — kalau nanti
 * pindah ke Telegram atau gateway WhatsApp, file inilah yang diganti, bukan
 * yang lain.
 *
 * Pakai SMTP Gmail + App Password (bukan password akun). App Password
 * mensyaratkan verifikasi 2 langkah aktif di akun Gmail tersebut.
 */

let cached: Transporter | null = null;

export function mailerReady(): boolean {
  return Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASSWORD?.trim());
}

function transporter(): Transporter {
  cached ??= nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER!.trim(),
      pass: process.env.SMTP_PASSWORD!.trim(),
    },
  });
  return cached;
}

export async function sendMail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  await transporter().sendMail({
    from: `Sanghyang Resort <${process.env.SMTP_USER!.trim()}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}
```

- [ ] **Step 5: Tulis `lib/notify/send-reservation-notice.ts`**

```ts
import 'server-only';
import { getAdminClient } from '@/lib/supabase/admin';
import { buildReservationNotice } from './reservation-notice.ts';
import { mailerReady, sendMail as defaultSendMail } from './mailer.ts';

/**
 * Ambil satu reservasi + outletnya, susun email, kirim.
 *
 * TIDAK PERNAH melempar. Dipanggil dari after() setelah reservasi tersimpan
 * dan tamu sudah melihat halaman terkirim — kegagalan di sini tidak boleh
 * mengubah apa pun yang sudah terjadi. Semua kegagalan dicatat dengan id
 * reservasi supaya bisa ditindaklanjuti manual.
 */
export type NoticeRow = {
  id: string;
  service_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  reservation_date: string;
  checkout_date: string | null;
  guests: number;
  notes: string | null;
  item: { name: string } | null;
  outlet: { name: string; notify_email: string | null; is_active: boolean } | null;
};

export type Deps = {
  sendMail?: typeof defaultSendMail;
  loadReservation?: (id: string) => Promise<NoticeRow | null>;
};

/** Baca satu reservasi beserta outlet & nama item pilihannya. */
async function loadFromSupabase(reservationId: string): Promise<NoticeRow | null> {
  const supabase = getAdminClient();
  if (!supabase) {
    console.warn(`[notify] Supabase admin client belum siap, notifikasi ${reservationId} dilewati`);
    return null;
  }

  const { data, error } = await supabase
    .from('reservation_requests')
    .select(
      'id, service_id, customer_name, customer_email, customer_phone, reservation_date, ' +
        'checkout_date, guests, notes, item:service_items(name), ' +
        'outlet:outlets(name, notify_email, is_active)'
    )
    .eq('id', reservationId)
    .maybeSingle();

  if (error || !data) {
    console.error(`[notify] gagal membaca reservasi ${reservationId}: ${error?.message ?? 'tidak ditemukan'}`);
    return null;
  }
  return data as unknown as NoticeRow;
}

export async function sendReservationNotice(
  reservationId: string,
  deps: Deps = {}
): Promise<void> {
  const sendMail = deps.sendMail ?? defaultSendMail;
  const loadReservation = deps.loadReservation ?? loadFromSupabase;

  try {
    if (!deps.sendMail && !mailerReady()) {
      console.warn(`[notify] SMTP_USER/SMTP_PASSWORD belum diisi, notifikasi ${reservationId} dilewati`);
      return;
    }

    const row = await loadReservation(reservationId);
    if (!row) return;

    if (!row.outlet) {
      console.warn(`[notify] reservasi ${reservationId} tidak punya outlet — data outlet belum dilengkapi`);
      return;
    }
    if (!row.outlet.is_active || !row.outlet.notify_email) {
      console.warn(`[notify] outlet ${row.outlet.name} tidak aktif atau notify_email kosong, notifikasi ${reservationId} dilewati`);
      return;
    }

    const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '') ?? '';
    const notice = buildReservationNotice({
      outletName: row.outlet.name,
      dashboardUrl: `${base}/panel-sanghyang/reservasi`,
      reservation: { ...row, item_name: row.item?.name ?? null },
    });

    await sendMail({ to: row.outlet.notify_email, ...notice });
  } catch (err) {
    console.error(`[notify] notifikasi reservasi ${reservationId} gagal:`, err);
  }
}
```

Catatan untuk implementor: join `outlet:outlets(...)` di atas bekerja karena `reservation_requests.service_id` dan `outlets.service_id` menunjuk tabel yang sama. Kalau Supabase menolak join implisit ini, ganti dengan query kedua terpisah: baca `outlets` dengan `.eq('service_id', row.service_id).maybeSingle()`. Perilaku dan test tidak berubah.

- [ ] **Step 6: Jalankan test, pastikan lolos**

Run: `node --conditions=react-server --test scripts/notify.test.ts`
Expected: PASS 17 test (12 dari Task 5-6 + 5 baru).

- [ ] **Step 7: Sambungkan ke `app/actions/reservation.ts`**

Tambah impor:

```ts
import { after } from 'next/server';
import { sendReservationNotice } from '@/lib/notify/send-reservation-notice';
```

Ganti blok insert supaya mengembalikan id, lalu daftarkan notifikasi sebelum `redirect`:

```ts
  const { data: inserted, error } = await supabase
    .from('reservation_requests')
    .insert(parsed.data)
    .select('id')
    .single();

  if (error || !inserted) {
    console.error('[supabase] submitReservation:', error?.message ?? 'insert tidak mengembalikan baris');
    return {
      errors: {
        form: 'Permintaan gagal dikirim. Coba lagi sebentar lagi, atau hubungi kami langsung.',
      },
      values,
    };
  }

  // Notifikasi dikirim SETELAH respons sampai ke tamu: tamu tidak menunggu
  // SMTP, dan kegagalan kirim tidak boleh menggagalkan reservasi yang sudah
  // tersimpan. after() harus didaftarkan sebelum redirect() — redirect
  // bekerja dengan melempar.
  after(() => sendReservationNotice(inserted.id));

  redirect('/reservasi/terkirim');
```

- [ ] **Step 8: Tambah env ke `.env.example`**

```
# Notifikasi email ke captain outlet (Fase 6 Checkpoint 2).
# Pengirim: akun Gmail khusus resort. SMTP_PASSWORD adalah App Password 16
# karakter dari Google (butuh verifikasi 2 langkah aktif), BUKAN password akun.
# RAHASIA — jangan diberi prefix NEXT_PUBLIC_.
# Kalau salah satu kosong, notifikasi dilewati dan dicatat di log; reservasi
# tetap tersimpan.
SMTP_USER=
SMTP_PASSWORD=
```

- [ ] **Step 9: Typecheck, test penuh, lint**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

Run: `npm test`
Expected: PASS semua.

Run: `npm run lint`
Expected: tidak ada error.

- [ ] **Step 10: Commit**

```bash
git add lib/notify/ scripts/notify.test.ts app/actions/reservation.ts .env.example package.json package-lock.json
git commit -m "Kirim notifikasi email ke captain outlet setelah reservasi masuk"
```

---

### Task 8: Halaman daftar reservasi di dashboard

**Files:**
- Create: `app/panel-sanghyang/reservasi/page.tsx`
- Create: `app/panel-sanghyang/reservasi/status-form.tsx`
- Create: `app/actions/admin-reservasi.ts`
- Modify: `app/panel-sanghyang/page.tsx` (ganti teks placeholder dengan tautan ke halaman ini)

**Interfaces:**
- Consumes: `requireScopedClient`, `reservationQuery`, `canAccessService` (Task 4); `waLink` (Task 5).
- Produces: Server Action `ubahStatus(formData: FormData): Promise<void>` — membaca `id` dan `status` dari form, menolak kalau reservasinya di luar jangkauan sesi.

- [ ] **Step 1: Tulis Server Action `app/actions/admin-reservasi.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { canAccessService, requireScopedClient } from '@/lib/admin/scope';

const STATUSES = ['baru', 'dihubungi', 'dikonfirmasi', 'batal'] as const;

export async function ubahStatus(formData: FormData): Promise<void> {
  const { session, supabase } = await requireScopedClient();

  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) return;

  // Baca dulu service_id-nya, lalu periksa terhadap sesi. Jangan percaya
  // apa pun yang datang dari form: id bisa diganti manual.
  const { data } = await supabase
    .from('reservation_requests')
    .select('id, service_id')
    .eq('id', id)
    .maybeSingle();

  if (!data || !canAccessService(session, (data as { service_id: string }).service_id)) {
    console.warn(`[admin] ${session.email} mencoba mengubah reservasi di luar jangkauannya: ${id}`);
    return;
  }

  await supabase.from('reservation_requests').update({ status }).eq('id', id);
  revalidatePath('/panel-sanghyang/reservasi');
}
```

- [ ] **Step 2: Tulis `app/panel-sanghyang/reservasi/status-form.tsx`**

```tsx
'use client';

import { ubahStatus } from '@/app/actions/admin-reservasi';

const STATUSES = ['baru', 'dihubungi', 'dikonfirmasi', 'batal'] as const;

export function StatusForm({ id, status }: { id: string; status: string }) {
  return (
    <form action={ubahStatus} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="sr-only" htmlFor={`status-${id}`}>
        Status reservasi
      </label>
      <select
        id={`status-${id}`}
        name="status"
        defaultValue={status}
        className="rounded-md border border-border bg-card px-2 py-1 text-sm"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground">
        Simpan
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Tulis `app/panel-sanghyang/reservasi/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { requireScopedClient, reservationQuery } from '@/lib/admin/scope';
import { waLink } from '@/lib/notify/wa-link';
import { StatusForm } from './status-form';

export const metadata: Metadata = {
  title: 'Reservasi Masuk',
  robots: { index: false, follow: false },
};

type Row = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  reservation_date: string;
  checkout_date: string | null;
  guests: number;
  notes: string | null;
  status: string;
  created_at: string;
};

export default async function ReservasiPage() {
  const { session, supabase } = await requireScopedClient();
  const { data } = await reservationQuery(session, supabase)
    .order('created_at', { ascending: false })
    .limit(100);
  const rows = (data as Row[] | null) ?? [];

  return (
    <main className="min-h-screen bg-muted p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-heading text-2xl">Reservasi Masuk</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {session.role === 'owner' ? 'Semua outlet' : 'Outlet Anda'} — 100 terbaru.
        </p>

        {rows.length === 0 ? (
          <p className="mt-6 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Belum ada reservasi masuk.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {rows.map((r) => {
              const wa = waLink(r.customer_phone, `Halo ${r.customer_name}, mengenai reservasi Anda.`);
              return (
                <li key={r.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <strong className="text-base">{r.customer_name}</strong>
                    <span className="text-sm text-muted-foreground">
                      {r.reservation_date}
                      {r.checkout_date ? ` s/d ${r.checkout_date}` : ''} · {r.guests} orang
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {r.customer_phone} · {r.customer_email}
                  </p>
                  {r.notes && <p className="mt-2 text-sm">{r.notes}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <StatusForm id={r.id} status={r.status} />
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm underline underline-offset-4"
                      >
                        Chat via WhatsApp
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Tautkan dari `app/panel-sanghyang/page.tsx`**

Ganti paragraf placeholder ("Berhasil login. Ringkasan reservasi, ...") dengan:

```tsx
        <nav className="mt-4 flex flex-col gap-2 text-sm">
          <Link href="/panel-sanghyang/reservasi" className="underline underline-offset-4">
            Reservasi masuk
          </Link>
          <Link href="/panel-sanghyang/pengaturan" className="underline underline-offset-4">
            Pengaturan notifikasi & link outlet
          </Link>
        </nav>
```

Tambah `import Link from 'next/link';` di atas. Tautan `/panel-sanghyang/pengaturan` dibuat di Task 9 — sampai task itu selesai, tautannya akan menghasilkan 404.

- [ ] **Step 5: Jalankan dev server, periksa manual**

Run: `npm run dev`
Buka `/panel-sanghyang/reservasi` setelah login.
Expected: halaman tampil. Kalau migration belum dijalankan user, daftar kosong dan log server memuat pesan dari Supabase — bukan halaman 500.

- [ ] **Step 6: Typecheck & lint**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

Run: `npm run lint`
Expected: tidak ada error.

- [ ] **Step 7: Commit**

```bash
git add app/panel-sanghyang/reservasi app/actions/admin-reservasi.ts app/panel-sanghyang/page.tsx
git commit -m "Tambah halaman daftar reservasi dengan filter per outlet"
```

---

### Task 9: Pengaturan notifikasi & daftar link outlet

**Files:**
- Create: `app/panel-sanghyang/pengaturan/page.tsx`
- Create: `app/panel-sanghyang/pengaturan/notify-form.tsx`
- Create: `app/actions/admin-outlet.ts`
- Create: `lib/outlets.ts`

**Interfaces:**
- Consumes: `requireScopedClient` (Task 4), tipe `Outlet` (Task 1).
- Produces:
  - `listOutletsForSession(session, supabase): Promise<Array<Outlet & { slug: string }>>` — pemilik mendapat lima outlet, captain hanya outletnya.
  - `outletLink(slug: string): string` — `<NEXT_PUBLIC_SITE_URL>/kategori/<slug>?reservasi=1`.
  - Server Action `simpanNotifyEmail(formData: FormData): Promise<void>`.

- [ ] **Step 1: Tulis `lib/outlets.ts`**

```ts
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionPayload } from './admin/session';
import type { Outlet } from './types';

export type OutletWithSlug = Outlet & { slug: string };

/** Link yang dipasang sebagai barcode di outlet. Parameter reservasi=1 membuat
 *  form langsung terbuka begitu halaman dibuka. */
export function outletLink(slug: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '') ?? '';
  return `${base}/kategori/${slug}?reservasi=1`;
}

export async function listOutletsForSession(
  session: SessionPayload,
  supabase: SupabaseClient
): Promise<OutletWithSlug[]> {
  let query = supabase
    .from('outlets')
    .select('id, service_id, name, notify_email, is_active, service:services(type)')
    .order('name');

  if (session.role === 'captain') query = query.eq('id', session.outletId!);

  const { data, error } = await query;
  if (error) {
    console.error('[outlets] listOutletsForSession:', error.message);
    return [];
  }

  return ((data ?? []) as unknown as Array<Outlet & { service: { type: string } | null }>).map(
    ({ service, ...outlet }) => ({ ...outlet, slug: service?.type ?? '' })
  );
}
```

- [ ] **Step 2: Tulis `app/actions/admin-outlet.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireScopedClient } from '@/lib/admin/scope';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;

export async function simpanNotifyEmail(formData: FormData): Promise<void> {
  const { session, supabase } = await requireScopedClient();

  const outletId = String(formData.get('outlet_id') ?? '');
  const raw = String(formData.get('notify_email') ?? '').trim();
  if (!outletId) return;

  // Captain hanya boleh mengubah outletnya sendiri. Nilainya diambil dari
  // sesi, jadi id di form tidak bisa dipakai menjangkau outlet lain.
  if (session.role === 'captain' && outletId !== session.outletId) {
    console.warn(`[admin] ${session.email} mencoba mengubah notify_email outlet lain: ${outletId}`);
    return;
  }

  const email = raw === '' ? null : raw;
  if (email !== null && !EMAIL_RE.test(email)) return;

  await supabase.from('outlets').update({ notify_email: email }).eq('id', outletId);
  revalidatePath('/panel-sanghyang/pengaturan');
}
```

- [ ] **Step 3: Tulis `app/panel-sanghyang/pengaturan/notify-form.tsx`**

```tsx
'use client';

import { simpanNotifyEmail } from '@/app/actions/admin-outlet';

export function NotifyForm({ outletId, email }: { outletId: string; email: string | null }) {
  return (
    <form action={simpanNotifyEmail} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="outlet_id" value={outletId} />
      <label className="sr-only" htmlFor={`email-${outletId}`}>
        Email tujuan notifikasi
      </label>
      <input
        id={`email-${outletId}`}
        name="notify_email"
        type="email"
        defaultValue={email ?? ''}
        placeholder="captain@contoh.com"
        className="min-w-56 rounded-md border border-border bg-card px-2 py-1 text-sm"
      />
      <button type="submit" className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground">
        Simpan
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Tulis `app/panel-sanghyang/pengaturan/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { requireScopedClient } from '@/lib/admin/scope';
import { listOutletsForSession, outletLink } from '@/lib/outlets';
import { NotifyForm } from './notify-form';

export const metadata: Metadata = {
  title: 'Pengaturan Outlet',
  robots: { index: false, follow: false },
};

export default async function PengaturanPage() {
  const { session, supabase } = await requireScopedClient();
  const outlets = await listOutletsForSession(session, supabase);

  return (
    <main className="min-h-screen bg-muted p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-2xl">Pengaturan Outlet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Email tujuan notifikasi reservasi
          {session.role === 'owner' ? ', dan link yang dipakai membuat barcode.' : '.'}
        </p>

        {outlets.length === 0 ? (
          <p className="mt-6 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Data outlet belum diisi. Jalankan <code>db/007_outlets.sql</code> dan output{' '}
            <code>node scripts/create-outlets.ts</code> di Supabase.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {outlets.map((o) => (
              <li key={o.id} className="rounded-xl border border-border bg-card p-4">
                <strong className="text-base">{o.name}</strong>
                {!o.notify_email && (
                  <p className="mt-1 text-sm text-destructive">
                    Belum ada email tujuan — reservasi tetap masuk, tapi tidak ada notifikasi.
                  </p>
                )}
                <NotifyForm outletId={o.id} email={o.notify_email} />
                {session.role === 'owner' && o.slug && (
                  <p className="mt-3 break-all text-xs text-muted-foreground">
                    Link barcode: <code>{outletLink(o.slug)}</code>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
```

Tombol "Salin" sengaja belum dibuat: link sudah bisa ditandai-salin dari teksnya, dan tombol salin butuh Client Component tambahan. Tambahkan nanti kalau user merasa perlu.

- [ ] **Step 5: Periksa manual**

Run: `npm run dev`
Buka `/panel-sanghyang/pengaturan` sebagai pemilik.
Expected: lima outlet tampil (kalau migration sudah dijalankan) dengan kolom email dan link barcode. Login sebagai captain: hanya satu outlet, tanpa link barcode.

- [ ] **Step 6: Typecheck & lint**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

Run: `npm run lint`
Expected: tidak ada error.

- [ ] **Step 7: Commit**

```bash
git add lib/outlets.ts app/panel-sanghyang/pengaturan app/actions/admin-outlet.ts
git commit -m "Tambah pengaturan email notifikasi dan daftar link outlet"
```

---

### Task 10: Form terbuka otomatis dari link `?reservasi=1`

**Files:**
- Modify: `components/reservation-panel.tsx` (state `open` dan satu `useEffect` baru)

**Interfaces:**
- Consumes: komponen `ReservationPanel` yang sudah ada.
- Produces: perilaku baru — `?reservasi=1` pada URL membuat dialog terbuka saat halaman dimuat.

Penting: **jangan** memakai `useSearchParams()` maupun `searchParams` di `app/kategori/[slug]/page.tsx`. Halaman itu di-prerender lewat `generateStaticParams`, dan membaca search params di server akan mematikan prerender-nya. Baca `window.location.search` di `useEffect` — hanya berjalan di browser, prerender tetap utuh.

- [ ] **Step 1: Tambah `useEffect` pembuka dialog**

Di `components/reservation-panel.tsx`, sisipkan tepat sebelum `useEffect` pengambil token:

```tsx
  // Link barcode outlet berbentuk /kategori/<slug>?reservasi=1 supaya tamu
  // yang scan langsung disuguhi formnya. Dibaca dari window, BUKAN dengan
  // useSearchParams: halaman kategori di-prerender, dan membaca search params
  // di server akan mematikan prerender itu.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('reservasi') === '1') {
      setOpen(true);
    }
  }, []);
```

- [ ] **Step 2: Periksa manual — link dengan parameter**

Run: `npm run dev`
Buka `http://localhost:3000/kategori/dragon-beach-club?reservasi=1`
Expected: dialog reservasi terbuka sendiri. Untuk outlet `self_service`, form langsung tampil. Nama outlet tampil di judul dialog.

- [ ] **Step 3: Periksa manual — tanpa parameter tidak berubah**

Buka `http://localhost:3000/kategori/dragon-beach-club`
Expected: dialog tertutup, seperti sebelumnya. Tombol "Ajukan reservasi" tetap berfungsi.

- [ ] **Step 4: Periksa manual — Rooms tidak terpengaruh**

Buka halaman kategori Rooms dengan `?reservasi=1`.
Expected: dialog terbuka pada langkah pemilihan tanggal/kamar Exely, bukan langsung form — perilaku `booking_method='exely'` tidak berubah.

- [ ] **Step 5: Test penuh, typecheck, lint, build**

Run: `npm test`
Expected: PASS semua.

Run: `npx tsc --noEmit`
Expected: tidak ada error.

Run: `npm run lint`
Expected: tidak ada error.

Run: `npm run build`
Expected: build sukses, dan halaman `/kategori/[slug]` tetap terdaftar sebagai prerendered (SSG), bukan dynamic. Kalau berubah jadi dynamic, ada yang salah membaca search params di server.

- [ ] **Step 6: Commit**

```bash
git add components/reservation-panel.tsx
git commit -m "Buka form reservasi otomatis dari link barcode outlet"
```

---

## Setelah semua task selesai

Yang masih butuh tindakan user, di luar kode:

1. Jalankan `db/007_outlets.sql`, lalu `db/008_admin_users_outlet.sql`, lalu output `node scripts/create-outlets.ts` di Supabase SQL Editor — urut.
2. Buat akun Gmail khusus resort, aktifkan verifikasi 2 langkah, buat App Password.
3. Isi `SMTP_USER` dan `SMTP_PASSWORD` di `.env.local` dan di Vercel Production.
4. Isi `notify_email` tiap outlet dari `/panel-sanghyang/pengaturan`.
5. Buat akun captain per outlet. `scripts/create-admin.ts` belum bisa mengisi `outlet_id`, jadi untuk sekarang jalankan script itu lalu `update public.admin_users set outlet_id = '<id outlet>' where email = '...';` di Supabase. Kalau pembuatan akun captain lewat dashboard diperlukan, itu pekerjaan terpisah.
6. Uji kirim email sungguhan sekali: kirim satu reservasi uji dari `/kategori/<slug>?reservasi=1` dan pastikan emailnya masuk. Cek folder spam; tandai "bukan spam" sekali.
7. Login ulang sekali — sesi lama tanpa `role` sudah tidak sah.
