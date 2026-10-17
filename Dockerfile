FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json next.config.ts ./
COPY src ./src
COPY public ./public
COPY docs/dataset/ficha.json docs/dataset/DATASHEET.md ./docs/dataset/
# Next omite su propio chequeo de tipos (TS 7); ejecutamos el compilador por separado.
# El build no necesita credenciales ni genera crónicas reales.
RUN npm run typecheck && CRONISTA_LLM=stub npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    CRONISTA_CACHE_DIR=/app/.cache/cronicas
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
RUN mkdir -p /app/.cache/cronicas && chown -R node:node /app/.cache
USER node
EXPOSE 3000
CMD ["node", "server.js"]
