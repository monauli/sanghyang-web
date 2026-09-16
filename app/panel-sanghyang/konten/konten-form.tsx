'use client';

import { simpanKonten } from '@/app/actions/admin-konten';
import type { SiteContent } from '@/lib/types';

const FIELD =
  'mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm';

export function KontenForm({ content }: { content: SiteContent }) {
  return (
    <form action={simpanKonten} className="space-y-4">
      <div>
        <label htmlFor="about_us" className="text-sm font-medium">
          Tentang Kami
        </label>
        <textarea
          id="about_us"
          name="about_us"
          rows={5}
          defaultValue={content.about_us ?? ''}
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="contact_phone" className="text-sm font-medium">
          Telepon
        </label>
        <input
          id="contact_phone"
          name="contact_phone"
          type="text"
          defaultValue={content.contact_phone ?? ''}
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="contact_email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="contact_email"
          name="contact_email"
          type="email"
          defaultValue={content.contact_email ?? ''}
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="contact_address" className="text-sm font-medium">
          Alamat
        </label>
        <textarea
          id="contact_address"
          name="contact_address"
          rows={2}
          defaultValue={content.contact_address ?? ''}
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="footer_text" className="text-sm font-medium">
          Teks Footer
        </label>
        <input
          id="footer_text"
          name="footer_text"
          type="text"
          defaultValue={content.footer_text ?? ''}
          className={FIELD}
        />
      </div>

      <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
        Simpan
      </button>
    </form>
  );
}
