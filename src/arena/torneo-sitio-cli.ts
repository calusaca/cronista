// Brief 062 § 17.6 — CLI de administración del torneo del sitio. Llama a las rutas con el token; no necesita RBAC de
// datos sobre Blob ni ningún despliegue.
//
//   ARENA_ADMIN_TOKEN=… npm run arena:torneo-sitio -- --url https://<fqdn> --estado
//   ARENA_ADMIN_TOKEN=… npm run arena:torneo-sitio -- --url https://<fqdn> --cancelar
//   ARENA_ADMIN_TOKEN=… npm run arena:torneo-sitio -- --url https://<fqdn> --cerrar
//
// El token SOLO se lee de la variable de entorno `ARENA_ADMIN_TOKEN` (nunca de un argumento: quedaría en el historial
// del intérprete). Cómo crearlo y leerlo, sin imprimirlo: docs/evidencia/torneo-sitio-062/README.md.
import { parseArgs } from "node:util";

export interface DepsCliSitio { argv: string[]; env: Record<string, string | undefined>; fetch: typeof fetch; out: (s: string) => void; err: (s: string) => void }

export async function principalSitio(d: DepsCliSitio): Promise<number> {
  const { values: v } = parseArgs({ args: d.argv, strict: true, allowPositionals: false, options: {
    url: { type: "string" }, estado: { type: "boolean", default: false }, cancelar: { type: "boolean", default: false }, cerrar: { type: "boolean", default: false },
  } });
  const acciones = [v.estado, v.cancelar, v.cerrar].filter(Boolean).length;
  if (acciones !== 1) { d.err("Indica exactamente una acción: --estado, --cancelar o --cerrar"); return 1; }
  const base = (v.url ?? d.env.ARENA_URL ?? "").replace(/\/$/, "");
  if (!/^https?:\/\/[^/]+$/.test(base)) { d.err("--url (o ARENA_URL) obligatorio: origen del sitio, p. ej. https://cronista-arena.<dominio>"); return 1; }
  if (v.estado) {
    const r = await d.fetch(`${base}/api/arena/torneos/sitio`, { headers: { accept: "application/json" } });
    d.out(JSON.stringify(await r.json(), null, 2));
    return r.ok ? 0 : 1;
  }
  const token = d.env.ARENA_ADMIN_TOKEN;
  if (!token) { d.err("Falta ARENA_ADMIN_TOKEN en el entorno"); return 1; }
  const r = await d.fetch(`${base}/api/arena/torneos/sitio/${v.cancelar ? "cancelar" : "cerrar"}`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
  const cuerpo = await r.text();
  d.out(`${r.status} ${cuerpo.split(token).join("[REDACTED]")}`);
  return r.ok ? 0 : 1;
}

if (process.argv[1]?.endsWith("torneo-sitio-cli.ts")) {
  void principalSitio({ argv: process.argv.slice(2), env: process.env, fetch, out: s => console.log(s), err: s => console.error(s) }).then(c => { process.exitCode = c; });
}
