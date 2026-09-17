# Lupa Password Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin panel (`/panel-sanghyang`) dapat alur self-service reset
password: request lewat email, klik link, set password baru.

**Architecture:** Tabel baru `admin_password_resets` nyimpen token yang
di-hash (reuse `hashPassword`/`verifyPassword` dari `lib/admin/password.ts`
— format sama persis dengan password, jadi gak perlu fungsi hash baru).
Dua Server Action baru (`mintaReset`, `resetPassword`) di
`app/actions/admin-lupa-password.ts`, dua halaman baru, dan satu email
template baru yang dikirim lewat `lib/notify/mailer.ts` yang sudah ada.
Pola anti-enumeration ikut persis `app/actions/admin-auth.ts` (dummy hash
buat nyamain waktu respons).

**Tech Stack:** Next.js Server Actions, React `useActionState`, Supabase
(service_role client via `getAdminClient()`), scrypt (Node `crypto`,
sudah ada), nodemailer (sudah ada lewat `lib/notify/mailer.ts`).

**Spec:** `docs/superpowers/specs/2026-09-18-lupa-password-admin-design.md`

## Global Constraints

- Token tidak pernah disimpan polos di DB — hash pakai `hashPassword()`
  dari `lib/admin/password.ts`, verify pakai `verifyPassword()`.
- Token valid 30 menit, sekali pakai (`used_at`).
- Response request reset SELALU sama persis (pesan generik), gak peduli
  email terdaftar atau tidak — anti-enumeration, ikut pola
  `DUMMY_HASH`/`verifyPassword(password, DUMMY_HASH)` di
  `app/actions/admin-auth.ts:25,59`.
- Rate limit request: max 3 token per `admin_user_id` per jam.
- Reset sukses: `failed_attempts = 0`, `locked_until = null` (sama seperti
  login sukses di `admin-auth.ts:85-88`).
- `service_role` di project ini TIDAK otomatis dapat privilege tabel baru
  — wajib `grant` eksplisit di migration SQL.
- Migration file JANGAN langsung dijalankan — cuma dibuat, ada komentar
  "BELUM DIJALANKAN. Review dulu..." di header (ikuti pola
  `db/007_outlets.sql`, `db/005_admin_users.sql`), user yang jalankan
  manual di Supabase SQL Editor.

---

### Task 1: Migration SQL + fungsi token (hash/verify/expiry)

**Files:**
- Create: `db/011_admin_password_resets.sql`
- Create: `lib/admin/password-reset.ts`
- Test: `scripts/admin-password-reset.test.ts`

**Interfaces:**
- Produces:
  - `generateResetToken(): string` — token asli, random, url-safe (dipakai
    di query param & email link)
  - `hashResetToken(token: string): string` — reuse `hashPassword` dari
    `lib/admin/password.ts` (format sama, cuma nama beda biar jelas
    konteksnya token bukan password)
  - `verifyResetToken(token: string, stored: string): boolean` — reuse
    `verifyPassword`
  - `resetTokenExpiresAt(): string` — ISO timestamp `now() + 30 menit`,
    dipakai isi kolom `expires_at` saat insert
  - `isResetTokenExpired(expiresAt: string): boolean` — `new Date(expiresAt)
    < new Date()`

- [ ] **Step 1: Tulis migration SQL**

```sql
-- db/011_admin_password_resets.sql
-- Fase 6B — reset password self-service untuk admin_users.
-- BELUM DIJALANKAN. Review dulu, lalu paste ke Supabase SQL Editor.
--
-- Token TIDAK PERNAH disimpan polos — token_hash pakai format yang sama
-- dengan admin_users.password_hash (scrypt:<salt>:<hash>), lihat
-- lib/admin/password-reset.ts.

create table if not exists public.admin_password_resets (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.admin_password_resets is
  'Token reset password admin panel. Token asli cuma ada di email, DB cuma nyimpan hash-nya. Hanya diakses lewat service_role di server.';

-- Sengaja TIDAK ada RLS/GRANT untuk anon/authenticated: default-deny sama
-- seperti admin_users.
grant select, insert, update on public.admin_password_resets to service_role;
```

- [ ] **Step 2: Tulis `lib/admin/password-reset.ts`**

```typescript
import { randomBytes } from 'crypto';
import { hashPassword, verifyPassword } from './password';

const TOKEN_BYTES = 32;
const EXPIRY_MINUTES = 30;

/** Token asli — cuma pernah ada di URL email, TIDAK PERNAH disimpan polos di DB. */
export function generateResetToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** Reuse format hash password (scrypt:<salt>:<hash>) — token juga rahasia,
 *  aturan penyimpanannya sama. */
export function hashResetToken(token: string): string {
  return hashPassword(token);
}

export function verifyResetToken(token: string, stored: string): boolean {
  return verifyPassword(token, stored);
}

export function resetTokenExpiresAt(): string {
  return new Date(Date.now() + EXPIRY_MINUTES * 60_000).toISOString();
}

export function isResetTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}
```

- [ ] **Step 3: Tulis test**

```typescript
// scripts/admin-password-reset.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateResetToken,
  hashResetToken,
  verifyResetToken,
  resetTokenExpiresAt,
  isResetTokenExpired,
} from '../lib/admin/password-reset.ts';

test('generateResetToken menghasilkan token unik tiap panggilan', () => {
  const a = generateResetToken();
  const b = generateResetToken();
  assert.notEqual(a, b);
  assert.ok(a.length > 20);
});

test('hashResetToken lalu verifyResetToken cocok untuk token yang sama', () => {
  const token = generateResetToken();
  const hash = hashResetToken(token);
  assert.equal(verifyResetToken(token, hash), true);
});

test('verifyResetToken gagal untuk token yang salah', () => {
  const hash = hashResetToken(generateResetToken());
  assert.equal(verifyResetToken('token-salah', hash), false);
});

test('resetTokenExpiresAt menghasilkan waktu 30 menit ke depan', () => {
  const expires = new Date(resetTokenExpiresAt()).getTime();
  const now = Date.now();
  assert.ok(expires > now + 29 * 60_000);
  assert.ok(expires < now + 31 * 60_000);
});

test('isResetTokenExpired true untuk waktu di masa lalu', () => {
  assert.equal(isResetTokenExpired(new Date(Date.now() - 1000).toISOString()), true);
});

test('isResetTokenExpired false untuk waktu di masa depan', () => {
  assert.equal(isResetTokenExpired(new Date(Date.now() + 1000).toISOString()), false);
});
```

- [ ] **Step 4: Jalankan test, pastikan pass**

Run: `node --conditions=react-server --test scripts/admin-password-reset.test.ts`
Expected: 6/6 pass.

- [ ] **Step 5: Commit**

```bash
git add db/011_admin_password_resets.sql lib/admin/password-reset.ts scripts/admin-password-reset.test.ts
git commit -m "Tambah migration + fungsi token reset password admin"
```

---

### Task 2: Email template reset password

**Files:**
- Create: `lib/notify/password-reset-email.ts`

**Interfaces:**
- Consumes: `sendMail`, `mailerReady` dari `lib/notify/mailer.ts` (sudah
  ada, signature: `sendMail(input: {to, subject, html, text}): Promise<void>`,
  `mailerReady(): boolean`)
- Produces:
  - `sendPasswordResetEmail(to: string, resetLink: string): Promise<void>`
    — TIDAK PERNAH melempar (sama prinsip `send-reservation-notice.ts`),
    log warning kalau `mailerReady()` false atau `sendMail` gagal.

- [ ] **Step 1: Tulis `lib/notify/password-reset-email.ts`**

```typescript
import 'server-only';
import { mailerReady, sendMail } from './mailer';

/**
 * Kirim email link reset password. TIDAK PERNAH melempar — dipanggil dari
 * Server Action yang harus selalu balas sukses generik ke user (anti-
 * enumeration), jadi kegagalan kirim email cuma dicatat di log server.
 */
export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  if (!mailerReady()) {
    console.warn(`[password-reset] SMTP belum siap, email ke ${to} dilewati`);
    return;
  }

  const subject = 'Reset Password Panel Admin Sanghyang Resort';
  const text =
    `Ada permintaan reset password untuk akun panel admin Anda.\n\n` +
    `Klik link berikut untuk mengatur password baru (berlaku 30 menit):\n${resetLink}\n\n` +
    `Kalau Anda tidak meminta ini, abaikan email ini saja.`;
  const html =
    `<p>Ada permintaan reset password untuk akun panel admin Anda.</p>` +
    `<p><a href="${resetLink}">Klik di sini untuk mengatur password baru</a> (berlaku 30 menit).</p>` +
    `<p>Kalau Anda tidak meminta ini, abaikan email ini saja.</p>`;

  try {
    await sendMail({ to, subject, html, text });
  } catch (err) {
    console.error(`[password-reset] Gagal kirim email ke ${to}:`, err);
  }
}
```

- [ ] **Step 2: Verifikasi tidak ada error tipe**

Run: `npx tsc --noEmit`
Expected: tidak ada error baru dari file ini (satu-satunya error yang boleh
muncul adalah `LayoutProps` di `app/layout.tsx` — sudah ada sebelum plan
ini, bukan dari perubahan ini).

- [ ] **Step 3: Commit**

```bash
git add lib/notify/password-reset-email.ts
git commit -m "Tambah email template reset password admin"
```

---

### Task 3: Server Action `mintaReset` + halaman request

**Files:**
- Create: `app/actions/admin-lupa-password.ts`
- Create: `app/panel-sanghyang/lupa-password/page.tsx`
- Create: `app/panel-sanghyang/lupa-password/lupa-password-form.tsx`
- Modify: `app/panel-sanghyang/login/login-form.tsx:43` (tambah link ke
  halaman lupa password, di bawah field password)

**Interfaces:**
- Consumes:
  - `getAdminClient()` dari `@/lib/supabase/admin` (sudah ada)
  - `generateResetToken`, `hashResetToken`, `resetTokenExpiresAt` dari
    `@/lib/admin/password-reset` (Task 1)
  - `sendPasswordResetEmail` dari `@/lib/notify/password-reset-email`
    (Task 2)
- Produces:
  - `export type MintaResetState = { message: string | null }`
  - `export async function mintaReset(prevState: MintaResetState, formData:
    FormData): Promise<MintaResetState>` — dipakai Task 3's form. SELALU
    return message sukses generik yang sama, gak pernah return error
    (anti-enumeration di level UI juga — gak ada state error terpisah).

- [ ] **Step 1: Tulis `app/actions/admin-lupa-password.ts` (bagian `mintaReset`)**

```typescript
'use server';

import { getAdminClient } from '@/lib/supabase/admin';
import { generateResetToken, hashResetToken, resetTokenExpiresAt } from '@/lib/admin/password-reset';
import { sendPasswordResetEmail } from '@/lib/notify/password-reset-email';

export type MintaResetState = { message: string | null };

const GENERIC_MESSAGE =
  'Kalau email terdaftar, link reset sudah dikirim. Cek inbox (dan folder spam).';
const RATE_LIMIT_PER_HOUR = 3;

export async function mintaReset(
  _prev: MintaResetState,
  formData: FormData
): Promise<MintaResetState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) return { message: GENERIC_MESSAGE };

  const supabase = getAdminClient();
  if (!supabase) return { message: GENERIC_MESSAGE };

  const { data: admin } = await supabase
    .from('admin_users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (!admin) return { message: GENERIC_MESSAGE };

  const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
  const { count } = await supabase
    .from('admin_password_resets')
    .select('id', { count: 'exact', head: true })
    .eq('admin_user_id', admin.id)
    .gte('created_at', oneHourAgo);

  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) return { message: GENERIC_MESSAGE };

  const token = generateResetToken();
  const { error } = await supabase.from('admin_password_resets').insert({
    admin_user_id: admin.id,
    token_hash: hashResetToken(token),
    expires_at: resetTokenExpiresAt(),
  });

  if (!error) {
    const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '') ?? '';
    const resetLink = `${base}/panel-sanghyang/reset-password?token=${token}`;
    await sendPasswordResetEmail(admin.email, resetLink);
  }

  return { message: GENERIC_MESSAGE };
}
```

- [ ] **Step 2: Tulis `app/panel-sanghyang/lupa-password/lupa-password-form.tsx`**

```tsx
'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { mintaReset, type MintaResetState } from '@/app/actions/admin-lupa-password';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const EMPTY: MintaResetState = { message: null };

export function LupaPasswordForm() {
  const [state, formAction, pending] = useActionState(mintaReset, EMPTY);

  if (state.message) {
    return <p className="text-sm">{state.message}</p>;
  }

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="username" className="h-11" />
      </div>
      <Button type="submit" disabled={pending} className="h-11 w-full rounded-full">
        {pending && <Loader2 className="animate-spin" />}
        {pending ? 'Mengirim…' : 'Kirim link reset'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Tulis `app/panel-sanghyang/lupa-password/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { LupaPasswordForm } from './lupa-password-form';

export const metadata: Metadata = {
  title: 'Lupa Password — Panel Admin',
  robots: { index: false, follow: false },
};

export default function LupaPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="font-heading text-2xl">Lupa Password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Masukkan email akun panel admin Anda.
        </p>
        <div className="mt-6">
          <LupaPasswordForm />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Tambah link di `login-form.tsx`**

Tambahkan setelah blok password (baris 37, sebelum `{state.error && ...}`):

```tsx
      <a
        href="/panel-sanghyang/lupa-password"
        className="text-right text-sm text-muted-foreground underline underline-offset-4"
      >
        Lupa password?
      </a>
```

- [ ] **Step 5: Verifikasi tipe + lint**

Run: `npx tsc --noEmit && npx eslint app/actions/admin-lupa-password.ts app/panel-sanghyang/lupa-password/lupa-password-form.tsx app/panel-sanghyang/lupa-password/page.tsx app/panel-sanghyang/login/login-form.tsx`
Expected: tidak ada error baru (kecuali `LayoutProps` yang sudah ada
sebelumnya).

- [ ] **Step 6: Commit**

```bash
git add app/actions/admin-lupa-password.ts app/panel-sanghyang/lupa-password app/panel-sanghyang/login/login-form.tsx
git commit -m "Tambah halaman + Server Action request reset password admin"
```

---

### Task 4: Server Action `resetPassword` + halaman set password baru

**Files:**
- Modify: `app/actions/admin-lupa-password.ts` (tambah `resetPassword` di
  file yang sama dengan `mintaReset`, konsisten dengan pola
  `admin-katalog.ts` yang gabung `simpanKategori` + `simpanItem`)
- Create: `app/panel-sanghyang/reset-password/page.tsx`
- Create: `app/panel-sanghyang/reset-password/reset-password-form.tsx`

**Interfaces:**
- Consumes:
  - `verifyResetToken`, `isResetTokenExpired` dari
    `@/lib/admin/password-reset` (Task 1)
  - `hashPassword` dari `@/lib/admin/password` (sudah ada)
- Produces:
  - `export type ResetPasswordState = { error: string | null; success: boolean }`
  - `export async function resetPassword(prevState: ResetPasswordState,
    formData: FormData): Promise<ResetPasswordState>`

- [ ] **Step 1: Tambah `resetPassword` ke `app/actions/admin-lupa-password.ts`**

Tambahkan di bawah `mintaReset`, dan tambahkan import
`verifyResetToken, isResetTokenExpired` ke baris import
`@/lib/admin/password-reset` yang sudah ada, plus import baru
`hashPassword` dari `@/lib/admin/password`:

```typescript
import { hashPassword } from '@/lib/admin/password';
// ...gabung ke baris import yang sudah ada:
// import { generateResetToken, hashResetToken, resetTokenExpiresAt, verifyResetToken, isResetTokenExpired } from '@/lib/admin/password-reset';

export type ResetPasswordState = { error: string | null; success: boolean };

const TOKEN_INVALID_ERROR = 'Link reset tidak valid atau sudah kedaluwarsa. Minta link baru.';

export async function resetPassword(
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  if (!token || !password) return { error: TOKEN_INVALID_ERROR, success: false };
  if (password.length < 8) {
    return { error: 'Password minimal 8 karakter.', success: false };
  }

  const supabase = getAdminClient();
  if (!supabase) return { error: TOKEN_INVALID_ERROR, success: false };

  const { data: candidates } = await supabase
    .from('admin_password_resets')
    .select('id, admin_user_id, token_hash, expires_at, used_at')
    .is('used_at', null)
    .gte('expires_at', new Date().toISOString());

  const match = (candidates ?? []).find((row) => verifyResetToken(token, row.token_hash));
  if (!match) return { error: TOKEN_INVALID_ERROR, success: false };
  if (isResetTokenExpired(match.expires_at)) {
    return { error: TOKEN_INVALID_ERROR, success: false };
  }

  await supabase
    .from('admin_users')
    .update({ password_hash: hashPassword(password), failed_attempts: 0, locked_until: null })
    .eq('id', match.admin_user_id);

  await supabase
    .from('admin_password_resets')
    .update({ used_at: new Date().toISOString() })
    .eq('id', match.id);

  return { error: null, success: true };
}
```

**Catatan implementer:** query filter `.gte('expires_at', ...)` di DB
sudah menyaring sebagian besar token expired, tapi `isResetTokenExpired`
tetap dipanggil di kode sebagai lapis kedua (defense in depth, murah, dan
menghindari bug kalau nanti query berubah). Ini disengaja, bukan
duplikasi yang perlu dihapus.

- [ ] **Step 2: Tulis `app/panel-sanghyang/reset-password/reset-password-form.tsx`**

```tsx
'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { resetPassword, type ResetPasswordState } from '@/app/actions/admin-lupa-password';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const EMPTY: ResetPasswordState = { error: null, success: false };

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPassword, EMPTY);

  if (state.success) {
    return (
      <p className="text-sm">
        Password berhasil diganti.{' '}
        <a href="/panel-sanghyang/login" className="underline underline-offset-4">
          Masuk sekarang
        </a>
        .
      </p>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="grid gap-1.5">
        <Label htmlFor="password">Password Baru</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
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
        {pending ? 'Menyimpan…' : 'Simpan Password Baru'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Tulis `app/panel-sanghyang/reset-password/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = {
  title: 'Reset Password — Panel Admin',
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="font-heading text-2xl">Reset Password</h1>
        {token ? (
          <div className="mt-6">
            <ResetPasswordForm token={token} />
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Link tidak valid. Minta link reset baru dari halaman{' '}
            <a href="/panel-sanghyang/lupa-password" className="underline underline-offset-4">
              lupa password
            </a>
            .
          </p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verifikasi tipe + lint**

Run: `npx tsc --noEmit && npx eslint app/actions/admin-lupa-password.ts app/panel-sanghyang/reset-password/reset-password-form.tsx app/panel-sanghyang/reset-password/page.tsx`
Expected: tidak ada error baru (kecuali `LayoutProps` pre-existing).

- [ ] **Step 5: Jalankan semua test project sekali**

Run: `node --conditions=react-server --test scripts/*.test.ts`
Expected: semua test pass, termasuk 6 test dari Task 1.

- [ ] **Step 6: Commit**

```bash
git add app/actions/admin-lupa-password.ts app/panel-sanghyang/reset-password
git commit -m "Tambah Server Action + halaman set password baru"
```

---

## Setelah Semua Task Selesai

- Migration `db/011_admin_password_resets.sql` BELUM dijalankan — user
  perlu paste ke Supabase SQL Editor manual.
- Fitur baru aktif nyata setelah `SMTP_USER`/`SMTP_PASSWORD` diisi di
  `.env.local` dan Vercel (lihat CLAUDE.md, "Setup manual Checkpoint 2").
  Sebelum itu, request reset tetap jalan (token dibuat), tapi email gak
  terkirim — user dapat pesan sukses generik yang sama seolah terkirim.
