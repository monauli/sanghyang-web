'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

const NAV = [
  { href: '/fasilitas', label: 'Fasilitas' },
  { href: '/tentang-kami', label: 'Tentang' },
  { href: '/kontak', label: 'Kontak' },
];

/** Transparan di atas foto hero Home (gaya referensi), jadi solid begitu
 *  di-scroll lewat hero. Halaman lain (tanpa hero foto) selalu solid. */
export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const [scrolled, setScrolled] = useState(!isHome);

  useEffect(() => {
    if (!isHome) return;
    const onScroll = () => setScrolled(window.scrollY > 64);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHome]);

  const transparent = isHome && !scrolled;

  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-300 ${
        transparent ? 'bg-transparent' : 'border-b border-border/60 bg-background/85 backdrop-blur-md'
      }`}
    >
      <nav
        aria-label="Navigasi utama"
        className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-8"
      >
        <Link
          href="/"
          className={`-my-1 shrink-0 rounded-sm py-1 font-heading text-[1.35rem] font-bold leading-none tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-2xl ${
            transparent ? 'text-white hover:text-white/80' : 'text-foreground hover:text-primary'
          }`}
        >
          Sanghyang<span className="hidden sm:inline"> Resort</span>
        </Link>

        <ul className="ml-auto flex items-center gap-4 text-sm sm:gap-6">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`-my-2 block rounded-sm py-2 font-medium underline-offset-8 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    transparent
                      ? active
                        ? 'text-white underline decoration-sunset decoration-2'
                        : 'text-white/80 hover:text-white'
                      : active
                        ? 'text-primary underline decoration-sunset decoration-2'
                        : 'text-muted-foreground hover:text-primary'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <Button
          asChild
          size="sm"
          className={`hidden h-9 rounded-full px-4 sm:inline-flex ${
            transparent ? 'bg-white text-sea-deep hover:bg-white/90' : ''
          }`}
        >
          <Link href="/#reservasi">Reservasi</Link>
        </Button>
      </nav>
    </header>
  );
}
