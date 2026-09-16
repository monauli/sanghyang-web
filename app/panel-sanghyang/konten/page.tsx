import type { Metadata } from 'next';
import { requireScopedClient } from '@/lib/admin/scope';
import { getSiteContent } from '@/lib/supabase/queries';
import { KontenForm } from './konten-form';

export const metadata: Metadata = {
  title: 'Kelola Konten',
  robots: { index: false, follow: false },
};

export default async function KontenPage() {
  const { session } = await requireScopedClient();

  if (session.role !== 'owner') {
    return (
      <main className="min-h-screen bg-muted p-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-heading text-2xl">Kelola Konten</h1>
          <p className="mt-3 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Halaman ini khusus pemilik.
          </p>
        </div>
      </main>
    );
  }

  const content = await getSiteContent();

  return (
    <main className="min-h-screen bg-muted p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-2xl">Kelola Konten</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Teks yang tampil di halaman Tentang Kami, Kontak, dan footer.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <KontenForm content={content} />
        </div>
      </div>
    </main>
  );
}
