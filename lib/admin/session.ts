import { SignJWT, jwtVerify } from 'jose';

const ALG = 'HS256';
const SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8 jam

export const SESSION_COOKIE_NAME = 'sanghyang_admin_session';
export const SESSION_MAX_AGE_SECONDS = SESSION_DURATION_SECONDS;

export type AdminRole = 'owner' | 'captain';

export type SessionPayload = {
  sub: string;
  email: string;
  role: AdminRole;
  /** null untuk pemilik. */
  outletId: string | null;
  /** services.id milik outlet tersebut; null untuk pemilik. Dipakai memfilter
   *  reservation_requests. */
  serviceId: string | null;
};

function secretKey(): Uint8Array {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET belum diisi');
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: [ALG] });
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null;

    const role = payload.role;
    if (role !== 'owner' && role !== 'captain') return null;

    const outletId = payload.outletId ?? null;
    const serviceId = payload.serviceId ?? null;
    if (outletId !== null && typeof outletId !== 'string') return null;
    if (serviceId !== null && typeof serviceId !== 'string') return null;

    // Captain wajib punya keduanya: tanpa serviceId, filter outlet tidak punya
    // nilai dan captain bisa melihat semua reservasi.
    if (role === 'captain' && (!outletId || !serviceId)) return null;

    return { sub: payload.sub, email: payload.email, role, outletId, serviceId };
  } catch {
    return null;
  }
}
