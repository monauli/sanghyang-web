import { CardGridSkeleton, HeadingSkeleton, LoadingAnnouncement } from '@/components/skeletons';

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <LoadingAnnouncement>Memuat fasilitas…</LoadingAnnouncement>
      <HeadingSkeleton />
      <CardGridSkeleton
        count={8}
        aspect="aspect-square"
        columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
      />
    </div>
  );
}
