import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The MongoDB driver must run on the Node.js server, never in the browser bundle.
  serverExternalPackages: ["mongodb"],
};

export default nextConfig;
