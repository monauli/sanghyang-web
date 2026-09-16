import { CardGridSkeleton, HeadingSkeleton, LoadingAnnouncement } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <>
      <LoadingAnnouncement>Memuat beranda…</LoadingAnnouncement>
      <section className="relative flex min-h-[82svh] items-end sm:min-h-[88svh]">
        <Skeleton className="absolute inset-0 rounded-none" />
        <div className="relative mx-auto w-full max-w-6xl px-5 pb-14 sm:px-8 sm:pb-20" aria-hidden="true">
          <Skeleton className="h-3 w-28 bg-stone-400/40" />
          <Skeleton className="mt-4 h-14 w-64 bg-stone-400/40 sm:h-20 sm:w-[30rem]" />
          <Skeleton className="mt-5 h-4 w-full max-w-md bg-stone-400/40" />
          <Skeleton className="mt-8 h-12 w-56 rounded-full bg-stone-400/40" />
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <HeadingSkeleton />
        <CardGridSkeleton overlay aspect="aspect-[4/5]" />
      </section>
    </>
  );
}
