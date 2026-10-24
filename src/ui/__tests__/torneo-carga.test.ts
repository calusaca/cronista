// Brief 059 § 15.8 · Carga de un partido del torneo en /arena: torneo.json estático validado, .gz estático
// descomprimido con DecompressionStream, precedencia de parámetros y error sin DecompressionStream.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TorneoArchivado } from "../../arena/torneo";
import { cargarEncuentroTorneo, peticionDeUrl, SinDescompresion } from "../torneo-carga";

const DIR = "src/arena/__fixtures__/torneos/ensayo-059";
const torneo = JSON.parse(readFileSync(`${DIR}/torneo.json`, "utf8")) as TorneoArchivado;
const servidor = (sobre: Record<string, () => Response> = {}) => vi.fn(async (url: string | URL | Request) => {
  const ruta = String(url);
  if (sobre[ruta]) return sobre[ruta]!();
  const m = ruta.match(/^\/torneos\/ensayo-059\/(torneo\.json|e\d{2}\.json\.gz)$/);
  if (!m) return new Response("no", { status: 404 });
  return new Response(readFileSync(`${DIR}/${m[1]}`), { headers: { "content-type": m[1] === "torneo.json" ? "application/json" : "application/gzip" } });
}) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
afterEach(() => vi.unstubAllGlobals());

describe("059 · carga de un partido del torneo (§ 15.8)", () => {
  it("descomprime el registro archivado y devuelve la procedencia de torneo.json", async () => {
    const f = servidor();
    const r = await cargarEncuentroTorneo({ torneo: "ensayo-059", encuentro: "03" }, new AbortController().signal, f);
    expect(r.registro).toEqual(JSON.parse(gunzipSync(readFileSync(`${DIR}/e03.json.gz`)).toString("utf8")));
    const e = torneo.encuentros.find(x => x.n === 3)!, nombre = (id: string) => torneo.participantes.find(p => p.id === id)!.nombre;
    expect(r.origen).toEqual({ id: "ensayo-059", n: 3, inicioUtc: torneo.inicioUtc, local: { club: e.local.club, modelo: nombre(e.local.participante) }, visita: { club: e.visita.club, modelo: nombre(e.visita.participante) } });
    expect(f.mock.calls.map(c => String(c[0]))).toEqual(["/torneos/ensayo-059/torneo.json", "/torneos/ensayo-059/e03.json.gz"]);
  });
  it("un encuentro que no está en torneo.json, un torneo incoherente o inexistente fallan antes de pedir el registro", async () => {
    const s = new AbortController().signal;
    const f = servidor();
    await expect(cargarEncuentroTorneo({ torneo: "ensayo-059", encuentro: "99" }, s, f)).rejects.toThrow(/encuentro/);
    expect(f.mock.calls.some(c => String(c[0]).endsWith(".gz"))).toBe(false);
    await expect(cargarEncuentroTorneo({ torneo: "no-existe", encuentro: "01" }, s, servidor())).rejects.toThrow();
    const alterado = { ...torneo, encuentros: torneo.encuentros.map(e => e.n === 2 ? { ...e, local: e.visita, visita: e.local } : e) };
    await expect(cargarEncuentroTorneo({ torneo: "ensayo-059", encuentro: "01" }, s, servidor({ "/torneos/ensayo-059/torneo.json": () => Response.json(alterado) }))).rejects.toThrow(/incoherente/);
    await expect(cargarEncuentroTorneo({ torneo: "../x", encuentro: "01" }, s, servidor())).rejects.toThrow(/inválida/);
  });
  it("sin DecompressionStream: error propio, sin descargar el registro", async () => {
    vi.stubGlobal("DecompressionStream", undefined);
    const f = servidor();
    await expect(cargarEncuentroTorneo({ torneo: "ensayo-059", encuentro: "01" }, new AbortController().signal, f)).rejects.toBeInstanceOf(SinDescompresion);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("revisión Codex #2 · intercambiar dos registros válidos se rechaza: por la huella, y con las huellas también intercambiadas, por semilla, clubes o lados", async () => {
    const s = new AbortController().signal, gz = (n: string) => () => new Response(readFileSync(`${DIR}/e${n}.json.gz`));
    // El servidor devuelve el registro de P2 en la URL de P1.
    await expect(cargarEncuentroTorneo({ torneo: "ensayo-059", encuentro: "01" }, s, servidor({ "/torneos/ensayo-059/e01.json.gz": gz("02") }))).rejects.toThrow(/huella/);
    // torneo.json con las huellas de dos partidos intercambiadas (sigue siendo coherente) y los archivos también.
    const cruzar = (a: number, b: number) => {
      const ha = torneo.encuentros.find(x => x.n === a)!.archivoSha256, hb = torneo.encuentros.find(x => x.n === b)!.archivoSha256;
      const t = { ...torneo, encuentros: torneo.encuentros.map(x => x.n === a ? { ...x, archivoSha256: hb } : x.n === b ? { ...x, archivoSha256: ha } : x) };
      return servidor({ "/torneos/ensayo-059/torneo.json": () => Response.json(t), [`/torneos/ensayo-059/e0${a}.json.gz`]: gz(`0${b}`), [`/torneos/ensayo-059/e0${b}.json.gz`]: gz(`0${a}`) });
    };
    // P1 y P2: otro cruce (otra semilla y otros clubes).
    await expect(cargarEncuentroTorneo({ torneo: "ensayo-059", encuentro: "01" }, s, cruzar(1, 2))).rejects.toThrow(/no corresponde/);
    // P1 y P4: ida y vuelta del mismo cruce (misma semilla y mismos clubes): los lados delatan el cambio.
    expect(torneo.encuentros.find(x => x.n === 1)!.seed).toBe(torneo.encuentros.find(x => x.n === 4)!.seed);
    await expect(cargarEncuentroTorneo({ torneo: "ensayo-059", encuentro: "01" }, s, cruzar(1, 4))).rejects.toThrow(/no corresponde/);
  });
  it("un registro servido ya descomprimido (Content-Encoding) no supera la huella del archivo íntegro", async () => {
    const plano = gunzipSync(readFileSync(`${DIR}/e01.json.gz`));
    const f = servidor({ "/torneos/ensayo-059/e01.json.gz": () => new Response(plano, { headers: { "content-encoding": "gzip" } }) });
    await expect(cargarEncuentroTorneo({ torneo: "ensayo-059", encuentro: "01" }, new AbortController().signal, f)).rejects.toThrow(/huella/);
  });
  it("precedencia: partido gana sobre torneo; torneo sin encuentro de dos dígitos se ignora", () => {
    expect(peticionDeUrl(new URLSearchParams("torneo=ensayo-059&encuentro=07"))).toEqual({ torneo: "ensayo-059", encuentro: "07" });
    expect(peticionDeUrl(new URLSearchParams("partido=abc&torneo=ensayo-059&encuentro=07"))).toBeNull();
    for (const q of ["torneo=ensayo-059", "torneo=ensayo-059&encuentro=7", "torneo=ensayo-059&encuentro=e7", "torneo=..&encuentro=07", "encuentro=07"]) expect(peticionDeUrl(new URLSearchParams(q))).toBeNull();
  });
});

describe("062 · § 7.6 · un torneo lanzado en el sitio se carga por /api/arena/torneos/sitio/<id>", () => {
  const ID = "sitio-2026-10-20", DS = "src/arena/__fixtures__/torneos-sitio";
  const sitio = vi.fn(async (url: string | URL | Request) => {
    const ruta = String(url);
    if (ruta === `/api/arena/torneos/sitio/${ID}`) return new Response(readFileSync(`${DS}/${ID}.torneo.json`), { headers: { "content-type": "application/json" } });
    const m = ruta.match(new RegExp(`^/api/arena/torneos/sitio/${ID}/(e\\d{2}\\.json\\.gz)$`));
    return m ? new Response(readFileSync(`${DS}/${ID}.${m[1]}`), { headers: { "content-type": "application/gzip" } }) : new Response("no", { status: 404 });
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
  it("instantánea por la ruta [id] (esquema 062) y registro por la ruta [archivo], con las mismas comprobaciones", async () => {
    const r = await cargarEncuentroTorneo({ torneo: ID, encuentro: "03" }, new AbortController().signal, sitio);
    expect(r.registro).toEqual(JSON.parse(gunzipSync(readFileSync(`${DS}/${ID}.e03.json.gz`)).toString("utf8")));
    expect(r.origen.id).toBe(ID);
    expect(sitio.mock.calls.map(c => String(c[0]))).toEqual([`/api/arena/torneos/sitio/${ID}`, `/api/arena/torneos/sitio/${ID}/e03.json.gz`]);
    expect(peticionDeUrl(new URLSearchParams(`torneo=${ID}&encuentro=03`))).toEqual({ torneo: ID, encuentro: "03" });
  });
});
