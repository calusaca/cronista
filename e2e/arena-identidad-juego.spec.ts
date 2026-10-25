// Brief 063 · publicación 3 (reinicios-v8) · D4 y smoke visual del bloque D: la tarjeta de alineaciones muestra la
// identidad de juego de cada club (píldora y descripción legible en un <details>) y la del entrenador una línea, en EN y
// ES a 360 px sin desbordes; una grabación v7 no muestra nada de esto. Smoke: dos partidos con identidades contrastadas
// (presión frente a defensivo y directo frente a posesión), con la píldora, una posición media del bloque y los balones
// largos de cada lado. Capturas en docs/evidencia/motor-063/smoke-d/. Las semillas se buscan dentro del spec y los textos
// esperados salen de las constantes; ninguna cifra se repite a mano.
import { mkdir, readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { transformar } from "../src/arena/catalogo";
import { crearControladorProgramado } from "../src/arena/controladores";
import { ejecutarArena } from "../src/arena/coordinador";
import { crearConfigArena } from "../src/arena/motor";
import { lados, type EstiloJuego, type RegistroArena } from "../src/arena/tipos";
import { ARENA, ESTILO_JUEGO_ARENA as EJ, LOTE_ARENA_046 } from "../src/sim/limites";

test.describe.configure({ mode: "serial" });

const EVIDENCIA = "docs/evidencia/motor-063/smoke-d";
const FIXTURE_V8 = "src/arena/__fixtures__/arena-reinicios-v8.json", FIXTURE_V7 = "src/arena/__fixtures__/arena-reinicios-v7.json";
const LIMITES = { en: "Each club's playing identity is derived from its name", es: "La identidad de juego del club se deriva de su nombre" };
const PREFIJO = { en: "Identity", es: "Identidad" }, ENTRENADOR = { en: "Club identity", es: "Identidad del club" };
/** Ventana alta: la cancha entera queda visible bajo la cabecera fija del sitio. */
const VENTANA = { width: 1440, height: 1600 }, MOVIL = { width: 360, height: 780 };
/** Valores propios del smoke: semillas de la búsqueda y duración de los partidos contrastados. */
const BUSQUEDA = { semillas: 400, duracionS: LOTE_ARENA_046.duracionS };

async function importar(page: Page, nombre: string, datos: Buffer, local: string, ventana = VENTANA) {
  await page.setViewportSize(ventana);
  await page.goto("/arena");
  await page.getByRole("button", { name: "Saved matches", exact: true }).click();
  const respuesta = page.waitForResponse(r => new URL(r.url()).pathname === "/api/arena" && r.request().method() === "POST");
  await page.getByLabel("Open saved run", { exact: true }).setInputFiles({ name: nombre, mimeType: "application/json", buffer: datos });
  expect((await respuesta).ok()).toBe(true);
  await expect(page.locator(".arena-score")).toContainText(local);
}
const sinDesborde = async (page: Page, ancho: number) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho);
const pildora = (page: Page, lado: string) => page.locator(`[data-testid="arena-lineup"][data-side="${lado}"]`).getByTestId("arena-lineup-identity");

test("063 D4 · píldora de identidad y su descripción en la tarjeta de alineaciones y línea en la del entrenador, EN y ES a 360 px; ausentes con el fixture v7", async ({ page }) => {
  await mkdir(EVIDENCIA, { recursive: true });
  const datos = await readFile(FIXTURE_V8), r = JSON.parse(datos.toString("utf8")) as RegistroArena;
  const estilos = r.config.estilosJuego!;
  expect(estilos.local).not.toBe(estilos.visita);
  await importar(page, "arena-reinicios-v8.json", datos, r.config.partido.local.nombre, MOVIL);
  const tarjeta = page.getByTestId("arena-lineups");
  await expect(tarjeta).toBeVisible();
  for (const idioma of ["en", "es"] as const) {
    if (idioma === "es") await page.getByRole("button", { name: "Switch to Spanish" }).click();
    for (const lado of lados) {
      await expect(pildora(page, lado)).toHaveText(`${PREFIJO[idioma]}: ${EJ.etiquetas[idioma][estilos[lado]]}`);
      await expect(pildora(page, lado)).toHaveAttribute("data-estilo", estilos[lado]);
      const detalles = page.locator(`[data-testid="arena-lineup"][data-side="${lado}"]`).getByTestId("arena-lineup-identity-details");
      await detalles.locator("summary").click();
      await expect(detalles).toContainText(EJ.descripciones[idioma][estilos[lado]]);
      await expect(page.getByTestId(`arena-coach-${lado}`).getByTestId("arena-coach-identity")).toHaveText(`${ENTRENADOR[idioma]}: ${EJ.etiquetas[idioma][estilos[lado]]}`);
    }
    await sinDesborde(page, MOVIL.width);
    const local = page.locator('[data-testid="arena-lineup"][data-side="local"]');
    await local.scrollIntoViewIfNeeded();
    await local.screenshot({ path: `${EVIDENCIA}/alineacion-identidad-${idioma}-360.png` });
    await page.getByTestId("arena-coach-local").scrollIntoViewIfNeeded();
    await page.getByTestId("arena-coach-local").screenshot({ path: `${EVIDENCIA}/entrenador-identidad-${idioma}-360.png` });
    for (const lado of lados) await page.locator(`[data-testid="arena-lineup"][data-side="${lado}"]`).getByTestId("arena-lineup-identity-details").locator("summary").click();
  }
  // Texto de límites del bloque D (ES; luego EN).
  const limites = page.locator(".arena-limits");
  await limites.locator("summary").click();
  await expect(limites).toContainText(LIMITES.es);
  await page.getByRole("button", { name: "Cambiar a inglés" }).click();
  await expect(limites).toContainText(LIMITES.en);

  // Fixture v7: ni píldora, ni descripción, ni línea del entrenador, ni frase de límites.
  const v7 = await readFile(FIXTURE_V7), r7 = JSON.parse(v7.toString("utf8")) as RegistroArena;
  await importar(page, "arena-reinicios-v7.json", v7, r7.config.partido.local.nombre, MOVIL);
  await expect(page.getByTestId("arena-lineups")).toBeVisible();
  await expect(page.getByTestId("arena-lineup-identity")).toHaveCount(0);
  await expect(page.getByTestId("arena-lineup-identity-details")).toHaveCount(0);
  await expect(page.getByTestId("arena-coach-identity")).toHaveCount(0);
  await page.locator(".arena-limits summary").click();
  await expect(page.locator(".arena-limits")).not.toContainText(LIMITES.en);
  await sinDesborde(page, MOVIL.width);
});

/** Primera semilla cuyos dos clubes tienen exactamente las dos identidades pedidas (en cualquier lado). */
function semillaCon(a: EstiloJuego, b: EstiloJuego): number {
  for (let seed = 1; seed <= BUSQUEDA.semillas; seed++) {
    const e = crearConfigArena({ seed, duracionS: BUSQUEDA.duracionS }).estilosJuego!;
    if ((e.local === a && e.visita === b) || (e.local === b && e.visita === a)) return seed;
  }
  throw new Error(`Sin semilla ${a} frente a ${b}`);
}
/** x orientada media de los de campo de `lado` con el balón en el rival, fuera de pausa (fotogramas del registro). */
function bloqueMedio(r: RegistroArena, lado: "local" | "visita"): number {
  let suma = 0, n = 0;
  for (const f of r.fotogramas) {
    const p = f.jugadores.find(j => j.id === f.balon.poseedor);
    if (!p || p.lado === lado || (f.pausa && f.tick < f.pausa.hastaTick)) continue;
    for (const j of f.jugadores) if (j.lado === lado && j.puesto !== "POR") { suma += transformar(j.posicion, lado).x; n++; }
  }
  return suma / n;
}

for (const [a, b] of [["presion", "defensivo"], ["directo", "posesion"]] as const) {
  test(`063 D smoke · ${a} frente a ${b}: píldoras, posición media del bloque y balones largos de cada lado`, async ({ page }) => {
    test.setTimeout(180_000);
    await mkdir(EVIDENCIA, { recursive: true });
    const seed = semillaCon(a, b);
    const r = await ejecutarArena(crearConfigArena({ seed, duracionS: BUSQUEDA.duracionS }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
    const estilos = r.config.estilosJuego!, ladoDe = (e: EstiloJuego) => estilos.local === e ? "local" as const : "visita" as const;
    const resumen = Object.fromEntries(lados.map(lado => [estilos[lado], { lado, club: r.config.partido[lado].nombre, bloqueMedioM: Math.round(bloqueMedio(r, lado) * 10) / 10,
      largos: r.eventos.filter(e => e.tipo === "pase" && e.motivo === "largo" && e.lado === lado).length, lejanos: r.eventos.filter(e => e.tipo === "tiro" && e.motivo === "lejano" && e.lado === lado).length }]));
    console.log(`[063 smoke D ${a}-${b}]`, JSON.stringify({ seed, duracionS: BUSQUEDA.duracionS, reglas: r.config.reglas, resumen }));
    await importar(page, `arena-${a}-${b}.json`, Buffer.from(JSON.stringify(r)), r.config.partido.local.nombre);
    for (const e of [a, b]) await expect(pildora(page, ladoDe(e))).toHaveAttribute("data-estilo", e);
    await page.getByTestId("arena-lineups").screenshot({ path: `${EVIDENCIA}/${a}-${b}-alineaciones.png` });
    // Un fotograma con el balón en el equipo de `b` y el de `a` defendiendo (fuera de pausa), a mitad de partido.
    const defiende = ladoDe(a), medio = r.fotogramas.length / 2;
    const f = r.fotogramas.map((x, k) => ({ x, k })).filter(({ x }) => { const p = x.jugadores.find(j => j.id === x.balon.poseedor); return p && p.lado !== defiende && !(x.pausa && x.tick < x.pausa.hastaTick); })
      .sort((p, q) => Math.abs(p.k - medio) - Math.abs(q.k - medio))[0]!.x;
    await page.getByRole("slider", { name: "Match time" }).fill(String(Math.round(f.tick * ARENA.pasoS * 10) / 10));
    await page.getByTestId("arena-pitch").screenshot({ path: `${EVIDENCIA}/${a}-${b}-bloque-${a}-defiende.png` });
    console.log(`[063 smoke D ${a}-${b} fotograma]`, JSON.stringify({ s: f.tick * ARENA.pasoS, defiende: a, bloqueM: Math.round(f.jugadores.filter(j => j.lado === defiende && j.puesto !== "POR").reduce((s, j) => s + transformar(j.posicion, defiende).x, 0) / f.jugadores.filter(j => j.lado === defiende && j.puesto !== "POR").length * 10) / 10 }));
  });
}
