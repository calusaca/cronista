// Brief 063 · publicación 1 (reinicios-v6) · smoke visual del bloque A: tres fotogramas consecutivos de un
// episodio superado con los defensas desplazándose hacia su arco, un delantero que persigue y se detiene en
// la línea media, y el texto de límites ES/EN (ausente en una grabación v5). Capturas en
// docs/evidencia/motor-063/smoke-a/. Las escenas se buscan dentro del spec; ninguna cifra se repite a mano.
import { mkdir, readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { lineaDePuesto } from "../src/arena/atributos";
import { crearControladorProgramado } from "../src/arena/controladores";
import { ejecutarArena } from "../src/arena/coordinador";
import { crearConfigArena } from "../src/arena/motor";
import { limiteXPersecucion, perseguidoresDe, seleccionRepliegue, superadoPor } from "../src/arena/persecucion";
import { transformar } from "../src/arena/catalogo";
import type { EstadoArena, RegistroArena } from "../src/arena/tipos";
import { ARENA, LOTE_ARENA_046 as L } from "../src/sim/limites";

const EVIDENCIA = "docs/evidencia/motor-063/smoke-a";
const FRASE = { en: "Beaten defenders run back towards their goal", es: "Los defensores superados corren hacia su arco" };
/** Valores propios del smoke: semillas de la búsqueda, margen del balón por debajo de la mitad y
 * holgura (m) del delantero respecto de su límite. */
const BUSQUEDA = { semillas: 60, balonPorDebajoM: 8, holguraM: 1.5, avanceMinM: 1, sinGolPrevioS: 10, sigueS: 1 };
/** Ventana alta: la cancha entera queda visible bajo la cabecera fija del sitio. */
const VENTANA = { width: 1440, height: 1600 };

const cursor = async (page: Page, segundos: number) => { await page.getByRole("slider", { name: "Match time" }).fill(String(Math.round(segundos * 10) / 10)); };
const fichas = (page: Page) => page.getByTestId("arena-player").evaluateAll(els => Object.fromEntries(els.map(el => {
  const m = /translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/.exec(el.getAttribute("transform") ?? "")!;
  return [el.getAttribute("data-player")!, { x: Number(m[1]), y: Number(m[2]) }];
})) as Record<string, { x: number; y: number }>);
async function importar(page: Page, nombre: string, datos: Buffer, local: string) {
  await page.setViewportSize(VENTANA);
  await page.goto("/arena");
  await page.getByRole("button", { name: "Saved matches", exact: true }).click();
  const respuesta = page.waitForResponse(r => new URL(r.url()).pathname === "/api/arena" && r.request().method() === "POST");
  await page.getByLabel("Open saved run", { exact: true }).setInputFiles({ name: nombre, mimeType: "application/json", buffer: datos });
  expect((await respuesta).ok()).toBe(true);
  await expect(page.locator(".arena-score")).toContainText(local);
}
const enJuego = (f: EstadoArena) => !f.saque && !(f.pausa && f.tick < f.pausa.hastaTick);
const limites = (page: Page) => page.locator(".arena-limits");

test("063 A · repliegue en tres fotogramas consecutivos y texto de límites ES/EN (fixture reinicios-v6); la grabación v5 no lo menciona", async ({ page }) => {
  await mkdir(EVIDENCIA, { recursive: true });
  const datos = await readFile("src/arena/__fixtures__/arena-reinicios-v6.json");
  const r = JSON.parse(datos.toString("utf8")) as RegistroArena;
  const paso = Math.round(ARENA.fotogramaS / ARENA.pasoS);
  // Tres fotogramas consecutivos (fotogramaS) con el mismo poseedor superado y al menos dos en repliegue.
  const escena = r.fotogramas.flatMap((f, i) => {
    const s = enJuego(f) ? superadoPor(f) : null;
    if (!s) return [];
    const ids = seleccionRepliegue(f, perseguidoresDe(f.jugadores, f.balon.posicion)).map(j => j.id);
    const siguientes = [1, 2].map(k => r.fotogramas.find(g => g.tick === f.tick + k * paso));
    const continua = siguientes.every(g => g && enJuego(g) && superadoPor(g)?.id === s.id);
    return ids.length >= 2 && continua ? [{ tick: f.tick, ids, defiende: r.fotogramas[i]!.jugadores.find(j => j.id === ids[0])!.lado }] : [];
  })[0];
  expect(escena).toBeDefined();
  await importar(page, "arena-reinicios-v6.json", datos, r.config.partido.local.nombre);
  const posiciones: Record<string, { x: number; y: number }>[] = [];
  for (const k of [0, 1, 2]) {
    await cursor(page, (escena!.tick + k * paso) * ARENA.pasoS);
    posiciones.push(await fichas(page));
    await page.getByTestId("arena-pitch").screenshot({ path: `${EVIDENCIA}/repliegue-${k + 1}.png` });
  }
  // Cada defensa en repliegue se desplaza hacia su arco del primer al tercer fotograma.
  for (const id of escena!.ids) {
    const avance = transformar(posiciones[0]![id]!, escena!.defiende).x - transformar(posiciones[2]![id]!, escena!.defiende).x;
    expect({ id, haciaSuArco: avance >= BUSQUEDA.avanceMinM }).toEqual({ id, haciaSuArco: true });
  }
  await limites(page).locator("summary").click();
  await expect(limites(page)).toContainText(FRASE.en);
  await limites(page).screenshot({ path: `${EVIDENCIA}/limites-en.png` });
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  await expect(limites(page)).toContainText(FRASE.es);
  await limites(page).screenshot({ path: `${EVIDENCIA}/limites-es.png` });

  const v5 = await readFile("src/arena/__fixtures__/arena-reinicios-v5.json");
  await importar(page, "arena-reinicios-v5.json", v5, (JSON.parse(v5.toString("utf8")) as RegistroArena).config.partido.local.nombre);
  await limites(page).locator("summary").click();
  await expect(limites(page)).not.toContainText(FRASE.en);
});

test("063 A · un delantero que pierde el balón lo persigue y se detiene en la línea media", async ({ page }) => {
  test.setTimeout(180_000);
  await mkdir(EVIDENCIA, { recursive: true });
  // Busca, en partidos programados nuevos, un fotograma con un delantero perseguidor en su límite y el balón
  // del rival bastante por debajo de la mitad de su campo; un segundo después sigue en su límite y persiguiendo,
  // y no hubo gol en los segundos previos (el rótulo del gol taparía la escena).
  let hallado: { registro: RegistroArena; tick: number; id: string; lado: "local" | "visita"; limite: number } | undefined;
  for (let seed = 1; seed <= BUSQUEDA.semillas && !hallado; seed++) {
    const registro = await ejecutarArena(crearConfigArena({ seed, duracionS: L.duracionS }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
    const enLimite = (f: EstadoArena | undefined, id: string) => {
      const p = f?.persecucion, j = f && p?.jugador === id ? f.jugadores.find(x => x.id === id) : undefined;
      const poseedor = f?.jugadores.find(x => x.id === f.balon.poseedor);
      if (!f || !p || !j || lineaDePuesto(j.puesto) !== "DEL" || !poseedor || poseedor.lado === j.lado || !enJuego(f)) return null;
      const limite = limiteXPersecucion(j), xj = transformar(j.posicion, j.lado).x, xb = transformar(f.balon.posicion, j.lado).x;
      return xb < limite - BUSQUEDA.balonPorDebajoM && Math.abs(xj - limite) <= BUSQUEDA.holguraM ? { lado: j.lado, limite } : null;
    };
    const golReciente = (tick: number) => registro.eventos.some(e => e.tipo === "gol" && e.tick <= tick && e.tick > tick - BUSQUEDA.sinGolPrevioS / ARENA.pasoS);
    for (const f of registro.fotogramas) {
      const id = f.persecucion?.jugador, a = id ? enLimite(f, id) : null;
      const despues = registro.fotogramas.find(g => g.tick === f.tick + Math.round(BUSQUEDA.sigueS / ARENA.pasoS));
      if (!id || !a || f.tick % Math.round(ARENA.fotogramaS / ARENA.pasoS) !== 0 || !enLimite(despues, id) || golReciente(despues!.tick)) continue;
      hallado = { registro, tick: f.tick, id, lado: a.lado, limite: a.limite }; break;
    }
  }
  expect(hallado).toBeDefined();
  const { registro, tick, id, lado, limite } = hallado!;
  const x0 = transformar(registro.fotogramas.find(f => f.tick === tick)!.jugadores.find(j => j.id === id)!.posicion, lado).x;
  for (const ronda of registro.rondas) for (const d of Object.values(ronda.decisiones)) d.tiempoMs = 0;
  await importar(page, `arena-persecucion-${registro.config.partido.seed}.json`, Buffer.from(JSON.stringify(registro)), registro.config.partido.local.nombre);
  await page.getByTestId("arena-player").and(page.locator(`[data-player="${id}"]`)).click();
  for (const [k, s] of [tick * ARENA.pasoS, tick * ARENA.pasoS + BUSQUEDA.sigueS].entries()) {
    await cursor(page, s);
    const x = transformar((await fichas(page))[id]!, lado).x;
    expect(Math.abs(x - limite)).toBeLessThanOrEqual(BUSQUEDA.holguraM);
    await page.getByTestId("arena-pitch").screenshot({ path: `${EVIDENCIA}/delantero-en-la-mitad-${k + 1}.png` });
  }
  console.log("[063 smoke delantero]", JSON.stringify({ seed: registro.config.partido.seed, segundo: tick * ARENA.pasoS, jugador: id, xOrientada: x0, limite }));
});
