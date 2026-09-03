# Sistem Login Admin (Fase 6 Checkpoint 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bangun sistem login session-based untuk `/panel-sanghyang` (admin dashboard Sanghyang Resort) — tabel `admin_users` dengan password ter-hash, cookie sesi httpOnly, rate limit percobaan login, dan proteksi route otomatis — menggantikan Basic Auth hardcode dari versi Express lama.

**Architecture:** `middleware.ts` (Edge Runtime) mencegat semua request ke `/panel-sanghyang/*`, verifikasi JWT sesi dari cookie httpOnly pakai `jose`, redirect ke halaman login kalau tidak valid. Password di-hash dengan `scrypt` bawaan Node (bukan disimpan polos). Login/logout jalan lewat Server Action yang query `admin_users` lewat `service_role` (bypass RLS, tidak ada akses `anon` sama sekali ke tabel ini).

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres + `service_role` client), `jose` (JWT, baru ditambahkan), Node.js `crypto` bawaan (scrypt), `node:test` untuk unit test.

**Spec:** `docs/superpowers/specs/2026-09-03-admin-login-design.md`

## Global Constraints

- Path dashboard: `/panel-sanghyang` (bukan `/admin`) — semua route di bawahnya butuh login.
- Semua teks UI dalam Bahasa Indonesia.
- Durasi sesi: **8 jam** dari waktu login.
- Rate limit: kunci akun **15 menit** setelah **5 kali** gagal login berturut-turut; reset ke 0 begitu login berhasil.
- Cookie sesi: nama `sanghyang_admin_session`, httpOnly, `secure` di production, `sameSite=lax`, `path=/`.
- Password TIDAK PERNAH disimpan polos — hash `scrypt` bawaan Node, format `scrypt:<salt-hex>:<hash-hex>`.
- Pesan error login digeneralisasi ("Email atau password salah.") — tidak membedakan email tidak ada vs password salah.
- Dependency baru yang boleh ditambah: **hanya `jose`**.
- `db/005_admin_users.sql` **TIDAK dijalankan** oleh siapa pun yang mengerjakan plan ini — hanya dibuat untuk direview & dijalankan manual oleh user di Supabase SQL Editor.
- Tabel `admin_users` tidak punya RLS policy atau GRANT untuk `anon`/`authenticated` — hanya diakses lewat `service_role` (`lib/supabase/admin.ts` yang sudah ada).
- Ikuti pola kode yang sudah ada di `app/actions/reservation.ts` dan `lib/supabase/queries.ts` (Server Action dengan `'use server'`, cast `data as Type | null` alih-alih generic Supabase, komentar Bahasa Indonesia untuk hal yang tidak jelas dari kode).

---

### Task 1: Skema database, env var, dan dokumentasi

**Files:**
- Create: `db/005_admin_users.sql`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Produces: tabel `public.admin_users(id, email, password_hash, failed_attempts, locked_until, created_at)` — dipakai Task 6 (Server Actions). Env var `ADMIN_SESSION_SECRET` — dipakai Task 3 (session.ts).

- [ ] **Step 1: Tulis SQL migrasi (JANGAN dijalankan)**

Buat `db/005_admin_users.sql`:

```sql
-- Fase 6 — tabel admin_users untuk panel admin (/panel-sanghyang).
-- BELUM DIJALANKAN. Review dulu, lalu paste ke Supabase SQL Editor.
--
-- Menggantikan Basic Auth hardcode dari versi Express lama
-- (backend/src/middleware/adminAuth.js) dengan akun tersimpan & password
-- ter-hash. Password TIDAK PERNAH disimpan polos — lihat lib/admin/password.ts.

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,

  -- Rate limit percobaan login: terkunci sementara setelah beberapa kali
  -- gagal berturut-turut. Direset ke 0/null begitu login berhasil.
  failed_attempts int not null default 0,
  locked_until timestamptz,

  created_at timestamptz not null default now()
);

comment on table public.admin_users is
  'Akun staff untuk panel admin (/panel-sanghyang). Hanya diakses lewat service_role di server — tidak ada GRANT untuk anon/authenticated (default-deny).';

-- Sengaja TIDAK ada RLS policy atau GRANT untuk anon/authenticated: tabel ini
-- hanya boleh disentuh lewat service_role (BYPASSRLS) di server, sama seperti
-- reservation_requests (lihat 003_reservation_requests_revoke_anon.sql).
```

- [ ] **Step 2: Tambah `ADMIN_SESSION_SECRET` ke `.env.example`**

Di `.env.example`, tambahkan di baris paling bawah:

```
# Panel admin (Fase 6) — menandatangani cookie sesi login /panel-sanghyang.
# RAHASIA — string acak panjang, generate misalnya dengan:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ADMIN_SESSION_SECRET=
```

- [ ] **Step 3: Update daftar env var di `README.md`**

Di bagian "## Environment variables" (`README.md`), tambahkan baris baru di daftar:

```
- `ADMIN_SESSION_SECRET` — rahasia, server-only, untuk sesi login panel admin
```

- [ ] **Step 4: Commit**

```bash
git add db/005_admin_users.sql .env.example README.md
git commit -m "$(cat <<'EOF'
Tambah skema admin_users dan env var sesi admin (belum dijalankan)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Modul hashing password

**Files:**
- Create: `lib/admin/password.ts`
- Test: `scripts/admin-auth.test.ts`

**Interfaces:**
- Consumes: Node `crypto` (`randomBytes`, `scryptSync`, `timingSafeEqual`) — bawaan Node, tidak perlu import tambahan di `package.json`.
- Produces: `hashPassword(password: string): string`, `verifyPassword(password: string, stored: string): boolean` — dipakai Task 6 (Server Actions) dan Task 9 (`create-admin.ts`).

- [ ] **Step 1: Tulis test yang gagal**

Buat `scripts/admin-auth.test.ts`:

```ts
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
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `node --conditions=react-server --test scripts/admin-auth.test.ts`
Expected: FAIL — `Cannot find module '../lib/admin/password.ts'` (file belum ada).

- [ ] **Step 3: Implementasi minimal**

Buat `lib/admin/password.ts`:

```ts
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LENGTH = 64;

/**
 * Format: scrypt:<salt-hex>:<hash-hex>. Salt unik per password, digabung
 * dalam satu string supaya tidak perlu kolom terpisah di database.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hashHex] = parts;

  try {
    const hash = scryptSync(password, salt, KEY_LENGTH);
    const storedHash = Buffer.from(hashHex, 'hex');
    if (hash.length !== storedHash.length) return false;
    return timingSafeEqual(hash, storedHash);
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `node --conditions=react-server --test scripts/admin-auth.test.ts`
Expected: PASS — 4 test lolos.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/password.ts scripts/admin-auth.test.ts
git commit -m "$(cat <<'EOF'
Tambah modul hashing password admin (scrypt bawaan Node)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Modul token sesi (JWT via jose)

**Files:**
- Modify: `package.json` (tambah dependency `jose`)
- Create: `lib/admin/session.ts`
- Modify: `scripts/admin-auth.test.ts` (tambah test di akhir file)

**Interfaces:**
- Consumes: `ADMIN_SESSION_SECRET` dari `process.env` (Global Constraints).
- Produces: `createSessionToken(payload: SessionPayload): Promise<string>`, `verifySessionToken(token: string): Promise<SessionPayload | null>`, `SESSION_COOKIE_NAME: string`, `SESSION_MAX_AGE_SECONDS: number`, `type SessionPayload = { sub: string; email: string }` — dipakai Task 4 (`lib/admin/auth.ts`), Task 5 (`middleware.ts`), Task 6 (Server Actions).

- [ ] **Step 1: Install `jose`**

Run: `npm install jose@^5`
Expected: `package.json` dan `package-lock.json` berubah, ada `"jose": "^5.x.x"` di `dependencies`.

- [ ] **Step 2: Tulis test yang gagal**

Tambahkan di akhir `scripts/admin-auth.test.ts` (setelah test password yang sudah ada):

```ts
import { SignJWT } from 'jose';
import { createSessionToken, verifySessionToken } from '../lib/admin/session.ts';

process.env.ADMIN_SESSION_SECRET ||= 'rahasia-test-admin-session-panjang-banget';

test('createSessionToken lalu verifySessionToken -> payload sesuai', async () => {
  const token = await createSessionToken({ sub: 'admin-1', email: 'staff@sanghyang.com' });
  const payload = await verifySessionToken(token);
  assert.deepEqual(payload, { sub: 'admin-1', email: 'staff@sanghyang.com' });
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
```

Catatan: `import { SignJWT } from 'jose';` dan `process.env.ADMIN_SESSION_SECRET ||= ...` pindahkan ke bagian atas file (dekat import lain), bukan di tengah — tulisan di atas menunjukkan isinya, bukan urutan penempatan literalnya di file.

- [ ] **Step 3: Jalankan test, pastikan gagal**

Run: `node --conditions=react-server --test scripts/admin-auth.test.ts`
Expected: FAIL — `Cannot find module '../lib/admin/session.ts'`.

- [ ] **Step 4: Implementasi minimal**

Buat `lib/admin/session.ts`:

```ts
import { SignJWT, jwtVerify } from 'jose';

const ALG = 'HS256';
const SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8 jam

export const SESSION_COOKIE_NAME = 'sanghyang_admin_session';
export const SESSION_MAX_AGE_SECONDS = SESSION_DURATION_SECONDS;

export type SessionPayload = { sub: string; email: string };

function secretKey(): Uint8Array {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET belum diisi');
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: [ALG] });
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Jalankan test, pastikan lolos**

Run: `node --conditions=react-server --test scripts/admin-auth.test.ts`
Expected: PASS — 7 test lolos (4 dari Task 2 + 3 baru).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/admin/session.ts scripts/admin-auth.test.ts
git commit -m "$(cat <<'EOF'
Tambah modul token sesi admin (JWT via jose)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Helper `requireAdminSession()`

**Files:**
- Create: `lib/admin/auth.ts`

**Interfaces:**
- Consumes: `verifySessionToken`, `SESSION_COOKIE_NAME`, `type SessionPayload` dari `lib/admin/session.ts` (Task 3); `cookies` dari `next/headers`; `redirect` dari `next/navigation`.
- Produces: `requireAdminSession(): Promise<SessionPayload>` — dipakai checkpoint-checkpoint berikutnya (Server Action & Route Handler kelola katalog/konten) sebagai baris pertama tiap fungsi. Tidak dipakai task lain di plan ini (middleware Task 5 punya jalurnya sendiri karena beda runtime), tapi wajib ada sekarang supaya checkpoint berikutnya tinggal pakai.

Tidak ada test otomatis untuk file ini — ini pembungkus tipis di atas `verifySessionToken` yang sudah ditest di Task 3 (redirect + baca cookie adalah glue code, bukan logic baru). Diverifikasi manual di Task 10.

- [ ] **Step 1: Tulis helper**

Buat `lib/admin/auth.ts`:

```ts
import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken, SESSION_COOKIE_NAME, type SessionPayload } from './session';

/**
 * Panggil di baris pertama tiap Server Action / Route Handler di bawah
 * /panel-sanghyang. middleware.ts menangani redirect untuk halaman, tapi
 * Server Action & Route Handler tetap wajib cek sendiri — jangan asumsikan
 * middleware selalu jalan duluan untuk setiap kemungkinan jalur eksekusi.
 */
export async function requireAdminSession(): Promise<SessionPayload> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) redirect('/panel-sanghyang/login');
  return session;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/auth.ts
git commit -m "$(cat <<'EOF'
Tambah helper requireAdminSession untuk Server Action/Route Handler admin

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Middleware proteksi route

**Files:**
- Create: `middleware.ts`

**Interfaces:**
- Consumes: `verifySessionToken`, `SESSION_COOKIE_NAME` dari `lib/admin/session.ts` (Task 3).
- Produces: proteksi otomatis untuk semua route `/panel-sanghyang/*` — tidak diimpor file lain, Next.js menjalankannya otomatis berdasarkan `config.matcher`.

Tidak ada test otomatis (middleware butuh request Next.js sungguhan, sesuai lingkup testing di spec). Diverifikasi manual di Task 10.

- [ ] **Step 1: Tulis middleware**

Buat `middleware.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/admin/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (pathname === '/panel-sanghyang/login') {
    // Sudah login tapi buka halaman login lagi -> langsung ke dashboard.
    if (session) return NextResponse.redirect(new URL('/panel-sanghyang', request.url));
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL('/panel-sanghyang/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/panel-sanghyang/:path*',
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "$(cat <<'EOF'
Tambah middleware proteksi route /panel-sanghyang

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Server Action login() & logout()

**Files:**
- Create: `app/actions/admin-auth.ts`

**Interfaces:**
- Consumes: `getAdminClient` dari `@/lib/supabase/admin` (sudah ada); `verifyPassword` dari `@/lib/admin/password` (Task 2); `createSessionToken`, `SESSION_COOKIE_NAME`, `SESSION_MAX_AGE_SECONDS` dari `@/lib/admin/session` (Task 3); `cookies` dari `next/headers`; `redirect` dari `next/navigation`.
- Produces: `type LoginState = { error: string | null }`, `login(_prev: LoginState, formData: FormData): Promise<LoginState>`, `logout(): Promise<void>` — dipakai Task 7 (`login-form.tsx`) dan Task 8 (dashboard placeholder).

Tidak ada test otomatis untuk file ini — logic lockout & password sudah ditest lewat unit Task 2/3, sisanya query database langsung (butuh koneksi Supabase sungguhan, di luar lingkup `node --test`). Diverifikasi manual end-to-end di Task 10.

- [ ] **Step 1: Tulis Server Action**

Buat `app/actions/admin-auth.ts`:

```ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminClient } from '@/lib/supabase/admin';
import { verifyPassword } from '@/lib/admin/password';
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/admin/session';

export type LoginState = { error: string | null };

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const GENERIC_ERROR = 'Email atau password salah.';
const LOCKED_ERROR = 'Terlalu banyak percobaan gagal. Coba lagi dalam beberapa menit.';

type AdminRow = {
  id: string;
  email: string;
  password_hash: string;
  failed_attempts: number;
  locked_until: string | null;
};

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!process.env.ADMIN_SESSION_SECRET) {
    return { error: 'Server belum siap. Coba lagi sebentar lagi.' };
  }

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: GENERIC_ERROR };

  const supabase = getAdminClient();
  if (!supabase) return { error: 'Server belum siap. Coba lagi sebentar lagi.' };

  const { data } = await supabase
    .from('admin_users')
    .select('id, email, password_hash, failed_attempts, locked_until')
    .eq('email', email)
    .maybeSingle();
  const admin = data as AdminRow | null;

  if (!admin) return { error: GENERIC_ERROR };

  if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
    return { error: LOCKED_ERROR };
  }

  const valid = verifyPassword(password, admin.password_hash);

  if (!valid) {
    const nextAttempts = admin.failed_attempts + 1;
    const locked = nextAttempts >= MAX_FAILED_ATTEMPTS;
    await supabase
      .from('admin_users')
      .update({
        failed_attempts: nextAttempts,
        locked_until: locked
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
          : null,
      })
      .eq('id', admin.id);
    return { error: locked ? LOCKED_ERROR : GENERIC_ERROR };
  }

  await supabase
    .from('admin_users')
    .update({ failed_attempts: 0, locked_until: null })
    .eq('id', admin.id);

  const token = await createSessionToken({ sub: admin.id, email: admin.email });
  (await cookies()).set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect('/panel-sanghyang');
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE_NAME);
  redirect('/panel-sanghyang/login');
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add app/actions/admin-auth.ts
git commit -m "$(cat <<'EOF'
Tambah Server Action login/logout admin dengan rate limit

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Halaman login

**Files:**
- Create: `app/panel-sanghyang/login/login-form.tsx`
- Create: `app/panel-sanghyang/login/page.tsx`

**Interfaces:**
- Consumes: `login`, `type LoginState` dari `@/app/actions/admin-auth` (Task 6); `Button`, `Input`, `Label` dari `@/components/ui/*` (sudah ada, sama seperti dipakai `components/reservation-panel.tsx`).
- Produces: halaman `/panel-sanghyang/login` yang bisa diakses (middleware Task 5 membiarkan path ini lewat tanpa sesi).

- [ ] **Step 1: Tulis komponen form (Client Component)**

Buat `app/panel-sanghyang/login/login-form.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { login, type LoginState } from '@/app/actions/admin-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const EMPTY: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, EMPTY);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className="h-11"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-11"
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-11 w-full rounded-full">
        {pending && <Loader2 className="animate-spin" />}
        {pending ? 'Masuk…' : 'Masuk'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Tulis halaman (Server Component)**

Buat `app/panel-sanghyang/login/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Login — Panel Admin',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="font-heading text-2xl">Sanghyang Resort</h1>
        <p className="mt-1 text-sm text-muted-foreground">Masuk ke panel admin.</p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck & lint**

Run: `npx tsc --noEmit && npx eslint app/panel-sanghyang/login`
Expected: tidak ada error.

- [ ] **Step 4: Commit**

```bash
git add app/panel-sanghyang/login/
git commit -m "$(cat <<'EOF'
Tambah halaman login panel admin

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Placeholder dashboard + logout

**Files:**
- Create: `app/panel-sanghyang/page.tsx`

**Interfaces:**
- Consumes: `logout` dari `@/app/actions/admin-auth` (Task 6); `Button` dari `@/components/ui/button`.
- Produces: halaman `/panel-sanghyang` yang jadi tujuan redirect setelah login berhasil (dipakai `login()` di Task 6) — akan digantikan dashboard sungguhan di checkpoint berikutnya.

- [ ] **Step 1: Tulis halaman**

Buat `app/panel-sanghyang/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { logout } from '@/app/actions/admin-auth';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Panel Admin',
  robots: { index: false, follow: false },
};

export default function AdminDashboardPage() {
  return (
    <main className="min-h-screen bg-muted p-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl">Panel Admin</h1>
          <form action={logout}>
            <Button type="submit" variant="ghost">
              Keluar
            </Button>
          </form>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Berhasil login. Ringkasan reservasi, kelola katalog, dan kelola konten
          menyusul di checkpoint berikutnya.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck & lint**

Run: `npx tsc --noEmit && npx eslint app/panel-sanghyang/page.tsx`
Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add app/panel-sanghyang/page.tsx
git commit -m "$(cat <<'EOF'
Tambah placeholder dashboard admin dengan tombol keluar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Script bootstrap akun admin pertama

**Files:**
- Create: `scripts/create-admin.ts`

**Interfaces:**
- Consumes: `hashPassword` dari `../lib/admin/password.ts` (Task 2).
- Produces: script CLI standalone, dijalankan manual oleh user — tidak diimpor file lain. Tidak menyentuh Supabase/env sama sekali (murni generate hash + teks SQL).

- [ ] **Step 1: Tulis script**

Buat `scripts/create-admin.ts`:

```ts
// Bootstrap akun admin pertama. Tidak ada halaman signup publik — jalankan
// sekali secara lokal, lalu tempel SQL yang dicetak ke Supabase SQL Editor
// (setelah tabel admin_users dibuat lewat db/005_admin_users.sql).
//
// Pemakaian: node scripts/create-admin.ts <email> <password>
import { hashPassword } from '../lib/admin/password.ts';

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error('Pemakaian: node scripts/create-admin.ts <email> <password>');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password minimal 8 karakter.');
  process.exit(1);
}

const hash = hashPassword(password);
const escapedEmail = email.replace(/'/g, "''");

console.log('Password hash:');
console.log(hash);
console.log('');
console.log('SQL siap-tempel (Supabase SQL Editor, setelah admin_users dibuat):');
console.log('');
console.log('insert into public.admin_users (email, password_hash) values');
console.log(`  ('${escapedEmail}', '${hash}');`);
```

- [ ] **Step 2: Jalankan manual untuk sanity check**

Run: `node scripts/create-admin.ts staff@sanghyang.com passwordtest123`
Expected: output berisi `Password hash:` diikuti string `scrypt:...`, lalu blok `insert into public.admin_users ...` dengan email dan hash yang sama.

- [ ] **Step 3: Commit**

```bash
git add scripts/create-admin.ts
git commit -m "$(cat <<'EOF'
Tambah script CLI bootstrap akun admin pertama

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Verifikasi end-to-end manual

**Files:** Tidak ada file baru — task ini murni verifikasi.

**Interfaces:** Tidak ada.

Task ini butuh migrasi `db/005_admin_users.sql` (Task 1) **sudah dijalankan manual oleh user** di Supabase SQL Editor, dan `ADMIN_SESSION_SECRET` sudah diisi di `.env.local`. Kalau user belum konfirmasi keduanya, hentikan di sini dan tanya dulu — jangan asumsikan sudah dijalankan.

- [ ] **Step 1: Jalankan seluruh test suite**

Run: `npm test`
Expected: semua test PASS (termasuk `admin-auth.test.ts` dari Task 2/3, dan test lain yang sudah ada seperti `antispam.test.ts`, `reservation.test.ts`).

- [ ] **Step 2: Typecheck & lint seluruh proyek**

Run: `npx tsc --noEmit && npx eslint .`
Expected: tidak ada error.

- [ ] **Step 3: Buat akun admin test**

Run: `node scripts/create-admin.ts test-e2e@sanghyang.com TestPassword123`

Salin SQL `insert` yang dicetak, minta user menjalankannya di Supabase SQL Editor (atau kalau user sudah kasih kredensial Supabase untuk dipakai langsung, jalankan lewat koneksi `pg` seperti pola verifikasi di task-task sebelumnya).

- [ ] **Step 4: Jalankan dev server**

Run: `npm run dev`
Expected: server jalan di `http://localhost:3000` (atau port lain kalau 3000 terpakai).

- [ ] **Step 5: Verifikasi redirect guard (belum login)**

Buka `http://localhost:3000/panel-sanghyang` di browser tanpa cookie sesi (mode private/incognito).
Expected: redirect otomatis ke `/panel-sanghyang/login`.

- [ ] **Step 6: Verifikasi login gagal + pesan generik**

Di halaman login, masuk dengan email `test-e2e@sanghyang.com` dan password salah.
Expected: pesan "Email atau password salah." muncul, tetap di halaman login.

- [ ] **Step 7: Verifikasi rate limit**

Ulangi Step 6 empat kali lagi (total 5 kali gagal berturut-turut).
Expected: percobaan ke-5 (atau setelahnya) menampilkan pesan "Terlalu banyak percobaan gagal. Coba lagi dalam beberapa menit." — bahkan kalau setelah itu password yang dimasukkan BENAR, tetap ditolak dengan pesan yang sama (akun sedang terkunci).

- [ ] **Step 8: Verifikasi reset lockout**

Jalankan query manual untuk reset lockout (simulasikan waktu terkunci sudah lewat):

```sql
update public.admin_users
set failed_attempts = 0, locked_until = null
where email = 'test-e2e@sanghyang.com';
```

- [ ] **Step 9: Verifikasi login berhasil**

Login dengan email `test-e2e@sanghyang.com` dan password `TestPassword123` (benar).
Expected: redirect ke `/panel-sanghyang`, halaman placeholder dashboard muncul ("Berhasil login...").

- [ ] **Step 10: Verifikasi cookie**

Di DevTools browser (Application/Storage → Cookies), cek cookie `sanghyang_admin_session`.
Expected: ada, flag `HttpOnly` tercentang, `Path=/`, `SameSite=Lax`.

- [ ] **Step 11: Verifikasi akses langsung ke dashboard (sudah login)**

Buka tab baru (masih browser yang sama, cookie masih ada), langsung akses `http://localhost:3000/panel-sanghyang`.
Expected: langsung masuk ke dashboard placeholder, tidak redirect ke login.

- [ ] **Step 12: Verifikasi redirect login->dashboard kalau sudah login**

Sambil masih login, akses `http://localhost:3000/panel-sanghyang/login` langsung.
Expected: redirect otomatis ke `/panel-sanghyang` (tidak menampilkan form login lagi).

- [ ] **Step 13: Verifikasi logout**

Klik tombol "Keluar" di dashboard placeholder.
Expected: redirect ke `/panel-sanghyang/login`, cookie `sanghyang_admin_session` hilang dari DevTools.

- [ ] **Step 14: Verifikasi guard setelah logout**

Coba akses `http://localhost:3000/panel-sanghyang` lagi setelah logout.
Expected: redirect ke `/panel-sanghyang/login` (sesi benar-benar hilang, bukan cuma UI).

- [ ] **Step 15: Bersihkan akun test**

Setelah semua langkah di atas lolos, minta user menjalankan (atau jalankan lewat koneksi `pg` yang sudah dipakai sebelumnya di percakapan ini):

```sql
delete from public.admin_users where email = 'test-e2e@sanghyang.com';
```

Laporkan ke user: semua langkah yang PASS/FAIL, dan konfirmasi checkpoint 1 selesai sebelum lanjut ke checkpoint 2 (dashboard utama).
