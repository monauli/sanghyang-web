// Cetak SQL siap-tempel untuk mengisi tabel outlets.
// Jalankan sekali secara lokal, lalu tempel hasilnya ke Supabase SQL Editor
// (setelah db/007_outlets.sql dijalankan).
//
// Pemakaian: node scripts/create-outlets.ts

/** Slug di services.type -> nama outlet yang tampil di dashboard. */
const OUTLETS: Array<{ slug: string; name: string }> = [
  { slug: 'dbistro', name: "D'Bistro" },
  { slug: 'sunset-grill', name: 'Sunset Grill' },
  { slug: 'dspa', name: "D'Spa" },
  { slug: 'dbar-karaoke', name: "D'Bar & Karaoke" },
  { slug: 'dragon-beach-club', name: 'Dragon Beach Club' },
];

console.log('-- Cek dulu slug di bawah cocok dengan services.type:');
console.log('--   select type, name from public.services where is_bookable;');
console.log('');
console.log('insert into public.outlets (service_id, name)');
console.log('select s.id, v.name');
console.log('from (values');
console.log(
  OUTLETS.map((o) => `  ('${o.slug}', '${o.name.replace(/'/g, "''")}')`).join(',\n')
);
console.log(') as v(slug, name)');
console.log('join public.services s on s.type = v.slug');
console.log('on conflict (service_id) do nothing;');
