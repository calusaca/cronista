import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  // /datos lee estos archivos en runtime; no dependen del cwd del checkout.
  outputFileTracingIncludes: {
    "/datos": ["./docs/dataset/ficha.json"],
    "/datos/datasheet": ["./docs/dataset/DATASHEET.md"],
  },
  // Una compilación local puede cargar .env; nunca debe viajar en el artefacto.
  outputFileTracingExcludes: { "/*": ["./.env", "./.env.*"] },
  // El chequeo de tipos lo hace `npm run typecheck` (tsc 7, compilador nativo). Next usa la
  // API JS de TypeScript, que TS 7 no expone: se desactiva su chequeo propio en el build.
  typescript: { ignoreBuildErrors: true },
};

export default config;
