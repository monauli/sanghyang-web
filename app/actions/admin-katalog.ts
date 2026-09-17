'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireScopedClient } from '@/lib/admin/scope';
import { listServicesAdmin, getServiceByIdAdmin, getItemByIdAdmin } from '@/lib/katalog/queries';
import { slugify, uniqueSlug } from '@/lib/katalog/slug';
import { uploadKatalogFoto, deleteFotoJikaMilikKita, FotoError } from '@/lib/katalog/photo';
import { parsePrice } from '@/lib/katalog/validation';

export type KatalogFormState = { error: string | null; success: boolean };

export async function simpanKategori(
  _prevState: KatalogFormState,
  formData: FormData
): Promise<KatalogFormState> {
  const { session, supabase } = await requireScopedClient();
  if (session.role !== 'owner') return { error: 'Khusus pemilik.', success: false };

  const id = String(formData.get('id') ?? '').trim() || null;
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const isBookable = formData.get('is_bookable') === 'on';
  const photo = formData.get('photo');

  if (name.length < 2) return { error: 'Nama kategori minimal 2 karakter.', success: false };

  let photoUrl: string | undefined;
  if (photo instanceof File && photo.size > 0) {
    try {
      photoUrl = await uploadKatalogFoto(supabase, photo);
    } catch (err) {
      return { error: err instanceof FotoError ? err.message : 'Upload foto gagal.', success: false };
    }
  }

  if (id) {
    const current = await getServiceByIdAdmin(supabase, id);
    if (!current) return { error: 'Kategori tidak ditemukan.', success: false };

    // Rooms (booking_method = 'exely') dikunci: form ini tidak boleh pernah
    // mengubahnya jadi self_service, apa pun isi checkbox-nya (lihat Global
    // Constraints di plan ini). Sumber kebenaran diambil dari DB, bukan
    // form, supaya tidak bisa dipalsukan lewat hidden field.
    const isBookableFinal = current.booking_method === 'exely' ? true : isBookable;

    const update: Record<string, unknown> = {
      name,
      description: description || null,
      is_bookable: isBookableFinal,
      booking_method: current.booking_method,
    };
    if (photoUrl) update.photo_url = photoUrl;

    const { error } = await supabase.from('services').update(update).eq('id', id);
    if (error) return { error: `Gagal menyimpan: ${error.message}`, success: false };

    if (photoUrl) await deleteFotoJikaMilikKita(supabase, current.photo_url);

    revalidatePath('/panel-sanghyang/katalog');
    revalidatePath(`/panel-sanghyang/katalog/${id}`);
    revalidatePath('/');
    revalidatePath('/fasilitas');
    revalidatePath('/kategori/[slug]', 'page');
    return { error: null, success: true };
  }

  const existing = await listServicesAdmin(supabase);
  const slug = uniqueSlug(
    slugify(name),
    existing.map((s) => s.type)
  );

  const { data, error } = await supabase
    .from('services')
    .insert({
      type: slug,
      name,
      description: description || null,
      is_bookable: isBookable,
      booking_method: 'self_service',
      photo_url: photoUrl ?? null,
    })
    .select('id')
    .single();
  if (error || !data) {
    return { error: `Gagal menyimpan: ${error?.message ?? 'tidak diketahui'}`, success: false };
  }

  revalidatePath('/panel-sanghyang/katalog');
  revalidatePath('/');
  revalidatePath('/fasilitas');
  redirect(`/panel-sanghyang/katalog/${data.id}`);
}

export async function simpanItem(
  _prevState: KatalogFormState,
  formData: FormData
): Promise<KatalogFormState> {
  const { session, supabase } = await requireScopedClient();
  if (session.role !== 'owner') return { error: 'Khusus pemilik.', success: false };

  const id = String(formData.get('id') ?? '').trim() || null;
  const serviceId = String(formData.get('service_id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const priceRaw = String(formData.get('price') ?? '');
  const photo = formData.get('photo');

  if (!serviceId) return { error: 'Kategori tidak valid.', success: false };
  if (name.length < 2) return { error: 'Nama item minimal 2 karakter.', success: false };

  const price = parsePrice(priceRaw);
  if (price === null) return { error: 'Harga tidak valid.', success: false };

  let photoUrl: string | undefined;
  if (photo instanceof File && photo.size > 0) {
    try {
      photoUrl = await uploadKatalogFoto(supabase, photo);
    } catch (err) {
      return { error: err instanceof FotoError ? err.message : 'Upload foto gagal.', success: false };
    }
  }

  if (id) {
    const current = await getItemByIdAdmin(supabase, id);
    if (!current) return { error: 'Item tidak ditemukan.', success: false };

    const update: Record<string, unknown> = { name, description: description || null, price };
    if (photoUrl) update.photo_url = photoUrl;

    const { error } = await supabase
      .from('service_items')
      .update(update)
      .eq('id', id)
      .eq('service_id', serviceId);
    if (error) return { error: `Gagal menyimpan: ${error.message}`, success: false };

    if (photoUrl) await deleteFotoJikaMilikKita(supabase, current.photo_url);
  } else {
    const { error } = await supabase.from('service_items').insert({
      service_id: serviceId,
      name,
      description: description || null,
      price,
      photo_url: photoUrl ?? null,
      is_active: true,
    });
    if (error) return { error: `Gagal menyimpan: ${error.message}`, success: false };
  }

  revalidatePath(`/panel-sanghyang/katalog/${serviceId}`);
  revalidatePath('/kategori/[slug]', 'page');
  revalidatePath('/fasilitas');
  redirect(`/panel-sanghyang/katalog/${serviceId}`);
}
