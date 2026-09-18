'use client';

import { useActionState } from 'react';
import { gantiEmail, type GantiEmailState } from '@/app/actions/admin-akun';

const EMPTY: GantiEmailState = { error: null, success: false };

export function GantiEmailForm({ emailSekarang }: { emailSekarang: string }) {
  const [state, formAction, pending] = useActionState(gantiEmail, EMPTY);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <strong className="text-base">Email Login</strong>
      <p className="mt-1 text-sm text-muted-foreground">Sekarang: {emailSekarang}</p>

      {state.success ? (
        <p className="mt-2 text-sm text-primary">
          Email berhasil diganti. Pakai email baru untuk login berikutnya.
        </p>
      ) : (
        <form action={formAction} className="mt-2 grid max-w-sm gap-2">
          <input
            name="email_baru"
            type="email"
            required
            placeholder="Email baru"
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
          <input
            name="password_sekarang"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Password sekarang (verifikasi)"
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-fit rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground"
          >
            {pending ? 'Menyimpan…' : 'Ganti Email'}
          </button>
        </form>
      )}
    </div>
  );
}
