import { NextResponse } from 'next/server';
import { createFormToken } from '@/lib/antispam';

/**
 * Token anti-bot untuk form reservasi. Diambil saat form dibuka, bukan saat
 * halaman dirender: halaman kategori di-prerender (SSG), jadi token yang
 * ditanam di HTML statis akan basi.
 */
export async function GET() {
  return NextResponse.json(
    { token: createFormToken() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
