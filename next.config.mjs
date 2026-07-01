/** @type {import('next').NextConfig} */
const BUILD_ID = Date.now().toString();

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
  async headers() {
    return [
      {
        // Never cache Next.js JS/CSS chunks — force fresh fetch every time
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
          { key: "Surrogate-Control", value: "no-store" },
        ],
      },
      {
        // HTML pages: always revalidate
        source: "/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-cache, must-revalidate" },
        ],
      },
    ];
  },
};
export default nextConfig;
