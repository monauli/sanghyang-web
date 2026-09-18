import type { Metadata } from 'next';
import { Geist, Geist_Mono, Kaushan_Script } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { OrganizationJsonLd } from '@/components/json-ld';
import { SITE_NAME, SITE_TAGLINE, siteUrl } from '@/lib/seo';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const brushScript = Kaushan_Script({ variable: '--font-script', subsets: ['latin'], weight: ['400'] });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s — ${SITE_NAME}`,
  },
  description:
    'Kamar tepi pantai, dining, spa, dan aktivitas keluarga di Anyer. Kirim permintaan reservasi, tim kami menghubungi Anda untuk konfirmasi.',
  applicationName: SITE_NAME,
  openGraph: { type: 'website', locale: 'id_ID', siteName: SITE_NAME },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} ${brushScript.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#konten"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
        >
          Lompat ke konten utama
        </a>
        <SiteHeader />
        <main id="konten" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <OrganizationJsonLd />
      </body>
    </html>
  );
}
