'use client';

import { useActionState } from 'react';
import { simpanKategori, type KatalogFormState } from '@/app/actions/admin-katalog';
import { CompressedPhotoInput } from '@/components/compressed-photo-input';
import type { Service } from '@/lib/types';

const initialState: KatalogFormState = { error: null, success: false };
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
      {state.success && <p className="text-sm text-primary">Tersimpan.</p>}

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
