'use client';

import { useState, type ChangeEvent } from 'react';

const MAX_WIDTH = 1600;
const QUALITY = 0.8;

async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', QUALITY)
  );
  if (!blob) return file;

  const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
  return new File([blob], name, { type: 'image/webp' });
}

/** Input file foto yang otomatis mengompres & resize di browser sebelum form
 *  submit — foto dari HP bisa 5-10MB, terlalu besar untuk dikirim ke Server
 *  Action dan untuk ditampilkan di halaman publik. Mengganti isi input file
 *  lewat DataTransfer supaya <form action={...}> bawaan tetap jalan apa
 *  adanya, tidak perlu intercept submit manual. */
export function CompressedPhotoInput({
  name,
  currentUrl,
}: {
  name: string;
  currentUrl: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [busy, setBusy] = useState(false);
  const inputId = `foto-${name}`;

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const compressed = await compressImage(file);
      const dt = new DataTransfer();
      dt.items.add(compressed);
      e.target.files = dt.files;
      setPreview(URL.createObjectURL(compressed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label htmlFor={inputId} className="text-sm font-medium">
        Foto
      </label>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- preview lokal (object URL atau URL luar), bukan aset Next.
        <img src={preview} alt="" className="mt-2 h-32 w-32 rounded-md object-cover" />
      )}
      <input
        id={inputId}
        name={name}
        type="file"
        accept="image/*"
        onChange={handleChange}
        disabled={busy}
        className="mt-2 block text-sm"
      />
      {busy && <p className="mt-1 text-xs text-muted-foreground">Mengompres foto…</p>}
    </div>
  );
}
