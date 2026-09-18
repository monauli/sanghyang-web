'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isHome) return;
    const onScroll = () => setScrolled(window.scrollY > 64);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHome]);

  const transparent = isHome && !scrolled;

  // Home pakai sidebar kiri (components/hero-sidebar.tsx), bukan header
  // melintang — lihat referensi desain Home.
  if (isHome) return null;

  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-300 ${
        transparent ? 'bg-transparent' : 'border-b border-border/60 bg-background/85 backdrop-blur-md'
      }`}
    >
      <nav
        aria-label="Navigasi utama"
        className="relative mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-8"
      >
        <Link
          href="/"
          className={`-my-1 shrink-0 rounded-sm py-1 font-heading text-[1.35rem] font-bold leading-none tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-2xl ${
            transparent ? 'text-white hover:text-white/80' : 'text-foreground hover:text-primary'
          }`}
        >
          Sanghyang<span className="hidden sm:inline"> Resort</span>
        </Link>

        <div className="ml-auto flex items-center gap-4">
          <span
            className={`hidden text-sm font-medium sm:inline ${
              transparent ? 'text-white/85' : 'text-muted-foreground'
            }`}
          >
            Anyer, Banten
          </span>

          <Button
            asChild
            size="sm"
            className={`hidden h-9 rounded-full px-4 sm:inline-flex ${
              transparent ? 'bg-white text-sea-deep hover:bg-white/90' : ''
            }`}
          >
            <Link href="/#reservasi">Reservasi</Link>
          </Button>

          <button
            type="button"
            aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className={`-m-2 rounded-sm p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              transparent ? 'text-white hover:text-white/80' : 'text-foreground hover:text-primary'
            }`}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="absolute inset-x-0 top-full border-b border-border bg-background shadow-lg">
          <ul className="mx-auto max-w-6xl space-y-1 px-4 py-3 sm:px-8">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={`block rounded-md px-3 py-2 text-sm font-medium ${
                      active ? 'bg-muted text-primary' : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li className="pt-1 sm:hidden">
              <Link
                href="/#reservasi"
                onClick={() => setMenuOpen(false)}
                className="block rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground"
              >
                Reservasi
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
