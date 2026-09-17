import type { Metadata } from 'next';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = {
  title: 'Reset Password — Panel Admin',
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="font-heading text-2xl">Reset Password</h1>
        {token ? (
          <div className="mt-6">
            <ResetPasswordForm token={token} />
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Link tidak valid. Minta link reset baru dari halaman{' '}
            <a href="/panel-sanghyang/lupa-password" className="underline underline-offset-4">
              lupa password
            </a>
            .
          </p>
        )}
      </div>
    </main>
  );
}
