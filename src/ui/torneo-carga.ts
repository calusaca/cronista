// Brief 059 § 15.8 · Carga de un partido de un torneo archivado en /arena, dentro del MISMO AbortController de
// `ejecutar`: torneo.json estático (esquema + coherencia), `eNN.json.gz` estático descomprimido con
// DecompressionStream y después `POST /api/arena { accion: "reproducir", registro }` (lo hace `ejecutar`), como
// los ejemplos. Sin rutas de servidor nuevas. La identidad del modelo de cada lado la declara el ejecutor.
import { esquemaTorneo, ID_TORNEO, archivoEncuentro, validarCoherencia } from "../arena/torneo";

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
  if (!rGz.ok || !rGz.body) throw new Error("registro");
  // Si el servidor lo sirvió con Content-Encoding: gzip, el navegador ya lo descomprimió.
  const yaDescomprimido = /gzip/i.test(rGz.headers.get("content-encoding") ?? "");
  const registro = await (yaDescomprimido ? rGz : new Response(rGz.body.pipeThrough(new DecompressionStream("gzip")))).json() as unknown;
  const modelo = (id: string) => torneo.participantes.find(x => x.id === id)!.nombre;
  return { registro, origen: { id: torneo.id, n, inicioUtc: torneo.inicioUtc, local: { club: e.local.club, modelo: modelo(e.local.participante) }, visita: { club: e.visita.club, modelo: modelo(e.visita.participante) } } };
}
