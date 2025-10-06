import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",

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
};
export default config;
