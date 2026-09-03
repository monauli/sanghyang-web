import { CardGridSkeleton, LoadingAnnouncement } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <article>
      <LoadingAnnouncement>Memuat kategori…</LoadingAnnouncement>
      <Skeleton className="h-72 w-full rounded-none sm:h-80 lg:h-[26rem]" />
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-12" aria-hidden="true">
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="mt-2 h-4 w-2/3 max-w-lg" />
        <Skeleton className="mt-8 h-28 w-full rounded-2xl" />
        <Skeleton className="mt-12 h-8 w-56" />
        <div className="mt-6">
          <CardGridSkeleton />
        </div>
      </div>
    </article>
  );
}
