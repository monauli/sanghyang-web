'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Photo } from './photo';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

export type GalleryEntry = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  items: { id: string; name: string; description: string | null }[];
};

export function GalleryGrid({ entries }: { entries: GalleryEntry[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const open = openIndex === null ? null : entries[openIndex];

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((i) => (i === null ? i : (i + delta + entries.length) % entries.length)),
    [entries.length]
  );

  // Esc, focus trap, dan kunci scroll ditangani Radix Dialog. Sisanya tinggal
  // panah kiri/kanan untuk pindah foto.
  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openIndex, step]);

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
        {entries.map((entry, index) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={`Lihat ${entry.name} lebih besar`}
              className="card-surface card-surface-hover group block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="relative aspect-square w-full overflow-hidden">
                <Photo
                  src={entry.photo_url}
                  alt={entry.name}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="transition-transform duration-700 ease-soft group-hover:scale-[1.04]"
                />
              </div>
              <div className="p-3 sm:p-4">
                <h3 className="font-sans text-sm font-medium text-foreground group-hover:text-primary">
                  {entry.name}
                </h3>
                {entry.items.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">{entry.items.length} pilihan</p>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={open !== null} onOpenChange={(next) => !next && close()}>
        <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
          {open && (
            <>
              <div className="relative aspect-[4/3] w-full shrink-0 sm:aspect-[16/9]">
                <Photo
                  src={open.photo_url}
                  alt={open.name}
                  sizes="(max-width: 768px) 100vw, 768px"
                />
              </div>

              <div className="p-5 sm:p-6">
                <DialogTitle className="font-heading text-2xl sm:text-3xl">{open.name}</DialogTitle>
                <DialogDescription className="mt-2 leading-relaxed">
                  {open.description ?? 'Salah satu fasilitas yang bisa dinikmati selama menginap.'}
                </DialogDescription>

                {open.items.length > 0 && (
                  <ul className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
                    {open.items.map((item) => (
                      <li key={item.id}>
                        <span className="font-medium text-foreground">{item.name}</span>
                        {item.description && (
                          <span className="text-muted-foreground"> — {item.description}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => step(-1)}
                      className="h-10 rounded-full px-4"
                      aria-label="Fasilitas sebelumnya"
                    >
                      <ArrowLeft />
                      Sebelumnya
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => step(1)}
                      className="h-10 rounded-full px-4"
                      aria-label="Fasilitas berikutnya"
                    >
                      Berikutnya
                      <ArrowRight />
                    </Button>
                  </div>
                  <Button asChild variant="link" className="h-auto p-0">
                    <Link href={`/kategori/${open.slug}`}>Halaman detail &rarr;</Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
