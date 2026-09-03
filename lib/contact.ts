import type { SiteContent } from './types';

export type ContactLink = { label: string; value: string; href: string | null };

/** Kontak dari site_content, sudah jadi tautan yang bisa diklik. Dipakai footer + /kontak. */
export function contactLinks(content: SiteContent): ContactLink[] {
  const digits = content.contact_phone?.replace(/[^\d+]/g, '');

  return [
    {
      label: 'Telepon',
      value: content.contact_phone ?? '',
      href: digits ? `tel:${digits}` : null,
    },
    {
      label: 'Email',
      value: content.contact_email ?? '',
      href: content.contact_email ? `mailto:${content.contact_email}` : null,
    },
    { label: 'Alamat', value: content.contact_address ?? '', href: null },
  ].filter((c): c is ContactLink => c.value.length > 0);
}

/** Nomor WhatsApp dari nomor telepon Indonesia: 08xx / +62xx -> 62xx. */
export function whatsappNumber(phone: string | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return null;
}
