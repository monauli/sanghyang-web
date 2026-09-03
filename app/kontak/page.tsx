import Link from 'next/link';
import type { Metadata } from 'next';
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { SectionHeading } from '@/components/section-heading';
import { Button } from '@/components/ui/button';
import { getSiteContent } from '@/lib/supabase/queries';
import { contactLinks, whatsappNumber } from '@/lib/contact';
import { defaultOgImage, pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  const bits = [content.contact_phone, content.contact_address].filter(Boolean).join(' · ');

  return pageMetadata({
    title: 'Kontak',
    description: bits
      ? `Hubungi Sanghyang Resort — ${bits}`
      : 'Hubungi Sanghyang Resort untuk pertanyaan, reservasi, atau acara.',
    path: '/kontak',
    image: await defaultOgImage(),
  });
}

const ICONS = {
  Telepon: Phone,
  Email: Mail,
  Alamat: MapPin,
} as const;

export default async function KontakPage() {
  const content = await getSiteContent();
  const contacts = contactLinks(content);
  const wa = whatsappNumber(content.contact_phone);

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <SectionHeading
        as="h1"
        eyebrow="Kontak"
        title="Hubungi Kami"
        subtitle="Punya pertanyaan sebelum memesan, atau ingin mengatur acara? Kami senang membantu."
      />

      {contacts.length === 0 ? (
        <EmptyState>
          Data kontak belum tersedia. Silakan kirim permintaan reservasi lewat halaman kategori —
          tim kami akan menghubungi Anda.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {contacts.map(({ label, value, href }) => {
            const Icon = ICONS[label as keyof typeof ICONS] ?? MapPin;
            const body = (
              <>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {label}
                  </span>
                  <span className="mt-1 block break-words text-[0.95rem] leading-relaxed text-foreground">
                    {value}
                  </span>
                </span>
              </>
            );

            return (
              <li key={label} className={label === 'Alamat' ? 'sm:col-span-2' : undefined}>
                {href ? (
                  <a
                    href={href}
                    className="card-surface card-surface-hover flex h-full items-start gap-4 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {body}
                  </a>
                ) : (
                  <div className="card-surface flex h-full items-start gap-4 p-5">
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        {wa && (
          <Button asChild size="lg" className="btn-pill">
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden="true" />
              Chat lewat WhatsApp
            </a>
          </Button>
        )}
        <Button asChild size="lg" variant="outline" className="btn-pill bg-card">
          <Link href="/#reservasi">Kirim permintaan reservasi</Link>
        </Button>
      </div>

      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        Permintaan reservasi lewat situs ini biasanya kami balas dalam 1×24 jam. Untuk kebutuhan
        mendadak, telepon atau WhatsApp lebih cepat.
      </p>
    </div>
  );
}
