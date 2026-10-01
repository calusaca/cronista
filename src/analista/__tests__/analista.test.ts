// Suite rápida del Analista (brief 002): fixtures a mano + propiedades de corpus.
// Salida esperada cerrada por propiedad (tipos presentes/ausentes y eventos citados),
// nunca por igualdad de texto. Umbrales importados de umbrales.ts.
import { describe, expect, it } from "vitest";
import { VERIFICADORES } from "../../sim/invariantes";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Partido } from "../../sim/tipos";
import { EQUIPO_LOCAL, EQUIPO_VISITA } from "../__fixtures__/constructor";
import * as F from "../__fixtures__/partidos";
import { analizar, claveRelevancia } from "../analista";
import { TIPOS_HECHO, type Hecho, type TipoHecho } from "../tipos";
import {
  DESEMPATE_EVENTO,
  DOBLETE_MIN_GOLES,
  PRESION_TIROS_MIN,
  RAREZA_PORTERO,
  RAREZA_PRESION,
  RAREZA_REMONTADA_VICTORIA,
  RELEVANCIA,
} from "../umbrales";

const de = (hs: Hecho[], tipo: TipoHecho) => hs.filter((h) => h.tipo === tipo);
const uno = (hs: Hecho[], tipo: TipoHecho): Hecho => {
  const xs = de(hs, tipo);
  expect(xs, `se esperaba exactamente un ${tipo}`).toHaveLength(1);
  return xs[0] as Hecho;
};

/** Propiedades estructurales que todo análisis debe cumplir (fixtures y corpus). */
function problemasEstructurales(p: Partido, hs: Hecho[]): string[] {
  const err: string[] = [];
  const indice = new Map(p.eventos.map((e, i) => [e.id, i] as const));
  hs.forEach((h, k) => {
    const pre = `${h.id} (${h.tipo})`;
    if (h.id !== `h${String(k + 1).padStart(2, "0")}`) err.push(`${pre}: id no secuencial`);
    if (h.eventos.length === 0) err.push(`${pre}: eventos vacío`);
    for (const id of h.eventos) if (!indice.has(id)) err.push(`${pre}: cita ${id}, que no existe`);
    const pos = h.eventos.map((id) => indice.get(id) ?? -1);
    if (pos.some((x, i) => i > 0 && x <= (pos[i - 1] as number))) err.push(`${pre}: eventos fuera de orden o repetidos`);
    if (h.relevancia !== RELEVANCIA[claveRelevancia(h.tipo, h.datos)]) err.push(`${pre}: relevancia ${h.relevancia} ≠ tabla`);
    if (h.tipo === "remontada" && h.datos.desenlace !== "victoria" && h.datos.desenlace !== "empate") {
      err.push(`${pre}: desenlace inválido ${String(h.datos.desenlace)}`);
    }
    if (h.relevancia < 0 || h.relevancia > 100) err.push(`${pre}: relevancia fuera de 0–100`);
    for (const t of [h.texto_es, h.texto_en]) {
      if (t.trim() === "") err.push(`${pre}: texto vacío`);
      if (t.includes("{") || t.includes("}")) err.push(`${pre}: placeholder sin resolver: ${t}`);
      if (/NaN|undefined|null|Infinity/.test(t)) err.push(`${pre}: valor inválido en texto: ${t}`);
    }
    for (const [k2, v] of Object.entries(h.datos)) {
      if (typeof v === "number" && !Number.isFinite(v)) err.push(`${pre}: datos.${k2} no finito`);
      if (typeof v === "string" && v === "") err.push(`${pre}: datos.${k2} vacío`);
    }
    if (k > 0) {
      const prev = hs[k - 1] as Hecho;
      if (prev.relevancia < h.relevancia) err.push(`${pre}: orden de relevancia roto`);
      if (prev.relevancia === h.relevancia) {
        // Rev. 2.3 [B1]: desempate por el minuto del evento definitorio de cada tipo.
        const definitorio = (x: Hecho) => {
          const id = x.eventos.find((e) => p.eventos[indice.get(e) ?? -1]?.tipo === DESEMPATE_EVENTO[x.tipo]) ?? x.eventos[0];
          return p.eventos[indice.get(id as string) ?? 0]?.minuto ?? 0;
        };
        if (definitorio(prev) > definitorio(h)) err.push(`${pre}: desempate por minuto del evento definitorio roto`);
      }
    }
  });
  return err;
}

// ---------------- fixtures ----------------

describe("fixtures: son partidos válidos según el contrato del 001", () => {
  it.each(Object.keys(F.FIXTURES))("%s cumple todas las invariantes del simulador", (nombre) => {
    const { partido } = F.FIXTURES[nombre as keyof typeof F.FIXTURES]();
    for (const [inv, verificar] of Object.entries(VERIFICADORES)) {
      expect(verificar(partido), `${nombre} viola ${inv}`).toEqual([]);
    }
  });

  it.each(Object.keys(F.FIXTURES))("%s: el análisis cumple las propiedades estructurales", (nombre) => {
    const { partido } = F.FIXTURES[nombre as keyof typeof F.FIXTURES]();
    expect(problemasEstructurales(partido, analizar(partido))).toEqual([]);
  });
});

describe("fixtures: resultado, marcador por periodo y goles", () => {
  const { partido, ids } = F.basico();
  const hs = analizar(partido);

  it("resultado_final: uno, con el marcador y citando todos los goles + el fin del partido", () => {
    const h = uno(hs, "resultado_final");
    expect(h.datos).toMatchObject({ goles_local: 2, goles_visita: 1, local: EQUIPO_LOCAL, visita: EQUIPO_VISITA });
    expect(h.eventos).toEqual([...ids.goles!, ids.fines![1]]);
  });

  it("marcador_por_periodo: uno por periodo, cada uno con sus goles y su fin_periodo", () => {
    const [p1, p2] = de(hs, "marcador_por_periodo").sort((a, b) => Number(a.datos.periodo) - Number(b.datos.periodo));
    expect(de(hs, "marcador_por_periodo")).toHaveLength(2);
    expect(p1!.eventos).toEqual([ids.goles![0], ids.fines![0]]);
    expect(p1!.datos).toMatchObject({ periodo: 1, marcador_local: 1, marcador_visita: 0 });
    expect(p2!.eventos).toEqual([ids.goles![1], ids.goles![2], ids.fines![1]]);
    expect(p2!.datos).toMatchObject({ periodo: 2, goles_local_periodo: 1, goles_visita_periodo: 1, marcador_local: 2, marcador_visita: 1 });
  });

  it("gol_anotado: uno por gol, citando el gol y su tiro", () => {
    const gs = de(hs, "gol_anotado");
    expect(gs).toHaveLength(3);
    for (const h of gs) {
      expect(h.eventos).toHaveLength(2);
      const [tiro, gol] = h.eventos.map((id) => partido.eventos.find((e) => e.id === id));
      expect(tiro?.tipo).toBe("tiro");
      expect(gol?.tipo).toBe("gol");
      expect(gol?.relacionadoCon).toBe(tiro?.id);
    }
  });

  it("partido sin roja ⇒ no hay expulsion_y_efecto; sin remontada, doblete ni disciplina", () => {
    for (const t of ["expulsion_y_efecto", "remontada", "doblete_o_mas", "disciplina"] as const) expect(de(hs, t)).toEqual([]);
  });
});

describe("fixtures: remontada", () => {
  it("0–2 ⇒ 3–2: una remontada del local con victoria, citando la secuencia", () => {
    const { partido, ids } = F.remontadaVictoria();
    const hs = analizar(partido);
    const h = uno(hs, "remontada");
    expect(h.datos).toMatchObject({ equipo: EQUIPO_LOCAL, desenlace: "victoria", desventaja_max: 2, final_propios: 3, final_rival: 2 });
    expect(h.eventos).toEqual([...ids.desventaja!, ...ids.remontada!]);
    // Rev. 2.2: la remontada con victoria es titular (relevancia de victoria, primer hecho).
    expect(h.relevancia).toBe(RELEVANCIA.remontada_victoria);
    expect(hs[0]).toBe(h);
    expect(h.texto_es).toMatch(/ y ganó /);
    expect(h.texto_en).toMatch(/ and won /);
  });

  it("caso borde: 0–1 ⇒ 1–1 también es remontada (termina en empate), con relevancia de empate", () => {
    const { partido, ids } = F.remontadaEmpate();
    const hs = analizar(partido);
    const h = uno(hs, "remontada");
    expect(h.datos).toMatchObject({ equipo: EQUIPO_LOCAL, desenlace: "empate", desventaja_max: 1 });
    expect(h.eventos).toEqual(ids.goles);
    expect(h.relevancia).toBe(RELEVANCIA.remontada_empate);
    expect(h.texto_es).toMatch(/ y empató /);
    expect(h.texto_en).toMatch(/ and drew /);
    // Rev. 2.2: ya no es titular. Todo hecho de relevancia mayor va antes; todo uno menor, después.
    const pos = hs.indexOf(h);
    expect(hs.slice(0, pos).every((x) => x.relevancia >= h.relevancia)).toBe(true);
    expect(hs.slice(pos + 1).every((x) => x.relevancia <= h.relevancia)).toBe(true);
    expect(hs.indexOf(uno(hs, "resultado_final"))).toBeLessThan(pos);
    for (const g of de(hs, "gol_anotado")) expect(hs.indexOf(g)).toBeLessThan(pos);
  });

  it("claveRelevancia: lanza ante una remontada sin desenlace válido (error de programa)", () => {
    expect(claveRelevancia("remontada", { desenlace: "victoria" })).toBe("remontada_victoria");
    expect(claveRelevancia("remontada", { desenlace: "empate" })).toBe("remontada_empate");
    expect(() => claveRelevancia("remontada", {})).toThrow(/desenlace/);
    expect(() => claveRelevancia("remontada", { desenlace: "derrota" })).toThrow(/desenlace/);
  });

  it("estuvo abajo y terminó perdiendo, o nunca estuvo abajo ⇒ no hay remontada", () => {
    const { partido } = F.sinRemontada();
    expect(de(analizar(partido), "remontada")).toEqual([]);
  });
});

describe("fixtures: doblete_o_mas", () => {
  it(`doblete exacto (${DOBLETE_MIN_GOLES} goles) cita exactamente esos goles; el de 1 gol no emite`, () => {
    const { partido, ids } = F.dobleteExacto();
    const h = uno(analizar(partido), "doblete_o_mas");
    expect(h.eventos).toEqual(ids.doblete);
    expect(h.datos.goles).toBe(DOBLETE_MIN_GOLES);
    expect(h.eventos).not.toContain(ids.suelto![0]);
  });

  it("tres goles del mismo jugador ⇒ un solo hecho con los tres", () => {
    const { partido, ids } = F.triplete();
    const h = uno(analizar(partido), "doblete_o_mas");
    expect(h.eventos).toEqual(ids.goles);
    expect(h.datos.goles).toBe(3);
  });
});

describe("fixtures: gol_temprano y gol_tardio", () => {
  const { partido, ids } = F.tempranoYTardio();
  const hs = analizar(partido);
  it("temprano: solo el gol antes del umbral; el del minuto umbral no", () => {
    expect(de(hs, "gol_temprano").map((h) => h.eventos)).toEqual(ids.tempranos!.map((id) => [id]));
  });
  it("tardío: el gol pasado el umbral y el del descuento; el del minuto umbral no", () => {
    expect(de(hs, "gol_tardio").map((h) => h.eventos[0]).sort()).toEqual([...ids.tardios!].sort());
    for (const id of ids.noEmiten!) {
      expect(hs.some((h) => (h.tipo === "gol_temprano" || h.tipo === "gol_tardio") && h.eventos.includes(id))).toBe(false);
    }
  });
});

describe("fixtures: dominio_periodo", () => {
  it("exactamente el umbral ⇒ SÍ emite, citando las acciones ofensivas del equipo en ese periodo", () => {
    const { partido, ids } = F.dominioJusto();
    const h = uno(analizar(partido), "dominio_periodo");
    expect(h.datos).toMatchObject({ equipo: EQUIPO_LOCAL, periodo: 1 });
    expect(h.eventos).toEqual(ids.propias);
  });

  it("caso borde: 64.9 % ⇒ NO emite", () => {
    const { partido } = F.dominioCasi();
    expect(de(analizar(partido), "dominio_periodo")).toEqual([]);
  });
});

describe("fixtures: presion_sostenida", () => {
  it(`${PRESION_TIROS_MIN} tiros en la ventana exacta con el xG mínimo exacto emite; más ancha, cruzando el descanso o con una centésima menos de xG no`, () => {
    const { partido, ids } = F.presion();
    const h = uno(analizar(partido), "presion_sostenida");
    expect(h.datos.equipo).toBe(EQUIPO_LOCAL);
    expect(h.eventos).toEqual(ids.presionL);
  });
});

describe("fixtures: portero_destacado", () => {
  it("por número de atajadas: nombra al portero rival del tirador y cita atajadas + tiros", () => {
    const { partido, ids } = F.porteroPorAtajadas();
    const h = uno(analizar(partido), "portero_destacado");
    expect(h.datos).toMatchObject({ equipo: EQUIPO_LOCAL, portero: ids.portero![0] });
    expect(h.eventos).toEqual(ids.citados);
  });

  it("por xG atajado exactamente en el umbral (con menos atajadas que el mínimo) ⇒ emite", () => {
    const { partido, ids } = F.porteroPorXg();
    const h = uno(analizar(partido), "portero_destacado");
    expect(h.datos).toMatchObject({ equipo: EQUIPO_VISITA, portero: ids.portero![0] });
  });

  it("una atajada menos que el mínimo (con xG ínfimo) ⇒ NO emite", () => {
    expect(de(analizar(F.porteroCasiPorAtajadas().partido), "portero_destacado")).toEqual([]);
  });

  it("una centésima por debajo del xG y una atajada menos que el mínimo ⇒ NO emite", () => {
    expect(de(analizar(F.porteroCasi().partido), "portero_destacado")).toEqual([]);
  });

  it("con cambio de arquero nombra a los dos porteros que atajaron", () => {
    const { partido, ids } = F.porteroConCambio();
    const h = uno(analizar(partido), "portero_destacado");
    expect(h.datos.portero).toBe(ids.porteros!.join(" / "));
  });
});

describe("fixtures: expulsion_y_efecto", () => {
  it("roja directa: cita roja, falta y goles posteriores (no los anteriores); marcador al momento", () => {
    const { partido, ids } = F.expulsionDirecta();
    const h = uno(analizar(partido), "expulsion_y_efecto");
    expect(h.datos).toMatchObject({ motivo: "roja_directa", marcador_local: 0, marcador_visita: 1, goles_despues_local: 1, goles_despues_visita: 1 });
    expect(h.eventos).toEqual([...ids.falta!, ...ids.roja!, ...ids.despues!]);
    expect(h.eventos).not.toContain(ids.antes![0]);
  });

  it("doble amarilla (una sola tarjeta_roja): lo dice y cita la amarilla previa", () => {
    const { partido, ids } = F.expulsionDobleAmarilla();
    const h = uno(analizar(partido), "expulsion_y_efecto");
    expect(h.datos.motivo).toBe("doble_amarilla");
    expect(h.eventos).toContain(ids.amarilla![0]);
    expect(h.eventos).toContain(ids.roja![0]);
    expect(h.texto_es).toMatch(/doble amarilla/);
    expect(h.texto_en).toMatch(/second yellow/);
  });
});

describe("fixtures: disciplina", () => {
  it("el equipo con el mínimo de amarillas emite citando esas tarjetas; el que tiene una menos no", () => {
    const { partido, ids } = F.disciplina();
    const h = uno(analizar(partido), "disciplina");
    expect(h.datos.equipo).toBe(EQUIPO_LOCAL);
    expect(h.eventos).toEqual(ids.locales);
  });
});

describe("fixtures: justicia_xg", () => {
  it("ganar con menos xG ⇒ contra_la_corriente = si", () => {
    const h = uno(analizar(F.contraLaCorriente().partido), "justicia_xg");
    expect(h.datos).toMatchObject({ contra_la_corriente: "si", ganador: EQUIPO_LOCAL, xg_local: "0.10", xg_visita: "1.50" });
  });

  it("partido sin tiros: justicia_xg y resultado_final citan el fin del partido (nunca lista vacía)", () => {
    const { partido, ids } = F.sinTiros();
    const hs = analizar(partido);
    expect(uno(hs, "justicia_xg").eventos).toEqual(ids.fin);
    expect(uno(hs, "resultado_final").eventos).toEqual(ids.fin);
    expect(uno(hs, "justicia_xg").datos.contra_la_corriente).toBe("no");
  });

  it("el ganador con más xG ⇒ contra_la_corriente = no", () => {
    expect(uno(analizar(F.basico().partido), "justicia_xg").datos.contra_la_corriente).toBe("no");
  });

  it("rev. 2.3 — borde: ganar con EXACTAMENTE el mismo xG ⇒ contra_la_corriente = no", () => {
    const h = uno(analizar(F.justiciaXgIgual().partido), "justicia_xg");
    expect(h.datos).toMatchObject({ xg_local: "0.30", xg_visita: "0.30", goles_local: 1, goles_visita: 0, contra_la_corriente: "no" });
  });
});

describe("rev. 2.3 [B1] — desempate cronológico por el evento definitorio", () => {
  it("dos dobles amarillas con amarillas previas en orden inverso: los hechos siguen el orden de las rojas", () => {
    const { partido, ids } = F.dosDoblesAmarillas();
    const exp = de(analizar(partido), "expulsion_y_efecto");
    expect(exp).toHaveLength(2);
    const rojaDe = (h: Hecho) => h.eventos.find((id) => partido.eventos.find((e) => e.id === id)?.tipo === "tarjeta_roja");
    expect(exp.map(rojaDe)).toEqual(ids.rojasEnOrden);
    // y cada una sigue citando su amarilla previa (la prueba de la doble amarilla)
    for (const h of exp) expect(h.datos.motivo).toBe("doble_amarilla");
    expect(exp.flatMap((h) => h.eventos).filter((id) => ids.amarillas!.includes(id)).sort()).toEqual([...ids.amarillas!].sort());
  });
});

describe("rev. 2.3 [B2] — roja al portero", () => {
  it("atajadas posteriores a la roja del portero, sin reemplazo: «El portero de {equipo}», sin nombre", () => {
    const { partido, ids } = F.rojaAlPortero();
    const h = uno(analizar(partido), "portero_destacado");
    expect(h.datos.portero).toBeUndefined();
    expect(h.datos.equipo).toBe(EQUIPO_LOCAL);
    expect(h.texto_es.startsWith(`El portero de ${EQUIPO_LOCAL}`)).toBe(true);
    expect(h.texto_en.startsWith(`The ${EQUIPO_LOCAL} goalkeeper`)).toBe(true);
    expect(h.texto_es).not.toContain(ids.expulsado![0]);
  });

  it("caso mixto (atajadas antes y después de la roja): no se le atribuyen al expulsado", () => {
    const { partido, ids } = F.rojaAlPorteroMixto();
    const h = uno(analizar(partido), "portero_destacado");
    expect(h.datos.portero).toBeUndefined();
    expect(h.texto_es).not.toContain(ids.expulsado![0]);
    expect(h.texto_en).not.toContain(ids.expulsado![0]);
  });

  it("si entra el portero suplente tras la roja, las atajadas son suyas y se lo nombra", () => {
    const { partido, ids } = F.rojaAlPorteroConSuplente();
    const h = uno(analizar(partido), "portero_destacado");
    expect(h.datos.portero).toBe(ids.portero![0]);
    expect(h.texto_es).not.toContain(ids.expulsado![0]);
  });
});

// ---------------- corpus ----------------

const CORPUS = 1000; // brief: semillas 1..1000 (cabe en la suite rápida, ~1 s)
const partidos: Partido[] = Array.from({ length: CORPUS }, (_, i) => simular(configDeSemilla(i + 1)));

describe(`propiedades de corpus (semillas 1..${CORPUS})`, () => {
  const analisis: Hecho[][] = [];

  it("1 — analizar nunca lanza y emite exactamente un resultado_final", () => {
    const fallas: string[] = [];
    for (const p of partidos) {
      try {
        const hs = analizar(p);
        analisis.push(hs);
        const n = de(hs, "resultado_final").length;
        if (n !== 1) fallas.push(`seed ${p.config.seed}: ${n} resultado_final`);
      } catch (e) {
        fallas.push(`seed ${p.config.seed}: lanzó ${String(e)}`);
      }
    }
    expect(fallas.slice(0, 10)).toEqual([]);
    expect(analisis).toHaveLength(CORPUS);
  });

  it("2 + 5 — IDs existentes, nada vacío, orden y textos ES/EN sin placeholders", () => {
    const fallas = partidos.flatMap((p, i) => problemasEstructurales(p, analisis[i] ?? analizar(p)).map((e) => `seed ${p.config.seed}: ${e}`));
    expect(fallas.slice(0, 10)).toEqual([]);
  });

  it("3 — los datos de resultado_final coinciden con contar los goles a mano", () => {
    const fallas: string[] = [];
    partidos.forEach((p, i) => {
      const gl = p.eventos.filter((e) => e.tipo === "gol" && e.equipo === "local").length;
      const gv = p.eventos.filter((e) => e.tipo === "gol" && e.equipo === "visita").length;
      const h = de(analisis[i] ?? analizar(p), "resultado_final")[0];
      if (h?.datos.goles_local !== gl || h?.datos.goles_visita !== gv) fallas.push(`seed ${p.config.seed}`);
    });
    expect(fallas).toEqual([]);
  });

  it.each([7, 42, 1999])("4 — determinismo: semilla %i ⇒ misma salida byte a byte", (seed) => {
    const p = simular(configDeSemilla(seed));
    expect(JSON.stringify(analizar(p))).toBe(JSON.stringify(analizar(simular(configDeSemilla(seed)))));
    // y no muta el partido de entrada
    const antes = JSON.stringify(p);
    analizar(p);
    expect(JSON.stringify(p)).toBe(antes);
  });

  it("cada gol del partido tiene exactamente un gol_anotado", () => {
    partidos.forEach((p, i) => {
      const goles = p.eventos.filter((e) => e.tipo === "gol").length;
      expect(de(analisis[i] ?? [], "gol_anotado")).toHaveLength(goles);
    });
  });

  it("rev. 2.1 — rareza: presion_sostenida y portero_destacado no son banales ni desaparecen", () => {
    const fraccion = (t: TipoHecho) => analisis.filter((hs) => hs.some((h) => h.tipo === t)).length / CORPUS;
    const media = (t: TipoHecho) => analisis.reduce((s, hs) => s + de(hs, t).length, 0) / CORPUS;
    const fp = fraccion("presion_sostenida");
    const mp = media("presion_sostenida");
    const fk = fraccion("portero_destacado");
    console.log(`[rareza] presion_sostenida: ${(fp * 100).toFixed(1)} % de los partidos, ${mp.toFixed(2)} por partido`);
    console.log(`[rareza] portero_destacado: ${(fk * 100).toFixed(1)} % de los partidos, ${media("portero_destacado").toFixed(2)} por partido`);
    expect(fp).toBeGreaterThanOrEqual(RAREZA_PRESION.min);
    expect(fp).toBeLessThanOrEqual(RAREZA_PRESION.max);
    expect(mp).toBeLessThanOrEqual(RAREZA_PRESION.mediaMax);
    expect(fk).toBeGreaterThanOrEqual(RAREZA_PORTERO.min);
    expect(fk).toBeLessThanOrEqual(RAREZA_PORTERO.max);
  });

  it("rev. 2.2 — rareza: la remontada con victoria es excepcional; ambos desenlaces existen", () => {
    const conVictoria = analisis.filter((hs) => hs.some((h) => h.tipo === "remontada" && h.datos.desenlace === "victoria")).length / CORPUS;
    const conEmpate = analisis.filter((hs) => hs.some((h) => h.tipo === "remontada" && h.datos.desenlace === "empate")).length / CORPUS;
    const conAlguna = analisis.filter((hs) => hs.some((h) => h.tipo === "remontada")).length / CORPUS;
    console.log(
      `[rareza] remontada: ${(conAlguna * 100).toFixed(1)} % de los partidos; con victoria ${(conVictoria * 100).toFixed(1)} %, con empate ${(conEmpate * 100).toFixed(1)} %`,
    );
    expect(conVictoria).toBeGreaterThanOrEqual(RAREZA_REMONTADA_VICTORIA.min);
    expect(conVictoria).toBeLessThanOrEqual(RAREZA_REMONTADA_VICTORIA.max);
    expect(conEmpate).toBeGreaterThan(0);
  });

  it("los 13 tipos de hecho aparecen en el corpus (ningún detector muerto)", () => {
    const vistos = new Set(analisis.flat().map((h) => h.tipo));
    expect(TIPOS_HECHO.filter((t) => !vistos.has(t))).toEqual([]);
  });

  it("los nombres de jugadores en datos pertenecen a la plantilla del partido", () => {
    const fallas: string[] = [];
    partidos.forEach((p, i) => {
      const nombres = new Set([...p.config.local.jugadores, ...p.config.visita.jugadores].map((j) => j.nombre));
      for (const h of analisis[i] ?? []) {
        for (const clave of ["jugador", "portero"]) {
          const v = h.datos[clave];
          if (v === undefined) continue;
          for (const n of String(v).split(" / ")) if (!nombres.has(n)) fallas.push(`seed ${p.config.seed} ${h.id}: ${n}`);
        }
      }
    });
    expect(fallas.slice(0, 10)).toEqual([]);
  });
});
