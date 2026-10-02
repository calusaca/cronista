// Brief 018 §3 — hechos de las condiciones: ORÁCULO sobre el corpus de liga. Cada hecho de efecto
// se recuenta aquí por otro camino (sin importar src/analista/condiciones.ts) sobre el partido y
// su capa micro: existe ⇔ la condición está registrada Y la medición de ESE partido pasa el
// umbral; sus cifras y citas coinciden con el recuento. La condición sola nunca basta.
// Umbrales importados de umbrales.ts / limites.ts: nada repetido a mano.
import { describe, expect, it } from "vitest";
import { mundo } from "../../mundo/mundo";
import { configDePartidoLiga } from "../../mundo/temporada";
import { PASE_M, SALIDA_TEMPRANA_MIN } from "../../sim/limites";
import { micro, type MicroPartido } from "../../sim/micro";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Partido } from "../../sim/tipos";
import { detectarMomentos, hechosDelMomento, prefijo } from "../../vivo/momentos";
import { analizar } from "../analista";
import type { Hecho } from "../tipos";
import { CALOR_PASES_2T_MAX, CANCHA_CORTOS_MAX, CANCHA_CORTOS_MUESTRA_MIN, LIGA_DESTACADA, PERDIDAS_MIN, PRESION_PERDIDAS_MIN, TEMPORADA_ACTUAL } from "../umbrales";

// Dos ligas enteras: la visible (templada, presión alta para el visitante) y una desértica
// (calor frecuente, presión baja para el local ⇒ el visitante juega con presión media).
const LIGAS = [LIGA_DESTACADA, "liga-de-las-dunas"];
interface Caso {
  ref: string;
  p: Partido;
  m: MicroPartido;
  hs: Hecho[];
}
const corpus: Caso[] = mundo()
  .ligas.filter((l) => LIGAS.includes(l.id))
  .flatMap((liga) =>
    Array.from({ length: 90 }, (_, k) => {
      const j = Math.floor(k / 5) + 1;
      const i = (k % 5) + 1;
      const p = simular(configDePartidoLiga(liga, TEMPORADA_ACTUAL, j, i));
      return { ref: `${liga.id} ${j}/${i}`, p, m: micro(p), hs: analizar(p) };
    }),
  );
const de = (c: Caso, tipo: string) => c.hs.filter((h) => h.tipo === tipo);

/** Recuento independiente: pases por periodo (por el periodo del ancla, contando inicios aquí). */
function pasesPorPeriodo(c: Caso): [number, number] {
  const per = new Map<string, number>();
  let n = 0;
  for (const e of c.p.eventos) {
    if (e.tipo === "inicio_periodo") n++;
    per.set(e.id, n);
  }
  let a = 0;
  let b = 0;
  for (const x of c.m.eventos) if (x.tipo === "pase") (per.get(x.ancla) === 2 ? b++ : a++);
  return [a, b];
}

describe("018 · oráculo de los hechos de condiciones (corpus de liga)", () => {
  it("el corpus ejercita las tres condiciones con efecto y los tres hechos (ningún detector muerto)", () => {
    for (const t of ["condiciones_del_partido", "efecto_calor", "cancha_incomoda", "presion_que_ahoga"]) expect(corpus.some((c) => de(c, t).length > 0), t).toBe(true);
  });

  it("condiciones_del_partido: exactamente uno por partido, con la config registrada en sus datos, citando el saque inicial", () => {
    for (const c of corpus) {
      const k = c.p.config.condiciones!;
      const hs = de(c, "condiciones_del_partido");
      expect(hs, c.ref).toHaveLength(1);
      const d = hs[0]!.datos;
      expect([d.clima, d.temperatura_c, d.superficie, d.cesped, d.presion_local, d.presion_visita], c.ref).toEqual([k.clima, k.temperaturaC, k.superficie, k.cesped, k.presion.local, k.presion.visita]);
      expect(hs[0]!.eventos).toEqual([c.p.eventos[0]!.id]);
      expect(c.p.eventos[0]!.tipo).toBe("inicio_periodo");
    }
  });

  it("efecto_calor ⇔ calor registrado Y pases 2T ≤ CALOR_PASES_2T_MAX % de los del 1T (recuento propio)", () => {
    let conCalorSinEfecto = 0;
    for (const c of corpus) {
      const k = c.p.config.condiciones!;
      const [a, b] = pasesPorPeriodo(c);
      const esperado = k.clima === "calor" && b * 100 <= CALOR_PASES_2T_MAX * a;
      const hs = de(c, "efecto_calor");
      expect(hs.length, c.ref).toBe(esperado ? 1 : 0);
      if (k.clima === "calor" && !esperado) conCalorSinEfecto++;
      if (hs[0]) {
        expect([hs[0].datos.pases_primer_tiempo, hs[0].datos.pases_segundo_tiempo, hs[0].datos.temperatura_c], c.ref).toEqual([a, b, k.temperaturaC]);
        expect(hs[0].datos.porcentaje).toBe(Math.round((b * 100) / a));
      }
    }
    expect(conCalorSinEfecto).toBeGreaterThan(0); // la condición sola no basta: hay calor sin hecho
  });

  it("cancha_incomoda ⇔ césped natural alto, SIN lluvia, Y cortos del visitante ≤ CANCHA_CORTOS_MAX % (con muestra mínima)", () => {
    let altoSinEfecto = 0;
    for (const c of corpus) {
      const k = c.p.config.condiciones!;
      const cortos = c.m.eventos.filter((x) => x.tipo === "pase" && x.equipo === "visita" && x.distanciaM !== undefined && x.distanciaM < PASE_M.corto.max);
      const ok = cortos.filter((x) => x.completado).length;
      const alto = k.superficie === "natural" && k.cesped === "alto";
      const esperado = alto && k.clima !== "lluvia" && cortos.length >= CANCHA_CORTOS_MUESTRA_MIN && ok * 100 <= CANCHA_CORTOS_MAX * cortos.length;
      const hs = de(c, "cancha_incomoda");
      expect(hs.length, c.ref).toBe(esperado ? 1 : 0);
      if (alto && !esperado) altoSinEfecto++;
      if (hs[0]) {
        expect([hs[0].datos.completados, hs[0].datos.intentados, hs[0].datos.equipo], c.ref).toEqual([ok, cortos.length, c.p.config.visita.nombre]);
      }
    }
    expect(altoSinEfecto).toBeGreaterThan(0);
  });

  it("cancha_incomoda jamás con césped CORTO, aunque el visitante complete pocos cortos (semillas sueltas, condición forzada)", () => {
    // El corpus de liga casi no tiene visitantes flojos en césped corto: aquí se fuerzan.
    let flojos = 0;
    for (let s = 1; s <= 200; s++) {
      for (const cesped of ["corto", "alto"] as const) {
        const p = simular({ ...configDeSemilla(s), condiciones: { clima: "despejado", superficie: "natural", cesped, presion: { local: "baja", visita: "media" } } });
        const cortos = micro(p).eventos.filter((x) => x.tipo === "pase" && x.equipo === "visita" && x.distanciaM !== undefined && x.distanciaM < PASE_M.corto.max);
        const bajo = cortos.length >= CANCHA_CORTOS_MUESTRA_MIN && cortos.filter((x) => x.completado).length * 100 <= CANCHA_CORTOS_MAX * cortos.length;
        if (cesped === "corto" && bajo) flojos++;
        expect(analizar(p).some((h) => h.tipo === "cancha_incomoda"), `seed ${s} ${cesped}`).toBe(cesped === "alto" && bajo);
      }
    }
    expect(flojos).toBeGreaterThan(0); // el caso que la mutación necesita existe
  });

  it("cancha_incomoda jamás con LLUVIA, aunque la caída medida pase el umbral (la lluvia, no el césped, podría explicarla)", () => {
    let caidas = 0;
    for (let s = 1; s <= 120; s++) {
      for (const clima of ["lluvia", "despejado"] as const) {
        const p = simular({ ...configDeSemilla(s), condiciones: { clima, superficie: "natural", cesped: "alto", presion: { local: "baja", visita: "media" } } });
        const cortos = micro(p).eventos.filter((x) => x.tipo === "pase" && x.equipo === "visita" && x.distanciaM !== undefined && x.distanciaM < PASE_M.corto.max);
        const bajo = cortos.length >= CANCHA_CORTOS_MUESTRA_MIN && cortos.filter((x) => x.completado).length * 100 <= CANCHA_CORTOS_MAX * cortos.length;
        if (clima === "lluvia" && bajo) caidas++;
        expect(analizar(p).some((h) => h.tipo === "cancha_incomoda"), `seed ${s} ${clima}`).toBe(clima === "despejado" && bajo);
      }
    }
    expect(caidas).toBeGreaterThan(0); // hubo caída medida bajo lluvia, y aun así no hay hecho
  });

  it("presion_que_ahoga SUBSUME a perdidas_en_salida del mismo equipo; sin presión alta, el hecho del 013 como siempre", () => {
    let subsumidos = 0;
    let planos = 0;
    for (const c of corpus) {
      const k = c.p.config.condiciones!;
      for (const lado of ["local", "visita"] as const) {
        const nombre = c.p.config[lado].nombre;
        const porCanal = new Map<string, number>();
        for (const x of c.m.eventos) if (x.tipo === "perdida" && x.equipo === lado && x.zona === "defensa") porCanal.set(x.canal, (porCanal.get(x.canal) ?? 0) + 1);
        const plano = Math.max(0, ...porCanal.values()) >= PERDIDAS_MIN;
        const tempranas = c.m.eventos.filter((x) => x.tipo === "perdida" && x.equipo === lado && x.zona === "defensa" && x.minuto < SALIDA_TEMPRANA_MIN).length;
        const condicionado = k.presion[lado] === "alta" && tempranas >= PRESION_PERDIDAS_MIN;
        const tiene = (t: string) => c.hs.some((h) => h.tipo === t && h.datos.equipo === nombre);
        expect(tiene("presion_que_ahoga"), `${c.ref} ${lado}`).toBe(condicionado);
        expect(tiene("perdidas_en_salida"), `${c.ref} ${lado}`).toBe(plano && !condicionado);
        if (plano && condicionado) subsumidos++;
        if (plano && !condicionado) planos++;
      }
    }
    expect(subsumidos).toBeGreaterThan(0); // los dos umbrales superados: solo el condicionado
    expect(planos).toBeGreaterThan(0); // y el plano sigue donde no hay presión que lo explique
  });

  it("presion_que_ahoga ⇔ presión alta Y pérdidas tempranas en salida ≥ PRESION_PERDIDAS_MIN; cita EXACTAMENTE esas pérdidas", () => {
    let altaSinEfecto = 0;
    for (const c of corpus) {
      const k = c.p.config.condiciones!;
      const lado = k.presion.visita === "alta" ? "visita" : k.presion.local === "alta" ? "local" : undefined;
      const ids = lado ? c.m.eventos.filter((x) => x.tipo === "perdida" && x.equipo === lado && x.zona === "defensa" && x.minuto < SALIDA_TEMPRANA_MIN).map((x) => x.id) : [];
      const esperado = lado !== undefined && ids.length >= PRESION_PERDIDAS_MIN;
      const hs = de(c, "presion_que_ahoga");
      expect(hs.length, c.ref).toBe(esperado ? 1 : 0);
      if (lado && !esperado) altaSinEfecto++;
      if (hs[0]) {
        expect(hs[0].eventos, c.ref).toEqual(ids);
        expect(hs[0].datos.perdidas).toBe(ids.length);
        expect(hs[0].datos.equipo).toBe(c.p.config[lado!].nombre);
      }
    }
    expect(altaSinEfecto).toBeGreaterThan(0);
  });

  it("los números de cada texto están en sus datos (V3 los encontrará) y no queda ninguna {clave} sin rellenar", () => {
    for (const c of corpus) {
      for (const h of c.hs.filter((x) => ["condiciones_del_partido", "efecto_calor", "cancha_incomoda", "presion_que_ahoga"].includes(x.tipo))) {
        const enDatos = new Set(Object.values(h.datos).flatMap((v) => (typeof v === "number" ? [String(Math.abs(v))] : String(v).match(/\d+/g) ?? [])));
        for (const t of [h.texto_es, h.texto_en]) {
          expect(t, `${c.ref} ${h.tipo}: plantilla sin rellenar`).not.toMatch(/[{}]/);
          for (const n of t.match(/\d+/g) ?? []) expect(enDatos.has(n), `${c.ref} ${h.tipo}: ${n}`).toBe(true);
        }
      }
    }
  });
});

describe("018 · en vivo: condiciones desde el 0', efectos solo cuando el prefijo ya los mide", () => {
  const casos = corpus.slice(0, 90);
  it("las condiciones están en TODOS los momentos (desde el primero)", () => {
    for (const c of casos) for (const mo of detectarMomentos(c.p)) expect(hechosDelMomento(c.p, mo).some((h) => h.tipo === "condiciones_del_partido"), c.ref).toBe(true);
    // y sobre el prefijo mínimo (el saque inicial) también existen
    for (const c of casos.slice(0, 10)) expect(analizar({ config: c.p.config, eventos: c.p.eventos.slice(0, 1) }).some((h) => h.tipo === "condiciones_del_partido")).toBe(true);
  });

  it("efecto_calor jamás antes del pitazo final (la comparación del 2.º tiempo no está hecha)", () => {
    for (const c of casos) {
      for (const mo of detectarMomentos(c.p)) {
        if (mo.tipo === "final") continue;
        expect(analizar(prefijo(c.p, mo)).some((h) => h.tipo === "efecto_calor"), `${c.ref} ${mo.id}`).toBe(false);
      }
    }
  });

  it("presion_que_ahoga y cancha_incomoda en un prefijo: los mide ESE prefijo (recuento sobre la capa micro del prefijo)", () => {
    for (const c of casos) {
      for (const mo of detectarMomentos(c.p)) {
        const pre = prefijo(c.p, mo);
        const mp = micro(pre);
        const hs = analizar(pre);
        const k = c.p.config.condiciones!;
        const lado = k.presion.visita === "alta" ? "visita" : undefined;
        const n = lado ? mp.eventos.filter((x) => x.tipo === "perdida" && x.equipo === lado && x.zona === "defensa" && x.minuto < SALIDA_TEMPRANA_MIN).length : 0;
        expect(hs.some((h) => h.tipo === "presion_que_ahoga"), `${c.ref} ${mo.id}`).toBe(lado !== undefined && n >= PRESION_PERDIDAS_MIN);
        const cortos = mp.eventos.filter((x) => x.tipo === "pase" && x.equipo === "visita" && x.distanciaM !== undefined && x.distanciaM < PASE_M.corto.max);
        const ok = cortos.filter((x) => x.completado).length;
        const alto = k.superficie === "natural" && k.cesped === "alto";
        expect(hs.some((h) => h.tipo === "cancha_incomoda"), `${c.ref} ${mo.id}`).toBe(alto && k.clima !== "lluvia" && cortos.length >= CANCHA_CORTOS_MUESTRA_MIN && ok * 100 <= CANCHA_CORTOS_MAX * cortos.length);
      }
    }
  });
});
