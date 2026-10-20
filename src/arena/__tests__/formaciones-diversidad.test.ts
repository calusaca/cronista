import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { anclas, estructuraBase, puestos, transformar } from "../catalogo";
import { formaciones } from "../tipos";
import { crearConfigArena, MotorArena } from "../motor";
import { observarArena, reproducirArena } from "../coordinador";
import { gestionarProgramado } from "../entrenadores";

it("ofrece al menos diez geometrías base distintas, con diez funciones y un portero en cada fase", () => {
  expect(formaciones.length).toBeGreaterThanOrEqual(10);
  const geometrías = new Set<string>();
  for (const f of formaciones) {
    expect(estructuraBase(f)).toBe(f);
    const funciones = puestos(f);
    expect(funciones).toHaveLength(11); expect(new Set(funciones).size).toBe(11);
    expect(funciones.filter(p => p === "POR")).toHaveLength(1);
    for (const fase of ["base", "ataque", "defensa"] as const) {
      const local = anclas(f, "local", fase), visita = anclas(f, "visita", fase);
      expect(Object.keys(local).sort()).toEqual([...funciones].sort());
      expect(new Set(Object.values(local).map(p => `${p.x}:${p.y}`)).size).toBe(11);
      for (const puesto of funciones) {
        expect(local[puesto]!.x).toBeGreaterThanOrEqual(0); expect(local[puesto]!.x).toBeLessThanOrEqual(105);
        expect(local[puesto]!.y).toBeGreaterThanOrEqual(0); expect(local[puesto]!.y).toBeLessThanOrEqual(68);
        expect(visita[puesto]).toEqual(transformar(local[puesto]!, "visita"));
      }
    }
    geometrías.add(JSON.stringify(Object.values(anclas(f, "local", "base")).map(p => [p.x, p.y]).sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!)));
  }
  expect(geometrías.size).toBe(formaciones.length);
});

it("la selección automática alcanza todo el catálogo sin concentrarse en una primera opción común", () => {
  const conteos = new Map<string, number>();
  for (let seed = 1; seed <= 1000; seed++) {
    const c = crearConfigArena({ seed });
    for (const f of Object.values(c.formaciones)) conteos.set(f, (conteos.get(f) ?? 0) + 1);
  }
  expect([...conteos.keys()].sort()).toEqual([...formaciones].sort());
  // Guarda de diversidad del generador, no una frecuencia táctica profesional.
  expect(Math.max(...conteos.values()) / 2000).toBeLessThan(.3);
});

it("el entrenador puede cambiar a una nueva estructura defensiva durante el partido", () => {
  const motor = new MotorArena(crearConfigArena({ local: "5-4-1", duracionS: 60 }));
  const obs = structuredClone(observarArena(motor, "local"));
  obs.estado.tick = 300; obs.tiempoS = 30; obs.estado.marcador.local = 1;
  obs.estado.entrenadores!.local.proximaRevisionTick = 300;
  Object.assign(obs.equipos.local.entrenador!, { preferidas: ["5-3-2"], adaptabilidad: 100, defensiva: 100, riesgo: 0, rotacion: 0 });
  const gestion = gestionarProgramado(obs)!;
  expect(gestion.mentalidad).toBe("conservar"); expect(gestion.formacion).toBe("5-3-2");
});

it.each(["public/experimentos/arena-llm-v3.json", "public/experimentos/arena-duelo-v3.json"])("conserva la reproducción exacta del repertorio archivado: %s", archivo => {
  const r = JSON.parse(readFileSync(archivo, "utf8"));
  expect(reproducirArena(r)).toEqual(r);
});
