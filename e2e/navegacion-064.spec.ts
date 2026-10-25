// Brief 064 § 8.2 (bloque A) · Una sola navegación: `/` redirige con 307 (N1); la barra única CRONISTA · Arena · Torneo
// · ES/EN en la arena, el torneo y las rutas heredadas (N2, I1); el dataset a un clic desde el pie (N3, I3); sin
// desborde de 320 a 1440 px con el error del formulario visible (N4); la portada en /cronicas (N5).
// La crónica de un partido de la arena (/arena/cronica/<h>) es del bloque B (B8, v1.2).
import { expect, type Page, test } from "@playwright/test";

const TORNEO_FIXTURE = "ensayo-059";
const ARENA = ["/arena", "/arena/torneo", `/arena/torneo/${TORNEO_FIXTURE}`];
const HEREDADAS = ["/cronicas", "/match/246", "/liga", "/liga/1/1", "/datos"];
const RUTAS = [...ARENA, ...HEREDADAS];

async function abrir(page: Page, destino: string) {
  await page.goto(destino);
  await page.waitForLoadState("networkidle");
}

/** I1 · Una sola barra (landmark banner, el único <header> fuera de <main>) con dos enlaces de sección y un botón. */
async function barra(page: Page) {
  await expect(page.getByRole("banner")).toHaveCount(1);
  expect(await page.locator("header").evaluateAll((hs) => hs.filter((h) => !h.closest("main, article, section, aside, nav")).length)).toBe(1);
  const banner = page.getByRole("banner");
  const nav = banner.getByRole("navigation");
  const enlaces = await nav.getByRole("link").evaluateAll((as) => as.map((a) => ({ nombre: (a.textContent ?? "").trim(), href: a.getAttribute("href"), actual: a.getAttribute("aria-current") })));
  const botones = await nav.getByRole("button").count();
  const marca = await banner.locator("a.brand").getAttribute("href");
  const enBanner = await banner.getByRole("link").count();
  return { enlaces, botones, marca, enBanner, texto: (await banner.textContent()) ?? "" };
}

test.describe("064 · N1 raíz con 307", () => {
  for (const [desde, hacia] of [["/", "/arena"], ["/?lang=es", "/arena?lang=es"], ["/?perspectiva=visita", "/cronicas?perspectiva=visita"], ["/?partido=abc&lang=es", "/arena?partido=abc&lang=es"]] as const) {
    test(`${desde} → 307 ${hacia}`, async ({ request, baseURL }) => {
      const r = await request.get(desde, { maxRedirects: 0 });
      expect(r.status()).toBe(307);
      const destino = new URL(r.headers().location!, baseURL);
      expect(destino.origin).toBe(new URL(baseURL!).origin);
      expect(destino.pathname + destino.search).toBe(hacia);
    });
  }
  test("seguir la redirección de / abre la arena; la de /?perspectiva=visita abre la crónica de esa afición", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL((u) => u.pathname === "/arena");
    await expect(page.locator("main.arena-shell")).toBeVisible();
    await page.goto("/?perspectiva=visita");
    await expect(page).toHaveURL((u) => u.pathname === "/cronicas" && u.search === "?perspectiva=visita");
    await expect(page.locator('[data-perspective="visita"]')).toHaveAttribute("aria-current", "true");
  });
});

test.describe("064 · N2 barra única (I1)", () => {
  for (const ruta of RUTAS) {
    test(`${ruta}: una barra con Arena · Tournament y el botón de idioma; la marca a /arena`, async ({ page }) => {
      await abrir(page, ruta);
      const b = await barra(page);
      expect(b.enlaces.map((a) => a.nombre)).toEqual(["Arena", "Tournament"]);
      expect(b.enlaces.map((a) => a.href)).toEqual(["/arena", "/arena/torneo"]);
      expect(b.botones).toBe(1);
      expect(b.enBanner).toBe(3);
      expect(b.marca).toBe("/arena");
      for (const viejo of ["Match reports", "League mode", "Data", "Lab", "Team agents lab", "Model tournament"]) expect(b.texto).not.toContain(viejo);
      const actual = b.enlaces.filter((a) => a.actual === "page").map((a) => a.nombre);
      expect(actual).toEqual(ruta === "/arena" ? ["Arena"] : ruta.startsWith("/arena/torneo") ? ["Tournament"] : []);
      await expect(page.getByRole("banner").getByRole("button", { name: "Switch to Spanish" })).toBeVisible();
    });
  }

  test("tras ES en la arena, los dos enlaces y la marca llevan ?lang=es y «Torneo»", async ({ page }) => {
    await abrir(page, "/arena");
    await page.getByRole("banner").getByRole("button", { name: "Switch to Spanish" }).click();
    const b = await barra(page);
    expect(b.enlaces.map((a) => [a.nombre, a.href])).toEqual([["Arena", "/arena?lang=es"], ["Torneo", "/arena/torneo?lang=es"]]);
    expect(b.marca).toBe("/arena?lang=es");
    await expect(page.getByRole("banner").getByRole("button", { name: "Cambiar a inglés" })).toBeVisible();
  });

  test("en una ruta heredada, ES cambia la barra (no el marco) y ?lang=es arranca en español", async ({ page }) => {
    await abrir(page, "/match/246");
    await page.getByRole("banner").getByRole("button", { name: "Switch to Spanish" }).click();
    let b = await barra(page);
    expect(b.enlaces.map((a) => [a.nombre, a.href])).toEqual([["Arena", "/arena?lang=es"], ["Torneo", "/arena/torneo?lang=es"]]);
    await expect(page.getByTestId("reports-link")).toHaveText("Featured match");
    await abrir(page, "/datos?lang=es");
    b = await barra(page);
    expect(b.enlaces.map((a) => a.nombre)).toEqual(["Arena", "Torneo"]);
    expect(b.marca).toBe("/arena?lang=es");
  });

  test("la tira de las heredadas no es un <header> ni una región y conserva sus enlaces", async ({ page }) => {
    for (const ruta of HEREDADAS) {
      await abrir(page, ruta);
      const tira = page.locator("nav.cronicas-herramientas");
      await expect(tira).toHaveCount(1);
      await expect(tira).toHaveAccessibleName("90-minute simulator");
      await expect(tira).toContainText("90-minute simulator · separate from the arena");
      expect(await tira.evaluate((n) => n.closest("header") === null && n.getAttribute("role") === null)).toBe(true);
      expect(await tira.getByRole("link").evaluateAll((as) => as.map((a) => [(a.textContent ?? "").trim(), a.getAttribute("href")]))).toEqual([["Featured match", "/cronicas"], ["League mode", "/liga"], ["Data", "/datos"]]);
    }
  });
});

test.describe("064 · N3 dataset a un clic (I3)", () => {
  test("desde /arena, «Synthetic dataset» del pie abre /datos", async ({ page }) => {
    await abrir(page, "/arena");
    const enlace = page.getByRole("contentinfo").getByTestId("dataset-link");
    await expect(enlace).toHaveText("Synthetic dataset");
    await expect(enlace).toHaveAttribute("href", "/datos");
    await enlace.click();
    await expect(page).toHaveURL((u) => u.pathname === "/datos");
    await expect(page.getByRole("heading", { level: 1, name: "The CRONISTA match dataset" })).toBeVisible();
  });

  test("/arena/torneo también tiene el pie con el dataset; en ES dice «Dataset sintético»", async ({ page, request }) => {
    await abrir(page, "/arena/torneo");
    await expect(page.getByTestId("dataset-link")).toHaveAttribute("href", "/datos");
    await page.getByRole("banner").getByRole("button", { name: "Switch to Spanish" }).click();
    await expect(page.getByTestId("dataset-link")).toHaveText("Dataset sintético");
    const r = await request.get("/datos");
    expect(r.status()).toBe(200);
    expect(await r.text()).toContain("The CRONISTA match dataset");
  });
});

test.describe("064 · N4 sin desborde", () => {
  const SELECTORES = { simulate: '[data-testid="simulate"]', random: '[data-testid="random-match"]', reports: '[data-testid="reports-link"]', arena: '[data-testid="arena-link"]', torneo: '[data-testid="torneo-link"]', alerta: '.sim-form [role="alert"]' };
  const medir = (page: Page) => page.evaluate((sel) => ({
    ancho: innerWidth,
    scroll: document.documentElement.scrollWidth,
    derechas: Object.fromEntries(Object.entries(sel).map(([id, s]) => { const e = document.querySelector(s); return [id, e ? e.getBoundingClientRect().right : null]; })),
    // Disposición de la tira (061 V1 trasladado): hasta 1279 px el formulario va en su propia fila, bajo rótulo y enlaces.
    tira: (() => {
      const cabeza = document.querySelector(".cronicas-herramientas .cronicas-cabeza"), form = document.querySelector(".cronicas-herramientas .sim-form");
      return cabeza && form ? { cabezaAbajo: cabeza.getBoundingClientRect().bottom, formArriba: form.getBoundingClientRect().top } : null;
    })(),
  }), SELECTORES);
  const comprobar = async (page: Page, contexto: string, heredada: boolean) => {
    const m = await medir(page);
    expect(m.scroll, `${contexto}: scrollWidth`).toBeLessThanOrEqual(m.ancho);
    for (const [id, x] of Object.entries(m.derechas)) {
      const propio = id === "arena" || id === "torneo" || heredada;
      if (!propio) continue;
      expect(x, `${contexto}: falta ${id}`).not.toBeNull();
      expect(x!, `${contexto}: ${id}`).toBeLessThanOrEqual(m.ancho);
    }
    if (heredada) {
      expect(m.tira, `${contexto}: falta la tira`).not.toBeNull();
      if (m.ancho <= 1279) expect(m.tira!.formArriba, `${contexto}: el formulario va en su propia fila`).toBeGreaterThanOrEqual(m.tira!.cabezaAbajo - 1);
    }
  };
  async function conError(page: Page) {
    await page.getByTestId("seed-input").fill("abc");
    await page.getByTestId("simulate").click();
    await expect(page.locator('.sim-form [role="alert"]')).toBeVisible();
  }

  test("/match/246 de 320 a 1440 px en pasos de 20, con el error visible", async ({ page }) => {
    await abrir(page, "/match/246");
    await conError(page);
    for (let w = 320; w <= 1440; w += 20) {
      await page.setViewportSize({ width: w, height: 900 });
      await comprobar(page, `/match/246 ${w} px`, true);
    }
  });

  for (const ruta of RUTAS.filter((r) => r !== "/match/246")) {
    test(`${ruta}: 360, 480/481, 900/901 y 1279/1280 en claro y 360 en oscuro`, async ({ page }) => {
      const heredada = HEREDADAS.includes(ruta);
      await page.emulateMedia({ colorScheme: "light" });
      await abrir(page, ruta);
      if (heredada) await conError(page);
      for (const w of [360, 480, 481, 900, 901, 1279, 1280]) {
        await page.setViewportSize({ width: w, height: 900 });
        await comprobar(page, `${ruta} ${w} px claro`, heredada);
      }
      await page.emulateMedia({ colorScheme: "dark" });
      await page.setViewportSize({ width: 360, height: 780 });
      await comprobar(page, `${ruta} 360 px oscuro`, heredada);
    });
  }
});

test("064 · N5 /cronicas muestra la crónica destacada y la tira marca «Featured match»", async ({ page }) => {
  await abrir(page, "/cronicas");
  await expect(page.getByTestId("featured-match")).toBeVisible();
  await expect(page.getByTestId("sentence").first()).toBeVisible();
  await expect(page.locator('nav.cronicas-herramientas [aria-current="page"]')).toHaveText("Featured match");
  await expect(page.getByTestId("reports-link")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("to-arena")).toHaveAttribute("href", "/arena");
});
