/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  transpilePackages: ["@acme/core", "@acme/server", "@acme/db"],
};

export default nextConfig;
