# Kelola Katalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner bisa tambah & edit kategori (`services`) dan item (`service_items`) — nama, deskripsi, harga, foto — langsung dari `/panel-sanghyang/katalog`, termasuk upload foto ke Supabase Storage, tanpa buka Supabase Table Editor.

**Architecture:** Pola sama seperti Kelola Konten & Pengaturan Outlet yang sudah ada: Server Component ambil data lewat `requireScopedClient()` (owner-only), form Client Component pakai `useActionState` supaya bisa nampilin pesan error, Server Action nulis ke database + upload foto + `revalidatePath()`. Foto dikompres/di-resize di browser (Canvas API, native, tanpa dependency baru) sebelum dikirim ke server, lalu disimpan ke bucket Storage baru `katalog`.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (`@supabase/supabase-js`, Storage), React 19 `useActionState`, `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-16-kelola-katalog-design.md`

## Global Constraints

- File SQL **ditulis, tidak dijalankan**. User yang menjalankan manual di Supabase SQL Editor.
- **Tidak ada tombol hapus** kategori atau item di UI ini sama sekali (lihat spec, bagian "Di luar cakupan").
- Slug kategori (`services.type`) dibuat otomatis sekali saat create, lalu **tidak pernah bisa diubah** lagi — tidak ada input untuk itu di form edit.
- Kategori dengan `booking_method = 'exely'` (Rooms) **tidak boleh** ke-overwrite jadi `self_service` kalau owner edit nama/foto/deskripsinya lewat form yang sama. Field ini dikunci di UI dan dipertahankan di Server Action lewat nilai sebelumnya, bukan diasumsikan ulang dari checkbox.
- Dependency baru: **tidak ada**. Kompresi foto pakai Canvas API browser bawaan, bukan library.
- `service_role` Supabase punya akses penuh ke Storage API secara default (beda dari privilege tabel biasa) — bucket + policy baca publik saja yang perlu dibuat lewat SQL.
- Semua halaman/action di sini **owner-only**, pola sama seperti `/panel-sanghyang/konten`: cek `session.role !== 'owner'` lalu tampilkan pesan "khusus pemilik" atau `return { error: 'Khusus pemilik.' }`.
- Test dijalankan dengan `npm test` (`node --conditions=react-server --test scripts/*.test.ts`). Hanya logika murni (slug, validasi harga, parsing URL foto) yang dites otomatis — upload Storage sungguhan & alur UI dites manual (sama seperti SMTP di plan Reservasi per Outlet).
- Komentar dan teks UI dalam bahasa Indonesia.
- Tampilan fungsional seperlunya, sama gaya minimal seperti halaman admin lain (plain HTML + Tailwind, bukan komponen shadcn) — bukan `card-surface`/`btn-pill` ala halaman publik.

---

### Task 1: Storage bucket `katalog` + domain foto di Next config

**Files:**
- Create: `db/010_katalog_storage.sql`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: `process.env.NEXT_PUBLIC_SUPABASE_URL` (sudah ada di `.env.local`).
- Produces: bucket Storage publik `katalog`; `next.config.ts` mengizinkan `next/image` merender URL dari domain Supabase Storage.

- [ ] **Step 1: Tulis `db/010_katalog_storage.sql`**

```sql
-- Fase 6B — bucket Storage untuk foto kategori & item katalog.
-- BELUM DIJALANKAN. Review dulu, lalu paste ke Supabase SQL Editor.
--
-- Baca publik supaya foto tampil di halaman publik tanpa auth. Tulis/ubah/
-- hapus sengaja TIDAK dibuka untuk anon/authenticated — service_role (dipakai
-- Server Action panel admin) punya akses penuh ke Storage API secara default,
-- beda dari privilege tabel biasa yang butuh GRANT eksplisit di project ini.

insert into storage.buckets (id, name, public)
values ('katalog', 'katalog', true)
on conflict (id) do nothing;

create policy "Baca publik bucket katalog"
on storage.objects for select
using (bucket_id = 'katalog');
```

- [ ] **Step 2: Tambah domain Storage ke `next.config.ts`**

Modify `next.config.ts` — ganti bagian `images` (baris 11-15):

```ts
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // ...
  images: {
    // Foto lama masih di situs utama resort; foto baru dari Kelola Katalog
    // masuk ke Supabase Storage. Daftar host ini juga mencegah /_next/image
    // dipakai sebagai proxy SSRF ke host lain.
    remotePatterns: [
      { protocol: "https", hostname: "sanghyang.com" },
      ...(supabaseHost ? [{ protocol: "https" as const, hostname: supabaseHost }] : []),
    ],
  },
  // ...
};
```

- [ ] **Step 3: Verifikasi build tidak rusak**

Run: `npm run lint && npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 4: Commit**

```bash
git add db/010_katalog_storage.sql next.config.ts
git commit -m "Tambah bucket Storage katalog + domain foto di next.config"
```

---

### Task 2: `lib/katalog/slug.ts`

**Files:**
- Create: `lib/katalog/slug.ts`
- Test: `scripts/katalog-slug.test.ts`

**Interfaces:**
- Consumes: tidak ada (fungsi murni).
- Produces: `slugify(name: string): string`, `uniqueSlug(base: string, existing: readonly string[]): string`.

- [ ] **Step 1: Tulis test**

```ts
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
```

- [ ] **Step 2: Jalankan test, pastikan gagal (modul belum ada)**

Run: `node --conditions=react-server --test scripts/katalog-slug.test.ts`
Expected: FAIL — `Cannot find module '../lib/katalog/slug.ts'`

- [ ] **Step 3: Tulis `lib/katalog/slug.ts`**

```ts
/** "Kids Club!" -> "kids-club". Dipakai sekali saat kategori dibuat lewat
 *  dashboard; hasilnya dikunci selamanya karena dipakai di URL publik
 *  (/kategori/<slug>) — lihat Global Constraints di plan ini. */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'kategori';
}

/** Tambah angka di belakang kalau slug-nya sudah dipakai kategori lain. */
export function uniqueSlug(base: string, existing: readonly string[]): string {
  if (!existing.includes(base)) return base;
  let n = 2;
  while (existing.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `node --conditions=react-server --test scripts/katalog-slug.test.ts`
Expected: PASS, 7 test lulus.

- [ ] **Step 5: Commit**

```bash
git add lib/katalog/slug.ts scripts/katalog-slug.test.ts
git commit -m "Tambah slugify + uniqueSlug untuk kategori baru"
```

---

### Task 3: `lib/katalog/validation.ts`

**Files:**
- Create: `lib/katalog/validation.ts`
- Test: `scripts/katalog-validation.test.ts`

**Interfaces:**
- Consumes: tidak ada (fungsi murni).
- Produces: `parsePrice(raw: string): number | null`.

- [ ] **Step 1: Tulis test**

```ts
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
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `node --conditions=react-server --test scripts/katalog-validation.test.ts`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Tulis `lib/katalog/validation.ts`**

```ts
/** Parse input harga dari form (boleh ada "Rp", titik/spasi ribuan) jadi
 *  angka bulat rupiah. null kalau kosong atau tidak mengandung angka sama
 *  sekali. */
export function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^\d]/g, '');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `node --conditions=react-server --test scripts/katalog-validation.test.ts`
Expected: PASS, 6 test lulus.

- [ ] **Step 5: Commit**

```bash
git add lib/katalog/validation.ts scripts/katalog-validation.test.ts
git commit -m "Tambah parsePrice untuk validasi harga item"
```

---

### Task 4: `lib/katalog/photo.ts` — upload & bersih-bersih Storage

**Files:**
- Create: `lib/katalog/photo.ts`
- Test: `scripts/katalog-photo.test.ts`

**Interfaces:**
- Consumes: `SupabaseClient` dari `@supabase/supabase-js` (dari `requireScopedClient()`).
- Produces: `class FotoError extends Error`, `uploadKatalogFoto(supabase: SupabaseClient, file: File): Promise<string>` (return public URL), `deleteFotoJikaMilikKita(supabase: SupabaseClient, url: string | null): Promise<void>`.

- [ ] **Step 1: Tulis test (hanya untuk `deleteFotoJikaMilikKita` — bagian yang murni logika parsing URL, tidak butuh Storage sungguhan)**

```ts
// node --conditions=react-server --test scripts/katalog-photo.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteFotoJikaMilikKita } from '../lib/katalog/photo.ts';

function fakeSupabaseStorage() {
  const removed: string[][] = [];
  const client = {
    storage: {
      from: () => ({
        remove: async (paths: string[]) => {
          removed.push(paths);
          return { error: null };
        },
      }),
    },
  };
  return { client: client as never, removed };
}

test('deleteFotoJikaMilikKita: URL dari bucket katalog -> dihapus', async () => {
  const { client, removed } = fakeSupabaseStorage();
  await deleteFotoJikaMilikKita(
    client,
    'https://xxx.supabase.co/storage/v1/object/public/katalog/abc-123.webp'
  );
  assert.deepEqual(removed, [['abc-123.webp']]);
});

test('deleteFotoJikaMilikKita: URL domain lama (sanghyang.com) -> tidak disentuh', async () => {
  const { client, removed } = fakeSupabaseStorage();
  await deleteFotoJikaMilikKita(client, 'https://sanghyang.com/foto/rooms.jpg');
  assert.deepEqual(removed, []);
});

test('deleteFotoJikaMilikKita: null -> tidak dipanggil', async () => {
  const { client, removed } = fakeSupabaseStorage();
  await deleteFotoJikaMilikKita(client, null);
  assert.deepEqual(removed, []);
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `node --conditions=react-server --test scripts/katalog-photo.test.ts`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Tulis `lib/katalog/photo.ts`**

```ts
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'katalog';
const ALLOWED_TYPES = ['image/webp', 'image/jpeg', 'image/png'];
const MAX_BYTES = 4 * 1024 * 1024;

export class FotoError extends Error {}

/** Upload satu file foto ke bucket katalog, return public URL-nya. File
 *  diasumsikan sudah dikompresi di browser (lihat components/compressed-
 *  photo-input.tsx) — validasi di sini adalah jaring pengaman kedua. */
export async function uploadKatalogFoto(supabase: SupabaseClient, file: File): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new FotoError('Format foto tidak didukung. Pakai JPG, PNG, atau WebP.');
  }
  if (file.size > MAX_BYTES) {
    throw new FotoError('Ukuran foto kegedean (maks 4MB).');
  }

  const ext = file.type === 'image/webp' ? 'webp' : file.type === 'image/png' ? 'png' : 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000',
  });
  if (error) throw new FotoError(`Upload gagal: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Hapus foto lama dari Storage, tapi HANYA kalau memang berasal dari bucket
 *  katalog kita sendiri — 15 kategori & 35 item yang sudah ada fotonya masih
 *  di domain sanghyang.com, jangan disentuh (lihat spec). */
export async function deleteFotoJikaMilikKita(
  supabase: SupabaseClient,
  url: string | null
): Promise<void> {
  if (!url) return;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const path = url.slice(idx + marker.length);
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `node --conditions=react-server --test scripts/katalog-photo.test.ts`
Expected: PASS, 3 test lulus.

- [ ] **Step 5: Commit**

```bash
git add lib/katalog/photo.ts scripts/katalog-photo.test.ts
git commit -m "Tambah upload & cleanup foto katalog ke Supabase Storage"
```

---

### Task 5: `lib/katalog/queries.ts` — baca data admin

**Files:**
- Create: `lib/katalog/queries.ts`

**Interfaces:**
- Consumes: `SupabaseClient`, tipe `Service`/`ServiceItem` dari `lib/types.ts` (sudah ada, tidak berubah).
- Produces: `listServicesAdmin(supabase): Promise<Service[]>`, `getServiceByIdAdmin(supabase, id): Promise<Service | null>`, `listItemsByServiceIdAdmin(supabase, serviceId): Promise<ServiceItem[]>`, `getItemByIdAdmin(supabase, id): Promise<ServiceItem | null>`.

- [ ] **Step 1: Tulis `lib/katalog/queries.ts`**

```ts
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Service, ServiceItem } from '@/lib/types';

const SERVICE_COLUMNS = 'id, type, name, description, photo_url, is_bookable, booking_method';
const ITEM_COLUMNS = 'id, service_id, name, description, price, photo_url, is_active';

/** Beda dari lib/supabase/queries.ts (halaman publik, pakai anon key): ini
 *  dipakai panel admin lewat service_role, jadi tidak difilter is_active
 *  dsb — owner perlu lihat semuanya. */
export async function listServicesAdmin(supabase: SupabaseClient): Promise<Service[]> {
  const { data, error } = await supabase.from('services').select(SERVICE_COLUMNS).order('name');
  if (error) {
    console.error('[katalog] listServicesAdmin:', error.message);
    return [];
  }
  return (data ?? []) as Service[];
}

export async function getServiceByIdAdmin(
  supabase: SupabaseClient,
  id: string
): Promise<Service | null> {
  const { data, error } = await supabase
    .from('services')
    .select(SERVICE_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[katalog] getServiceByIdAdmin:', error.message);
    return null;
  }
  return (data as Service | null) ?? null;
}

export async function listItemsByServiceIdAdmin(
  supabase: SupabaseClient,
  serviceId: string
): Promise<ServiceItem[]> {
  const { data, error } = await supabase
    .from('service_items')
    .select(ITEM_COLUMNS)
    .eq('service_id', serviceId)
    .order('name');
  if (error) {
    console.error('[katalog] listItemsByServiceIdAdmin:', error.message);
    return [];
  }
  return (data ?? []) as ServiceItem[];
}

export async function getItemByIdAdmin(
  supabase: SupabaseClient,
  id: string
): Promise<ServiceItem | null> {
  const { data, error } = await supabase
    .from('service_items')
    .select(ITEM_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[katalog] getItemByIdAdmin:', error.message);
    return null;
  }
  return (data as ServiceItem | null) ?? null;
}
```

- [ ] **Step 2: Verifikasi tipe**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add lib/katalog/queries.ts
git commit -m "Tambah query admin untuk kategori & item katalog"
```

---

### Task 6: `components/compressed-photo-input.tsx`

**Files:**
- Create: `components/compressed-photo-input.tsx`

**Interfaces:**
- Consumes: tidak ada import internal baru (Canvas API browser bawaan).
- Produces: `<CompressedPhotoInput name={string} currentUrl={string | null} />` — Client Component, dipasang di dalam `<form>` mana pun, menghasilkan `<input type="file" name={name}>` yang isinya sudah dikompresi.

- [ ] **Step 1: Tulis `components/compressed-photo-input.tsx`**

```tsx
'use client';

import { useState, type ChangeEvent } from 'react';

const MAX_WIDTH = 1600;
const QUALITY = 0.8;

async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', QUALITY)
  );
  if (!blob) return file;

  const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
  return new File([blob], name, { type: 'image/webp' });
}

/** Input file foto yang otomatis mengompres & resize di browser sebelum form
 *  submit — foto dari HP bisa 5-10MB, terlalu besar untuk dikirim ke Server
 *  Action dan untuk ditampilkan di halaman publik. Mengganti isi input file
 *  lewat DataTransfer supaya <form action={...}> bawaan tetap jalan apa
 *  adanya, tidak perlu intercept submit manual. */
export function CompressedPhotoInput({
  name,
  currentUrl,
}: {
  name: string;
  currentUrl: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [busy, setBusy] = useState(false);
  const inputId = `foto-${name}`;

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const compressed = await compressImage(file);
      const dt = new DataTransfer();
      dt.items.add(compressed);
      e.target.files = dt.files;
      setPreview(URL.createObjectURL(compressed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label htmlFor={inputId} className="text-sm font-medium">
        Foto
      </label>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- preview lokal (object URL atau URL luar), bukan aset Next.
        <img src={preview} alt="" className="mt-2 h-32 w-32 rounded-md object-cover" />
      )}
      <input
        id={inputId}
        name={name}
        type="file"
        accept="image/*"
        onChange={handleChange}
        disabled={busy}
        className="mt-2 block text-sm"
      />
      {busy && <p className="mt-1 text-xs text-muted-foreground">Mengompres foto…</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verifikasi lint & tipe**

Run: `npm run lint && npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add components/compressed-photo-input.tsx
git commit -m "Tambah input foto dengan kompresi otomatis di browser"
```

---

### Task 7: `app/actions/admin-katalog.ts` — `simpanKategori`

**Files:**
- Create: `app/actions/admin-katalog.ts`

**Interfaces:**
- Consumes: `requireScopedClient` (`lib/admin/scope.ts`), `listServicesAdmin` (`lib/katalog/queries.ts`), `slugify`/`uniqueSlug` (`lib/katalog/slug.ts`), `uploadKatalogFoto`/`deleteFotoJikaMilikKita`/`FotoError` (`lib/katalog/photo.ts`).
- Produces: `type KatalogFormState = { error: string | null }`, `simpanKategori(prevState: KatalogFormState, formData: FormData): Promise<KatalogFormState>` — dipakai lewat `useActionState` di Task 8.

- [ ] **Step 1: Tulis `app/actions/admin-katalog.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireScopedClient } from '@/lib/admin/scope';
import { listServicesAdmin } from '@/lib/katalog/queries';
import { slugify, uniqueSlug } from '@/lib/katalog/slug';
import { uploadKatalogFoto, deleteFotoJikaMilikKita, FotoError } from '@/lib/katalog/photo';

export type KatalogFormState = { error: string | null };

export async function simpanKategori(
  _prevState: KatalogFormState,
  formData: FormData
): Promise<KatalogFormState> {
  const { session, supabase } = await requireScopedClient();
  if (session.role !== 'owner') return { error: 'Khusus pemilik.' };

  const id = String(formData.get('id') ?? '').trim() || null;
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const isBookable = formData.get('is_bookable') === 'on';
  const currentBookingMethod = String(formData.get('current_booking_method') ?? '');
  const currentPhotoUrl = String(formData.get('current_photo_url') ?? '') || null;
  const photo = formData.get('photo');

  if (name.length < 2) return { error: 'Nama kategori minimal 2 karakter.' };

  // Rooms (booking_method = 'exely') dikunci: form ini tidak boleh pernah
  // mengubahnya jadi self_service, apa pun isi checkbox-nya (lihat Global
  // Constraints di plan ini).
  const bookingMethod = currentBookingMethod === 'exely' ? 'exely' : 'self_service';
  const isBookableFinal = currentBookingMethod === 'exely' ? true : isBookable;

  let photoUrl: string | undefined;
  if (photo instanceof File && photo.size > 0) {
    try {
      photoUrl = await uploadKatalogFoto(supabase, photo);
    } catch (err) {
      return { error: err instanceof FotoError ? err.message : 'Upload foto gagal.' };
    }
  }

  if (id) {
    const update: Record<string, unknown> = {
      name,
      description: description || null,
      is_bookable: isBookableFinal,
      booking_method: bookingMethod,
    };
    if (photoUrl) update.photo_url = photoUrl;

    const { error } = await supabase.from('services').update(update).eq('id', id);
    if (error) return { error: `Gagal menyimpan: ${error.message}` };

    if (photoUrl) await deleteFotoJikaMilikKita(supabase, currentPhotoUrl);

    revalidatePath('/panel-sanghyang/katalog');
    revalidatePath(`/panel-sanghyang/katalog/${id}`);
    revalidatePath('/');
    revalidatePath('/fasilitas');
    revalidatePath('/kategori/[slug]', 'page');
    return { error: null };
  }

  const existing = await listServicesAdmin(supabase);
  const slug = uniqueSlug(
    slugify(name),
    existing.map((s) => s.type)
  );

  const { data, error } = await supabase
    .from('services')
    .insert({
      type: slug,
      name,
      description: description || null,
      is_bookable: isBookableFinal,
      booking_method: bookingMethod,
      photo_url: photoUrl ?? null,
    })
    .select('id')
    .single();
  if (error || !data) return { error: `Gagal menyimpan: ${error?.message ?? 'tidak diketahui'}` };

  revalidatePath('/panel-sanghyang/katalog');
  revalidatePath('/');
  revalidatePath('/fasilitas');
  redirect(`/panel-sanghyang/katalog/${data.id}`);
}
```

- [ ] **Step 2: Verifikasi lint & tipe**

Run: `npm run lint && npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add app/actions/admin-katalog.ts
git commit -m "Tambah Server Action simpanKategori"
```

---

### Task 8: Halaman list katalog + form kategori + link nav

**Files:**
- Create: `app/panel-sanghyang/katalog/page.tsx`
- Create: `app/panel-sanghyang/katalog/kategori-form.tsx`
- Modify: `app/panel-sanghyang/page.tsx` (tambah link nav owner-only)

**Interfaces:**
- Consumes: `requireScopedClient`, `listServicesAdmin` (Task 5), `simpanKategori`+`KatalogFormState` (Task 7), `CompressedPhotoInput` (Task 6), tipe `Service` (`lib/types.ts`).
- Produces: `<KategoriForm service?: Service />` — Client Component, dipakai lagi di Task 9 untuk halaman edit.

- [ ] **Step 1: Tulis `app/panel-sanghyang/katalog/kategori-form.tsx`**

```tsx
'use client';

import { useActionState } from 'react';
import { simpanKategori, type KatalogFormState } from '@/app/actions/admin-katalog';
import { CompressedPhotoInput } from '@/components/compressed-photo-input';
import type { Service } from '@/lib/types';

const initialState: KatalogFormState = { error: null };
const FIELD = 'mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm';

export function KategoriForm({ service }: { service?: Service }) {
  const [state, formAction, pending] = useActionState(simpanKategori, initialState);
  const isExely = service?.booking_method === 'exely';

  return (
    <form action={formAction} className="space-y-4">
      {service && <input type="hidden" name="id" value={service.id} />}
      <input type="hidden" name="current_booking_method" value={service?.booking_method ?? ''} />
      <input type="hidden" name="current_photo_url" value={service?.photo_url ?? ''} />

      <div>
        <label htmlFor="kategori-name" className="text-sm font-medium">
          Nama
        </label>
        <input
          id="kategori-name"
          name="name"
          type="text"
          required
          minLength={2}
          defaultValue={service?.name ?? ''}
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="kategori-description" className="text-sm font-medium">
          Deskripsi
        </label>
        <textarea
          id="kategori-description"
          name="description"
          rows={3}
          defaultValue={service?.description ?? ''}
          className={FIELD}
        />
      </div>

      <CompressedPhotoInput name="photo" currentUrl={service?.photo_url ?? null} />

      <div className="flex items-center gap-2">
        <input
          id="kategori-bookable"
          name="is_bookable"
          type="checkbox"
          defaultChecked={service?.is_bookable ?? false}
          disabled={isExely}
        />
        <label htmlFor="kategori-bookable" className="text-sm">
          Bisa direservasi (self-service)
        </label>
      </div>
      {isExely && (
        <p className="text-xs text-muted-foreground">
          Kategori ini pakai integrasi Exely, statusnya dikunci.
        </p>
      )}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
      >
        {pending ? 'Menyimpan…' : 'Simpan'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Tulis `app/panel-sanghyang/katalog/page.tsx`**

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireScopedClient } from '@/lib/admin/scope';
import { listServicesAdmin } from '@/lib/katalog/queries';
import { KategoriForm } from './kategori-form';

export const metadata: Metadata = {
  title: 'Kelola Katalog',
  robots: { index: false, follow: false },
};

export default async function KatalogPage() {
  const { session, supabase } = await requireScopedClient();

  if (session.role !== 'owner') {
    return (
      <main className="min-h-screen bg-muted p-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-heading text-2xl">Kelola Katalog</h1>
          <p className="mt-3 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Halaman ini khusus pemilik.
          </p>
        </div>
      </main>
    );
  }

  const services = await listServicesAdmin(supabase);

  return (
    <main className="min-h-screen bg-muted p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-2xl">Kelola Katalog</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kategori & item yang tampil di halaman publik.
        </p>

        <ul className="mt-6 space-y-2">
          {services.map((s) => (
            <li key={s.id}>
              <Link
                href={`/panel-sanghyang/katalog/${s.id}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary"
              >
                <span>
                  <strong className="text-base">{s.name}</strong>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {s.is_bookable ? 'Bisa direservasi' : 'Info saja'}
                  </span>
                </span>
                <span className="text-sm text-primary">Kelola →</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-8 rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium">Tambah kategori baru</h2>
          <div className="mt-3">
            <KategoriForm />
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Tambah link nav di dashboard — modify `app/panel-sanghyang/page.tsx`**

Cari blok ini (ditambahkan waktu Kelola Konten dibuat):

```tsx
          {session.role === 'owner' && (
            <Link href="/panel-sanghyang/konten" className="underline underline-offset-4">
              Kelola konten
            </Link>
          )}
```

Tambah link baru tepat setelahnya:

```tsx
          {session.role === 'owner' && (
            <Link href="/panel-sanghyang/konten" className="underline underline-offset-4">
              Kelola konten
            </Link>
          )}
          {session.role === 'owner' && (
            <Link href="/panel-sanghyang/katalog" className="underline underline-offset-4">
              Kelola katalog
            </Link>
          )}
```

- [ ] **Step 4: Verifikasi lint & tipe**

Run: `npm run lint && npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 5: Verifikasi manual**

Jalankan `npm run dev`, login sebagai owner, buka `/panel-sanghyang/katalog`. Cek: 15 kategori tampil, klik salah satu (boleh 404 sementara — halaman detailnya baru di Task 9), coba isi form "Tambah kategori baru" dengan nama tes, submit, cek redirect ke halaman detail (boleh 404 sementara juga) dan kategori baru muncul di list kalau balik ke `/panel-sanghyang/katalog`.

- [ ] **Step 6: Commit**

```bash
git add app/panel-sanghyang/katalog/page.tsx app/panel-sanghyang/katalog/kategori-form.tsx app/panel-sanghyang/page.tsx
git commit -m "Tambah halaman list Kelola Katalog + form tambah kategori"
```

---

### Task 9: Halaman detail kategori (edit + list item)

**Files:**
- Create: `app/panel-sanghyang/katalog/[id]/page.tsx`

**Interfaces:**
- Consumes: `requireScopedClient`, `getServiceByIdAdmin`+`listItemsByServiceIdAdmin` (Task 5), `KategoriForm` (Task 8), `formatPrice` (`lib/types.ts`, sudah ada).
- Produces: halaman `/panel-sanghyang/katalog/[id]`, link ke `/panel-sanghyang/katalog/[id]/item/baru` dan `/panel-sanghyang/katalog/[id]/item/[itemId]` (dibuat Task 11).

- [ ] **Step 1: Tulis `app/panel-sanghyang/katalog/[id]/page.tsx`**

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireScopedClient } from '@/lib/admin/scope';
import { getServiceByIdAdmin, listItemsByServiceIdAdmin } from '@/lib/katalog/queries';
import { formatPrice } from '@/lib/types';
import { KategoriForm } from '../kategori-form';

export const metadata: Metadata = {
  title: 'Kelola Kategori',
  robots: { index: false, follow: false },
};

export default async function KategoriDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { session, supabase } = await requireScopedClient();

  if (session.role !== 'owner') {
    return (
      <main className="min-h-screen bg-muted p-6">
        <div className="mx-auto max-w-3xl">
          <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Halaman ini khusus pemilik.
          </p>
        </div>
      </main>
    );
  }

  const service = await getServiceByIdAdmin(supabase, id);
  if (!service) notFound();

  const items = await listItemsByServiceIdAdmin(supabase, service.id);

  return (
    <main className="min-h-screen bg-muted p-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/panel-sanghyang/katalog"
          className="text-sm text-primary underline underline-offset-4"
        >
          ← Semua kategori
        </Link>
        <h1 className="mt-2 font-heading text-2xl">{service.name}</h1>

        <div className="mt-4 rounded-xl border border-border bg-card p-5">
          <KategoriForm service={service} />
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Item</h2>
            <Link
              href={`/panel-sanghyang/katalog/${service.id}/item/baru`}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            >
              + Tambah item
            </Link>
          </div>

          {items.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Belum ada item.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/panel-sanghyang/katalog/${service.id}/item/${item.id}`}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary"
                  >
                    <strong className="text-sm">{item.name}</strong>
                    <span className="text-sm text-muted-foreground">{formatPrice(item.price)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verifikasi lint & tipe**

Run: `npm run lint && npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 3: Verifikasi manual**

Buka `/panel-sanghyang/katalog`, klik salah satu kategori (mis. "Rooms"). Cek: form terisi data yang benar, checkbox "Bisa direservasi" ke-disable dengan catatan Exely (khusus Rooms), foto & deskripsi tampil. Ubah deskripsi, simpan, cek pesan sukses (tetap di halaman ini, tidak redirect) dan datanya kepersist kalau di-refresh.

- [ ] **Step 4: Commit**

```bash
git add "app/panel-sanghyang/katalog/[id]/page.tsx"
git commit -m "Tambah halaman detail kategori (edit + list item)"
```

---

### Task 10: `app/actions/admin-katalog.ts` — `simpanItem`

**Files:**
- Modify: `app/actions/admin-katalog.ts` (tambah di akhir file)

**Interfaces:**
- Consumes: `parsePrice` (`lib/katalog/validation.ts`, Task 3), yang lain sama seperti Task 7.
- Produces: `simpanItem(prevState: KatalogFormState, formData: FormData): Promise<KatalogFormState>` — dipakai Task 11.

- [ ] **Step 1: Tambah import `parsePrice` di puncak `app/actions/admin-katalog.ts`**

```ts
import { parsePrice } from '@/lib/katalog/validation';
```

- [ ] **Step 2: Tambah fungsi `simpanItem` di akhir `app/actions/admin-katalog.ts`**

```ts
export async function simpanItem(
  _prevState: KatalogFormState,
  formData: FormData
): Promise<KatalogFormState> {
  const { session, supabase } = await requireScopedClient();
  if (session.role !== 'owner') return { error: 'Khusus pemilik.' };

  const id = String(formData.get('id') ?? '').trim() || null;
  const serviceId = String(formData.get('service_id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const priceRaw = String(formData.get('price') ?? '');
  const currentPhotoUrl = String(formData.get('current_photo_url') ?? '') || null;
  const photo = formData.get('photo');

  if (!serviceId) return { error: 'Kategori tidak valid.' };
  if (name.length < 2) return { error: 'Nama item minimal 2 karakter.' };

  const price = parsePrice(priceRaw);
  if (price === null) return { error: 'Harga tidak valid.' };

  let photoUrl: string | undefined;
  if (photo instanceof File && photo.size > 0) {
    try {
      photoUrl = await uploadKatalogFoto(supabase, photo);
    } catch (err) {
      return { error: err instanceof FotoError ? err.message : 'Upload foto gagal.' };
    }
  }

  if (id) {
    const update: Record<string, unknown> = { name, description: description || null, price };
    if (photoUrl) update.photo_url = photoUrl;

    const { error } = await supabase.from('service_items').update(update).eq('id', id);
    if (error) return { error: `Gagal menyimpan: ${error.message}` };

    if (photoUrl) await deleteFotoJikaMilikKita(supabase, currentPhotoUrl);
  } else {
    const { error } = await supabase.from('service_items').insert({
      service_id: serviceId,
      name,
      description: description || null,
      price,
      photo_url: photoUrl ?? null,
      is_active: true,
    });
    if (error) return { error: `Gagal menyimpan: ${error.message}` };
  }

  revalidatePath(`/panel-sanghyang/katalog/${serviceId}`);
  revalidatePath('/kategori/[slug]', 'page');
  revalidatePath('/fasilitas');
  redirect(`/panel-sanghyang/katalog/${serviceId}`);
}
```

- [ ] **Step 3: Verifikasi lint & tipe**

Run: `npm run lint && npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 4: Commit**

```bash
git add app/actions/admin-katalog.ts
git commit -m "Tambah Server Action simpanItem"
```

---

### Task 11: Halaman tambah/edit item

**Files:**
- Create: `app/panel-sanghyang/katalog/[id]/item/[itemId]/page.tsx`
- Create: `app/panel-sanghyang/katalog/[id]/item/[itemId]/item-form.tsx`

**Interfaces:**
- Consumes: `requireScopedClient`, `getServiceByIdAdmin`+`getItemByIdAdmin` (Task 5), `simpanItem`+`KatalogFormState` (Task 10), `CompressedPhotoInput` (Task 6), tipe `ServiceItem` (`lib/types.ts`).
- Produces: halaman `/panel-sanghyang/katalog/[id]/item/baru` (create) dan `/panel-sanghyang/katalog/[id]/item/[itemId]` (edit) — `itemId` literal `"baru"` dipakai sebagai penanda mode create, bukan route terpisah.

- [ ] **Step 1: Tulis `app/panel-sanghyang/katalog/[id]/item/[itemId]/item-form.tsx`**

```tsx
'use client';

import { useActionState } from 'react';
import { simpanItem, type KatalogFormState } from '@/app/actions/admin-katalog';
import { CompressedPhotoInput } from '@/components/compressed-photo-input';
import type { ServiceItem } from '@/lib/types';

const initialState: KatalogFormState = { error: null };
const FIELD = 'mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm';

export function ItemForm({ serviceId, item }: { serviceId: string; item?: ServiceItem }) {
  const [state, formAction, pending] = useActionState(simpanItem, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="service_id" value={serviceId} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="current_photo_url" value={item?.photo_url ?? ''} />

      <div>
        <label htmlFor="item-name" className="text-sm font-medium">
          Nama
        </label>
        <input
          id="item-name"
          name="name"
          type="text"
          required
          minLength={2}
          defaultValue={item?.name ?? ''}
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="item-description" className="text-sm font-medium">
          Deskripsi
        </label>
        <textarea
          id="item-description"
          name="description"
          rows={3}
          defaultValue={item?.description ?? ''}
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="item-price" className="text-sm font-medium">
          Harga (Rp)
        </label>
        <input
          id="item-price"
          name="price"
          type="text"
          inputMode="numeric"
          required
          defaultValue={item?.price ?? ''}
          className={FIELD}
        />
      </div>

      <CompressedPhotoInput name="photo" currentUrl={item?.photo_url ?? null} />

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
      >
        {pending ? 'Menyimpan…' : 'Simpan'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Tulis `app/panel-sanghyang/katalog/[id]/item/[itemId]/page.tsx`**

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireScopedClient } from '@/lib/admin/scope';
import { getServiceByIdAdmin, getItemByIdAdmin } from '@/lib/katalog/queries';
import { ItemForm } from './item-form';

export const metadata: Metadata = {
  title: 'Kelola Item',
  robots: { index: false, follow: false },
};

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = await params;
  const { session, supabase } = await requireScopedClient();

  if (session.role !== 'owner') {
    return (
      <main className="min-h-screen bg-muted p-6">
        <div className="mx-auto max-w-3xl">
          <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Halaman ini khusus pemilik.
          </p>
        </div>
      </main>
    );
  }

  const service = await getServiceByIdAdmin(supabase, id);
  if (!service) notFound();

  const item = itemId === 'baru' ? null : await getItemByIdAdmin(supabase, itemId);
  if (itemId !== 'baru' && !item) notFound();

  return (
    <main className="min-h-screen bg-muted p-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/panel-sanghyang/katalog/${service.id}`}
          className="text-sm text-primary underline underline-offset-4"
        >
          ← {service.name}
        </Link>
        <h1 className="mt-2 font-heading text-2xl">{item ? item.name : 'Item baru'}</h1>

        <div className="mt-4 rounded-xl border border-border bg-card p-5">
          <ItemForm serviceId={service.id} item={item ?? undefined} />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verifikasi lint & tipe**

Run: `npm run lint && npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 4: Verifikasi manual — end to end**

1. Buka `/panel-sanghyang/katalog/<id-kategori-apa-saja>`, klik "+ Tambah item", isi nama+harga+foto (pakai foto ukuran besar dari HP kalau ada, buat mastiin kompresi jalan), submit. Cek redirect balik ke halaman kategori dan item baru muncul di list.
2. Klik item yang baru dibuat, ubah harga, submit, cek datanya keupdate.
3. Buka halaman publik `/kategori/<slug-kategori-itu>` di tab baru, cek item baru & foto barunya tampil (mungkin perlu refresh keras kalau masih ke-cache browser, bukan Next — `revalidatePath` sudah dipanggil).
4. Login sebagai captain, coba akses `/panel-sanghyang/katalog` dan `/panel-sanghyang/katalog/<id>/item/baru` langsung lewat URL — pastikan dua-duanya nolak dengan pesan "khusus pemilik".

- [ ] **Step 5: Commit**

```bash
git add "app/panel-sanghyang/katalog/[id]/item"
git commit -m "Tambah halaman tambah/edit item katalog"
```
