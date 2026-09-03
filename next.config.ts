import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ada package-lock.json di root repo (untuk backend/ + mobile/), jadi Next
  // salah menebak workspace root dan ikut menelusuri folder di luar web/.
  // Kunci ke folder ini.
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    // Foto kategori & item disimpan di situs utama resort. Daftar host ini
    // juga yang mencegah /_next/image dipakai sebagai proxy SSRF ke host lain.
    remotePatterns: [{ protocol: "https", hostname: "sanghyang.com" }],
  },
  // Header pengaman dasar. CSP sengaja belum: Next menyisipkan script inline
  // dan butuh nonce per request — pasang terpisah setelah ditinjau.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          // HSTS hanya berarti di HTTPS; browser mengabaikannya di http://localhost.
          { key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
