import type { Oracion } from "../cadena/tipos";
import type { HechoVerificable } from "../cadena/verificador";
import { MESA_ARENA } from "../sim/limites";
import { VOZ_BUFFER } from "./buffer";
import type { DatoEstadista } from "./estadista";
import { varianteVoz } from "./expresion";
import { hechosArena } from "./inteligencia";
import { contextoNarradorArena } from "./narrador";
import type { AuditDialogo, EvidenciaMesa, FormaDialogo, FuncionTurno, IntervencionArena, RolMesa, TurnoMesa } from "./protocolo";
import type { EventoArena, RegistroArena } from "./tipos";
import { estimarDuracionS } from "./turnos";

/** Brief 048 · Diálogo entre voces. Composición única en el servidor (función pura) y
 * comprobación D1–D5 de los turnos de plantilla. v1.1: formas pregunta, ronda, estadista y
 * final; marcos neutrales `repaso` y `generico` (cesión); sin conectores. */
const D = MESA_ARENA.dialogo;
type Idioma = "es" | "en";
type Invitado = Exclude<RolMesa, "narrador">;
const IDIOMAS = ["es", "en"] as const;

/** Memoria de la sesión: ids de plantilla recientes por función y destinos ya presentados. */
export interface MemoriaDialogo { recientes: Partial<Record<FuncionTurno, string[]>>; presentados: Invitado[] }
export const memoriaDialogoVacia = (): MemoriaDialogo => ({ recientes: {}, presentados: [] });
const HISTORIAL = 24;

// ——— Plantillas ———
/** Lista de textos de una familia de plantillas («marco.repaso», «marco.estadista.remates»,
 * «marco.final», «cesion.comentarista», «cierre»). */
export function textosPlantilla(familia: string, idioma: Idioma): readonly string[] | undefined {
  const [tipo, a, b, ...resto] = familia.split(".");
  if (resto.length) return undefined;
  if (tipo === "marco" && a === "repaso" && b === undefined) return D.marcos[idioma].repaso;
  if (tipo === "marco" && a === "final" && b === undefined) return D.marcos[idioma].final;
  if (tipo === "marco" && a === "estadista" && b !== undefined && Object.hasOwn(D.marcos[idioma].estadista, b)) return D.marcos[idioma].estadista[b as keyof typeof D.marcos.es.estadista];
  if (tipo === "cesion" && (a === "comentarista" || a === "estadista") && b === undefined) return MESA_ARENA.cesiones[idioma][a];
  if (tipo === "cierre" && a === undefined) return D.cierres[idioma];
  if (tipo === "cierre" && a === "final" && b === undefined) return D.cierresFinal[idioma];
  return undefined;
}
const partir = (id: string) => { const m = /^(.+)#(\d+)$/.exec(id); return m ? { familia: m[1]!, indice: Number(m[2]) } : null; };
export function textoPlantilla(id: string, idioma: Idioma): string | undefined {
  const p = partir(id);
  return p ? textosPlantilla(p.familia, idioma)?.[p.indice] : undefined;
}
/** Nombre de la mesa: completo la primera vez; después, el primer token. */
export const nombreMesa = (rol: Invitado, idioma: Idioma, corto: boolean) => { const n = MESA_ARENA.nombres[idioma][rol]; return corto ? n.split(/\s+/)[0]! : n; };
function rellenar(plantilla: string, v: { nombre?: string; jugador?: string; accion?: string }) {
  let t = plantilla;
  if (v.accion !== undefined) t = t.split("{accion}").join(v.accion);
  if (v.jugador !== undefined) t = t.split("{jugador}").join(v.jugador);
  if (v.nombre !== undefined) t = t.split("{nombre}").join(v.nombre);
  return t;
}
const eventoDe = (hecho: string | undefined, registro: RegistroArena) => hecho?.startsWith("arena:") ? registro.eventos.find(e => `arena:${e.id}` === hecho) : undefined;
/** `{jugador}`: nombre del `jugador` del evento (en una atajada, el portero), copiado del registro. */
const jugadorDe = (e: EventoArena, registro: RegistroArena) => [...registro.inicial.jugadores, ...registro.inicial.banco ?? []].find(j => j.id === e.jugador)?.nombre;
const accionDe = (e: EventoArena, idioma: Idioma) => Object.hasOwn(D.acciones[idioma], e.tipo) ? D.acciones[idioma][e.tipo as keyof typeof D.acciones.es] : undefined;
const temaDe = (hecho: string) => hecho.startsWith("estadista:") ? hecho.split(":")[1] : undefined;

/** Destino ({nombre}) de una familia de plantillas del narrador; el cierre nombra al invitado previo. */
function destinoDe(familia: string, previo: TurnoMesa | undefined): Invitado | undefined {
  if (familia === "marco.repaso" || familia === "cesion.comentarista") return "comentarista";
  if (familia.startsWith("marco.estadista.") || familia === "marco.final" || familia === "cesion.estadista") return "estadista";
  if ((familia === "cierre" || familia === "cierre.final") && previo && previo.rol !== "narrador") return previo.rol;
  return undefined;
}

// ——— Disparador ———
/** Evento disparador de una candidatura del comentarista: el último evento del tipo del disparo
 * con tick ≤ tick de la intervención (el mismo que elige MesaSesion). Por tiempo: ninguno. */
export function disparadorDe(i: Pick<IntervencionArena, "rol" | "tema" | "tick">, registro: RegistroArena): EventoArena | undefined {
  if (i.rol !== "comentarista" || i.tema === "tiempo") return undefined;
  return [...registro.eventos].reverse().find(e => e.tipo === i.tema && e.tick <= i.tick);
}
/** v1.1 (4) · `repaso` solo si la acción tiene entrada en `acciones` y no es autogol; disparo por
 * tiempo, autogol, `final_anticipado` o acción sin entrada → genérico (cesión). */
export const accionable = (e: EventoArena | undefined): e is EventoArena => !!e && !e.autogol && Object.hasOwn(D.acciones.es, e.tipo);
/** v1.2 (1) · Principal esperado: EXACTAMENTE el evento disparador, si está en el contexto del
 * comentarista; sin caer al último hecho. Sin él (disparo por tiempo, tarjetas, que el contexto no
 * admite), `undefined`: entonces el marco es genérico. */
export function principalEsperado(i: Pick<IntervencionArena, "rol" | "tema" | "tick">, registro: RegistroArena): string | undefined {
  const d = disparadorDe(i, registro);
  if (!d) return undefined;
  return contextoNarradorArena(registro, i.tick, MESA_ARENA.hechosComentarista).find(h => h.id === `arena:${d.id}`)?.id;
}
/** Principal que impone V5 en comentarArena (para D5): el disparador si está en el contexto; si no,
 * el último hecho del contexto. */
function principalComentario(i: Pick<IntervencionArena, "rol" | "tema" | "tick">, registro: RegistroArena): string | undefined {
  return principalEsperado(i, registro) ?? contextoNarradorArena(registro, i.tick, MESA_ARENA.hechosComentarista).at(-1)?.id;
}
/** v1.2 (1) · `repaso` solo si la acción es nombrable, el disparador está en el contexto y la
 * primera oración publicada lo cita como hecho principal. */
function repasoPertinente(i: Pick<IntervencionArena, "rol" | "tema" | "tick">, registro: RegistroArena, primeraPrincipal: string | undefined): boolean {
  const d = disparadorDe(i, registro), esperado = principalEsperado(i, registro);
  return accionable(d) && esperado === `arena:${d.id}` && primeraPrincipal === esperado;
}

// ——— Elección de plantillas ———
/** §3.6 · Dentro de la familia se rota desde varianteVoz(seed, `${id}:${funcion}`) y se toma la
 * primera plantilla fuera de las `memoriaPlantillas` últimas de esa función; si todas están, la
 * usada hace más tiempo. ES y EN son paralelas: se elige un índice. */
export function elegirPlantilla(familia: string, funcion: FuncionTurno, id: string, seed: number, memoria: MemoriaDialogo): string {
  const n = textosPlantilla(familia, "es")!.length;
  const inicio = varianteVoz(seed, `${id}:${funcion}`) % n;
  const recientes = memoria.recientes[funcion] ?? [];
  const ventana = recientes.slice(-D.memoriaPlantillas);
  const ids = Array.from({ length: n }, (_, k) => `${familia}#${(inicio + k) % n}`);
  return ids.find(p => !ventana.includes(p)) ?? [...ids].sort((a, b) => recientes.lastIndexOf(a) - recientes.lastIndexOf(b))[0]!;
}
/** Cesión genérica del 045 (variante breve y escalón 4): varianteVoz(seed, id), sin memoria. */
export const cesion045 = (rol: Invitado, id: string, seed: number) => `cesion.${rol}#${varianteVoz(seed, id) % MESA_ARENA.cesiones.es[rol].length}`;

// ——— Composición ———
interface Pieza { oracion: Oracion; evidencia: EvidenciaMesa }
interface Borrador { rol: RolMesa; funcion: FuncionTurno; plantilla?: string; destino?: Invitado; evento?: EventoArena; refiere?: string[]; piezas?: number[] }
export interface EntradaComposicion {
  intervencion: IntervencionArena; registro: RegistroArena; seed: number;
  /** Forma pedida; `ronda` exige `dato` (dato de mesa vigente, revalidado por MesaSesion). */
  forma: Exclude<FormaDialogo, "dato">;
  dato?: DatoEstadista;
  memoria: MemoriaDialogo;
}
export interface Intercambio {
  intervencion: IntervencionArena;
  /** La completa conserva el turno del dato de mesa (solo `ronda`): MesaSesion lo registra. */
  conDato: boolean;
  /** Plantillas de la variante completa por función y destinos presentados: se confirman en la
   * memoria solo tras publicar (v1.1, 11). */
  plantillas: Partial<Record<FuncionTurno, string[]>>;
  presentados: Invitado[];
}

function materializar(borradores: readonly Borrador[], pool: readonly Pieza[], presentados: readonly Invitado[], registro: RegistroArena): TurnoMesa[] {
  const dirigidos = new Set(presentados);
  return borradores.map(b => {
    if (b.plantilla) {
      const textos = Object.fromEntries(IDIOMAS.map(idioma => {
        const jugador = b.evento && jugadorDe(b.evento, registro), accion = b.evento && accionDe(b.evento, idioma);
        const nombre = b.destino && nombreMesa(b.destino, idioma, dirigidos.has(b.destino));
        return [idioma, rellenar(textoPlantilla(b.plantilla!, idioma)!, { nombre, jugador, accion })];
      })) as Record<Idioma, string>;
      if (b.destino) dirigidos.add(b.destino);
      return { rol: b.rol, funcion: b.funcion, texto_es: textos.es, texto_en: textos.en, oraciones: [], plantilla: b.plantilla, ...(b.refiere?.length ? { refiere: [...b.refiere] } : {}) };
    }
    const piezas = b.piezas ?? [];
    return { rol: b.rol, funcion: b.funcion, texto_es: piezas.map(k => pool[k]!.oracion.texto_es).join(" "), texto_en: piezas.map(k => pool[k]!.oracion.texto_en).join(" "), oraciones: [...piezas] };
  });
}
const caracteres = (turnos: readonly TurnoMesa[]) => Math.max(turnos.map(t => t.texto_es).join(" ").length, turnos.map(t => t.texto_en).join(" ").length);
/** §3.5 · Una variante cabe si su texto más largo (ES o EN) no supera maxCaracteresIntervencion y
 * su estimación (v1.1, 8) no supera VOZ_BUFFER.duracionMaxS. La misma medida para ES y EN. */
export const cabeVariante = (turnos: readonly TurnoMesa[]) => caracteres(turnos) <= MESA_ARENA.maxCaracteresIntervencion && estimarDuracionS(turnos) <= VOZ_BUFFER.duracionMaxS;

/** Compone el intercambio DESPUÉS de tener las oraciones verificadas. Ambas variantes parten del
 * mismo estado previo de memoria; nada se confirma aquí. */
export function componerIntercambio(entrada: EntradaComposicion): Intercambio {
  const { intervencion: base, registro, seed, memoria } = entrada;
  const dato = entrada.forma === "ronda" && base.rol === "comentarista" ? entrada.dato : undefined;
  let forma: Exclude<FormaDialogo, "dato"> = base.rol === "estadista" ? (entrada.forma === "final" ? "final" : "estadista") : dato ? "ronda" : "pregunta";
  const piezasBase: Pieza[] = base.oraciones.map((o, k) => ({ oracion: o, evidencia: base.evidencia[k] ?? { eventos: [] } }));
  const pool: Pieza[] = [...piezasBase, ...(dato ? [{ oracion: { texto_es: dato.texto_es, texto_en: dato.texto_en, hecho: dato.hecho.id, apoyo: [] }, evidencia: structuredClone(dato.evidencia) }] : [])];
  const idxBase = piezasBase.map((_, k) => k), idxDato = dato ? [piezasBase.length] : [];
  // D4 · un hecho principal una vez por variante; la primera oración nunca se retira.
  const unicos = (idx: number[], excluir?: string) => idx.filter((k, n) => n === 0 || pool[k]!.oracion.hecho !== excluir && !idx.slice(0, n).some(j => pool[j]!.oracion.hecho === pool[k]!.oracion.hecho));
  const disparador = disparadorDe(base, registro);
  const refDisparador = disparador ? [`arena:${disparador.id}`] : undefined;
  const elegir = (familia: string, funcion: FuncionTurno) => elegirPlantilla(familia, funcion, base.id, seed, memoria);
  const marcoC = (): Borrador => accionable(disparador) && repasoPertinente(base, registro, base.oraciones[0]?.hecho)
    ? { rol: "narrador", funcion: "pregunta", plantilla: elegir("marco.repaso", "pregunta"), destino: "comentarista", evento: disparador, refiere: refDisparador }
    : { rol: "narrador", funcion: "cesion", plantilla: elegir("cesion.comentarista", "cesion"), destino: "comentarista", refiere: refDisparador };
  const marcoE = (piezas: number[], final: boolean): Borrador => {
    const primera = pool[piezas[0]!]!.oracion.hecho, tema = temaDe(primera);
    const familia = final ? "marco.final" : tema && textosPlantilla(`marco.estadista.${tema}`, "es") ? `marco.estadista.${tema}` : undefined;
    return familia ? { rol: "narrador", funcion: "pregunta", plantilla: elegir(familia, "pregunta"), destino: "estadista", refiere: [primera] }
      : { rol: "narrador", funcion: "cesion", plantilla: elegir("cesion.estadista", "cesion"), destino: "estadista", refiere: [primera] };
  };
  // v1.2 (4): la forma final cierra con sus propias plantillas (nunca «seguimos»).
  const cierre = (destino: Invitado): Borrador => { const familia = forma === "final" ? "cierre.final" : "cierre"; return { rol: "narrador", funcion: "cierre", plantilla: elegir(familia, "cierre"), destino }; };
  const turnoC = (piezas: number[]): Borrador => ({ rol: "comentarista", funcion: "respuesta", piezas });
  const turnoE = (piezas: number[]): Borrador => ({ rol: "estadista", funcion: "dato", piezas });
  const protagonista = base.rol;

  let actual: Borrador[] = forma === "pregunta" ? [marcoC(), turnoC(unicos(idxBase)), cierre("comentarista")]
    : forma === "ronda" ? [marcoC(), turnoC(unicos(idxBase, dato!.hecho.id)), marcoE(idxDato, false), turnoE(idxDato)]
    : [marcoE(idxBase, forma === "final"), turnoE(unicos(idxBase)), cierre("estadista")];
  let conDato = forma === "ronda";
  const escalones: string[] = [];
  const turnosDe = (b: readonly Borrador[]) => materializar(b, pool, memoria.presentados, registro);
  // §3.5 · Escalera determinista, la misma para ES y EN.
  const pasos: (() => string | null)[] = [
    () => { const k = actual.findIndex(b => b.funcion === "cierre"); if (k < 0) return null; actual = actual.filter((_, j) => j !== k); return "1:cierre"; },
    () => {
      if (forma !== "ronda") return null;
      forma = "pregunta"; conDato = false;
      actual = [actual[0]!, turnoC(unicos(idxBase))];
      // v1.2 (5): la ronda recortada conserva el cierre del narrador cuando cabe.
      const conCierre = [...actual, cierre("comentarista")];
      if (cabeVariante(turnosDe(conCierre))) actual = conCierre;
      return "2:sin-estadista";
    },
    () => {
      const k = actual.findIndex(b => b.rol === protagonista);
      if (k < 0 || (actual[k]!.piezas?.length ?? 0) <= 1) return null;
      actual = actual.map((b, j) => j === k ? { ...b, piezas: b.piezas!.slice(0, 1) } : b);
      return protagonista === "estadista" ? "3:primer-dato" : "3:primera-oracion";
    },
    () => {
      const marco = actual[0];
      if (!marco || marco.rol !== "narrador") return null;
      const plantilla = cesion045(protagonista, base.id, seed);
      if (marco.plantilla === plantilla) return null;
      actual = [{ rol: "narrador", funcion: "cesion", plantilla, destino: protagonista, refiere: marco.refiere }, ...actual.slice(1)];
      return "4:cesion";
    },
    () => { if (actual[0]?.rol !== "narrador" || actual.length < 2) return null; actual = actual.slice(1); return "5:sin-marco"; },
  ];
  for (const paso of pasos) { if (cabeVariante(turnosDe(actual))) break; const r = paso(); if (r) escalones.push(r); }

  // Variante breve: la cesión genérica del 045 y el primer turno del protagonista.
  const primera = protagonista === "comentarista" ? idxBase[0]! : (actual.find(b => b.rol === "estadista")?.piezas ?? idxBase)[0]!;
  let breve: Borrador[] = [
    { rol: "narrador", funcion: "cesion", plantilla: cesion045(protagonista, base.id, seed), destino: protagonista, refiere: protagonista === "comentarista" ? refDisparador : [pool[primera]!.oracion.hecho] },
    protagonista === "comentarista" ? turnoC([primera]) : turnoE([primera]),
  ];
  if (!cabeVariante(turnosDe(breve))) { breve = breve.slice(1); escalones.push("breve:5:sin-marco"); }

  const completaT = turnosDe(actual), breveT = turnosDe(breve);
  const igual = JSON.stringify(completaT) === JSON.stringify(breveT);
  // Oraciones publicadas: las usadas por alguna variante, en el orden del pool (base y después el dato).
  const usadas = [...new Set([...completaT, ...(igual ? [] : breveT)].flatMap(t => t.oraciones))].sort((a, b) => a - b);
  const nuevo = new Map(usadas.map((k, n) => [k, n]));
  const remapear = (ts: TurnoMesa[]) => ts.map(t => ({ ...t, oraciones: t.oraciones.map(k => nuevo.get(k)!) }));
  // Los hechos referidos por los marcos se añaden a `hechos` para que la Mesa muestre su texto.
  const hechos: HechoVerificable[] = [...base.hechos];
  const conocidos = new Set(hechos.map(h => h.id));
  const delRegistro = new Map(hechosArena(registro, base.tick).map(h => [h.id, h]));
  for (const id of [...completaT, ...breveT].flatMap(t => t.refiere ?? [])) {
    if (conocidos.has(id)) continue;
    const h = delRegistro.get(id);
    if (h) { hechos.push({ id: h.id, tipo: "accion_arena", texto_es: h.texto_es, texto_en: h.texto_en, eventos: [...h.eventos], relevancia: 50, datos: {} }); conocidos.add(id); }
  }
  if (conDato && dato && !conocidos.has(dato.hecho.id)) hechos.push(dato.hecho);
  const intervencion: IntervencionArena = {
    ...base, hechos, oraciones: usadas.map(k => pool[k]!.oracion), evidencia: usadas.map(k => pool[k]!.evidencia),
    forma, turnos: remapear(completaT), ...(igual ? {} : { turnosBreve: remapear(breveT) }),
    ...(escalones.length ? { auditDialogo: { motivos: [], escalones } } : {}),
  };
  if (!intervencion.auditDialogo) delete intervencion.auditDialogo;
  const plantillas: Partial<Record<FuncionTurno, string[]>> = {};
  for (const t of completaT) if (t.plantilla) (plantillas[t.funcion] ??= []).push(t.plantilla);
  const presentados = [...new Set(actual.flatMap(b => b.destino ? [b.destino] : []))];
  return { intervencion, conDato, plantillas, presentados };
}

/** v1.1 (11) · Confirma en la memoria las plantillas de la completa y los destinos presentados;
 * solo tras publicar en el diario. */
export function confirmarMemoria(memoria: MemoriaDialogo, intercambio: Pick<Intercambio, "plantillas" | "presentados">): void {
  for (const [funcion, ids] of Object.entries(intercambio.plantillas) as [FuncionTurno, string[]][]) memoria.recientes[funcion] = [...memoria.recientes[funcion] ?? [], ...ids].slice(-HISTORIAL);
  for (const rol of intercambio.presentados) if (!memoria.presentados.includes(rol)) memoria.presentados.push(rol);
}

// ——— D1–D5 ———
type Motivo = AuditDialogo["motivos"][number];
/** Comprobación de turnos D1–D5 (pura). Sin `turnos` no hay nada que comprobar. */
export function comprobarTurnos(i: IntervencionArena, registro: RegistroArena): Motivo[] {
  const motivos: Motivo[] = [];
  const m = (regla: Motivo["regla"], detalle: string) => { if (!motivos.some(x => x.regla === regla && x.detalle === detalle)) motivos.push({ regla, detalle }); };
  if (!i.turnos) return motivos;
  const disparador = disparadorDe(i, registro);
  const esperado = i.rol === "comentarista" ? principalComentario(i, registro) : undefined;
  if (i.forma === "dato") m("D2", "la forma dato está fuera de la versión 1.1");
  if (i.forma && (i.rol === "comentarista") !== (i.forma === "pregunta" || i.forma === "ronda")) m("D5", `forma ${i.forma} incompatible con el rol ${i.rol}`);
  const variantes: [string, TurnoMesa[]][] = [["completa", i.turnos], ...(i.turnosBreve ? [["breve", i.turnosBreve] as [string, TurnoMesa[]]] : [])];
  for (const [variante, turnos] of variantes) {
    const v = (detalle: string) => `${variante}: ${detalle}`;
    if (turnos.length < 1 || turnos.length > D.maxTurnos) m("D5", v(`${turnos.length} turnos; deben ser de 1 a ${D.maxTurnos}`));
    turnos.forEach((t, k) => {
      const previo = turnos[k - 1], siguiente = turnos[k + 1];
      if (previo && previo.rol === t.rol) m("D5", v(`turnos ${k - 1} y ${k} del mismo rol`));
      if (!t.texto_es || !t.texto_en) m("D5", v(`turno ${k} sin texto en ES o EN`));
      for (const id of t.refiere ?? []) {
        const e = eventoDe(id, registro);
        if (!(e ? e.tick <= i.tick : i.hechos.some(h => h.id === id))) m("D1", v(`turno ${k}: referencia ${id} sin procedencia`));
      }
      if (t.rol === "narrador") {
        if (t.oraciones.length) m("D5", v(`turno ${k} del narrador con oraciones`));
        if (t.conector) m("D3", v(`turno ${k} del narrador con conector`));
        const p = t.plantilla ? partir(t.plantilla) : null;
        const listas = p && IDIOMAS.map(idioma => textosPlantilla(p.familia, idioma));
        if (!p || !listas || listas.some(l => !l || p.indice >= l.length) || listas[0]!.length !== listas[1]!.length) { m("D1", v(`turno ${k}: plantilla ${t.plantilla ?? "(ninguna)"} inexistente`)); return; }
        const destino = destinoDe(p.familia, previo);
        if ((p.familia === "cierre" || p.familia === "cierre.final") && !destino) m("D2", v(`turno ${k}: cierre sin invitado previo`));
        // v1.2 (4): la forma final solo cierra con cierres propios; las demás, nunca con ellos.
        if (p.familia === "cierre" && i.forma === "final") m("D2", v(`turno ${k}: cierre ordinario en la forma final`));
        if (p.familia === "cierre.final" && i.forma !== "final") m("D2", v(`turno ${k}: cierre del final fuera de la forma final`));
        const evento = eventoDe(t.refiere?.[0], registro);
        // D1 · reconstrucción: plantilla con {nombre} de la mesa, {jugador} y {accion} del evento referido.
        for (const idioma of IDIOMAS) {
          const plantilla = textoPlantilla(t.plantilla!, idioma)!;
          const usaEvento = plantilla.includes("{jugador}") || plantilla.includes("{accion}");
          const jugador = evento && jugadorDe(evento, registro), accion = evento && accionDe(evento, idioma);
          if (usaEvento && (!evento || !jugador || (plantilla.includes("{accion}") && !accion))) { m("D1", v(`turno ${k}: sin evento referido para {jugador}/{accion}`)); continue; }
          const nombres = destino ? [nombreMesa(destino, idioma, false), nombreMesa(destino, idioma, true)] : [undefined];
          const posibles = nombres.map(nombre => rellenar(plantilla, { nombre, jugador, accion }));
          if (!posibles.includes(idioma === "es" ? t.texto_es : t.texto_en)) m("D1", v(`turno ${k} (${idioma.toUpperCase()}) no se reconstruye desde ${t.plantilla}`));
        }
        // D1 · procedencia: hacia el comentarista, refiere[0] es el evento disparador.
        if (destino === "comentarista" && !p.familia.startsWith("cierre")) {
          if (disparador && t.refiere?.[0] !== `arena:${disparador.id}`) m("D1", v(`turno ${k}: refiere[0] no es el disparador arena:${disparador.id}`));
          if (!disparador && t.refiere?.length) m("D1", v(`turno ${k}: referencia sin disparador`));
        }
        // D2 · coherencia del marco con los turnos siguientes.
        if (p.familia === "marco.repaso") {
          if (!accionable(disparador) || t.refiere?.[0] !== `arena:${disparador.id}`) m("D2", v(`turno ${k}: repaso sin acción disparadora válida`));
          // v1.2 (1): la respuesta que sigue tiene como principal ese mismo disparador.
          else if (!repasoPertinente(i, registro, siguiente?.rol === "comentarista" ? i.oraciones[siguiente.oraciones[0]!]?.hecho : undefined)) m("D2", v(`turno ${k}: repaso cuya respuesta no cita el disparador como principal`));
          if (siguiente?.rol !== "comentarista") m("D2", v(`turno ${k}: repaso no seguido del comentarista`));
        } else if (p.familia.startsWith("marco.estadista.") || p.familia === "marco.final") {
          const primera = siguiente?.rol === "estadista" ? i.oraciones[siguiente.oraciones[0]!]?.hecho : undefined;
          if (!primera) m("D2", v(`turno ${k}: marco del estadista no seguido de un dato`));
          else {
            if (t.refiere?.[0] !== primera) m("D2", v(`turno ${k}: refiere[0] no es el primer dato ${primera}`));
            if (p.familia !== "marco.final" && temaDe(primera) !== p.familia.slice("marco.estadista.".length)) m("D2", v(`turno ${k}: el marco ${p.familia} no coincide con el tema de ${primera}`));
          }
          if (p.familia === "marco.final" && i.forma !== "final") m("D2", v(`turno ${k}: marco final fuera de la candidatura final`));
        } else if (p.familia.startsWith("cesion.")) {
          if (siguiente?.rol !== destino) m("D2", v(`turno ${k}: cesión a ${destino} no seguida de su turno`));
        }
        return;
      }
      // Turno de invitado.
      if (t.plantilla) m("D1", v(`turno ${k} del invitado con plantilla`));
      if (!t.oraciones.length) m("D5", v(`turno ${k} del invitado sin oraciones`));
      if (t.oraciones.some(o => !Number.isInteger(o) || o < 0 || o >= i.oraciones.length)) { m("D1", v(`turno ${k}: índice de oración inexistente`)); return; }
      for (const idioma of IDIOMAS) {
        const partes = t.oraciones.map(o => idioma === "es" ? i.oraciones[o]!.texto_es : i.oraciones[o]!.texto_en);
        if (t.conector) {
          const pos = t.oraciones.indexOf(t.conector.antesDe), texto = textoPlantilla(t.conector.plantilla, idioma);
          if (pos < 0 || !texto) m("D1", v(`turno ${k}: conector ${t.conector.plantilla} no reconstruible`));
          else partes.splice(pos, 0, rellenar(texto, { nombre: nombreMesa("estadista", idioma, false) }));
        }
        if (partes.join(" ") !== (idioma === "es" ? t.texto_es : t.texto_en)) m("D1", v(`turno ${k} (${idioma.toUpperCase()}) no coincide con sus oraciones`));
      }
      // D3 · v1.2 (8): sin forma `dato` no hay conectores; cualquiera se rechaza.
      if (t.conector) m("D3", v(`turno ${k}: conector ${t.conector.plantilla} no admitido (no hay forma dato)`));
      if (t.rol === "estadista" && t.oraciones.some(o => !i.oraciones[o]!.hecho.startsWith("estadista:"))) m("D5", v(`turno ${k} del estadista con una oración que no es un dato`));
      if (t.rol === "comentarista") {
        if (i.rol !== "comentarista") m("D5", v(`turno ${k} del comentarista en una candidatura del estadista`));
        else if (i.oraciones[t.oraciones[0]!]!.hecho !== esperado) m("D5", v(`turno ${k}: la primera oración del comentarista no tiene como principal ${esperado}`));
      }
    });
    // D4 · un hecho, una vez por variante.
    const principales = turnos.flatMap(t => t.oraciones.map(o => i.oraciones[o]?.hecho));
    const repetidos = principales.filter((h, n) => principales.indexOf(h) !== n);
    if (repetidos.length) m("D4", v(`hecho principal repetido: ${[...new Set(repetidos)].join(", ")}`));
    // D5 · presupuesto, con la misma medida para ES y EN.
    const c = caracteres(turnos);
    if (c > MESA_ARENA.maxCaracteresIntervencion) m("D5", v(`${c} caracteres; máximo ${MESA_ARENA.maxCaracteresIntervencion}`));
    if (estimarDuracionS(turnos) > VOZ_BUFFER.duracionMaxS) m("D5", v(`estimación ${estimarDuracionS(turnos).toFixed(1)} s > ${VOZ_BUFFER.duracionMaxS} s`));
  }
  // D5 · la breve es la cesión (opcional) y el primer turno del protagonista.
  if (i.turnosBreve) {
    const invitados = i.turnosBreve.filter(t => t.rol !== "narrador");
    const primeraCompleta = i.turnos.find(t => t.rol === i.rol)?.oraciones[0];
    if (invitados.length !== 1 || invitados[0]!.rol !== i.rol || invitados[0]!.oraciones.length !== 1 || invitados[0]!.oraciones[0] !== primeraCompleta) m("D5", "breve: no es la cesión y el primer turno del protagonista");
  }
  if (!i.turnos.some(t => t.rol === i.rol)) m("D5", "completa: sin turno del protagonista");
  return motivos;
}
