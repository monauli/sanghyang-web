import type { Metadata } from 'next';
import { logout } from '@/app/actions/admin-auth';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Panel Admin',
  robots: { index: false, follow: false },
};

export default function AdminDashboardPage() {
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
        <p className="mt-4 text-sm text-muted-foreground">
          Berhasil login. Ringkasan reservasi, kelola katalog, dan kelola konten
          menyusul di checkpoint berikutnya.
        </p>
      </div>
    </main>
  );
}
