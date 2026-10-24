// Brief 044: rechace del portero en reinicios-v3, ventanas con varias sustituciones,
// prompt construido desde TECNICA_ARENA y temperatura coherente con el clima.
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ARENA, TECNICA_ARENA as T, TEMPERATURA_C } from "../../sim/limites";
import type { Lado } from "../../sim/tipos";
import { POST } from "../../app/api/arena/route";
import { POST as POSTSesion } from "../../app/api/arena/sesiones/route";
import { crearControladorProgramado, planProgramado, SISTEMA_ARENA, esquemaRespuestaArena, validarOrdenes } from "../controladores";
import { ejecutarArena, observarArena, reproducirArena } from "../coordinador";
import { cumpleFixtureV3 } from "../__fixtures__/generar-reinicios-v3";
import { comentarioEditorial } from "../editorial";
import { hechosArena } from "../inteligencia";
import { entornoDeFormulario } from "../entorno-formulario";
import { crearConfigArena, crearEstadoArena, MotorArena } from "../motor";
import { entornoArena, peticionSesion } from "../peticiones";
import { esquemaOrdenes, lados, paresSustitucion, type ConfigArena, type OrdenesEquipo, type ParSustitucion, type RegistroArena } from "../tipos";
import { narrarEventoArena } from "../vista";

const leer = async (nombre: string) => JSON.parse(await readFile(`src/arena/__fixtures__/${nombre}.json`, "utf8")) as RegistroArena;

/** Repite las órdenes archivadas sobre la misma configuración con otras reglas. */
function rejugar(registro: RegistroArena, reglas: NonNullable<ConfigArena["reglas"]>, hastaTick: number): MotorArena {
  const motor = new MotorArena({ ...structuredClone(registro.config), reglas });
  for (const r of registro.rondas) {
    if (r.inicioTick >= hastaTick) break;
    motor.avanzar({ local: r.decisiones.local.ordenes, visita: r.decisiones.visita.ordenes }, r.finTick);
  }
  return motor;
}

describe("044 · rechace del portero (reinicios-v3)", () => {
  it("reproduce exactamente el fixture v3 (desvío que sale y ventana con arreglo de sustituciones)", async () => {
    const registro = await leer("arena-reinicios-v3");
    expect(registro.config.reglas).toBe("reinicios-v3");
    const desvio = registro.eventos.find(e => e.tipo === "atajada" && e.motivo === "desvio")!;
    expect(desvio).toBeDefined();
    const siguiente = registro.eventos.find(e => e.tick > desvio.tick && e.tipo !== "pase" && e.tipo !== "recepcion")!;
    expect(siguiente).toMatchObject({ tipo: "reinicio", ultimoToque: desvio.jugador });
    expect(registro.rondas.some(r => lados.some(l => Array.isArray(r.decisiones[l].ordenes.gestion?.sustitucion)))).toBe(true);
    expect(cumpleFixtureV3(registro)).toBe(true);
    expect(reproducirArena(registro)).toEqual(registro);
  });

  it("misma semilla y órdenes: el desvío que sale cuenta tiro_fuera bajo v2 y no bajo v3", async () => {
    const archivo = await leer("arena-reinicios-v2");
    const desvio = archivo.eventos.find(e => e.tipo === "atajada" && e.motivo === "desvio")!;
    const salida = archivo.eventos.find(e => e.tick > desvio.tick && e.tipo === "reinicio")!;
    const v2 = rejugar(archivo, "reinicios-v2", salida.tick + 1), v3 = rejugar(archivo, "reinicios-v3", salida.tick + 1);
    const entre = (m: MotorArena) => m.eventos.filter(e => e.tick >= desvio.tick && e.tick <= salida.tick);
    // Hasta el desvío ambos motores son idénticos.
    expect(v3.eventos.filter(e => e.tick <= desvio.tick)).toEqual(v2.eventos.filter(e => e.tick <= desvio.tick));
    expect(entre(v2).map(e => e.tipo)).toContain("tiro_fuera");
    expect(entre(v3).map(e => e.tipo)).not.toContain("tiro_fuera");
    expect(entre(v3).filter(e => e.tipo === "atajada")).toHaveLength(1);
    // Un remate, un desenlace: el desvío. El saque lo provoca el último toque del portero.
    expect(entre(v3).find(e => e.tipo === "reinicio")).toMatchObject({ ultimoToque: desvio.jugador });
    expect(v3.eventos.filter(e => e.tipo === "tiro")).toHaveLength(v2.eventos.filter(e => e.tipo === "tiro").length);
  });

  /** Remate de la visita que toca el portero local. Sin `recoge`, a un metro de su línea y
   * frente al arco; con `recoge`, desde un lateral del área y con un jugador de ese lado
   * plantado en la trayectoria del rechace. */
  function remateAlPortero(seed: number, reglas: NonNullable<ConfigArena["reglas"]>, recoge?: Lado) {
    // Brief 063 § 4.3: la configuración se crea con sus reglas (los atributos de reinicios-v7 no existen en v3).
    const config = { ...crearConfigArena({ seed, duracionS: 10, intervaloS: 5, reglas }) };
    const inicial = crearEstadoArena(config);
    inicial.saque = null; inicial.pausa = null;
    for (const j of inicial.jugadores) { j.posicion = { x: j.lado === "local" ? 60 : 70, y: 60 }; j.velocidad = { x: 0, y: 0 }; }
    const portero = inicial.jugadores.find(j => j.lado === "local" && j.puesto === "POR")!;
    const rematador = inicial.jugadores.find(j => j.lado === "visita" && j.puesto !== "POR")!;
    const y = recoge ? ARENA.anchoM / 2 - 14 : ARENA.anchoM / 2 + .5, x = recoge ? 5 : 1;
    portero.posicion = { x, y };
    // Punto medio entre el portero y el destino del rechace (detrás de su línea, desplazado desvioLateralM).
    const recogedor = recoge ? inicial.jugadores.find(j => j.lado === recoge && j.puesto !== "POR" && j.id !== rematador.id)! : undefined;
    if (recogedor) recogedor.posicion = { x: (x - ARENA.desvioFondoM) / 2, y: (y + ARENA.anchoM / 2 - ARENA.desvioLateralM) / 2 };
    inicial.balon = { posicion: { x: x + 2, y }, poseedor: null, ultimoToque: { jugador: rematador.id, lado: "visita" },
      vuelo: { tipo: "tiro", autor: rematador.id, lado: "visita", receptor: null, origen: { x: x + 11, y }, destino: { x: -.5, y }, inicioTick: 0, adelantados: [] } };
    const motor = new MotorArena(config, inicial);
    const planes = Object.fromEntries(lados.map(lado => {
      const p = planProgramado(observarArena(motor, lado));
      p.ordenes = inicial.jugadores.filter(j => j.lado === lado).map(j => ({ jugador: j.id, accion: "mover", destino: j.posicion, receptor: null }));
      return [lado, p];
    })) as Record<Lado, OrdenesEquipo>;
    motor.avanzar(planes, 1);
    return { motor, planes, portero, rematador, recogedor };
  }

  it("un rechace que entra en el arco propio es autogol del portero", () => {
    let seed = 1;
    while (remateAlPortero(seed, "reinicios-v3").motor.eventos[0]?.motivo !== "desvio") { seed++; expect(seed).toBeLessThan(200); }
    const { motor, planes, portero } = remateAlPortero(seed, "reinicios-v3");
    // Balón suelto: autor el portero, lado el del remate.
    expect(motor.estado.balon.vuelo).toMatchObject({ tipo: "rechace", autor: portero.id, lado: "visita", receptor: null });
    expect(motor.estado.balon.ultimoToque).toEqual({ jugador: portero.id, lado: "local" });
    motor.avanzar(planes, 5);
    const gol = motor.eventos.find(e => e.tipo === "gol")!;
    expect(gol).toMatchObject({ jugador: portero.id, lado: "visita", autogol: true });
    expect(motor.estado.marcador).toEqual({ local: 0, visita: 1 });
    expect(motor.eventos.some(e => e.tipo === "tiro_fuera")).toBe(false);
    const registro = { config: motor.config, inicial: motor.fotogramas[0], eventos: motor.eventos, fotogramas: motor.fotogramas, final: motor.estado, rondas: [] } as unknown as RegistroArena;
    expect(narrarEventoArena(gol, registro, "es")).toBeTruthy();
    // Con la misma semilla, v2 atribuía ese gol al rematador.
    const v2 = remateAlPortero(seed, "reinicios-v2");
    v2.motor.avanzar(v2.planes, 5);
    expect(v2.motor.eventos.find(e => e.tipo === "gol")).toMatchObject({ jugador: v2.rematador.id, lado: "visita" });
    expect(v2.motor.eventos.find(e => e.tipo === "gol")!.autogol).toBeUndefined();
  });

  /** Primera semilla (barrido) en la que el portero desvía el remate del escenario. */
  function semillaConDesvio(recoge?: Lado): number {
    for (let seed = 1; seed < 400; seed++) if (remateAlPortero(seed, "reinicios-v3", recoge).motor.eventos[0]?.motivo === "desvio") return seed;
    throw new Error("Sin desvío en el barrido");
  }
  const registroDe = (motor: MotorArena) => ({ version: motor.config.version, config: motor.config, inicial: motor.fotogramas[0], eventos: motor.eventos, fotogramas: motor.fotogramas, final: motor.estado, rondas: [] }) as unknown as RegistroArena;

  it.each(["local", "visita"] as const)("un rechace recogido por un jugador %s es una recuperación sin pasador", recoge => {
    const seed = semillaConDesvio(recoge);
    const { motor, planes, portero, recogedor } = remateAlPortero(seed, "reinicios-v3", recoge);
    expect(motor.estado.balon.vuelo).toMatchObject({ tipo: "rechace", autor: portero.id });
    motor.avanzar(planes, 10);
    const tras = motor.eventos.filter(e => e.tick > motor.eventos[0]!.tick && e.tipo !== "pase" && e.tipo !== "tiro");
    expect(tras[0]).toMatchObject({ tipo: "recuperacion", jugador: recogedor!.id, lado: recoge, receptor: null });
    expect(motor.eventos.some(e => ["recepcion", "intercepcion", "atajada"].includes(e.tipo) && e.receptor === portero.id)).toBe(false);
    // Ni hechos ni comentario editorial presentan al portero como pasador.
    const registro = registroDe(motor), nombre = registro.inicial.jugadores.find(j => j.id === portero.id)!.nombre;
    const pase = new RegExp(`${nombre} (found|conectó)|(delivery|envío) (from|de) ${nombre}`);
    for (const h of hechosArena(registro, motor.estado.tick)) { expect(h.texto_es).not.toMatch(pase); expect(h.texto_en).not.toMatch(pase); }
    for (let tick = tras[0]!.tick; tick <= motor.estado.tick; tick++) for (const idioma of ["es", "en"] as const) {
      expect(comentarioEditorial(registro, tick, idioma)?.texto ?? "").not.toMatch(pase);
    }
    // La misma jugada bajo v2 contaba una recepción o intercepción con el rematador como origen.
    const v2 = remateAlPortero(seed, "reinicios-v2", recoge);
    v2.motor.avanzar(v2.planes, 10);
    expect(v2.motor.eventos.find(e => e.jugador === v2.recogedor!.id && e.tipo !== "pase")).toMatchObject({ tipo: recoge === "visita" ? "recepcion" : "intercepcion", receptor: v2.rematador.id });
  });

  it("barrido de partidos v3: ningún rechace aparece como pase del portero", async () => {
    let desvios = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const r = await ejecutarArena(crearConfigArena({ seed, duracionS: 120, reglas: "reinicios-v3" }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
      r.eventos.forEach((e, i) => {
        if (e.tipo !== "atajada" || e.motivo !== "desvio") return;
        desvios++;
        const fin = r.eventos.findIndex((x, k) => k > i && x.tipo !== "pase" && x.tipo !== "tiro");
        if (fin < 0) return;
        expect(r.eventos[fin]!.tipo).not.toBe("tiro_fuera");
        if (["recepcion", "intercepcion", "atajada", "recuperacion"].includes(r.eventos[fin]!.tipo)) expect(r.eventos[fin]).toMatchObject({ tipo: "recuperacion", receptor: null });
      });
      expect(r.eventos.some(e => ["recepcion", "intercepcion"].includes(e.tipo) && r.eventos.some(d => d.tipo === "atajada" && d.motivo === "desvio" && d.jugador === e.receptor && d.tick <= e.tick && !r.eventos.some(x => x.tick > d.tick && x.tick < e.tick && x.tipo !== "pase")))).toBe(false);
    }
    expect(desvios).toBeGreaterThan(0);
  });
});

describe("044 · varias sustituciones por ventana", () => {
  function preparar() {
    const motor = new MotorArena(crearConfigArena({ seed: 11, duracionS: ARENA.duracionMaxS }));
    motor.estado.saque = null; motor.estado.pausa = null;
    // Un suplente sintético adicional aísla el presupuesto de cambios del tamaño del banco.
    const extra = structuredClone(motor.estado.banco!.find(j => j.lado === "local" && j.posicionNatural !== "POR")!);
    motor.estado.banco!.push({ ...extra, id: "local-extra", dorsal: 98 });
    abrirVentana(motor);
    return motor;
  }
  /** Avanza el reloj lo justo para cumplir la separación entre ventanas y la revisión. */
  function abrirVentana(motor: MotorArena) {
    const t = motor.estado.entrenadores!.local;
    motor.estado.tick = Math.max(motor.estado.tick, Math.round(T.cambioMinS / ARENA.pasoS), t.ultimoCambioTick + Math.round(T.cambiosSeparacionS / ARENA.pasoS));
    t.proximaRevisionTick = motor.estado.tick; t.ultimoPlanTick = 0;
  }
  /** Pares válidos: cada suplente entra por un titular de su misma condición (portero o no). */
  function pares(motor: MotorArena, n: number): ParSustitucion[] {
    const usados = new Set<string>();
    return motor.estado.banco!.filter(j => j.lado === "local").slice(0, n).map(s => {
      const sale = motor.estado.jugadores.find(j => j.lado === "local" && !usados.has(j.id) && (j.puesto === "POR") === (s.posicionNatural === "POR"))!;
      usados.add(sale.id); return { sale: sale.id, entra: s.id };
    });
  }
  function proponer(motor: MotorArena, sustitucion: ParSustitucion | ParSustitucion[]) {
    const obs = observarArena(motor, "local"), plan = structuredClone(planProgramado(obs));
    plan.gestion = { formacion: null, mentalidad: motor.estado.entrenadores!.local.plan.mentalidad, sustitucion, motivo: "rotación", fuentes: [] };
    return () => validarOrdenes(plan, obs);
  }
  /** Ejecuta lo aceptado como lo haría la siguiente interrupción. */
  function ejecutar(motor: MotorArena, sustitucion: OrdenesEquipo["gestion"]) {
    motor.estado.entrenadores!.local.pendiente = structuredClone(sustitucion!.sustitucion);
    (motor as unknown as { realizarCambios(): void }).realizarCambios();
    motor.estado.tick++;
  }

  it("una ventana ejecuta hasta cambiosPorVentana pares en la misma interrupción", () => {
    const motor = preparar(), t = motor.estado.entrenadores!.local, lote = pares(motor, T.cambiosPorVentana);
    expect(lote).toHaveLength(T.cambiosPorVentana);
    const antes = motor.eventos.length;
    ejecutar(motor, proponer(motor, lote)().gestion);
    const cambios = motor.eventos.slice(antes);
    expect(cambios.map(e => e.tipo)).toEqual(lote.map(() => "cambio"));
    expect(new Set(cambios.map(e => e.tick)).size).toBe(1);
    expect(cambios.map(e => [e.sale, e.jugador])).toEqual(lote.map(p => [p.sale, p.entra]));
    expect(t.ultimaDecision!.fuentes).toEqual(cambios.map(e => e.id));
    expect([t.cambios, t.ventanas, t.pendiente]).toEqual([T.cambiosPorVentana, 1, null]);
    const registro = { config: motor.config, inicial: motor.fotogramas[0], eventos: motor.eventos, fotogramas: motor.fotogramas, final: motor.estado, rondas: [] } as unknown as RegistroArena;
    for (const e of cambios) expect(narrarEventoArena(e, registro, "es")).toContain("entra");
  });

  it("cinco cambios en tres ventanas se aceptan; el sexto se rechaza", () => {
    const motor = preparar(), t = motor.estado.entrenadores!.local;
    // 2 + 2 + 1 = 5 con el presupuesto de T; el reparto se deriva de las constantes.
    const reparto = [Math.min(2, T.cambiosPorVentana), Math.min(2, T.cambiosPorVentana)];
    reparto.push(T.maxCambios - reparto[0]! - reparto[1]!);
    expect(reparto).toHaveLength(T.maxVentanas);
    for (const [v, n] of reparto.entries()) {
      if (v) abrirVentana(motor);
      if (v === reparto.length - 1) {
        // Sexto cambio: la propuesta entera se rechaza aunque una parte cupiera.
        expect(proponer(motor, pares(motor, n + 1))).toThrow(/presupuesto/);
      }
      ejecutar(motor, proponer(motor, pares(motor, n))().gestion);
    }
    expect([t.cambios, t.ventanas]).toEqual([T.maxCambios, T.maxVentanas]);
    expect(motor.eventos.filter(e => e.tipo === "cambio" && e.lado === "local")).toHaveLength(T.maxCambios);
    expect(motor.estado.jugadores.filter(j => j.lado === "local")).toHaveLength(11);
    expect(motor.estado.retirados!.filter(j => j.lado === "local")).toHaveLength(T.maxCambios);
  });

  it("una cuarta ventana se rechaza aunque queden cambios", () => {
    const motor = preparar(), t = motor.estado.entrenadores!.local;
    for (let v = 0; v < T.maxVentanas; v++) {
      if (v) abrirVentana(motor);
      ejecutar(motor, proponer(motor, pares(motor, 1)[0]!)().gestion);
    }
    expect([t.cambios, t.ventanas]).toEqual([T.maxVentanas, T.maxVentanas]);
    expect(t.cambios).toBeLessThan(T.maxCambios);
    abrirVentana(motor);
    expect(proponer(motor, pares(motor, 1))).toThrow(/presupuesto/);
    // El motor tampoco ejecuta una ventana de más si se la encuentra pendiente.
    t.pendiente = pares(motor, 1); (motor as unknown as { realizarCambios(): void }).realizarCambios();
    expect([t.cambios, t.ventanas, t.pendiente]).toEqual([T.maxVentanas, T.maxVentanas, null]);
  });

  it("rechaza pares con jugadores repetidos, reingresos y más pares que cambiosPorVentana", () => {
    const motor = preparar(), [a, b] = pares(motor, 2) as [ParSustitucion, ParSustitucion];
    expect(proponer(motor, [a, { sale: a.sale, entra: b.entra }])).toThrow(/repetidos/);
    expect(proponer(motor, [a, { sale: b.sale, entra: a.entra }])).toThrow(/repetidos/);
    expect(proponer(motor, [a, a])).toThrow(/repetidos/);
    expect(proponer(motor, [a, { sale: b.sale, entra: b.sale }])).toThrow();
    const demasiados = Array.from({ length: T.cambiosPorVentana + 1 }, () => a);
    expect(proponer(motor, demasiados)).toThrow();
    expect(proponer(motor, [])).toThrow();
    ejecutar(motor, proponer(motor, a)().gestion);
    abrirVentana(motor);
    const titular = motor.estado.jugadores.find(j => j.lado === "local" && j.puesto !== "POR" && j.id !== a.entra)!;
    expect(proponer(motor, [{ sale: titular.id, entra: a.sale }])).toThrow(/inválida/);
    expect(proponer(motor, { sale: titular.id, entra: a.sale })).toThrow(/inválida/);
  });

  it("el esquema y la normalización aceptan el objeto y el arreglo", () => {
    const par = { sale: "local-1", entra: "local-12" };
    const gestion = (sustitucion: unknown) => ({ observacion: "x", lado: "local", intencion: "y", amplitud: "media", bloque: "medio", ordenes: [{ jugador: "local-1", accion: "mover", destino: { x: 1, y: 1 }, receptor: null }], gestion: { formacion: null, mentalidad: "equilibrar", sustitucion, motivo: "m", fuentes: [] } });
    expect(esquemaOrdenes.parse(gestion(par)).gestion!.sustitucion).toEqual(par);
    expect(esquemaOrdenes.parse(gestion([par])).gestion!.sustitucion).toEqual([par]);
    expect(() => esquemaOrdenes.parse(gestion(Array.from({ length: T.cambiosPorVentana + 1 }, () => par)))).toThrow();
    expect(paresSustitucion(par)).toEqual([par]); expect(paresSustitucion([par, par])).toHaveLength(2); expect(paresSustitucion(null)).toEqual([]);
    const motor = new MotorArena(crearConfigArena({ duracionS: 60 }));
    const schema = JSON.stringify(esquemaRespuestaArena(observarArena(motor, "local")));
    expect(schema).toContain(`"maxItems":${T.cambiosPorVentana}`);
  });
});

describe("044 · el prompt usa las constantes de TECNICA_ARENA", () => {
  it("cifras de cambios, ventanas y plazos salen de T", () => {
    expect(SISTEMA_ARENA).toContain(`conserva el plan al menos ${T.cambioPlanMinS} s`);
    expect(SISTEMA_ARENA).toContain(`un arreglo de 1 a ${T.cambiosPorVentana} de esos pares`);
    expect(SISTEMA_ARENA).toContain(`máximo ${T.maxCambios} cambios y ${T.maxVentanas} ventanas`);
    expect(SISTEMA_ARENA).toContain(`desde ${T.cambioMinS} s y separadas ${T.cambiosSeparacionS} s`);
    expect(SISTEMA_ARENA).not.toMatch(/cinco cambios|tres ventanas/);
  });
});

describe("044 · temperatura coherente con el clima", () => {
  const pedir = (entorno: unknown) => POST(new Request("http://localhost/api/arena", { method: "POST", body: JSON.stringify({ accion: "simular", seed: 3, segundos: 2, local: "auto", visita: "auto", entorno }) }));
  // Cifras derivadas de TEMPERATURA_C: una temperatura de frío con calor, la máxima de calor
  // con frío, y una temperatura dentro de la banda de calor.
  const { calor, frio } = TEMPERATURA_C, dentro = Math.round((calor.min + calor.max) / 2), ceroOFrio = Math.min(Math.max(0, frio.min), frio.max);
  it("la ruta rechaza calor a 0 °C y frío a 41 °C y acepta calor a 32 °C (cifras de TEMPERATURA_C)", async () => {
    expect(ceroOFrio < calor.min && calor.max > frio.max).toBe(true);
    expect((await pedir({ clima: "calor", temperaturaC: ceroOFrio })).status).toBe(400);
    expect((await pedir({ clima: "calor", temperaturaC: calor.max + 1 })).status).toBe(400);
    expect((await pedir({ clima: "frio", temperaturaC: calor.max })).status).toBe(400);
    expect((await pedir({ clima: "frio", temperaturaC: frio.min - 1 })).status).toBe(400);
    expect((await pedir({ clima: "lluvia", temperaturaC: dentro })).status).toBe(400);
    expect((await pedir({ temperaturaC: dentro })).status).toBe(400);
    const ok = await pedir({ clima: "calor", temperaturaC: dentro });
    expect(ok.status).toBe(200);
    expect((await ok.json() as RegistroArena).config.partido.condiciones).toMatchObject({ clima: "calor", temperaturaC: dentro });
    expect((await pedir({ clima: "frio" })).status).toBe(200);
  });
  it("las bandas salen de TEMPERATURA_C y las sesiones en directo usan el mismo esquema", () => {
    for (const clima of ["calor", "frio"] as const) {
      const { min, max } = TEMPERATURA_C[clima];
      for (const t of [min, max]) expect(entornoArena.safeParse({ clima, temperaturaC: t }).success).toBe(true);
      for (const t of [min - 1, max + 1]) expect(entornoArena.safeParse({ clima, temperaturaC: t }).success).toBe(false);
    }
    const sesion = (temperaturaC: number) => peticionSesion.safeParse({ seed: 1, segundos: 5, local: "auto", visita: "auto", entorno: { clima: "calor", temperaturaC }, seleccion: { modo: "programado" } }).success;
    expect(sesion(ceroOFrio)).toBe(false); expect(sesion(TEMPERATURA_C.calor.min)).toBe(true);
    expect(z.object({ e: entornoArena }).safeParse({ e: { clima: "despejado", temperaturaC: dentro } }).success).toBe(false);
  });
  it("/api/arena/sesiones responde 400 con el mensaje en inglés del esquema", async () => {
    const r = await POSTSesion(new Request("http://localhost/api/arena/sesiones", { method: "POST", body: JSON.stringify({ seed: 1, segundos: 5, local: "auto", visita: "auto", entorno: { clima: "calor", temperaturaC: ceroOFrio }, seleccion: { modo: "programado" } }) }));
    expect(r.status).toBe(400);
    const { error } = await r.json() as { error: string };
    expect(error).toContain(`Temperature for hot weather must be ${calor.min}..${calor.max}`);
  });
  it("el formulario omite una temperatura vacía o fuera de rango", () => {
    const base = { superficie: "auto", cesped: "corto", presion: "auto" } as const;
    expect(entornoDeFormulario({ ...base, clima: "calor", temperatura: "" })).toEqual({ clima: "calor" });
    expect(entornoDeFormulario({ ...base, clima: "calor", temperatura: String(ceroOFrio) })).toEqual({ clima: "calor" });
    expect(entornoDeFormulario({ ...base, clima: "frio", temperatura: String(TEMPERATURA_C.frio.max + 1) })).toEqual({ clima: "frio" });
    expect(entornoDeFormulario({ ...base, clima: "calor", temperatura: String(TEMPERATURA_C.calor.min) })).toEqual({ clima: "calor", temperaturaC: TEMPERATURA_C.calor.min });
    expect(entornoDeFormulario({ ...base, clima: "lluvia", temperatura: String(dentro) })).toEqual({ clima: "lluvia" });
    expect(entornoDeFormulario({ clima: "auto", temperatura: String(dentro), superficie: "natural", cesped: "alto", presion: "baja" })).toEqual({ superficie: "natural", cesped: "alto", presion: { local: "baja", visita: "media" } });
    const config = crearConfigArena({ seed: 5, duracionS: 5, entorno: entornoDeFormulario({ ...base, clima: "calor", temperatura: "" }) });
    const t = config.partido.condiciones!.temperaturaC!;
    expect(t).toBeGreaterThanOrEqual(TEMPERATURA_C.calor.min); expect(t).toBeLessThanOrEqual(TEMPERATURA_C.calor.max);
  });
});
