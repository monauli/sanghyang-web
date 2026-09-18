import type { Metadata } from 'next';
import { requireScopedClient } from '@/lib/admin/scope';
import { listOutletsForSession, outletLink } from '@/lib/outlets';
import { NotifyForm } from './notify-form';
import { GantiEmailForm } from './ganti-email-form';

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

        <div className="mt-8">
          <GantiEmailForm emailSekarang={session.email} />
        </div>
      </div>
    </main>
  );
}
