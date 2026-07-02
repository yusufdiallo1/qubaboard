/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  // generateBuildId makes every `next build` produce a unique build ID
  // which is embedded in ALL /_next/static/{buildId}/ chunk paths.
  // This means after a deploy, all chunk URLs change → browser MUST fetch fresh.
  // Old cached chunks (different path) are never served instead of new ones.
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
  async headers() {
    return [
      {
        // Chunk files already have unique build IDs in their paths.
        // Cache them aggressively — they will NEVER be stale (path changes each build).
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // HTML pages: never cache — always fetch fresh so new buildId chunks are used
        source: "/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};
export default nextConfig;
