import { Skeleton } from '@/components/ui/skeleton';

/** Kerangka kartu — bentuk & jaraknya sengaja menyerupai CategoryCard supaya
 *  isi asli tidak "melompat" saat menggantikannya. */
export function CardGridSkeleton({
  count = 6,
  aspect = 'aspect-[4/3]',
  columns = 'sm:grid-cols-2 lg:grid-cols-3',
}: {
  count?: number;
  aspect?: string;
  columns?: string;
}) {
  return (
    <div className={`grid gap-5 sm:gap-6 ${columns}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
          <Skeleton className={`${aspect} w-full rounded-none`} />
          <div className="space-y-2 p-5">
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HeadingSkeleton() {
  return (
    <div className="mb-8 max-w-2xl space-y-3" aria-hidden="true">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-4 w-full max-w-lg" />
    </div>
  );
}

/** Dibaca screen reader; kerangka visualnya sendiri aria-hidden. */
export function LoadingAnnouncement({ children = 'Memuat…' }: { children?: string }) {
  return (
    <p role="status" className="sr-only">
      {children}
    </p>
  );
}
