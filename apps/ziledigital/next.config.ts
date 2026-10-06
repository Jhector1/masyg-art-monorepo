import type { NextConfig } from "next";
const config: NextConfig = {
  // Keep Turbopack dev artifacts isolated from production builds.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },        // ← skip ESLint in prod build
  typescript: { ignoreBuildErrors: true },      // ← skip TS errors in prod build

  transpilePackages: [
    "@acme/ui",
    "@acme/core",
    "@acme/server",
    "@acme/config",
    "@acme/db",
    "@acme/auth",
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
        {
        protocol: "https",
        hostname: "files.cdn.printful.com" ,
      },
        {
        protocol: "https",
        hostname: "files.printful.com" ,
      },
    ],
  },
};
export default config;
