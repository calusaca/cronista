// Brief 059 § 5.1 + § 15.5 (M23 adaptada: sin ruta GET en P1) · Lector de la página: id fuera de la regex o sin
// archivo → null (404); esquema o coherencia fallidos → «incoherente» (la página no muestra cifras).
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { leerIndice, leerTorneo } from "../torneo-archivo";

const FIXTURE = resolve("src/arena/__fixtures__/torneos");
let previo: string | undefined;
const dirs: string[] = [];
beforeEach(() => { previo = process.env.ARENA_TORNEOS_DIR; process.env.ARENA_TORNEOS_DIR = FIXTURE; });
afterEach(() => { if (previo === undefined) delete process.env.ARENA_TORNEOS_DIR; else process.env.ARENA_TORNEOS_DIR = previo; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe("059 · lector de torneos archivados", () => {
  it("lee el índice y el torneo del fixture", async () => {
    expect((await leerIndice()).map(x => x.id)).toEqual(["ensayo-059"]);
    const l = await leerTorneo("ensayo-059");
    expect(l?.estado).toBe("ok");
  });
  it("ids fuera de la regex o sin archivo → null (404)", async () => {
    for (const id of ["..", "../ensayo-059", "../torneos/ensayo-059", "e7", "99", "no-existe", "ENSAYO-059", "a/b"]) expect(await leerTorneo(id)).toBeNull();
  });
  it("esquema, JSON o coherencia fallidos, o id distinto del directorio → «incoherente»", async () => {
    const dir = mkdtempSync(join(tmpdir(), "torneo-archivo-")); dirs.push(dir);
    process.env.ARENA_TORNEOS_DIR = dir;
    const t = JSON.parse(readFileSync(join(FIXTURE, "ensayo-059", "torneo.json"), "utf8"));
    const casos: Record<string, string> = {
      extra: JSON.stringify({ ...t, id: "extra", tabla: [] }),
      roto: "{ no es json",
      plan: JSON.stringify({ ...t, id: "plan", encuentros: t.encuentros.map((e: { n: number; local: unknown; visita: unknown }) => e.n === 1 ? { ...e, local: e.visita, visita: e.local } : e) }),
      otro: JSON.stringify(t),
    };
    for (const [id, texto] of Object.entries(casos)) { cpSync(join(FIXTURE, "ensayo-059"), join(dir, id), { recursive: true }); writeFileSync(join(dir, id, "torneo.json"), texto); }
    // Sin índice no se sirve nada; con los casos en el índice, cada uno es «incoherente».
    for (const id of Object.keys(casos)) expect(await leerTorneo(id)).toBeNull();
    writeFileSync(join(dir, "indice.json"), JSON.stringify(Object.keys(casos).map(id => ({ id, inicioUtc: t.inicioUtc, titulo: t.titulo }))));
    for (const id of Object.keys(casos)) expect((await leerTorneo(id))?.estado).toBe("incoherente");
  });
  it("revisión Codex #1 · un directorio huérfano (coherente pero fuera de indice.json) no se sirve", async () => {
    const dir = mkdtempSync(join(tmpdir(), "torneo-archivo-")); dirs.push(dir);
    cpSync(FIXTURE, dir, { recursive: true });
    cpSync(join(dir, "ensayo-059"), join(dir, "huerfano"), { recursive: true });
    const t = JSON.parse(readFileSync(join(dir, "huerfano", "torneo.json"), "utf8"));
    writeFileSync(join(dir, "huerfano", "torneo.json"), JSON.stringify({ ...t, id: "huerfano" }));
    process.env.ARENA_TORNEOS_DIR = dir;
    expect(await leerTorneo("huerfano")).toBeNull();
    expect((await leerTorneo("ensayo-059"))?.estado).toBe("ok");
  });
});
