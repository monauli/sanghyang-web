import type { Metadata } from 'next';
import Link from 'next/link';
import { logout } from '@/app/actions/admin-auth';
import { Button } from '@/components/ui/button';
import { requireScopedClient } from '@/lib/admin/scope';

export const metadata: Metadata = {
  title: 'Panel Admin',
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const { session } = await requireScopedClient();

  return (
    <main className="min-h-screen bg-muted p-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl">Panel Admin</h1>
          <form action={logout}>
            <Button type="submit" variant="ghost">
              Keluar
            </Button>
          </form>
        </div>
        <nav className="mt-4 flex flex-col gap-2 text-sm">
          <Link href="/panel-sanghyang/reservasi" className="underline underline-offset-4">
            Reservasi masuk
          </Link>
          <Link href="/panel-sanghyang/pengaturan" className="underline underline-offset-4">
            Pengaturan notifikasi & link outlet
          </Link>
          {session.role === 'owner' && (
            <Link href="/panel-sanghyang/konten" className="underline underline-offset-4">
              Kelola konten
            </Link>
          )}
        </nav>
      </div>
    </main>
  );
}
