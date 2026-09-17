'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { resetPassword, type ResetPasswordState } from '@/app/actions/admin-lupa-password';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const EMPTY: ResetPasswordState = { error: null, success: false };

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPassword, EMPTY);

  if (state.success) {
    return (
      <p className="text-sm">
        Password berhasil diganti.{' '}
        <a href="/panel-sanghyang/login" className="underline underline-offset-4">
          Masuk sekarang
        </a>
        .
      </p>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="grid gap-1.5">
        <Label htmlFor="password">Password Baru</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="h-11"
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-11 w-full rounded-full">
        {pending && <Loader2 className="animate-spin" />}
        {pending ? 'Menyimpan…' : 'Simpan Password Baru'}
      </Button>
    </form>
  );
}
