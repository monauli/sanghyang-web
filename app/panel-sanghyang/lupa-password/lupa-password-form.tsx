'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { mintaReset, type MintaResetState } from '@/app/actions/admin-lupa-password';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const EMPTY: MintaResetState = { message: null };

export function LupaPasswordForm() {
  const [state, formAction, pending] = useActionState(mintaReset, EMPTY);

  if (state.message) {
    return <p className="text-sm">{state.message}</p>;
  }

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="username" className="h-11" />
      </div>
      <Button type="submit" disabled={pending} className="h-11 w-full rounded-full">
        {pending && <Loader2 className="animate-spin" />}
        {pending ? 'Mengirim…' : 'Kirim link reset'}
      </Button>
    </form>
  );
}
