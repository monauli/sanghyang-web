import Link from 'next/link';
import { getSiteContent } from '@/lib/supabase/queries';
import { SITE_NAME } from '@/lib/seo';
import { contactLinks } from '@/lib/contact';
import { TornEdge } from '@/components/torn-edge';

const NAV = [
  { href: '/', label: 'Beranda' },
  { href: '/fasilitas', label: 'Fasilitas' },
  { href: '/tentang-kami', label: 'Tentang Kami' },
  { href: '/kontak', label: 'Kontak' },
];

const LINK =
  '-my-1 inline-block rounded-sm py-1 text-primary-foreground underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70';

/** Footer gelap hijau-laut: penutup yang tenang, kontras dengan halaman pasir. */
export async function SiteFooter() {
  const content = await getSiteContent();
  const contacts = contactLinks(content);

  return (
    <footer className="relative mt-16 bg-sea-deep text-primary-foreground sm:mt-24">
      <TornEdge className="text-background" />
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-3">
          <div>
            <p className="font-heading text-2xl">{SITE_NAME}</p>
            {content.about_us && (
              <p className="mt-3 max-w-md text-sm leading-relaxed text-primary-foreground/80">
                {content.about_us}
              </p>
            )}
          </div>

          <nav aria-label="Navigasi footer">
            <h2 className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-primary-foreground/60">
              Jelajahi
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={LINK}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {contacts.length > 0 && (
            <div>
              <h2 className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-primary-foreground/60">
                Kontak
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                {contacts.map(({ label, value, href }) => (
                  <div key={label}>
                    <dt className="text-primary-foreground/60">{label}</dt>
                    <dd className="mt-0.5">
                      {href ? (
                        <a className={LINK} href={href}>
                          {value}
                        </a>
                      ) : (
                        value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        <p className="mt-12 border-t border-white/10 pt-6 text-xs text-primary-foreground/60">
          {content.footer_text ?? `© ${new Date().getFullYear()} ${SITE_NAME}`}
        </p>
      </div>
    </footer>
  );
}
