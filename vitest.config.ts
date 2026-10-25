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
      "@lifehq/shared": new URL("./packages/shared/index.ts", import.meta.url)
        .pathname,
      "@lifehq/ui": new URL("./packages/ui/index.tsx", import.meta.url)
        .pathname,
    },
  },
});
