'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { login, type LoginState } from '@/app/actions/admin-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const EMPTY: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, EMPTY);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className="h-11"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
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
        {pending ? 'Masuk…' : 'Masuk'}
      </Button>
    </form>
  );
}
