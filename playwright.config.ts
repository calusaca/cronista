import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// E2e del camino del juez (brief 004 + 006). Corre contra el build de producción, en un
// puerto propio (no reutiliza un server ajeno: un puerto ocupado contestaría por nosotros),
// con el LLM de ENSAYO (una frase rechazada y corregida: así existe el estado ↻) y una
// caché aparte para no mezclarse con la del desarrollo.
const PUERTO = 3417;
/** Brief 062 § 10 · El torneo del sitio en el e2e: encendido, en ENSAYO (sin IA), 10 s por partido y sin ritmo. */
const commit = (() => { try { return execFileSync("git", ["-c", `safe.directory=${process.cwd()}`, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { return "0000000"; } })();
export const TOKEN_ADMIN_E2E = "e2e-token-de-administracion-solo-para-pruebas";

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
    // Brief 059 § 8: el fixture del torneo de ensayo se sirve como estático solo en el build del e2e.
    command: "npm run build && npm run package:standalone && node scripts/e2e-torneos.mjs && node .next/standalone/server.js",
    url: `http://127.0.0.1:${PUERTO}`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      PORT: String(PUERTO),
      HOSTNAME: "127.0.0.1",
      CRONISTA_LLM: "ensayo",
      CRONISTA_CACHE_DIR: ".cache/e2e",
      // Brief 059 § 8: la página lee una copia de public/torneos más el fixture de ensayo (scripts/e2e-torneos.mjs).
      ARENA_TORNEOS_DIR: resolve(".cache/e2e/torneos"),
      ARENA_TORNEO_SITIO: "1", CRONISTA_COMMIT: commit, ARENA_TORNEO_SITIO_ENSAYO: "1",
      ARENA_TORNEO_SITIO_SEGUNDOS: "10", ARENA_TORNEO_SITIO_SIN_RITMO: "1",
      ARENA_TORNEOS_SITIO_DIR: resolve(".cache/e2e/torneos-sitio"),
      ARENA_ORIGEN_PUBLICO: `http://127.0.0.1:${PUERTO}`, ARENA_ADMIN_TOKEN: TOKEN_ADMIN_E2E,
    },
  },
});
