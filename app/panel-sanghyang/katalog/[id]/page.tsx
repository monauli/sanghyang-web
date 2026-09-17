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
