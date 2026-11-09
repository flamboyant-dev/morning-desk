import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The browser opens 127.0.0.1 while the dev server listens on 0.0.0.0.
  // Without this, Next blocks the client scripts and the desk never hydrates.
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
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
