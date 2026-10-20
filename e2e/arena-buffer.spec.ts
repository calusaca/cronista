import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { construirRelato } from "../src/arena/relato";
import { wavMono } from "../src/arena/pista-audio";
import type { RegistroArena } from "../src/arena/tipos";

const ajustes = { seed: 42, segundos: 60, local: "auto", visita: "auto", seleccion: { modo: "programado" }, presentacion: "buffer" };
const audioCorto = Buffer.from(await wavMono([new Float32Array(7200)], 24000).arrayBuffer()).toString("base64");

test("reinicios: banda, esquina, meta y centro se ven junto al campo y en la descripción", async ({ page, request }) => {
  await page.goto("/arena");
  await expect(page.getByTestId("arena-ball")).toHaveAttribute("cx", "52.5");
  await expect(page.getByTestId("arena-ball")).toHaveAttribute("cy", "34");
  await page.getByRole("button", { name: "Saved matches", exact: true }).click();
  for (const [seed, tipos] of [[6, ["banda"]], [4, ["esquina"]], [3, ["centro"]], [5, ["meta"]]] as const) {
    const respuesta = await request.post("/api/arena", { data: { accion: "simular", seed, segundos: 60, local: "auto", visita: "auto" } });
    expect(respuesta.ok()).toBe(true);
    const registro = await respuesta.json() as RegistroArena;
    await page.getByLabel("Open saved run", { exact: true }).setInputFiles({ name: `saques-${seed}.json`, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(registro)) });
    await expect(page.getByText("Imported recording:", { exact: false })).toBeAttached();
    await expect(page.locator(".arena-score")).toContainText(registro.config.partido.local.nombre);
    for (const tipo of tipos) {
      const evento = registro.eventos.find(e => e.tipo === "reinicio" && e.reinicio === tipo && e.tick > 0)!; expect(evento).toBeDefined();
      await page.getByRole("slider", { name: "Match time" }).evaluate((el, valor) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, valor);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }, String(evento.tick / 10));
      const nombre = { banda: "Throw-in", esquina: "Corner kick", centro: "Kick-off", meta: "Goal kick" }[tipo];
      await expect(page.getByTestId("arena-restart")).toContainText(nombre);
      await expect(page.getByTestId("arena-restart")).toContainText(registro.config.partido[evento.lado].nombre);
      await expect(page.getByTestId("arena-description")).toContainText(nombre);
      if (tipo === "centro") { await expect(page.getByTestId("arena-ball")).toHaveAttribute("cx", "52.5"); await expect(page.getByTestId("arena-ball")).toHaveAttribute("cy", "34"); }
    }
  }
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  await expect(page.getByTestId("arena-restart")).toContainText("Saque de meta");
  await page.setViewportSize({ width: 360, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("narración continua: el cierre de reserva en español termina sin repetir comentarios", async ({ page }) => {
  const original = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  const id = "00000000-0000-4000-8000-000000000049", corte = 20;
  const registro = { ...original, config: { ...original.config, duracionS: 2 }, fotogramas: original.fotogramas.filter(f => f.tick <= corte), eventos: original.eventos.filter(e => e.tick <= corte), rondas: [], final: original.fotogramas.find(f => f.tick === corte) };
  await page.route(`**/api/arena/sesiones/${id}/emision`, r => r.fulfill({ json: { registro, comentarios: [], asignacion: { modo: "programado", local: { nombre: "Local" }, visita: { nombre: "Visita" } }, metricas: {}, estado: "completa", ultimoMensaje: 1 } }));
  await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { voz: true, analista: false } }));
  await page.route(`**/api/arena/sesiones/${id}/relato`, r => r.fulfill({ status: 503 }));
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  await page.getByRole("button", { name: "Activar narración" }).click();
  await expect(page.getByTestId("arena-voice-status")).toHaveText("Comentario de cierre", { timeout: 5000 });
  await expect(page.getByTestId("arena-voice-transcript")).toContainText("Ha terminado el encuentro");
  await expect(page.getByTestId("arena-voice-status")).toHaveText("Fin de la narración");
  await page.waitForTimeout(2500);
  await expect(page.getByTestId("arena-voice-status")).toHaveText("Fin de la narración");
});

test("narración continua: cubre Speech lento y fallido con voz audible, incluso al recuperar el búfer", async ({ page }, testInfo) => {
  const grabacion = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  const id = "00000000-0000-4000-8000-000000000048", corte = 300;
  const registro = { ...grabacion, fotogramas: grabacion.fotogramas.filter(f => f.tick <= corte), eventos: grabacion.eventos.filter(e => e.tick <= corte), rondas: grabacion.rondas.filter(r => r.inicioTick < corte), final: grabacion.fotogramas.find(f => f.tick === corte) };
  await page.route(`**/api/arena/sesiones/${id}/emision`, r => r.fulfill({ json: { registro, comentarios: [], asignacion: { modo: "programado", local: { nombre: "Local" }, visita: { nombre: "Visita" } }, metricas: {}, estado: "ejecutando", ultimoMensaje: 1 } }));
  await page.route(`**/api/arena/sesiones/${id}/eventos*`, r => r.fulfill({ headers: { "content-type": "text/event-stream" }, body: ": keepalive\n\n" }));
  await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { voz: true, analista: false } }));
  let liberar!: () => void; const barrera = new Promise<void>(r => { liberar = r; });
  await page.route(`**/api/arena/sesiones/${id}/relato`, async r => { await barrera; await r.fulfill({ status: 503, json: { error: "Speech no disponible en esta prueba" } }).catch(() => {}); });
  await page.addInitScript(() => {
    const Base = window.AudioContext;
    const fuentes: { inicio: number; fin: number; audible: boolean; velocidad: number }[] = [];
    (window as unknown as { continuidad: typeof fuentes }).continuidad = fuentes;
    window.AudioContext = class extends Base {
      override createBufferSource() {
        const fuente = super.createBufferSource(), iniciar = fuente.start.bind(fuente), detener = fuente.stop.bind(fuente);
        const dato = { inicio: 0, fin: 0, audible: false, velocidad: 0 };
        fuente.start = (cuando = 0) => {
          dato.inicio = performance.now() + Math.max(0, cuando - this.currentTime) * 1000;
          dato.fin = dato.inicio + fuente.buffer!.duration * 1000;
          dato.audible = fuente.buffer!.getChannelData(0).some(v => Math.abs(v) > .001);
          dato.velocidad = fuente.playbackRate.value; fuentes.push(dato); iniciar(cuando);
        };
        fuente.stop = (cuando = 0) => { dato.fin = Math.min(dato.fin, performance.now() + Math.max(0, cuando - this.currentTime) * 1000); detener(cuando); };
        fuente.addEventListener("ended", () => { dato.fin = Math.min(dato.fin, performance.now()); });
        return fuente;
      }
    };
  });
  try {
    await page.goto(`/arena?partido=${id}&vista=buffer`);
    const inicio = await page.evaluate(() => performance.now());
    await page.getByRole("button", { name: "Enable narration" }).click();
    await expect(page.getByTestId("arena-voice-status")).toHaveText("Narration playing", { timeout: 5000 });
    await page.waitForTimeout(9500); liberar();
    await expect(page.getByTestId("arena-buffer").getByRole("alert")).toBeVisible();
    await expect(page.getByTestId("arena-buffer-status")).toContainText("Rebuilding the buffer", { timeout: 15000 });
    await page.waitForTimeout(2000);
    const medicion = await page.evaluate(inicio => {
      const fuentes = (window as unknown as { continuidad: { inicio: number; fin: number; audible: boolean; velocidad: number }[] }).continuidad;
      let fin = inicio, maxSilencioMs = 0;
      for (const f of fuentes) { maxSilencioMs = Math.max(maxSilencioMs, f.inicio - fin); fin = Math.max(fin, f.fin); }
      maxSilencioMs = Math.max(maxSilencioMs, performance.now() - fin);
      return { fuentes, maxSilencioMs, duracionMs: performance.now() - inicio };
    }, inicio);
    expect(medicion.fuentes.length).toBeGreaterThanOrEqual(3);
    expect(medicion.fuentes.every(f => f.audible && f.velocidad === 1)).toBe(true);
    expect(medicion.maxSilencioMs).toBeLessThanOrEqual(5000);
    await testInfo.attach("continuidad-voz.json", { body: JSON.stringify(medicion, null, 2), contentType: "application/json" });
    await page.getByRole("button", { name: "Turn narration off" }).click();
    const cantidad = medicion.fuentes.length; await page.waitForTimeout(2200);
    expect(await page.evaluate(() => (window as unknown as { continuidad: unknown[] }).continuidad.length)).toBe(cantidad);
  } finally { liberar(); }
});

test("búfer: empieza antes del final, interpola, pausa y comparte sin volver a generar", async ({ page, request, context }) => {
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  let id: string | undefined;
  try {
    await page.goto("/arena");
    const panel = page.getByTestId("arena-live");
    await expect(page.getByRole("button", { name: "Live", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("combobox", { name: "Viewing mode" })).toHaveCount(0);
    const creada = page.waitForResponse(r => r.url().endsWith("/api/arena/sesiones") && r.request().method() === "POST");
    await panel.getByRole("button", { name: "Start live match", exact: true }).click();
    const respuesta = await creada; expect(respuesta.request().postDataJSON().presentacion).toBe("buffer");
    id = (await respuesta.json()).id;
    await expect(page.getByTestId("arena-buffer-status")).toContainText("Live");
    expect((await request.get(`/api/arena/sesiones/${id}/reproduccion`)).status()).toBe(409);
    const antes = await page.getByTestId("arena-player").nth(5).getAttribute("transform");
    await expect.poll(() => page.getByTestId("arena-player").nth(5).getAttribute("transform")).not.toBe(antes);
    await page.getByRole("button", { name: "Pause broadcast", exact: true }).click();
    await expect(page.getByTestId("arena-buffer-status")).toContainText("Broadcast paused");
    const reloj = await page.getByTestId("arena-clock").textContent();
    await page.waitForTimeout(350);
    await expect(page.getByTestId("arena-clock")).toHaveText(reloj!);
    const enlace = panel.getByRole("link", { name: "Share this broadcast" });
    expect(await enlace.getAttribute("href")).toBe(`/arena?partido=${id}&vista=buffer`);
    const otro = await context.newPage(); let nuevas = 0;
    otro.on("request", r => { if (r.url().endsWith("/api/arena/sesiones") && r.method() === "POST") nuevas++; });
    await otro.goto(`/arena?partido=${id}&vista=buffer`);
    await expect(otro.getByTestId("arena-buffer-status")).toContainText("Live");
    expect(nuevas).toBe(0); await otro.close();
    await page.getByRole("button", { name: "Resume broadcast", exact: true }).click();
    await expect(page.getByTestId("arena-buffer-status")).toContainText("Live");
    await page.setViewportSize({ width: 360, height: 780 }); await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.getByRole("button", { name: "Switch to Spanish" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await page.getByTestId("arena-buffer").screenshot({ path: ".cache/arena-buffer-movil.png" });
    expect(errores).toEqual([]);
  } finally { if (id) await request.delete(`/api/arena/sesiones/${id}`); }
});

test("búfer: una síntesis lenta no detiene el partido y la preparación es independiente", async ({ page, request }) => {
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  const creada = await request.post("/api/arena/sesiones", { data: ajustes }); const { id } = await creada.json();
  const tramos: { desdeTick: number; hastaTick: number; modo: string; cierre?: boolean; entradaTick?: number }[] = [];
  let liberar!: () => void; const barrera = new Promise<void>(r => { liberar = r; });
  try {
    await expect.poll(async () => (await (await request.get(`/api/arena/sesiones/${id}/emision`)).json()).registro?.final.tick).toBeGreaterThanOrEqual(200);
    await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { analista: false, voz: true } }));
    await page.route(`**/api/arena/sesiones/${id}/relato`, async r => {
      const p = r.request().postDataJSON(); tramos.push(p); await barrera;
      const registro = (await (await request.get(`/api/arena/sesiones/${id}/emision`)).json()).registro as RegistroArena;
      const relato = construirRelato(registro, p.desdeTick, p.hastaTick, "buffer", p.idioma, { cierre: p.cierre, entradaTick: p.entradaTick });
      await r.fulfill({ json: { ...relato, audio: relato.texto ? { base64: audioCorto, tipo: "audio/wav" } : null } }).catch(() => {});
    });
    await page.goto(`/arena?partido=${id}&vista=buffer`);
    await expect(page.getByTestId("arena-buffer-status")).toContainText("Live");
    const antes = await page.getByTestId("arena-clock").textContent();
    await page.getByRole("button", { name: "Enable narration" }).click();
    await expect.poll(() => tramos.length).toBe(2);
    await expect(page.getByTestId("arena-buffer-status")).toContainText("Live");
    await expect(page.getByTestId("arena-clock")).not.toHaveText(antes!);
    const posicion = await page.getByTestId("arena-player").nth(5).getAttribute("transform");
    await expect.poll(() => page.getByTestId("arena-player").nth(5).getAttribute("transform")).not.toBe(posicion);
    liberar(); await expect.poll(() => tramos.length).toBeGreaterThan(4);
    await expect(page.getByTestId("arena-voice-transcript")).toBeAttached();
    expect(tramos.every(t => t.modo === "buffer" && (t.cierre || t.hastaTick - t.desdeTick === 50))).toBe(true);
    await page.getByRole("button", { name: "Turn narration off" }).click();
    await expect(page.getByTestId("arena-voice-transcript")).toHaveCount(0); // Silenciar conserva la preparación futura.
    expect(errores).toEqual([]);
  } finally { liberar(); await request.delete(`/api/arena/sesiones/${id}`).catch(() => {}); }
});

test("búfer: una demora prolongada agota la reserva y la reconexión continúa sin saltar", async ({ page }) => {
  const grabacion = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  const id = "00000000-0000-4000-8000-000000000039", corte = 300;
  const registro = { ...grabacion, fotogramas: grabacion.fotogramas.filter(f => f.tick <= corte), eventos: grabacion.eventos.filter(e => e.tick <= corte), rondas: grabacion.rondas.filter(r => r.inicioTick < corte), final: grabacion.fotogramas.find(f => f.tick === corte) };
  await page.route(`**/api/arena/sesiones/${id}/emision`, r => r.fulfill({ json: { registro, comentarios: [], asignacion: { modo: "programado", local: { nombre: "Local" }, visita: { nombre: "Visita" } }, metricas: {}, estado: "ejecutando", ultimoMensaje: 1 } }));
  let continuar = false, conexiones = 0;
  await page.route(`**/api/arena/sesiones/${id}/eventos*`, r => {
    conexiones++;
    const publicaciones = [
      { tipo: "ordenes", ronda: grabacion.rondas[1] },
      { tipo: "avance", estado: grabacion.final, fotogramas: grabacion.fotogramas.filter(f => f.tick > corte), eventos: grabacion.eventos.filter(e => e.tick > corte) },
      { tipo: "terminada", estado: "completa", metricas: { decisiones: 4, respaldos: 0, duracionMs: 0 } },
    ];
    const body = continuar ? publicaciones.map((publicacion, i) => `id: ${i + 2}\nevent: arena\ndata: ${JSON.stringify({ id: i + 2, publicacion })}\n\n`).join("") : ": keepalive\n\n";
    return r.fulfill({ headers: { "content-type": "text/event-stream" }, body });
  });
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  await expect(page.getByTestId("arena-buffer-status")).toContainText("Live");
  await expect(page.getByTestId("arena-buffer-status")).toContainText("Rebuilding the buffer", { timeout: 25000 });
  await expect(page.getByTestId("arena-clock")).toHaveText("0:30 / 1:00");
  await page.waitForTimeout(350);
  await expect(page.getByTestId("arena-clock")).toHaveText("0:30 / 1:00");
  continuar = true;
  await expect(page.getByTestId("arena-buffer-status")).toContainText("Live", { timeout: 10000 });
  await expect(page.getByTestId("arena-clock")).toHaveText(/0:3[0-3] \/ 1:00/);
  expect(conexiones).toBeGreaterThan(1);
});

test("búfer: descarta audio atrasado al cambiar idioma y se recupera de un fallo de voz", async ({ page, request }) => {
  const creada = await request.post("/api/arena/sesiones", { data: { ...ajustes, segundos: 12, presentacion: "preparada" } }); const { id } = await creada.json();
  await expect.poll(async () => (await request.get(`/api/arena/sesiones/${id}/registro`)).status()).toBe(200);
  await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { analista: false, voz: true } }));
  let liberar!: () => void; const barrera = new Promise<void>(r => { liberar = r; }); let solicitudes = 0;
  await page.route(`**/api/arena/sesiones/${id}/relato`, async r => {
    solicitudes++; await barrera; await r.fulfill({ status: 503, json: { error: "Respuesta tardía de prueba" } }).catch(() => {});
  });
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  await page.getByRole("button", { name: "Enable narration" }).click();
  await expect.poll(() => solicitudes).toBe(2);
  await page.getByRole("button", { name: "Switch to Spanish" }).click(); liberar();
  await expect(page.getByRole("button", { name: "Activar narración" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("arena-buffer").getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Activar narración" }).click();
  await expect(page.getByTestId("arena-buffer").getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("arena-buffer-status")).toContainText("En vivo");
});

test("búfer: un consumidor tardío entra cerca del frente y no revela el gol antes de su cursor", async ({ page, request }) => {
  const grabacion = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  const id = "00000000-0000-4000-8000-000000000038", corte = 300;
  const registro = { ...grabacion, fotogramas: grabacion.fotogramas.filter(f => f.tick <= corte), eventos: grabacion.eventos.filter(e => e.tick <= corte), rondas: grabacion.rondas.filter(r => r.inicioTick < corte), final: grabacion.fotogramas.find(f => f.tick === corte) };
  await page.route(`**/api/arena/sesiones/${id}/emision`, r => r.fulfill({ json: { registro, comentarios: [], asignacion: { modo: "programado", local: { nombre: "Local" }, visita: { nombre: "Visita" } }, metricas: {}, estado: "ejecutando", ultimoMensaje: 1 } }));
  await page.route(`**/api/arena/sesiones/${id}/eventos*`, r => r.fulfill({ headers: { "content-type": "text/event-stream" }, body: ": keepalive\n\n" }));
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  await expect(page.getByTestId("arena-buffer-status")).toContainText("Live");
  await expect(page.getByTestId("arena-clock")).toHaveText("0:10 / 1:00");
  await expect(page.locator(".arena-score strong")).toHaveText("0–0");
  const antes = await page.getByTestId("arena-player").nth(5).getAttribute("transform");
  await expect.poll(() => page.getByTestId("arena-player").nth(5).getAttribute("transform")).not.toBe(antes);
  expect((await request.get("/api/health")).ok()).toBe(true);
});

test("voz independiente: un pasaje largo conserva su ritmo y un gol lo interrumpe sin anticiparse", async ({ page }) => {
  const registro = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  const id = "00000000-0000-4000-8000-000000000041", corte = 300;
  const prefijo = { ...registro, eventos: registro.eventos.filter(e => e.tick <= corte), fotogramas: registro.fotogramas.filter(f => f.tick <= corte), rondas: registro.rondas.filter(r => r.inicioTick < corte), final: registro.fotogramas.find(f => f.tick === corte) };
  await page.route(`**/api/arena/sesiones/${id}/emision`, r => r.fulfill({ json: { registro: prefijo, comentarios: [], asignacion: { modo: "programado", local: { nombre: "Local" }, visita: { nombre: "Visita" } }, metricas: {}, estado: "ejecutando", ultimoMensaje: 1 } }));
  await page.route(`**/api/arena/sesiones/${id}/eventos*`, r => r.fulfill({ headers: { "content-type": "text/event-stream" }, body: ": keepalive\n\n" }));
  await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { voz: true, analista: false } }));
  const larga = Buffer.from(await wavMono([new Float32Array(360000)], 24000).arrayBuffer()).toString("base64");
  const audioGol = Buffer.from(await wavMono([new Float32Array(57600)], 24000).arrayBuffer()).toString("base64");
  await page.addInitScript(() => {
    const Base = window.AudioContext;
    const fuentes: { duracion: number; velocidad: number; detenida: boolean }[] = [];
    (window as unknown as { fuentesPrueba: typeof fuentes }).fuentesPrueba = fuentes;
    window.AudioContext = class extends Base {
      override createBufferSource() {
        const f = super.createBufferSource(), iniciar = f.start.bind(f), detener = f.stop.bind(f);
        const dato = { duracion: 0, velocidad: 0, detenida: false };
        f.start = (cuando = 0) => { dato.duracion = f.buffer!.duration; dato.velocidad = f.playbackRate.value; fuentes.push(dato); iniciar(cuando); };
        f.stop = (cuando = 0) => { dato.detenida = true; detener(cuando); };
        return f;
      }
    };
  });
  await page.route(`**/api/arena/sesiones/${id}/relato`, r => {
    const p = r.request().postDataJSON();
    // Esta prueba necesita un comentario largo, sin la noticia de fuera de juego
    // que ahora prima sobre el antiguo balance periódico del segundo quince.
    const fuente = p.hastaTick === 150 && p.entradaTick === undefined ? { ...registro, eventos: registro.eventos.filter(e => e.tick <= 100 || e.tick > 150 || ["pase", "recepcion"].includes(e.tipo)) } : registro;
    const relato = construirRelato(fuente, p.desdeTick, p.hastaTick, "buffer", p.idioma, { entradaTick: p.entradaTick });
    return r.fulfill({ json: { ...relato, audio: relato.texto ? { base64: p.hastaTick === 150 && p.entradaTick === undefined ? larga : "prioridad" in relato && relato.prioridad === 100 ? audioGol : audioCorto, tipo: "audio/wav" } : null } });
  });
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  await page.getByRole("button", { name: "Enable narration" }).click();
  const transcripcion = page.getByTestId("arena-voice-transcript");
  await expect(transcripcion).toHaveAttribute("data-narration-tick", "150");
  expect(await page.evaluate(() => (window as unknown as { fuentesPrueba: { duracion: number; velocidad: number }[] }).fuentesPrueba.find(f => f.duracion === 15)?.velocidad)).toBe(1);
  await expect(page.getByTestId("arena-clock")).toHaveText(/0:1[5-9] \/ 1:00/);
  await expect(transcripcion).not.toContainText("Goal");
  await expect(transcripcion).toHaveAttribute("data-narration-tick", "231", { timeout: 12000 });
  await expect(page.locator(".arena-score strong")).toHaveText("1–0");
  expect(await page.evaluate(() => (window as unknown as { fuentesPrueba: { duracion: number; detenida: boolean }[] }).fuentesPrueba.find(f => f.duracion === 15)?.detenida)).toBe(true);
});

test("voz independiente: termina el partido mientras continúa el relato y después suena el cierre", async ({ page, request }) => {
  const creada = await request.post("/api/arena/sesiones", { data: { ...ajustes, segundos: 2, presentacion: "preparada" } }), { id } = await creada.json();
  await expect.poll(async () => (await request.get(`/api/arena/sesiones/${id}/registro`)).status()).toBe(200);
  const registro = (await (await request.get(`/api/arena/sesiones/${id}/registro`)).json()) as RegistroArena;
  await page.route(`**/api/arena/sesiones/${id}/emision`, r => r.fulfill({ json: { registro, comentarios: [], asignacion: { modo: "programado", local: { nombre: "Local" }, visita: { nombre: "Visita" } }, metricas: {}, estado: "ejecutando", ultimoMensaje: 1 } }));
  await page.route(`**/api/arena/sesiones/${id}/eventos*`, r => r.fulfill({ headers: { "content-type": "text/event-stream" }, body: ": commentary still pending\n\n" }));
  const audio = Buffer.from(await wavMono([new Float32Array(96000)], 24000).arrayBuffer()).toString("base64");
  await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { voz: true, analista: false } }));
  await page.route(`**/api/arena/sesiones/${id}/relato`, r => {
    const p = r.request().postDataJSON(), relato = construirRelato(registro, p.desdeTick, p.hastaTick, "buffer", p.idioma, { cierre: p.cierre, entradaTick: p.entradaTick });
    return r.fulfill({ json: { ...relato, audio: relato.texto ? { base64: audio, tipo: "audio/wav" } : null } });
  });
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  await page.getByRole("button", { name: "Enable narration" }).click();
  await expect(page.getByTestId("arena-voice-status")).toHaveText("Narration playing");
  await expect(page.getByTestId("arena-voice-transcript")).not.toContainText("Full time");
  await expect(page.getByTestId("arena-clock")).toHaveText("0:02 / 0:02");
  await expect(page.getByTestId("arena-voice-status")).toHaveText("Narration playing");
  await expect(page.getByTestId("arena-voice-status")).toHaveText("Closing commentary");
  await expect(page.getByTestId("arena-voice-transcript")).toContainText("Full time");
  await expect(page.getByTestId("arena-clock")).toHaveText("0:02 / 0:02");
  await page.getByRole("button", { name: "Turn narration off" }).click();
});
