import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Turbopack is the default bundler in Next.js 16 (dev & build)
  // Declaring turbopack config (even empty) silences the webpack-conflict error.
  // Turbopack supports WASM natively — no extra experiments needed.
  turbopack: {},
  // Keep webpack config as fallback when --webpack flag is used explicitly
  webpack(config) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
};

export default nextConfig;
