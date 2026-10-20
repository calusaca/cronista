import { ARENA, TECNICA_ARENA as T } from "../sim/limites";
import { intensidadCalor } from "../sim/condiciones";
import { prngDerivado } from "../sim/prng";
import type { Condiciones, Equipo, Lado } from "../sim/tipos";
import { elegirFormacion } from "./alineacion";
import type { EntrenadorArena, EstadoEntrenador, FormacionArena, GestionEquipo, Mentalidad, ObservacionArena, PerfilEntrenador, PlanTecnico } from "./tipos";
import { formaciones } from "./tipos";

const escuelas: Record<PerfilEntrenador, { preferidas: FormacionArena[]; valores: number[] }> = {
  posicional: { preferidas: ["4-3-3", "4-2-3-1", "4-1-2-1-2", "4-3-1-2", "4-2-2-2", "3-4-2-1"], valores: [75, 65, 65, 30, 85, 55, 65, 80, 50, 75] },
  presion: { preferidas: ["4-1-4-1", "4-3-3", "4-2-3-1", "3-4-3", "3-4-2-1"], valores: [80, 60, 90, 75, 65, 75, 60, 45, 80, 55] },
  reactivo: { preferidas: ["4-4-2", "3-5-2", "4-1-4-1", "5-3-2", "5-4-1"], valores: [40, 90, 35, 80, 45, 30, 65, 75, 55, 80] },
  vertical: { preferidas: ["4-4-2", "3-4-3", "4-3-3", "4-2-2-2", "4-3-1-2"], valores: [85, 45, 70, 90, 75, 85, 55, 40, 70, 50] },
  adaptable: { preferidas: [...formaciones], valores: [65, 70, 60, 55, 60, 55, 90, 65, 65, 85] },
};
const claves = ["ofensiva", "defensiva", "presion", "verticalidad", "amplitud", "riesgo", "adaptabilidad", "paciencia", "rotacion", "serenidad"] as const;
const nombres = ["Ariel", "Mara", "Leo", "Vera", "Noa", "Elio", "Lina", "Teo"] as const;
const inicios = ["Dor", "Fen", "Brel", "Quin", "Val", "Nev", "Zar", "Ulv"] as const;
const finales = ["ena", "ardi", "ales", "ino", "osa", "ueta", "ell", "era"] as const;
const acotar = (n: number) => Math.round(Math.max(T.emocionMin, Math.min(T.emocionMax, n)));

export function entrenadorDe(equipo: Pick<Equipo, "nombre" | "estilo">): EntrenadorArena {
  const rng = prngDerivado(T.semilla, `entrenador:arena-v3:${equipo.nombre}`);
  const candidatos: PerfilEntrenador[] = equipo.estilo === "posesion" ? ["posicional", "adaptable"] : equipo.estilo === "presion" ? ["presion", "vertical", "adaptable"] : ["reactivo", "vertical", "adaptable"];
  const perfil = rng.pick(candidatos), escuela = escuelas[perfil];
  const valores = Object.fromEntries(claves.map((k, i) => [k, acotar(escuela.valores[i]! + rng.int(-12, 12))])) as Pick<EntrenadorArena, (typeof claves)[number]>;
  // Corriente independiente: conserva nombre y atributos, pero cada entrenador
  // tiene un orden de preferencias propio. La plantilla decide su viabilidad.
  const preferencias = prngDerivado(T.semilla, `formaciones:arena-v3:${equipo.nombre}:${perfil}`);
  const preferidas = [...escuela.preferidas];
  for (let i = preferidas.length - 1; i > 0; i--) { const j = preferencias.int(0, i); [preferidas[i], preferidas[j]] = [preferidas[j]!, preferidas[i]!]; }
  return { nombre: `${rng.pick(nombres)} ${rng.pick(inicios)}${rng.pick(finales)}`, perfil, preferidas, ...valores };
}

export function planDelEntrenador(e: EntrenadorArena, mentalidad: Mentalidad, c?: Condiciones): PlanTecnico {
  const intensidad = e.presion - intensidadCalor(c) * T.presionCalor * 100 + (mentalidad === "buscar" ? 10 : mentalidad === "conservar" ? -15 : 0);
  return { mentalidad,
    amplitud: e.amplitud > 65 ? "amplia" : e.amplitud < 40 ? "estrecha" : "media",
    bloque: intensidad > 65 ? "alto" : intensidad < 40 ? "bajo" : "medio",
    ritmo: intensidadCalor(c) > 0.6 ? "pausado" : mentalidad === "buscar" || e.verticalidad > 75 ? "alto" : "normal",
  };
}
export function siguienteRevision(seed: number, nombre: string, tick: number, paciencia: number): number {
  const rng = prngDerivado(seed, `revision:arena-v3:${nombre}:${tick}`);
  return tick + Math.round((rng.int(T.revisionMinS, T.revisionMaxS) + paciencia / 10) / ARENA.pasoS);
}
export function estadoInicialEntrenador(e: EntrenadorArena, formacion: FormacionArena, seed: number, c?: Condiciones): EstadoEntrenador {
  return { formacion, plan: planDelEntrenador(e, "equilibrar", c), confianza: T.confianzaInicial, frustracion: 0, urgencia: 0,
    proximaRevisionTick: siguienteRevision(seed, e.nombre, 0, e.paciencia), ultimaRevisionTick: 0, ultimoPlanTick: 0,
    cambios: 0, ventanas: 0, ultimoCambioTick: -Math.round(T.cambiosSeparacionS / ARENA.pasoS), pendiente: null, ultimaDecision: null };
}

export function emocionesEntrenador(obs: ObservacionArena, lado: Lado): Pick<EstadoEntrenador, "confianza" | "frustracion" | "urgencia"> {
  const e = obs.equipos[lado].entrenador!, otro = lado === "local" ? "visita" : "local";
  const r = obs.resumen![lado], rival = obs.resumen![otro];
  const diferencia = obs.estado.marcador[lado] - obs.estado.marcador[otro];
  const presion = obs.estado.aficion?.[lado].animo ?? 50;
  const dificultad = r.perdidas * 4 + Math.max(0, rival.tiros - r.tiros) * 6 + intensidadCalor(obs.condiciones ?? undefined) * 15 + Math.max(0, 50 - presion) / 2;
  return { confianza: acotar(T.confianzaInicial + diferencia * 12 + (r.tiros - rival.tiros) * 3 - r.perdidas * 2),
    frustracion: acotar(dificultad * (1 - e.serenidad / 150)),
    urgencia: acotar(Math.max(0, -diferencia) * 25 + (diferencia <= 0 ? obs.tiempoS / (obs.duracionS ?? ARENA.duracionS) * 50 : 0)) };
}

/** Política de respaldo de gestión: azar derivado solo de datos ya observados. */
export function gestionarProgramado(obs: ObservacionArena): GestionEquipo | null {
  const estado = obs.estado.entrenadores?.[obs.lado], e = obs.equipos[obs.lado].entrenador;
  if (!estado || !e || obs.estado.tick < estado.proximaRevisionTick) return null;
  const rng = prngDerivado(T.semilla, `decision:${e.nombre}:${obs.id}`), r = obs.resumen![obs.lado];
  const otro = obs.lado === "local" ? "visita" : "local";
  const diferencia = obs.estado.marcador[obs.lado] - obs.estado.marcador[otro];
  const emocion = emocionesEntrenador(obs, obs.lado);
  let mentalidad: Mentalidad = diferencia > 0 && e.defensiva > e.riesgo ? "conservar" : emocion.urgencia > 45 || e.ofensiva > 80 || emocion.frustracion > 60 && e.paciencia < 50 ? "buscar" : "equilibrar";
  const puedeCambiarPlan = obs.tiempoS - estado.ultimoPlanTick * ARENA.pasoS >= T.cambioPlanMinS;
  if (!puedeCambiarPlan) mentalidad = estado.plan.mentalidad;
  const motivos = [intensidadCalor(obs.condiciones ?? undefined) > 0.5 ? "calor" : "", r.perdidas >= 3 ? "perdidas" : "", diferencia < 0 ? "desventaja" : diferencia > 0 ? "ventaja" : "", r.energiaMedia < T.energiaCambio ? "desgaste" : ""].filter(Boolean);
  let formacion: FormacionArena | null = null;
  if (puedeCambiarPlan && rng.chance(Math.min(1, e.adaptabilidad / 100 + emocion.frustracion / 300)) && motivos.length) {
    const originales = mentalidad === "conservar" ? ["4-1-4-1", "4-4-2", "3-5-2"] as const : mentalidad === "buscar" ? ["4-3-3", "3-4-3", "4-1-2-1-2"] as const : e.preferidas;
    // Las grabaciones con el repertorio original siguen usando su política exacta.
    const ampliado = e.preferidas.some(f => formaciones.indexOf(f) >= 7);
    const familia: readonly FormacionArena[] = mentalidad === "conservar" ? ["5-4-1", "5-3-2", "4-1-4-1", "4-4-2", "3-5-2"] : mentalidad === "buscar" ? ["4-2-2-2", "3-4-2-1", "4-3-3", "3-4-3", "4-3-1-2", "4-1-2-1-2"] : e.preferidas;
    const compatibles = e.preferidas.filter(f => familia.includes(f));
    const opciones = ampliado ? compatibles.length ? compatibles : familia : originales;
    const candidata = elegirFormacion(obs.estado.jugadores.filter(j => j.lado === obs.lado), opciones);
    if (candidata !== estado.formacion) formacion = candidata;
  }
  let sustitucion: GestionEquipo["sustitucion"] = null;
  if (!estado.pendiente && estado.cambios < T.maxCambios && estado.ventanas < T.maxVentanas && obs.tiempoS >= T.cambioMinS && obs.tiempoS - estado.ultimoCambioTick * ARENA.pasoS >= T.cambiosSeparacionS && rng.chance(Math.min(1, e.rotacion / 100 * (1 + (T.confianzaInicial - emocion.confianza) / 300)))) {
    const candidatos = obs.estado.jugadores.filter(j => j.lado === obs.lado && j.puesto !== "POR").sort((a, b) => a.energia - b.energia || a.nivel - b.nivel || a.id.localeCompare(b.id));
    for (const sale of candidatos) {
      const entra = obs.estado.banco?.filter(j => j.lado === obs.lado && j.posicionNatural === sale.posicionNatural).sort((a, b) => b.nivel - a.nivel || a.id.localeCompare(b.id))[0];
      if (entra) { sustitucion = { sale: sale.id, entra: entra.id }; break; }
    }
  }
  return { formacion, mentalidad, sustitucion, motivo: motivos.join(", ") || "revision", fuentes: r.fuentes.slice(-8) };
}

export const etiquetasEntrenador: Record<PerfilEntrenador, { es: string; en: string }> = {
  posicional: { es: "Juego posicional", en: "Positional play" }, presion: { es: "Presión organizada", en: "Organised pressing" },
  reactivo: { es: "Bloque y contragolpe", en: "Block and counter" }, vertical: { es: "Ataque vertical", en: "Direct attacking" }, adaptable: { es: "Adaptable", en: "Adaptable" },
};
