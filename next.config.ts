import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev badge sits over the bottom action bars of phone layouts.
  devIndicators: false,
  // Embedded Postgres for local dev is loaded from node_modules, not bundled.
  serverExternalPackages: ["@electric-sql/pglite", "@electric-sql/pglite-pgvector"],
  async headers() {
    return [
      {
        // The service worker must never be served stale, or updates get stuck.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  outputFileTracingIncludes: {
    "/**": ["./db/migrations/**/*"],
    "/api/share/**": ["./node_modules/@fontsource/{inter,space-grotesk}/files/*-latin-{400,600,700}-normal.woff"],
  },
};

export default nextConfig;
