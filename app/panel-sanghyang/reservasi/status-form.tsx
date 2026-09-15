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
