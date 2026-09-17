import type { Metadata } from 'next';
import { LupaPasswordForm } from './lupa-password-form';

export const metadata: Metadata = {
  title: 'Lupa Password — Panel Admin',
  robots: { index: false, follow: false },
};

export default function LupaPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="font-heading text-2xl">Lupa Password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Masukkan email akun panel admin Anda.
        </p>
        <div className="mt-6">
          <LupaPasswordForm />
        </div>
      </div>
    </main>
  );
}
