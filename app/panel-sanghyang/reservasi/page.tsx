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
