import { defineConfig } from "vitest/config";

// Suite rápida (invariantes): corre en cada `npm test`.
// La suite estadística (*.stats.test.ts) queda fuera; va por `npm run test:stats`.
export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
    exclude: ["**/node_modules/**", "src/**/__tests__/**/*.stats.test.ts"],
    // Brief 013: analizar deriva la capa micro (2.000+ eventos) en cada llamada; las pruebas de
    // corpus tardan más que los 5 s por defecto bajo carga paralela.
    testTimeout: 60_000,
  },
});
