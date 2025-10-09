import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },        // ← skip ESLint in prod build
  typescript: { ignoreBuildErrors: true },      // ← skip TS errors in prod build

  transpilePackages: [
    "@acme/ui",
    "@acme/core",
    "@acme/server",
    "@acme/config",
    "@acme/db",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "lh4.googleusercontent.com" },
      { protocol: "https", hostname: "lh5.googleusercontent.com" },
      { protocol: "https", hostname: "lh6.googleusercontent.com" },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  serverActions: {
    bodySizeLimit: "50mb",   // ← raise from 1 MB
  },
};
export default config;
