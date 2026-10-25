import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: [
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/integration/**/*.test.ts",
    ],
    environment: "node",
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": new URL("./apps/lifehq", import.meta.url).pathname,
      "@lifehq/shared/dates": new URL(
        "./packages/shared/dates.ts",
        import.meta.url,
      ).pathname,
      "@lifehq/shared/analytics": new URL(
        "./packages/shared/analytics.ts",
        import.meta.url,
      ).pathname,
      "@lifehq/shared/import": new URL(
        "./packages/shared/import.ts",
        import.meta.url,
      ).pathname,
      "@lifehq/shared": new URL("./packages/shared/index.ts", import.meta.url)
        .pathname,
      "@lifehq/ui": new URL("./packages/ui/index.tsx", import.meta.url)
        .pathname,
    },
  },
});
