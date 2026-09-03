/** Nama field anti-bot. Dipisah dari lib/antispam.ts karena file itu memakai
 *  node:crypto dan tidak boleh ikut ke bundle browser. */
export const HONEYPOT_FIELD = 'website';
export const TOKEN_FIELD = 'form_token';
