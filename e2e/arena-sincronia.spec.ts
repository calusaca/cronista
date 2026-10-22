import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { construirRelato } from "../src/arena/relato";
import { wavMono } from "../src/arena/pista-audio";
import type { RegistroArena } from "../src/arena/tipos";

test("activar y silenciar voz conserva su preparación y omite el gol ocurrido mientras estaba apagada", async ({ page }, testInfo) => {
  const r = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  const id = "00000000-0000-4000-8000-000000000052", corte = 400;
  const registro = { ...r, eventos: r.eventos.filter(e => e.tick <= corte), fotogramas: r.fotogramas.filter(f => f.tick <= corte), rondas: r.rondas.filter(r => r.inicioTick < corte), final: r.fotogramas.find(f => f.tick === corte) };
  const voz = Buffer.from(await wavMono([new Float32Array(48000)], 24000).arrayBuffer()).toString("base64");
  await page.route(`**/api/arena/sesiones/${id}/emision`, ruta => ruta.fulfill({ json: { registro, comentarios: [], asignacion: { modo: "programado", local: { nombre: "Local" }, visita: { nombre: "Visita" } }, metricas: {}, estado: "ejecutando", ultimoMensaje: 1 } }));
  await page.route(`**/api/arena/sesiones/${id}/eventos*`, ruta => ruta.fulfill({ headers: { "content-type": "text/event-stream" }, body: ": keepalive\n\n" }));
  await page.route("**/api/arena/herramientas", ruta => ruta.fulfill({ json: { voz: true, analista: false } }));
  await page.addInitScript(() => {
    const Base = window.AudioContext;
    const datos = { contextos: 0, inicios: [] as number[] };
    (window as unknown as { sincronia: typeof datos }).sincronia = datos;
    window.AudioContext = class extends Base {
      constructor(opciones?: AudioContextOptions) { super(opciones); datos.contextos++; }
      override createBufferSource() {
        const fuente = super.createBufferSource(), iniciar = fuente.start.bind(fuente);
        fuente.start = (cuando = 0) => { datos.inicios.push(performance.now()); iniciar(cuando); }; return fuente;
      }
    };
  });
  const peticiones: { desdeTick: number; hastaTick: number; entradaTick?: number; cierre?: boolean }[] = [];
  let liberar!: () => void; const barrera = new Promise<void>(resolver => { liberar = resolver; });
  let entradas = 0;
  await page.route(`**/api/arena/sesiones/${id}/relato`, async ruta => {
    const p = ruta.request().postDataJSON(); if (p.intervencion?.startsWith("previa:")) return ruta.fulfill({ status: 404, json: { error: "Sin invitados en esta prueba" } }).catch(() => {}); peticiones.push(p);
    if (p.entradaTick !== undefined && ++entradas === 1) await barrera;
    const relato = construirRelato(r, p.desdeTick, p.hastaTick, "buffer", p.idioma, { entradaTick: p.entradaTick, cierre: p.cierre });
    await ruta.fulfill({ json: { ...relato, audio: { base64: voz, tipo: "audio/wav" } } }).catch(() => {});
  });
  try {
    await page.goto(`/arena?partido=${id}&vista=buffer`);
    await expect(page.getByTestId("arena-clock")).toHaveText(/0:2[01] \/ 1:00/);
    await page.getByRole("button", { name: "Enable narration", exact: true }).click();
    await expect.poll(() => entradas).toBe(1);
    await expect.poll(() => peticiones.some(p => p.entradaTick === undefined && p.desdeTick === 200)).toBe(true);
    await page.getByRole("button", { name: "Turn narration off", exact: true }).click();
    const iniciosApagada = await page.evaluate(() => (window as unknown as { sincronia: { inicios: number[] } }).sincronia.inicios.length);
    await expect(page.getByTestId("arena-clock")).toHaveText("0:24 / 1:00");
    liberar();
    expect(await page.evaluate(() => (window as unknown as { sincronia: { inicios: number[] } }).sincronia.inicios.length)).toBe(iniciosApagada);
    await page.getByRole("button", { name: "Enable narration", exact: true }).click();
    await expect.poll(() => entradas).toBe(2);
    const entrada = peticiones.filter(p => p.entradaTick !== undefined).at(-1)!.entradaTick!;
    expect(entrada).toBeGreaterThanOrEqual(240);
    expect(entrada - 231).toBeLessThanOrEqual(30); // El gol aún no caducó: lo excluye la nueva activación.
    const transcripcion = page.getByTestId("arena-voice-transcript");
    await expect(transcripcion).toHaveAttribute("data-narration-kind", "entrada");
    await expect(transcripcion).toHaveAttribute("data-narration-tick", String(entrada));
    await expect(transcripcion).not.toContainText(/Goal|begins/);
    expect(await page.evaluate(() => (window as unknown as { sincronia: { contextos: number } }).sincronia.contextos)).toBe(1);
    expect(peticiones.filter(p => p.entradaTick === undefined && p.desdeTick === 250)).toHaveLength(1);
    await testInfo.attach("reactivar-voz.json", { body: JSON.stringify({ entrada, peticiones, contextoReutilizado: true, sinGolAnterior: true }), contentType: "application/json" });
  } finally { liberar(); }
});
