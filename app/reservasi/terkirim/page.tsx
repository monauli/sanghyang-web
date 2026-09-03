import Link from 'next/link';
import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSiteContent } from '@/lib/supabase/queries';

export const metadata: Metadata = {
  title: 'Permintaan terkirim',
  robots: { index: false, follow: false },
};

export default async function TerkirimPage() {
  const content = await getSiteContent();

  return (
    <div className="mx-auto max-w-2xl px-5 py-14 sm:px-8 sm:py-20">
      <div className="card-surface p-6 sm:p-9">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
          <Check className="size-6" aria-hidden="true" />
        </div>

        <p className="eyebrow mt-6">Permintaan terkirim</p>
        <h1 className="title-page mt-3 text-foreground">
          Terima kasih, permintaan Anda sudah kami terima
        </h1>

        <p className="mt-4 leading-relaxed text-foreground/85">
          Yang Anda kirim adalah <strong className="font-semibold">permintaan reservasi</strong>,
          bukan reservasi yang sudah pasti. Tim kami akan menghubungi Anda lewat telepon atau email
          dalam 1×24 jam untuk mengecek ketersediaan dan mengonfirmasi rinciannya.
        </p>

        <p className="mt-3 leading-relaxed text-foreground/85">
          Tempat, tanggal, dan harga baru terkunci setelah konfirmasi dari kami. Tidak ada
          pembayaran apa pun di tahap ini — kami tidak akan meminta transfer lewat halaman ini.
        </p>

        {(content.contact_phone || content.contact_email) && (
          <div className="mt-6 rounded-xl bg-muted p-4 text-sm leading-relaxed">
            <p className="font-medium text-foreground">Ada yang mendesak?</p>
            <p className="mt-1 text-muted-foreground">
              Hubungi kami langsung
              {content.contact_phone && <> di {content.contact_phone}</>}
              {content.contact_email && <> atau {content.contact_email}</>}.
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="btn-pill">
            <Link href="/">Kembali ke beranda</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="btn-pill bg-card">
            <Link href="/fasilitas">Lihat fasilitas</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
