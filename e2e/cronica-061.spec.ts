// Brief 061 (v1.1) · Crónicas con la barra de la arena y un historial sin pantallas repetidas.
// § V3 «← Arena» (1–2) · § V2 misma semilla y perspectiva (3a–3c) · § V6 perspectiva con replace (4)
// · § V1 sin desborde con el error visible (5a–5b) · § 6.2.6 + § V5 misma identidad que la arena (6).
// Brief 064 § 8.4.3 · La portada pasa a /cronicas y los enlaces y el formulario a la tira nav.cronicas-herramientas.
import { expect, type Page, test } from "@playwright/test";

const largoHistoria = (page: Page) => page.evaluate(() => history.length);
const ruta = (page: Page) => { const u = new URL(page.url()); return u.pathname + u.search; };

/** Carga y espera la hidratación (sin ella, un clic en un enlace sería una navegación de documento). */
async function abrir(page: Page, destino: string) {
  await page.goto(destino);
  await page.waitForLoadState("networkidle");
}

/** Navegación cliente desde /datos a la portada por «Featured match» de la tira (064 § 8.4.3): un precedente conocido
 *  en el historial. La portada vive en /cronicas desde el 064. */
async function desdeDatosALaPortada(page: Page) {
  await abrir(page, "/datos");
  await page.getByTestId("reports-link").click();
  await expect(page).toHaveURL((u) => u.pathname === "/cronicas" && u.search === "");
  await expect(page.getByTestId("featured-match")).toBeVisible();
}

test.describe("061 · «← Arena» (v1.1 § V3)", () => {
  test("(1) desde /cronicas lleva a la arena con un push: Atrás vuelve a /cronicas y otro Atrás a /datos", async ({ page }) => {
    await desdeDatosALaPortada(page);
    await page.getByTestId("to-arena").click();
    await expect(page).toHaveURL((u) => u.pathname === "/arena");
    await expect(page.locator("main.arena-shell")).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL((u) => u.pathname === "/cronicas" && u.search === "");
    await expect(page.getByTestId("featured-match")).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL((u) => u.pathname === "/datos");
    await expect(page.getByTestId("data-page")).toBeVisible();
  });

  test("(2) en /match/246 está visible, se llama exactamente «Arena», va a /arena y cabe a 360 px", async ({ page }) => {
    await abrir(page, "/match/246");
    const enlace = page.getByTestId("to-arena");
    await expect(enlace).toBeVisible();
    await expect(enlace).toHaveAccessibleName("Arena");
    await expect(enlace).toHaveAttribute("href", "/arena");
    // Sin arena previa sigue el «Arena» de la barra única (064 § 3.5); la sección actual, «Featured match», está en la tira
    // y la barra no marca ninguna sección.
    await expect(page.getByTestId("arena-link")).toHaveAttribute("href", "/arena");
    await expect(page.getByTestId("arena-link")).toHaveText("Arena");
    await expect(page.locator('nav.cronicas-herramientas [aria-current="page"]')).toHaveText("Featured match");
    await expect(page.getByRole("banner").locator("[aria-current]")).toHaveCount(0);
    await page.setViewportSize({ width: 360, height: 780 });
    await expect(enlace).toBeInViewport();
    const caja = await enlace.boundingBox();
    expect(caja!.x).toBeGreaterThanOrEqual(0);
    expect(caja!.x + caja!.width).toBeLessThanOrEqual(360);
  });
});

test.describe("061 · misma semilla y perspectiva (v1.1 § V2)", () => {
  test("(3a) en /cronicas, tras un error, «Simulate match» con 246 no navega, limpia el error y no muestra espera", async ({ page }) => {
    await abrir(page, "/cronicas");
    const rsc: string[] = [];
    page.on("request", (r) => { if (r.headers().rsc === "1") rsc.push(new URL(r.url()).pathname); });
    await page.getByTestId("seed-input").fill("abc");
    await page.getByTestId("simulate").click();
    await expect(page.locator('.sim-form [role="alert"]')).toBeVisible();
    const antes = await largoHistoria(page);
    await page.getByTestId("seed-input").fill("246");
    await page.getByTestId("simulate").click();
    await expect(page.locator('.sim-form [role="alert"]')).toHaveCount(0);
    // Ventana de observación: sin la guarda, el push a /match/246 pide su RSC y muestra la espera en este tiempo.
    await page.waitForTimeout(1500);
    await expect(page.getByTestId("match-loading")).toBeHidden();
    expect(ruta(page)).toBe("/cronicas");
    expect(await largoHistoria(page)).toBe(antes);
    expect(rsc).toEqual([]);
  });

  for (const origen of ["/match/246?perspectiva=local", "/cronicas?perspectiva=visita"]) {
    test(`(3${origen.startsWith("/match") ? "b" : "c"}) desde ${origen}, «Simulate match» con 246 abre la neutral y Atrás vuelve`, async ({ page }) => {
      await abrir(page, origen);
      await page.getByTestId("simulate").click();
      await expect(page).toHaveURL((u) => u.pathname === "/match/246" && u.search === "");
      await expect(page.locator('[data-perspective="neutral"]')).toHaveAttribute("aria-current", "true");
      await page.goBack();
      await expect(page).toHaveURL((u) => u.pathname + u.search === origen);
    });
  }

  test("(4) la perspectiva reemplaza: misma longitud de historial y Atrás vuelve a /datos", async ({ page }) => {
    await desdeDatosALaPortada(page);
    const antes = await largoHistoria(page);
    await page.locator('[data-perspective="visita"]').click();
    await expect(page).toHaveURL((u) => u.pathname === "/cronicas" && u.search === "?perspectiva=visita");
    await expect(page.locator('[data-perspective="visita"]')).toHaveAttribute("aria-current", "true");
    expect(await largoHistoria(page)).toBe(antes);
    await page.goBack();
    await expect(page).toHaveURL((u) => u.pathname === "/datos");
  });
});

test.describe("061 · barra sin desborde (v1.1 § V1)", () => {
  /** Muestra el error de la barra (semilla «abc»), que ocupa su propia línea. */
  async function conError(page: Page) {
    await page.getByTestId("seed-input").fill("abc");
    await page.getByTestId("simulate").click();
    await expect(page.locator('.sim-form [role="alert"]')).toBeVisible();
  }
  const medir = (page: Page) => page.evaluate(() => {
    const der = (s: string) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().right : Number.POSITIVE_INFINITY; };
    // 064 § 8.4.3 · Los enlaces y el formulario viven en la tira (nav.cronicas-herramientas), no en la barra.
    const nav = document.querySelector<HTMLElement>(".cronicas-herramientas .cronicas-enlaces")!;
    return {
      ancho: innerWidth,
      scroll: document.documentElement.scrollWidth,
      derechas: {
        simulate: der('[data-testid="simulate"]'), random: der('[data-testid="random-match"]'), reports: der('[data-testid="reports-link"]'),
        arena: der('[data-testid="arena-link"]'), alerta: der('.sim-form [role="alert"]'),
      },
      // La navegación tampoco desborda su propia caja (aunque el sobrante cupiera en el relleno de la barra).
      nav: { scroll: nav.scrollWidth, cliente: nav.clientWidth },
      // Disposición de V1 en 901–1279: fila 1 = rótulo + enlaces (los tres en una fila); fila 2 = formulario.
      enlacesArriba: [...nav.querySelectorAll("a")].map((a) => Math.round(a.getBoundingClientRect().top)),
      enlacesAbajo: Math.max(...[...nav.querySelectorAll("a")].map((a) => a.getBoundingClientRect().bottom)),
      formArriba: document.querySelector(".cronicas-herramientas .sim-form")!.getBoundingClientRect().top,
    };
  });
  const comprobar = async (page: Page, contexto: string) => {
    const m = await medir(page);
    expect(m.scroll, `${contexto}: scrollWidth`).toBeLessThanOrEqual(m.ancho);
    for (const [id, x] of Object.entries(m.derechas)) expect(x, `${contexto}: ${id}`).toBeLessThanOrEqual(m.ancho);
    expect(m.nav.scroll, `${contexto}: la navegación desborda su caja`).toBeLessThanOrEqual(m.nav.cliente);
    if (m.ancho >= 901 && m.ancho <= 1279) {
      expect(new Set(m.enlacesArriba).size, `${contexto}: navegación en una sola fila`).toBe(1);
      expect(m.formArriba, `${contexto}: el formulario va en la fila 2`).toBeGreaterThanOrEqual(m.enlacesAbajo);
    }
  };

  test("(5a) /match/246, de 320 a 1440 px en pasos de 10, con el error visible", async ({ page }) => {
    await abrir(page, "/match/246");
    await conError(page);
    for (let w = 320; w <= 1440; w += 10) {
      await page.setViewportSize({ width: w, height: 900 });
      await comprobar(page, `${w} px`);
    }
  });

  for (const destino of ["/cronicas", "/match/246", "/liga", "/liga/1/1", "/datos"]) {
    test(`(5b) ${destino}: límites 480/481, 900/901 y 1279/1280 en claro y 360 en oscuro`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: "light" });
      await abrir(page, destino);
      await conError(page);
      for (const w of [480, 481, 900, 901, 1279, 1280]) {
        await page.setViewportSize({ width: w, height: 900 });
        await comprobar(page, `${destino} ${w} px claro`);
      }
      await page.emulateMedia({ colorScheme: "dark" });
      await page.setViewportSize({ width: 360, height: 780 });
      await comprobar(page, `${destino} 360 px oscuro`);
    });
  }
});

test.describe("061 · misma identidad que la arena (§ 6.2.6 + v1.1 § V5)", () => {
  const identidad = (page: Page) => page.evaluate(() => {
    const css = (s: string, p: string) => getComputedStyle(document.querySelector(s)!).getPropertyValue(p).trim();
    return {
      bg: getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(),
      barra: css("header.topbar", "background-color"),
      marca: css("header.topbar .brand-mark", "color"),
      punto: css("header.topbar .brand-emblem circle", "fill"),
    };
  });

  for (const tema of ["light", "dark"] as const) {
    test(`(6) /cronicas y /arena comparten --bg, barra, marca y punto del emblema en ${tema === "light" ? "claro" : "oscuro"}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema });
      await abrir(page, "/cronicas");
      const cronica = await identidad(page);
      await page.goto("/arena");
      await expect(page.locator("main.arena-shell")).toBeVisible();
      const arena = await identidad(page);
      expect(cronica).toEqual(arena);
      // El punto es la señal «en vivo» (--ar-live), distinta de la marca, y cambia con el tema.
      expect(cronica.punto).not.toBe(cronica.marca);
    });
  }
});
