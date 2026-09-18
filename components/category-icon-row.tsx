import Link from 'next/link';
import { BedDouble, UtensilsCrossed, Soup, Sparkles, Music, Waves, Shell } from 'lucide-react';
import type { Service } from '@/lib/types';
import type { LucideIcon } from 'lucide-react';

const ICON_BY_TYPE: Record<string, LucideIcon> = {
  rooms: BedDouble,
  'd-bistro': UtensilsCrossed,
  'sunset-grill': Soup,
  'd-spa': Sparkles,
  'd-bar-karaoke': Music,
  'dragon-beach-club': Waves,
};

/** Baris kartu kotak kecil di tepi bawah foto hero, rata kiri dengan label di
 *  atasnya — gaya referensi (baris "activities you can plan"). */
export function CategoryIconRow({ services }: { services: Service[] }) {
  if (services.length === 0) return null;

  return (
    <div>
      <p className="text-xs text-white/85 sm:text-sm">Yang bisa kamu reservasi:</p>
      <ul className="scrollbar-none mt-3 flex gap-2.5 overflow-x-auto pb-1 sm:gap-3">
        {services.map((service) => {
          const Icon = ICON_BY_TYPE[service.type] ?? Shell;
          return (
            <li key={service.id}>
              <Link
                href={`/kategori/${service.type}`}
                className="flex size-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-lg bg-white/20 px-1.5 text-center text-white backdrop-blur-sm transition-colors hover:bg-white/30 sm:size-20"
              >
                <Icon className="size-5" aria-hidden="true" />
                <span className="text-[0.6rem] font-medium leading-tight">{service.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
