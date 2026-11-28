import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a production build run in a separate folder while `npm run dev` is running.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The MongoDB driver must run on the Node.js server, never in the browser bundle.
  serverExternalPackages: ["mongodb"],
  images: {
    // Serve small modern formats; fall back to the original for old browsers.
    formats: ["image/avif", "image/webp"],
    // Optimized images are cached for a year (brand images never change at the same URL).
    minimumCacheTTL: 60 * 60 * 24 * 365,
    // Only the sizes the UI actually uses, so Vercel doesn't generate extra variants.
    deviceSizes: [640, 828, 1200, 1920],
    imageSizes: [48, 64, 96, 128, 256, 384],
  },
};

export default nextConfig;
