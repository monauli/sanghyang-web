import { HeadingSkeleton, LoadingAnnouncement } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <LoadingAnnouncement>Memuat kontak…</LoadingAnnouncement>
      <HeadingSkeleton />
      <div className="grid gap-4 sm:grid-cols-2" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className={`h-24 rounded-2xl ${i === 2 ? 'sm:col-span-2' : ''}`} />
        ))}
      </div>
      <Skeleton className="mt-10 h-12 w-64 rounded-full" aria-hidden="true" />
    </div>
  );
}
