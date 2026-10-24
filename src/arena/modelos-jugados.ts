// Brief 060 § 5 + v1.1 (8)(10) · Modelos que jugaron: nombre público de cada controlador (catálogo empaquetado,
// infra/modelos-arena.json, sin secretos) y procedencia por lado. Puro: sin red ni DOM.
import type { AsignacionModelos } from "./protocolo";
import type { RegistroArena } from "./tipos";
import type { Lado } from "../sim/tipos";
import { controladorVerificado } from "./antesala";

type Idioma = "es" | "en";
export interface EntradaCatalogo { nombre: string; modelo: string; nombrePublico: string; publicar?: boolean }
/** § 5.3 · Forma de carga del registro en pantalla (la fija `Arena` en cada carga). */
export type ContextoModelos = { forma: "sesion"; asignacion: AsignacionModelos } | { forma: "ejemplo" } | { forma: "importado" } | { forma: "torneo" } | { forma: "simulado" };
export type Procedencia = "verificada" | "declarada" | "programado" | "ensayo";
/** Calificativo de una procedencia declarada: el archivo (o importado), el ejemplo del proyecto o el ejecutor del torneo. */
export type FuenteDeclarada = "archivo" | "ejemplo" | "torneo";

const TEXTOS = {
  programado: { en: "Programmed policy", es: "Política programada" },
  ensayo: { en: "Rehearsal (no model)", es: "Ensayo (sin modelo)" },
  fuera: { en: (d: string) => `deployment ${d} (not in the catalog)`, es: (d: string) => `deployment ${d} (fuera del catálogo)` },
  deployment: (nombre: string, d: string) => `${nombre} (deployment ${d})`,
  respaldo: { en: (n: number, total: number) => `${n} of ${total} decisions by programmed fallback`, es: (n: number, total: number) => `${n} de ${total} decisiones con respaldo programado` },
  mezcla: { en: "mixed", es: "mezcla" },
  sinDecisionesAun: { en: "no decisions yet", es: "sin decisiones aún" },
  sinDecisiones: { en: "no recorded decisions", es: "sin decisiones registradas" },
  difieren: { en: "assignment and record differ", es: "la asignación y el registro difieren" },
  lados: { en: { local: "Home", visita: "Away" }, es: { local: "Local", visita: "Visita" } },
} as const;
/** § 5.4 · Rótulos de procedencia (EN / ES). */
export const ROTULOS_PROCEDENCIA: Record<"verificada" | "programado" | "ensayo" | `declarada-${FuenteDeclarada}`, Record<Idioma, string>> = {
  verificada: { en: "verified: assigned by this session's server", es: "verificada: la asignó el servidor de esta sesión" },
  "declarada-archivo": { en: "declared by the file, not verified", es: "declarada por el archivo, no verificada" },
  "declarada-ejemplo": { en: "declared by the project's archived file, not verified", es: "declarada por el archivo archivado del proyecto, no verificada" },
  "declarada-torneo": { en: "declared by the tournament runner, not verified", es: "declarada por el ejecutor del torneo, no verificada" },
  programado: { en: "programmed, no AI", es: "programado, sin IA" },
  ensayo: { en: "rehearsal: programmed coaches with test names", es: "ensayo: entrenadores programados con nombre de prueba" },
};

const esEnsayo = (id: string) => id === "ensayo" || id.startsWith("ensayo:");
const esProgramado = (id: string) => id.startsWith("programado:");
const DEPLOYMENT = /^(?:azure-openai|foundry|foundry-modelos):([^:]+)(?::reasoning-[a-z]+)?$/;

/** § 5.1 · Nombre público de un controlador. Primero por `nombre` (el deployment), después por `modelo` (con el
 * sufijo del deployment) y, si no, «fuera del catálogo»; cualquier otro id, literal. */
export function nombreControlador(id: string, catalogo: readonly EntradaCatalogo[], idioma: Idioma = "en"): string {
  if (esProgramado(id)) return TEXTOS.programado[idioma];
  if (esEnsayo(id) || id.startsWith("stub")) return TEXTOS.ensayo[idioma];
  const d = DEPLOYMENT.exec(id)?.[1];
  if (!d) return id;
  const porNombre = catalogo.find(e => e.nombre === d);
  if (porNombre) return porNombre.nombrePublico;
  const porModelo = catalogo.find(e => e.modelo === d);
  if (porModelo) return TEXTOS.deployment(porModelo.nombrePublico, d);
  return TEXTOS.fuera[idioma](d);
}

/** § 5.2 · Decisiones de un lado (las publicadas hasta ahora en directo): por controlador y con respaldo. */
export function ladoJugado(registro: Pick<RegistroArena, "rondas">, lado: Lado, catalogo: readonly EntradaCatalogo[], idioma: Idioma = "en"): { decisiones: number; controladores: string[]; respaldos: number; tipos: ("programado" | "llm")[]; nombre: string | null } {
  const ds = registro.rondas.map(r => r.decisiones[lado]).filter(d => d !== undefined);
  const cuenta = new Map<string, number>();
  for (const d of ds) cuenta.set(d.controlador, (cuenta.get(d.controlador) ?? 0) + 1);
  const respaldos = ds.filter(d => d.origen === "respaldo").length, controladores = [...cuenta.keys()];
  let nombre: string | null = null;
  if (controladores.length === 1) {
    nombre = nombreControlador(controladores[0]!, catalogo, idioma);
    if (respaldos) nombre += ` (${TEXTOS.respaldo[idioma](respaldos, ds.length)})`;
  } else if (controladores.length > 1) {
    const partes = [...cuenta.entries()].map(([id, n], orden) => ({ id, n, orden })).sort((a, b) => b.n - a.n || a.orden - b.orden);
    nombre = `${TEXTOS.mezcla[idioma]}: ${partes.map(p => `${nombreControlador(p.id, catalogo, idioma)} ×${p.n}`).join(", ")}`;
    if (respaldos) nombre += ` (${TEXTOS.respaldo[idioma](respaldos, ds.length)})`;
  }
  return { decisiones: ds.length, controladores, respaldos, tipos: ds.map(d => d.tipo), nombre };
}

/** v1.1 (10) · Identidad y procedencia de un lado. */
export interface LadoProcedencia { nombre: string; procedencia: Procedencia; fuente?: FuenteDeclarada }
export function procedenciaLado(registro: Pick<RegistroArena, "rondas">, lado: Lado, contexto: ContextoModelos, catalogo: readonly EntradaCatalogo[], idioma: Idioma = "en"): LadoProcedencia {
  const jugado = ladoJugado(registro, lado, catalogo, idioma);
  const fuente: FuenteDeclarada = contexto.forma === "ejemplo" ? "ejemplo" : contexto.forma === "torneo" ? "torneo" : "archivo";
  const declarada = (nombre: string): LadoProcedencia => ({ nombre, procedencia: "declarada", fuente });
  const todosProgramados = jugado.decisiones > 0 && jugado.tipos.every(t => t === "programado") && jugado.controladores.every(esProgramado);
  if (jugado.decisiones > 0 && jugado.controladores.every(esEnsayo)) return { nombre: jugado.nombre!, procedencia: "ensayo" };
  if (contexto.forma === "sesion") {
    const asignacion = contexto.asignacion[lado], clausula = controladorVerificado(contexto.asignacion, lado).clausula;
    if (!jugado.decisiones) {
      const nombre = `${clausula === "programado" ? TEXTOS.programado[idioma] : asignacion.nombre} (${TEXTOS.sinDecisionesAun[idioma]})`;
      return clausula === "modelo" ? { nombre, procedencia: "verificada" } : clausula === "programado" ? { nombre, procedencia: "programado" } : declarada(nombre);
    }
    const coherente = jugado.controladores.every(c => c === asignacion.controlador);
    if (clausula === "modelo" && coherente) return { nombre: asignacion.nombre + (jugado.respaldos ? ` (${TEXTOS.respaldo[idioma](jugado.respaldos, jugado.decisiones)})` : ""), procedencia: "verificada" };
    if (clausula === "programado" && coherente && todosProgramados) return { nombre: jugado.nombre!, procedencia: "programado" };
    // Grabaciones registradas, `procedencia: "declarada"` o incoherencia: declarada por el archivo, con nombres de `rondas`.
    return declarada(clausula !== "ninguna" ? `${jugado.nombre} (${TEXTOS.difieren[idioma]})` : jugado.nombre!);
  }
  if (!jugado.decisiones) return contexto.forma === "simulado" ? { nombre: TEXTOS.sinDecisiones[idioma], procedencia: "programado" } : declarada(TEXTOS.sinDecisiones[idioma]);
  if (contexto.forma === "simulado" && todosProgramados) return { nombre: jugado.nombre!, procedencia: "programado" };
  return declarada(jugado.nombre!);
}

const rotulo = (p: LadoProcedencia, idioma: Idioma) => ROTULOS_PROCEDENCIA[p.procedencia === "declarada" ? `declarada-${p.fuente ?? "archivo"}` as const : p.procedencia][idioma];
/** § 5.4 + v1.1 (10) · La línea «Local: L · Visita: V · procedencia» (un sufijo común o uno por lado) y su
 * `data-procedencia` (la común o "mixta"). */
export function lineaModelos(registro: Pick<RegistroArena, "rondas">, contexto: ContextoModelos, catalogo: readonly EntradaCatalogo[], idioma: Idioma): { texto: string; procedencia: Procedencia | "mixta" } {
  const L = procedenciaLado(registro, "local", contexto, catalogo, idioma), V = procedenciaLado(registro, "visita", contexto, catalogo, idioma);
  const rl = rotulo(L, idioma), rv = rotulo(V, idioma), n = TEXTOS.lados[idioma];
  if (rl === rv) return { texto: `${n.local}: ${L.nombre} · ${n.visita}: ${V.nombre} · ${rl}`, procedencia: L.procedencia };
  return { texto: `${n.local}: ${L.nombre} (${rl}) · ${n.visita}: ${V.nombre} (${rv})`, procedencia: "mixta" };
}
