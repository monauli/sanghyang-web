'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LayoutGrid, X } from 'lucide-react';
import { SocialIcons } from '@/components/social-icons';

const NAV = [
  { href: '/fasilitas', label: 'Fasilitas' },
  { href: '/tentang-kami', label: 'Tentang Kami' },
  { href: '/kontak', label: 'Kontak' },
];

/** Kolom kiri hero Home: logo di atas, tombol menu di tengah, sosmed di bawah —
 *  gaya referensi (sidebar tipis penuh tinggi layar, bukan header melintang). */
export function HeroSidebar({ contactPhone }: { contactPhone?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <aside className="relative z-30 flex w-14 shrink-0 flex-col items-center justify-between py-5 sm:w-20 sm:py-7">
      <Link
        href="/"
        className="text-[0.5rem] font-bold uppercase tracking-tight text-white/90 transition-colors hover:text-white sm:text-[0.6rem] sm:tracking-wide"
      >
        Sanghyang
      </Link>

      <button
        type="button"
        aria-label={open ? 'Tutup menu' : 'Buka menu'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-sm p-1 text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        {open ? <X className="size-5" /> : <LayoutGrid className="size-5" />}
      </button>

      <SocialIcons vertical contactPhone={contactPhone} className="gap-5" />

      {open && (
        <nav
          aria-label="Navigasi utama"
          className="absolute left-full top-1/2 ml-2 w-44 -translate-y-1/2 rounded-xl bg-sea-deep/95 p-2 shadow-xl backdrop-blur"
        >
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-white/85 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </aside>
  );
}
