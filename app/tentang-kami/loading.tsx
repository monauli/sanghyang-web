import { HeadingSkeleton, LoadingAnnouncement } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <LoadingAnnouncement>Memuat halaman tentang kami…</LoadingAnnouncement>
      <HeadingSkeleton />
      <Skeleton className="mb-10 aspect-[16/9] w-full rounded-2xl sm:aspect-[21/9]" aria-hidden="true" />
      <div className="max-w-2xl space-y-3" aria-hidden="true">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}
