'use client';

import { useActionState } from 'react';
import { simpanItem, type KatalogFormState } from '@/app/actions/admin-katalog';
import { CompressedPhotoInput } from '@/components/compressed-photo-input';
import type { ServiceItem } from '@/lib/types';

const initialState: KatalogFormState = { error: null, success: false };
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
