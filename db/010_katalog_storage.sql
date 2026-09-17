-- Fase 6B — bucket Storage untuk foto kategori & item katalog.
-- BELUM DIJALANKAN. Review dulu, lalu paste ke Supabase SQL Editor.
--
-- Baca publik supaya foto tampil di halaman publik tanpa auth. Tulis/ubah/
-- hapus sengaja TIDAK dibuka untuk anon/authenticated — service_role (dipakai
-- Server Action panel admin) punya akses penuh ke Storage API secara default,
-- beda dari privilege tabel biasa yang butuh GRANT eksplisit di project ini.

insert into storage.buckets (id, name, public)
values ('katalog', 'katalog', true)
on conflict (id) do nothing;

drop policy if exists "Baca publik bucket katalog" on storage.objects;
create policy "Baca publik bucket katalog"
on storage.objects for select
using (bucket_id = 'katalog');
