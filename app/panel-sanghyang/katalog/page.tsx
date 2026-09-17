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
