import { defineConfig } from "vitest/config";

// Suite estadística (N = 1000 semillas): `npm run test:stats`.
export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.stats.test.ts"],
    testTimeout: 300_000,
  },
});
