// Brief 062 § 17.6 — CLI de administración del torneo del sitio. Llama a las rutas con el token; no necesita RBAC de
// datos sobre Blob ni ningún despliegue.
//
//   ARENA_ADMIN_TOKEN=… npm run arena:torneo-sitio -- --url https://<fqdn> --estado
//   ARENA_ADMIN_TOKEN=… npm run arena:torneo-sitio -- --url https://<fqdn> --cancelar
//   ARENA_ADMIN_TOKEN=… npm run arena:torneo-sitio -- --url https://<fqdn> --cerrar
//
// El token SOLO se lee de la variable de entorno `ARENA_ADMIN_TOKEN` (nunca de un argumento: quedaría en el historial
// del intérprete). Cómo crearlo y leerlo, sin imprimirlo: docs/evidencia/torneo-sitio-062/README.md.
//
// Fixture del sitio (§ 9, e2e): una liga de ENSAYO (participantes a–f programados, 10 s por partido, sin ritmo ni
// IA) jugada por el gestor real sobre un almacén local, con el reloj fijado en un día pasado:
//   rm -rf src/arena/__fixtures__/torneos-sitio && npm run arena:torneo-sitio -- --fixture src/arena/__fixtures__/torneos-sitio
// Es determinista salvo el commit (el de HEAD al generarlo). `scripts/e2e-torneos.mjs` lo copia al almacén del e2e.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { parseArgs } from "node:util";
import { TORNEO_ARENA as T, TORNEO_SITIO as S } from "../sim/limites";
import { almacenTorneosLocal } from "./almacen-torneos";
import { GestorTorneoSitio } from "./torneo-sitio";

/** Día del fixture (pasado: el e2e lanza el de hoy) y su hora de inicio. */
export const INICIO_FIXTURE_SITIO = "2026-10-20T12:00:00.000Z";

export async function generarFixtureSitio(dir: string, commit: string): Promise<string> {
  if (existsSync(dir) && readdirSync(dir).length) throw new Error(`${dir} no está vacío: bórralo antes de regenerar el fixture`);
  let t = Date.parse(INICIO_FIXTURE_SITIO), n = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  const g = new GestorTorneoSitio({
    almacen: almacenTorneosLocal(dir), uuid, ahora: () => t, log: () => {}, registrarSigterm: () => {},
    // El reloj solo avanza con las pausas; el latido se renueva en tiempo real para seguir vigente.
    dormir: async ms => { t += ms; await new Promise(r => setImmediate(r)); },
    programar: (fn, _ms) => { const x = setTimeout(fn, 5); return () => clearTimeout(x); },
    env: { ARENA_TORNEO_SITIO: "1", CRONISTA_COMMIT: commit, ARENA_ORIGEN_PUBLICO: "http://localhost:3000", ARENA_ADMIN_TOKEN: "f".repeat(S.admin.tokenMinCaracteres),
      ARENA_TORNEO_SITIO_ENSAYO: "1", ARENA_TORNEO_SITIO_SEGUNDOS: String(T.ensayoSegundos.min), ARENA_TORNEO_SITIO_SIN_RITMO: "1" },
  });
  g.iniciar();
  for (let i = 0; i < 1000 && g.barrera; i++) await new Promise(r => setTimeout(r, 5));
  const { id } = await g.lanzar({ formato: "liga", prueba: false });
  await g.esperarActivo();
  g.alSigterm();
  await new Promise(r => setTimeout(r, 100)); // deja terminar un latido en vuelo
  for (const f of readdirSync(dir).filter(x => x.startsWith("latido-"))) rmSync(`${dir}/${f}`);
  return id;
}

export interface DepsCliSitio { argv: string[]; env: Record<string, string | undefined>; fetch: typeof fetch; out: (s: string) => void; err: (s: string) => void }

export async function principalSitio(d: DepsCliSitio): Promise<number> {
  const { values: v } = parseArgs({ args: d.argv, strict: true, allowPositionals: false, options: {
    url: { type: "string" }, fixture: { type: "string" }, estado: { type: "boolean", default: false }, cancelar: { type: "boolean", default: false }, cerrar: { type: "boolean", default: false },
  } });
  if (v.fixture) {
    const commit = execFileSync("git", ["-c", `safe.directory=${process.cwd()}`, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    d.out(`Fixture del sitio: ${await generarFixtureSitio(v.fixture, commit)} en ${v.fixture}`);
    return 0;
  }
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
