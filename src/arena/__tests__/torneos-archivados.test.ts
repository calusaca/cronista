// Brief 059 v1.2 — CI sobre TODOS los torneos archivados (`public/torneos/`) y el fixture de ensayo: cada
// `eNN.json.gz` pasa `reproducirArena`; huella del archivo íntegro, configuración completa prescrita por el plan,
// clubes, goles, controladores por lado, cifras 049 y lo declarado que consta en el archivo, iguales a lo
// recalculado (§ 15.5, § 16.1); un torneo real cubre su plan completo (30 partidos con 6) y su resumen.md se
// regenera idéntico byte a byte. Además, los rechazos: M22, N11, N12 y N16.
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { afterAll, describe, expect, it } from "vitest";
import { ARENA } from "../../sim/limites";
import type { Lado } from "../../sim/tipos";
import { ejecutarArena } from "../coordinador";
import {
  calendarioTorneo, esquemaTorneo, LADOS_TORNEO, resumenTorneo, type EncuentroTorneo, type TorneoArchivado,
} from "../torneo";
import { cifrasDeRegistro, constaEnArchivo, sha256, validarEncuentro, validarRaizTorneos, validarTorneo } from "../torneo-validacion";
import type { ConfigArena, ControladorEquipo, RegistroArena } from "../tipos";

const RAICES = ["public/torneos", "src/arena/__fixtures__/torneos"];
const FIXTURE = "src/arena/__fixtures__/torneos/ensayo-059", ALTERADO = "src/arena/__fixtures__/torneos-rechazo/ensayo-059-alterado";
const leerDe = (dir: string) => (archivo: string) => readFileSync(join(dir, archivo));
const cargar = (dir: string) => JSON.parse(readFileSync(join(dir, "torneo.json"), "utf8")) as TorneoArchivado;
const temporales: string[] = [];
afterAll(() => { for (const d of temporales) rmSync(d, { recursive: true, force: true }); });

describe("059 · torneos archivados (CI)", () => {
  it("hay al menos el fixture de ensayo", () => expect(existsSync("src/arena/__fixtures__/torneos/indice.json")).toBe(true));
  // Revisión Codex #1: se enumeran los DIRECTORIOS publicados (no solo el índice) y todos sus archivos.
  for (const raiz of RAICES) it(`${raiz}: directorios = indice.json, solo los archivos de cada torneo, y cada registro se reproduce y coincide con torneo.json`, () => {
    for (const t of validarRaizTorneos(raiz)) {
      expect(t.encuentros.length + t.pendientes.length).toBe(calendarioTorneo(t.participantes.map(p => p.id), t.semilla).length);
      if (t.tipo === "real") {
        expect(raiz).toBe("public/torneos");
        expect(t.encuentros.length + t.pendientes.length).toBe(t.participantes.length * (t.participantes.length - 1));
        // README (resumen.md) regenerado idéntico byte a byte.
        expect(readFileSync(join("docs/evidencia/torneo-059", t.id, "resumen.md"), "utf8")).toBe(resumenTorneo(t));
      } else expect(raiz).not.toBe("public/torneos");
    }
  }, 120_000);

  it("revisión Codex #1 · un torneo huérfano (directorio sin entrada en el índice), una entrada sin directorio o un archivo de más se rechazan", () => {
    const copia = () => { const d = mkdtempSync(join(tmpdir(), "torneos-raiz-")); temporales.push(d); cpSync("src/arena/__fixtures__/torneos", d, { recursive: true }); return d; };
    expect(validarRaizTorneos(copia()).map(t => t.id)).toEqual(["ensayo-059"]);
    const huerfano = copia(); cpSync(join(huerfano, "ensayo-059"), join(huerfano, "otro"), { recursive: true });
    expect(() => validarRaizTorneos(huerfano)).toThrow(/huérfanos.*otro/);
    const sinDir = copia(); rmSync(join(sinDir, "ensayo-059"), { recursive: true });
    expect(() => validarRaizTorneos(sinDir)).toThrow(/sin directorio/);
    const extra = copia(); writeFileSync(join(extra, "ensayo-059", "e99.json.gz"), "x");
    expect(() => validarRaizTorneos(extra)).toThrow(/archivos distintos/);
    const suelto = copia(); writeFileSync(join(suelto, "nota.txt"), "x");
    expect(() => validarRaizTorneos(suelto)).toThrow(/inesperados/);
  });
});

// ---- rechazos ----------------------------------------------------------------------------------------------
const t0 = () => esquemaTorneo.parse(cargar(FIXTURE));
const planDe = (t: TorneoArchivado, n: number) => calendarioTorneo(t.participantes.map(p => p.id), t.semilla)[n - 1]!;
const registroDe = (bytes: Uint8Array) => JSON.parse(gunzipSync(bytes).toString("utf8")) as RegistroArena;
const validar = (t: TorneoArchivado, e: EncuentroTorneo, bytes: Uint8Array) => validarEncuentro(e, planDe(t, e.n), t.participantes, bytes, t);

describe("059 · rechazos de la validación compartida (M22, N11, N12, N16)", () => {
  it("M22 · el fixture alterado no pasa: gol cambiado en torneo.json y orden cambiada dentro de e03.json.gz", () => {
    const alterado = cargar(ALTERADO);
    expect(() => validarTorneo(alterado, leerDe(ALTERADO))).toThrow();
    const e1 = alterado.encuentros.find(e => e.n === 1)!, e3 = alterado.encuentros.find(e => e.n === 3)!;
    expect(() => validar(alterado, e1, readFileSync(join(ALTERADO, "e01.json.gz")))).toThrow(/goles local/);
    expect(() => validar(alterado, e3, readFileSync(join(ALTERADO, "e03.json.gz")))).toThrow(/huella/);
    // Con la huella recalculada, la orden alterada no reproduce el registro.
    const bytes3 = readFileSync(join(ALTERADO, "e03.json.gz"));
    expect(() => validar(alterado, { ...e3, archivoSha256: sha256(bytes3) }, bytes3)).toThrow(/Observación archivada alterada|no coincide con la reproducción/);
  });

  it("M22 · intercambiar lados en torneo.json se rechaza", () => {
    const t = t0(), e = t.encuentros[1]!;
    expect(() => validar(t, { ...e, local: e.visita, visita: e.local }, readFileSync(join(FIXTURE, e.archivo)))).toThrow(/calendario/);
    expect(() => validarTorneo({ ...t, encuentros: t.encuentros.map(x => x.n === e.n ? { ...x, local: x.visita, visita: x.local } : x) }, leerDe(FIXTURE))).toThrow();
  });

  it("N11 · una cifra del 049 alterada en torneo.json; controladores, solicitudes y tiempos alterados", () => {
    const t = t0(), e = t.encuentros[0]!, bytes = readFileSync(join(FIXTURE, e.archivo));
    expect(validar(t, e, bytes).final.marcador).toEqual({ local: e.local.goles, visita: e.visita.goles });
    expect(() => validar(t, { ...e, visita: { ...e.visita, cifras: { ...e.visita.cifras, remates: (e.visita.cifras.remates ?? 0) + 1 } } }, bytes)).toThrow(/cifras visita/);
    expect(() => validar(t, { ...e, local: { ...e.local, declarado: { ...e.local.declarado, llamadas: e.local.declarado.llamadas.map(x => x + 1) } } }, bytes)).toThrow(/solicitudes/);
    expect(() => validar(t, { ...e, local: { ...e.local, declarado: { ...e.local.declarado, tiemposMs: e.local.declarado.tiemposMs.map(x => x + 1) } } }, bytes)).toThrow(/tiempos/);
    const otro = { ...t, participantes: t.participantes.map(p => p.id === e.local.participante ? { ...p, controlador: "ensayo:otro" } : p) };
    expect(() => validarEncuentro(e, planDe(t, e.n), otro.participantes, bytes, t)).toThrow(/controlador local/);
  });

  it("N12 · tiemposMs alterado en el archivo (y en torneo.json, coherente) sin cambiar archivoSha256 se rechaza por la huella", () => {
    const t = t0(), e = t.encuentros[0]!, registro = registroDe(readFileSync(join(FIXTURE, e.archivo)));
    registro.rondas[0]!.decisiones.local.tiempoMs += 1;
    const bytes = gzipSync(JSON.stringify(registro), { level: 9 });
    const declarado = { ...e.local.declarado, tiemposMs: constaEnArchivo(registro, "local").tiemposMs };
    expect(() => validar(t, { ...e, local: { ...e.local, declarado } }, bytes)).toThrow(/huella/);
  });

  it("un .gz cuyo descomprimido supera ARENA.archivoMaxBytes se rechaza sin agotar memoria", () => {
    const t = t0(), e = t.encuentros[0]!, bomba = gzipSync(Buffer.alloc(ARENA.archivoMaxBytes + 1, 32), { level: 9 });
    expect(() => validar(t, { ...e, archivoSha256: sha256(bomba) }, bomba)).toThrow(/mayor que/);
  });

  // N16 · configuración alterada pero rejugada con el motor: reproducirArena y la huella pasan; la configuración no.
  async function rejugar(config: ConfigArena, original: RegistroArena, t: TorneoArchivado, e: EncuentroTorneo): Promise<{ e: EncuentroTorneo; bytes: Buffer }> {
    const controlador = (lado: Lado): ControladorEquipo => {
      let ronda = 0;
      const id = t.participantes.find(p => p.id === e[lado].participante)!.controlador;
      return { id, tipo: "programado", async decidir(obs) { const o = original.rondas[ronda++]?.decisiones[lado].ordenes; return o ? { ...o, observacion: obs.id } : null; } };
    };
    const registro = await ejecutarArena(config, { local: controlador("local"), visita: controlador("visita") }, { esperaMs: ARENA.esperaMs });
    const bytes = gzipSync(JSON.stringify(registro), { level: 9 }), cifras = cifrasDeRegistro(registro);
    const lado = (l: Lado) => ({ ...e[l], club: registro.config.partido[l].nombre, goles: registro.final.marcador[l], cifras: cifras[l], declarado: { ...e[l].declarado, ...constaEnArchivo(registro, l) } });
    return { e: { ...e, archivoSha256: sha256(bytes), local: lado("local"), visita: lado("visita") }, bytes };
  }
  it("N16 · nivel, clima o formación alterados y rejugados se rechazan; el caso de control pasa", async () => {
    const t = t0(), e = t.encuentros[0]!, original = registroDe(readFileSync(join(FIXTURE, e.archivo)));
    const control = await rejugar(structuredClone(original.config), original, t, e);
    expect(() => validar(t, control.e, control.bytes)).not.toThrow();
    const nivel = structuredClone(original.config); nivel.partido.local.jugadores[0]!.nivel = nivel.partido.local.jugadores[0]!.nivel! + 1;
    const clima = structuredClone(original.config); clima.partido.condiciones!.clima = clima.partido.condiciones!.clima === "despejado" ? "niebla" : "despejado";
    const formacion = structuredClone(original.config); formacion.formaciones.local = formacion.formaciones.local === "4-4-2" ? "4-3-3" : "4-4-2";
    for (const config of [nivel, clima, formacion]) {
      const r = await rejugar(config, original, t, e);
      expect(() => validar(t, r.e, r.bytes)).toThrow(/configuración distinta/);
    }
    expect(LADOS_TORNEO).toEqual(["local", "visita"]);
  }, 60_000);
});
