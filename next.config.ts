import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@microsoft/opentelemetry", "@azure/ai-projects", "@azure/identity", "@azure/storage-blob"],
  // /datos lee estos archivos en runtime; no dependen del cwd del checkout.
  outputFileTracingIncludes: {
    "/api/arena/grabaciones": ["./public/experimentos/arena-duelo-v3.json", "./public/experimentos/arena-llm-v3.json", "./public/experimentos/arena-llm-v1.json"],
    // Brief 064: la crónica de arena lee los mismos ejemplos y los registros de los torneos archivados.
    "/api/arena/cronicas": ["./public/experimentos/arena-duelo-v3.json", "./public/experimentos/arena-llm-v3.json", "./public/experimentos/arena-llm-v1.json", "./public/torneos/**/*.json.gz"],
    // Brief 071: el servidor MCP lista y lee los mismos partidos terminados que la crónica.
    "/api/mcp": ["./public/experimentos/arena-duelo-v3.json", "./public/experimentos/arena-llm-v3.json", "./public/experimentos/arena-llm-v1.json", "./public/torneos/**/*.json.gz", "./public/torneos/**/*.json"],
    "/datos": ["./docs/dataset/ficha.json"],
    "/datos/datasheet": ["./docs/dataset/DATASHEET.md"],
  },
  // Una compilación local puede cargar .env; nunca debe viajar en el artefacto.
  outputFileTracingExcludes: { "/*": ["./.env", "./.env.*"] },
  // El chequeo de tipos lo hace `npm run typecheck` (tsc 7, compilador nativo). Next usa la
  // API JS de TypeScript, que TS 7 no expone: se desactiva su chequeo propio en el build.
  typescript: { ignoreBuildErrors: true },
  // Brief 064 D2 · Sin esta opción, Next reconstruye la URL que ve `src/proxy.ts` desde un objeto de query que agrupa
  // las claves repetidas (`/?a=1&b=2&a=3` llegaba como `a=1&a=3&b=2`). Con ella el proxy recibe la URL tal como la
  // envió el cliente; el proxy (solo en `/`) descarta el `_rsc` interno que Next ya no quita.
  skipProxyUrlNormalize: true,
};

export default config;
