// Brief 060 v1.1 (11) · Medición previa de coste (sin Speech): solicitudes y caracteres de SSML por clase
// (narrador, cierre, invitado, previa), por idioma y por pista (ritmo y detallada), con construirRelato +
// prepararVoz(…).caracteresPresupuestados. Escenarios: solo ritmo; detallada y después ritmo; directo y después
// ritmo (las mismas ventanas buffer con memoria distinta: se suman sin caché compartida; la previa, igual en las dos
// pistas, se cuenta una vez por idioma porque sale de la caché).
// Uso: npx tsx docs/evidencia/repeticion-060/coste.ts > docs/evidencia/repeticion-060/coste.txt
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { construirRelato, relatoIntervencion } from "../../../src/arena/relato";
import { recordarVoz, type RecuerdoVoz } from "../../../src/arena/editorial";
import { prepararVoz } from "../../../src/arena/voz";
import { previaPartido, esPrevia } from "../../../src/arena/previa";
import { importantesVentana } from "../../../src/arena/plan-pista";
import { RELATO_INTERVALOS, type IntervencionArena } from "../../../src/arena/protocolo";
import { GestorSesiones, PRESUPUESTO_AUDIO_ENCUENTRO } from "../../../src/arena/sesiones";
import { planProgramado } from "../../../src/arena/controladores";
import type { ModeloConfigurado } from "../../../src/arena/modelos";
import type { RegistroArena } from "../../../src/arena/tipos";
import type { Llm } from "../../../src/lib/llm";
import type { HechoVerificable } from "../../../src/cadena/verificador";
import { MESA_ARENA, REPETICION_NARRADA } from "../../../src/sim/limites";

type Clase = "narrador" | "cierre" | "invitado" | "previa";
type Cuenta = Record<Clase, { n: number; c: number }>;
const vacia = (): Cuenta => ({ narrador: { n: 0, c: 0 }, cierre: { n: 0, c: 0 }, invitado: { n: 0, c: 0 }, previa: { n: 0, c: 0 } });
const sumar = (a: Cuenta, clase: Clase, fragmentos: Parameters<typeof prepararVoz>[0], idioma: "es" | "en", texto: string) => { if (!texto) return; a[clase].n++; a[clase].c += prepararVoz(fragmentos, idioma).caracteresPresupuestados; };
const completo = (r: RegistroArena) => r.final.tick >= Math.round(r.config.duracionS * 10) || Boolean(r.final.finalizado);

function previa(r: RegistroArena, idioma: "es" | "en", a: Cuenta) {
  let piezas: IntervencionArena[] = []; try { piezas = previaPartido(r); } catch { /* sin previa */ }
  for (const i of piezas) { const s = relatoIntervencion(i, r.config.partido.seed, idioma, "completa"); sumar(a, "previa", s.fragmentos, idioma, s.texto); }
}
function invitados(r: RegistroArena, diario: readonly IntervencionArena[], idioma: "es" | "en", variante: "completa" | "breve", a: Cuenta) {
  for (const i of diario.filter(i => !esPrevia(i) && i.tick <= r.final.tick)) { const s = relatoIntervencion(i, r.config.partido.seed, idioma, variante); sumar(a, "invitado", s.fragmentos, idioma, s.texto); }
}
/** Pista al ritmo (§ 3.1 + v1.1 (3)): ventanas buffer con memoria encadenada, extras por evento importante y cierre. */
function ritmo(r: RegistroArena, diario: readonly IntervencionArena[], idioma: "es" | "en", extras = true): Cuenta {
  const a = vacia(), paso = RELATO_INTERVALOS.buffer, hasta = r.final.tick;
  previa(r, idioma, a);
  let memoria: RecuerdoVoz[] = [], ultima = 0;
  const recordar = (s: ReturnType<typeof construirRelato>) => { if (s.texto) memoria = recordarVoz(memoria, { tick: s.fragmentos[0]!.tick, texto: s.texto.slice(0, 500), clave: "claveVoz" in s ? s.claveVoz : undefined, tema: "temaVoz" in s ? s.temaVoz : undefined }); };
  for (let d = 0; d < hasta; d += paso) {
    const h = Math.min(d + paso, hasta); ultima = d;
    const s = construirRelato(r, d, h, "buffer", idioma, { memoria }); sumar(a, "narrador", s.fragmentos, idioma, s.texto); recordar(s);
    if (!extras) continue;
    const narrado = "tipoRelato" in s && s.tipoRelato === "jugada" ? s.fuentes[0] : undefined;
    for (const e of importantesVentana(r, d, h)) if (e.id !== narrado) { const x = construirRelato(r, d, h, "buffer", idioma, { memoria, evento: e.id }); sumar(a, "narrador", x.fragmentos, idioma, x.texto); recordar(x); }
  }
  invitados(r, diario, idioma, REPETICION_NARRADA.varianteInvitado, a);
  if (completo(r)) { const c = construirRelato(r, ultima, hasta, "buffer", idioma, { cierre: true, memoria }); sumar(a, "cierre", c.fragmentos, idioma, c.texto); }
  return a;
}
/** Pista detallada (057, sin cambios): tramos de RELATO_INTERVALOS.completo, invitados completos y previa. */
function detallada(r: RegistroArena, diario: readonly IntervencionArena[], idioma: "es" | "en"): Cuenta {
  const a = vacia();
  previa(r, idioma, a);
  for (let d = 0; d < r.final.tick; d += RELATO_INTERVALOS.completo) { const s = construirRelato(r, d, Math.min(d + RELATO_INTERVALOS.completo, r.final.tick), "completo", idioma); sumar(a, "narrador", s.fragmentos, idioma, s.texto); }
  invitados(r, diario, idioma, "completa", a);
  return a;
}
/** Directo (aprox.): las mismas ventanas buffer sin extras y con su cierre; la previa y los invitados se cuentan igual. */
const directo = (r: RegistroArena, diario: readonly IntervencionArena[], idioma: "es" | "en") => ritmo(r, diario, idioma, false);
const mas = (...cs: Cuenta[]): Cuenta => { const t = vacia(); for (const c of cs) for (const k of Object.keys(t) as Clase[]) { t[k].n += c[k].n; t[k].c += c[k].c; } return t; };
/** Dos pistas seguidas del mismo idioma: la previa es la misma petición (mismo SSML y tick) y sale de la caché de
 * la sesión, así que se cuenta una sola vez; el resto se suma (memorias distintas, sin caché compartida). */
const seguidas = (x: Cuenta, y: Cuenta): Cuenta => { const t = mas(x, y); t.previa = x.previa.c >= y.previa.c ? { ...x.previa } : { ...y.previa }; return t; };
const P = PRESUPUESTO_AUDIO_ENCUENTRO;
const fila = (nombre: string, c: Cuenta) => {
  const n = c.narrador.n + c.cierre.n, ch = c.narrador.c + c.cierre.c;
  const pn = 100 * n / P.solicitudes, pc = 100 * ch / P.caracteres;
  return `${nombre.padEnd(34)} narrador ${String(c.narrador.n).padStart(3)} sol/${String(c.narrador.c).padStart(6)} c · cierre ${c.cierre.n}/${String(c.cierre.c).padStart(4)} · invitado ${String(c.invitado.n).padStart(2)}/${String(c.invitado.c).padStart(5)} · previa ${c.previa.n}/${String(c.previa.c).padStart(4)} · PRESUPUESTO narrador+cierre ${n}/${P.solicitudes} sol (${pn.toFixed(0)} %) y ${ch}/${P.caracteres} c (${pc.toFixed(0)} %)${pn > 50 || pc > 50 ? "  ← supera el 50 %" : ""}`;
};

async function sesionConMesa(segundos: number, seed: number): Promise<{ registro: RegistroArena; diario: IntervencionArena[] }> {
  const directorio = await mkdtemp(join(tmpdir(), "cronista-coste-060-"));
  const llm = (completar: Llm["completar"]): Llm => ({ id: "modelo-prueba", completar });
  // Comentarista fiel (como mesa-voz.test.ts): repite el hecho principal; sin red.
  const narrador = () => llm(async (_s, m) => { const c = JSON.parse(m[0]!.contenido) as { hechos: HechoVerificable[]; principal: string }, h = c.hechos.find(h => h.id === c.principal)!; return JSON.stringify({ oraciones: [{ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id, apoyo: [] }] }); });
  const catalogo: ModeloConfigurado[] = [{ publico: { id: "p", nombre: "P", controlador: "p" }, crear: () => llm(async (_s, m) => JSON.stringify(planProgramado(JSON.parse(m[0]!.contenido)))) }];
  process.env.ARENA_BLOB_ENDPOINT = "";
  const g = new GestorSesiones({ directorio, ritmoMsPorSegundo: 0, catalogo: () => catalogo, narrador });
  try {
    const { id } = await g.crear({ seed, segundos, local: "auto", visita: "auto", seleccion: { modo: "manual", local: "p", visita: "p" }, presentacion: "preparada" });
    await g.esperarFinal(id);
    const r = await g.reproduccion(id);
    return { registro: r.registro, diario: r.intervenciones ?? [] };
  } finally { await rm(directorio, { recursive: true, force: true }); }
}

const casos: { nombre: string; registro: RegistroArena; diario: IntervencionArena[] }[] = [];
for (const f of ["arena-duelo-v3.json", "arena-llm-v3.json", "arena-llm-v1.json"]) casos.push({ nombre: f, registro: JSON.parse(readFileSync(join("public/experimentos", f), "utf8")) as RegistroArena, diario: [] });
for (const [s, seed] of [[60, 42], [180, 42]] as const) { const x = await sesionConMesa(s, seed); casos.push({ nombre: `sesión con Mesa ${s} s (semilla ${seed}, ${x.diario.length} intervenciones)`, ...x }); }

console.log(`Brief 060 · coste por pista (SSML presupuestado, sin Speech). PRESUPUESTO_AUDIO_ENCUENTRO = ${P.solicitudes} solicitudes / ${P.caracteres} c (narrador + cierre; reserva del cierre ${MESA_ARENA.dialogo.reservaSpeechCierreSolicitudes} sol / ${MESA_ARENA.dialogo.reservaSpeechCierreCaracteres} c). Invitados y previa cobran de sus bolsas.`);
console.log("Escenarios por idioma y, al final, ES + EN. «directo» se aproxima con las ventanas buffer sin extras (memoria distinta: sin caché compartida).\n");
for (const c of casos) {
  console.log(`## ${c.nombre} · ${c.registro.config.duracionS} s`);
  const porIdioma = (["es", "en"] as const).map(idioma => {
    const R = ritmo(c.registro, c.diario, idioma), D = detallada(c.registro, c.diario, idioma), V = directo(c.registro, c.diario, idioma);
    console.log(fila(`${idioma} · pista ritmo`, R)); console.log(fila(`${idioma} · pista detallada`, D)); console.log(fila(`${idioma} · directo (aprox.)`, V));
    console.log(fila(`${idioma} · solo ritmo`, R)); console.log(fila(`${idioma} · detallada y después ritmo`, seguidas(D, R))); console.log(fila(`${idioma} · directo y después ritmo`, seguidas(V, R)));
    return { R, D, V };
  });
  const [es, en] = porIdioma as [typeof porIdioma[0], typeof porIdioma[0]];
  console.log(fila("es+en · solo ritmo", mas(es.R, en.R))); console.log(fila("es+en · detallada y después ritmo", mas(seguidas(es.D, es.R), seguidas(en.D, en.R)))); console.log(fila("es+en · directo y después ritmo", mas(seguidas(es.V, es.R), seguidas(en.V, en.R))));
  console.log("");
}
