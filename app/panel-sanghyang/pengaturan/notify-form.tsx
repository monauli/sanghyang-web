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
