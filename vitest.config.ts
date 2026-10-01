import { defineConfig } from "vitest/config";

// Suite rápida (invariantes): corre en cada `npm test`.
// La suite estadística (*.stats.test.ts) queda fuera; va por `npm run test:stats`.
export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
    exclude: ["**/node_modules/**", "src/**/__tests__/**/*.stats.test.ts"],
  },
});
