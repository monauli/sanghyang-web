import { Shell } from 'lucide-react';

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/70 px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Shell className="size-5" aria-hidden="true" />
      </span>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
