import { SignJWT, jwtVerify } from 'jose';

const ALG = 'HS256';
const SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8 jam

export const SESSION_COOKIE_NAME = 'sanghyang_admin_session';
export const SESSION_MAX_AGE_SECONDS = SESSION_DURATION_SECONDS;

export type SessionPayload = { sub: string; email: string };

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
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
