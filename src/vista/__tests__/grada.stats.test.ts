// Brief 026 — la grada sobre el corpus de liga COMPLETO (8 ligas × 90) y 1..1000 sueltos:
// cuánto suena cada reacción (informe), ninguna lista muerta, y el hecho del olé ⇔ la reacción
// del olé en cada partido. `npm run test:stats`.
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import { TEMPORADA_ACTUAL, TIPOS_REACCION } from "../../analista/umbrales";
import { mundo } from "../../mundo/mundo";
import { configDePartidoLiga } from "../../mundo/temporada";
import { micro } from "../../sim/micro";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Partido } from "../../sim/tipos";
import { reacciones } from "../grada";

const informe = (k: string, v: string) => console.log(`[grada 026] ${k}: ${v}`);
const pct = (a: number, b: number) => `${((a * 100) / b).toFixed(1)} %`;
const liga: Partido[] = mundo().ligas.flatMap((l) => Array.from({ length: 90 }, (_, k) => simular(configDePartidoLiga(l, TEMPORADA_ACTUAL, Math.floor(k / 5) + 1, (k % 5) + 1))));
const sueltos: Partido[] = Array.from({ length: 1000 }, (_, i) => simular(configDeSemilla(i + 1)));

describe("026 · la grada en los corpus", () => {
  for (const [nombre, corpus] of [
    ["liga (720)", liga],
    ["sueltos (1..1000)", sueltos],
  ] as const) {
    it(`${nombre}: cuánto suena cada reacción; ninguna lista muerta; el hecho del olé ⇔ su reacción`, () => {
      const por: Record<string, { n: number; partidos: number }> = Object.fromEntries(TIPOS_REACCION.map((t) => [t, { n: 0, partidos: 0 }]));
      const largos: number[] = [];
      const errores: string[] = [];
      for (const p of corpus) {
        const m = micro(p);
        const rs = reacciones(p, m);
        for (const t of TIPOS_REACCION) {
          const k = rs.filter((r) => r.tipo === t).length;
          (por[t] as { n: number }).n += k;
          if (k > 0) (por[t] as { partidos: number }).partidos++;
        }
        for (const r of rs) if (r.tipo === "ole") largos.push(r.micro.length);
        const hechos = analizar(p).filter((h) => h.tipo === "ole_de_la_grada").map((h) => h.eventos.join()).sort();
        const oles = rs.filter((r) => r.tipo === "ole").map((r) => r.micro.join()).sort();
        if (hechos.join("|") !== oles.join("|")) errores.push(`${p.config.seed}`);
      }
      for (const t of TIPOS_REACCION) {
        const x = por[t] as { n: number; partidos: number };
        informe(`${nombre} · ${t}`, `${x.n} (${(x.n / corpus.length).toFixed(2)} por partido) · en ${pct(x.partidos, corpus.length)} de los partidos`);
        expect(x.n, t).toBeGreaterThan(0);
      }
      largos.sort((a, b) => a - b);
      informe(`${nombre} · largo de la racha del olé`, `mediana ${largos[Math.floor(largos.length / 2)]}, máx ${largos[largos.length - 1]}`);
      expect(errores.slice(0, 5)).toEqual([]);
    });
  }
});
