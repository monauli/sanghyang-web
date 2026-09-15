import { waLink } from './wa-link.ts';

export type NoticeReservation = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  reservation_date: string;
  checkout_date: string | null;
  guests: number;
  notes: string | null;
  item_name: string | null;
};

export type NoticeInput = {
  outletName: string;
  dashboardUrl: string;
  reservation: NoticeReservation;
};

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** '2026-10-12' -> '12 Okt 2026'. Tanggal datang sebagai date polos dari
 *  Postgres, jadi dipecah manual — jangan lewat new Date() yang menggeser
 *  tanggal karena zona waktu. */
function formatDate(iso: string): string {
  const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const [y, m, d] = iso.split('-');
  const bulan = BULAN[Number(m) - 1];
  if (!bulan) return iso;
  return `${Number(d)} ${bulan} ${y}`;
}

export function buildReservationNotice(input: NoticeInput): {
  subject: string;
  html: string;
  text: string;
} {
  const r = input.reservation;
  const tanggal = formatDate(r.reservation_date);
  const subject = `Reservasi baru — ${input.outletName}, ${tanggal}`;

  const baris: Array<[string, string]> = [
    ['Nama', r.customer_name],
    ['Telepon', r.customer_phone],
    ['Email', r.customer_email],
    ['Tanggal', r.checkout_date ? `${tanggal} s/d ${formatDate(r.checkout_date)}` : tanggal],
    ['Jumlah tamu', String(r.guests)],
  ];
  if (r.item_name) baris.push(['Pilihan', r.item_name]);
  if (r.notes) baris.push(['Catatan tamu', r.notes]);

  const sapaan =
    `Halo ${r.customer_name}, terima kasih sudah mengirim permintaan reservasi ` +
    `di ${input.outletName} untuk ${tanggal}. Kami ingin mengonfirmasi beberapa hal.`;
  const wa = waLink(r.customer_phone, sapaan);

  const text = [
    `Reservasi baru di ${input.outletName}.`,
    '',
    ...baris.map(([label, value]) => `${label}: ${value}`),
    '',
    `Buka dashboard: ${input.dashboardUrl}`,
  ].join('\n');

  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#1c1917">
  <h2 style="margin:0 0 4px;font-size:18px">Reservasi baru</h2>
  <p style="margin:0 0 16px;color:#57534e">${esc(input.outletName)}</p>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    ${baris
      .map(
        ([label, value]) =>
          `<tr><td style="padding:4px 16px 4px 0;color:#57534e;vertical-align:top">${esc(label)}</td>` +
          `<td style="padding:4px 0"><strong>${esc(value)}</strong></td></tr>`
      )
      .join('\n    ')}
  </table>
  <p style="margin:20px 0 0">
    ${
      wa
        ? `<a href="${esc(wa)}" style="display:inline-block;padding:10px 18px;margin-right:8px;background:#128c7e;color:#fff;border-radius:999px;text-decoration:none">Chat via WhatsApp</a>`
        : ''
    }
    <a href="${esc(input.dashboardUrl)}" style="display:inline-block;padding:10px 18px;background:#f5f5f4;color:#1c1917;border-radius:999px;text-decoration:none">Buka dashboard</a>
  </p>
</div>`;

  return { subject, html, text };
}
