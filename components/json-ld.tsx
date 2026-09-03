import { getSiteContent } from '@/lib/supabase/queries';
import { SITE_NAME, defaultOgImage, siteUrl } from '@/lib/seo';

/**
 * Data terstruktur schema.org untuk bisnis perhotelan. `Resort` adalah subtipe
 * `LodgingBusiness`, jadi Google mengenalinya sebagai akomodasi, bukan sekadar
 * organisasi biasa. Isinya diambil dari site_content — tidak ada yang dikarang.
 */
export async function OrganizationJsonLd() {
  const [content, image] = await Promise.all([getSiteContent(), defaultOgImage()]);
  const url = siteUrl();

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Resort',
    '@id': `${url}/#resort`,
    name: SITE_NAME,
    url,
    ...(content.about_us && { description: content.about_us }),
    ...(image && { image }),
    ...(content.contact_phone && { telephone: content.contact_phone }),
    ...(content.contact_email && { email: content.contact_email }),
    ...(content.contact_address && {
      address: {
        '@type': 'PostalAddress',
        streetAddress: content.contact_address,
        addressCountry: 'ID',
      },
    }),
  };

  return (
    <script
      type="application/ld+json"
      // Aman: isinya objek yang kita bangun sendiri, bukan HTML dari user.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
