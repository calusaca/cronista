// Brief 059 § 15.8 · Carga de un partido de un torneo archivado en /arena, dentro del MISMO AbortController de
// `ejecutar`: torneo.json estático (esquema + coherencia), `eNN.json.gz` estático descomprimido con
// DecompressionStream y después `POST /api/arena { accion: "reproducir", registro }` (lo hace `ejecutar`), como
// los ejemplos. Sin rutas de servidor nuevas. La identidad del modelo de cada lado la declara el ejecutor.
import { esquemaTorneo, ID_TORNEO, archivoEncuentro, validarCoherencia, type EncuentroTorneo } from "../arena/torneo";

export interface PeticionTorneo { torneo: string; encuentro: string }
export interface OrigenTorneo { id: string; n: number; inicioUtc: string; local: { club: string; modelo: string }; visita: { club: string; modelo: string } }
export class SinDescompresion extends Error { constructor() { super("Este navegador no puede abrir el registro comprimido"); } }

export const esPeticionTorneo = (x: unknown): x is PeticionTorneo =>
  !!x && typeof x === "object" && typeof (x as PeticionTorneo).torneo === "string" && typeof (x as PeticionTorneo).encuentro === "string";

/** Parámetros de /arena: `partido` gana sobre `torneo`; un `torneo` sin `encuentro` de dos dígitos se ignora. */
export function peticionDeUrl(q: URLSearchParams): PeticionTorneo | null {
  if (q.has("partido")) return null;
  const torneo = q.get("torneo"), encuentro = q.get("encuentro");
  return torneo && encuentro && ID_TORNEO.test(torneo) && /^\d{2}$/.test(encuentro) ? { torneo, encuentro } : null;
}

export async function cargarEncuentroTorneo(p: PeticionTorneo, signal: AbortSignal, f: typeof fetch = fetch): Promise<{ registro: unknown; origen: OrigenTorneo }> {
  if (!ID_TORNEO.test(p.torneo) || !/^\d{2}$/.test(p.encuentro)) throw new Error("petición de torneo inválida");
  const rTorneo = await f(`/torneos/${p.torneo}/torneo.json`, { signal });
  if (!rTorneo.ok) throw new Error("torneo");
  const torneo = esquemaTorneo.parse(await rTorneo.json());
  if (torneo.id !== p.torneo || validarCoherencia(torneo).length) throw new Error("torneo incoherente");
  const n = Number(p.encuentro), e = torneo.encuentros.find(x => x.n === n);
  if (!e || e.archivo !== archivoEncuentro(n)) throw new Error("encuentro");
  if (typeof DecompressionStream === "undefined") throw new SinDescompresion();
  const rGz = await f(`/torneos/${p.torneo}/${e.archivo}`, { signal });
  if (!rGz.ok) throw new Error("registro");
  // Revisión Codex (#2) · El archivo descargado tiene que ser EL de este encuentro: huella SHA-256 del archivo
  // íntegro (la archivada en torneo.json) y, ya descomprimido, semilla, clubes y controlador de cada lado.
  const bytes = new Uint8Array(await rGz.arrayBuffer());
  if (await huellaSha256(bytes) !== e.archivoSha256) throw new Error("La huella del registro no coincide con el encuentro");
  const registro = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).json() as unknown;
  const participante = (id: string) => torneo.participantes.find(x => x.id === id)!;
  if (!registroDelEncuentro(registro, e, participante(e.local.participante).controlador, participante(e.visita.participante).controlador)) throw new Error("El registro no corresponde a este encuentro");
  const modelo = (id: string) => participante(id).nombre;
  return { registro, origen: { id: torneo.id, n, inicioUtc: torneo.inicioUtc, local: { club: e.local.club, modelo: modelo(e.local.participante) }, visita: { club: e.visita.club, modelo: modelo(e.visita.participante) } } };
}

/** SHA-256 hexadecimal con la Web Crypto API (contexto seguro: https o localhost). */
export async function huellaSha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Sin crypto.subtle: no se puede verificar el registro");
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Semilla, clubes por lado y controlador de cada decisión de cada lado, contra el encuentro de torneo.json. */
export function registroDelEncuentro(raw: unknown, e: Pick<EncuentroTorneo, "seed" | "local" | "visita">, controladorLocal: string, controladorVisita: string): boolean {
  const r = raw as { config?: { partido?: { seed?: unknown; local?: { nombre?: unknown }; visita?: { nombre?: unknown } } }; rondas?: { decisiones?: { local?: { controlador?: unknown }; visita?: { controlador?: unknown } } }[] };
  const p = r?.config?.partido;
  if (!p || p.seed !== e.seed || p.local?.nombre !== e.local.club || p.visita?.nombre !== e.visita.club) return false;
  return Array.isArray(r.rondas) && r.rondas.length > 0 && r.rondas.every(x => x?.decisiones?.local?.controlador === controladorLocal && x?.decisiones?.visita?.controlador === controladorVisita);
}
