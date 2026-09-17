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
