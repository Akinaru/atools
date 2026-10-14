import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone, used by the Dockerfile.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Tools upload files through Server Actions (e.g. Switch saves are several MB).
    serverActions: { bodySizeLimit: "64mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
