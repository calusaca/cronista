import { defineConfig, devices } from "@playwright/test";

// E2e del camino del juez (brief 004 + 006). Corre contra el build de producción, en un
// puerto propio (no reutiliza un server ajeno: un puerto ocupado contestaría por nosotros),
// con el LLM de ENSAYO (una frase rechazada y corregida: así existe el estado ↻) y una
// caché aparte para no mezclarse con la del desarrollo.
const PUERTO = 3417;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}`,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: "npm run build && npm run package:standalone && node .next/standalone/server.js",
    url: `http://127.0.0.1:${PUERTO}`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      PORT: String(PUERTO),
      HOSTNAME: "127.0.0.1",
      CRONISTA_LLM: "ensayo",
      CRONISTA_CACHE_DIR: ".cache/e2e",
    },
  },
});
