import type { NextConfig } from "next";

const config: NextConfig = {
  // El chequeo de tipos lo hace `npm run typecheck` (tsc 7, compilador nativo). Next usa la
  // API JS de TypeScript, que TS 7 no expone: se desactiva su chequeo propio en el build.
  typescript: { ignoreBuildErrors: true },
};

export default config;
