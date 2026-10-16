import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Embedded Postgres for local dev is loaded from node_modules, not bundled.
  serverExternalPackages: ["@electric-sql/pglite", "@electric-sql/pglite-pgvector"],
  outputFileTracingIncludes: {
    "/**": ["./db/migrations/**/*"],
    "/api/share/**": ["./node_modules/@fontsource/{inter,space-grotesk}/files/*-latin-{400,600,700}-normal.woff"],
  },
};

export default nextConfig;
