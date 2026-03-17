import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const isCodespaces =
  process.env.CODESPACES === "true" ||
  !!process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

const envAllowedOrigins = (process.env.NEXT_SERVER_ACTIONS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const defaultDevOrigins = [
  "localhost:3000",
  "127.0.0.1:3000",
  ...(isCodespaces ? ["*.app.github.dev"] : []),
];

const serverActionAllowedOrigins = isProduction
  ? envAllowedOrigins
  : [...defaultDevOrigins, ...envAllowedOrigins];

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      // In production, rely on explicit env allowlist only.
      // In development, include localhost and Codespaces forwarded domains.
      allowedOrigins: serverActionAllowedOrigins,
    },
  },
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
