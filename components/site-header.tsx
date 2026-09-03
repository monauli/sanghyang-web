'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

const NAV = [
  { href: '/fasilitas', label: 'Fasilitas' },
  { href: '/tentang-kami', label: 'Tentang' },
  { href: '/kontak', label: 'Kontak' },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <nav
        aria-label="Navigasi utama"
        className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-8"
      >
        <Link
          href="/"
          className="-my-1 shrink-0 rounded-sm py-1 font-heading text-[1.35rem] font-medium leading-none tracking-tight text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-2xl"
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
                  className={`-my-2 block rounded-sm py-2 underline-offset-8 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    active
                      ? 'font-medium text-primary underline decoration-sunset decoration-2'
                      : 'text-muted-foreground hover:text-primary'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <Button asChild size="sm" className="hidden h-9 rounded-full px-4 sm:inline-flex">
          <Link href="/#reservasi">Reservasi</Link>
        </Button>
      </nav>
    </header>
  );
}
