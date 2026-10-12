import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lint is run separately via `npm run lint`; type errors still fail the build.
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
