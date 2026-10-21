// Brief 045 · Mesa de transmisión con emisión sintética controlada: rutas simuladas como en
// arena-buffer.spec.ts, Speech simulado con duraciones fijas y demoras inyectadas, e
// intervenciones servidas por la instantánea (y el resto por el diario SSE). Las prioridades
// del narrador salen de PRIORIDAD_EVENTO_ARENA; la editorial (10) y las duraciones son del fixture.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { expect, test, type Page, type Route } from "@playwright/test";
import { BUFFER_ARENA, VOZ_BUFFER } from "../src/arena/buffer";
import { datosEstadista, intervencionEstadista } from "../src/arena/estadista";
import { comentarArena } from "../src/arena/narrador";
import { wavMono } from "../src/arena/pista-audio";
import type { IntervencionArena } from "../src/arena/protocolo";
import { construirRelato, relatoIntervencion } from "../src/arena/relato";
import { componerIntercambio, comprobarTurnos, memoriaDialogoVacia } from "../src/arena/dialogo";
import type { EventoArena, RegistroArena } from "../src/arena/tipos";
import { estimarDuracionS, varianteEfectiva } from "../src/arena/turnos";
import { ARENA, MESA_ARENA, PRIORIDAD_EVENTO_ARENA } from "../src/sim/limites";

type Fuente = { inicio: number; fin: number; duracion: number; detenida: boolean; relojS: number; etiqueta?: { role: string; kind: string; tick: number; texto: string; roles: string[]; variante?: string } };
type Pedido = { desdeTick: number; hastaTick: number; modo: string; idioma: string; intervencion?: string; variante?: string; cierre?: boolean; entradaTick?: number; memoria?: { texto: string }[] };
const sr = 24000;
const audio = async (s: number) => Buffer.from(await wavMono([Float32Array.from({ length: Math.round(s * sr) }, (_, i) => 0.05 * Math.sin(i / 9))], sr).arrayBuffer()).toString("base64");
const prefijo = (r: RegistroArena, t: number): RegistroArena => ({ ...r, eventos: r.eventos.filter(e => e.tick <= t), fotogramas: r.fotogramas.filter(f => f.tick <= t), rondas: r.rondas.filter(x => x.inicioTick < t), final: [...r.fotogramas].reverse().find(f => f.tick <= t)! });
const conPlaza = (r: RegistroArena, t: number) => datosEstadista(prefijo(r, t), t).filter(d => d.ocupaPlaza);
const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));
const relojS = (texto: string) => { const m = /^(\d+):(\d{2})/.exec(texto.trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const catalogoReserva = JSON.parse(await readFile("src/arena/voz-reserva.json", "utf8")) as Record<"es" | "en", { texto: string }[]>;
const PRIORIDAD_REINICIO = PRIORIDAD_EVENTO_ARENA.reinicio!, PRIORIDAD_TIRO = PRIORIDAD_EVENTO_ARENA.tiro!;

/** C11a: cada invitado arranca con el cursor visible en [tick·pasoS, tick·pasoS + caducidadInvitadoS]
 * (tolerancia de 1 s por la resolución del reloj). */
function cursorEnVentana(fuentes: Fuente[], intervenciones: IntervencionArena[]) {
  for (const f of fuentes.filter(x => x.etiqueta?.kind === "invitado")) {
    const i = intervenciones.find(x => x.tick === f.etiqueta!.tick && x.rol === f.etiqueta!.role)!;
    expect(i, JSON.stringify(f)).toBeDefined();
    expect(f.relojS, `${i.id} arrancó con el cursor en ${f.relojS} s`).toBeGreaterThanOrEqual(i.tick * ARENA.pasoS - 1);
    expect(f.relojS, `${i.id} arrancó con el cursor en ${f.relojS} s`).toBeLessThanOrEqual(i.tick * ARENA.pasoS + MESA_ARENA.caducidadInvitadoS + 1);
  }
}

async function instrumentar(page: Page) {
  await page.addInitScript(() => {
    const fuentes: Fuente[] = []; (window as unknown as { mesa: Fuente[] }).mesa = fuentes;
    const reloj = () => { const m = /^(\d+):(\d{2})/.exec(document.querySelector('[data-testid="arena-clock"]')?.textContent?.trim() ?? ""); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
    const Base = window.AudioContext;
    window.AudioContext = class extends Base {
      override createBufferSource() {
        const f = super.createBufferSource(), iniciar = f.start.bind(f), detener = f.stop.bind(f);
        const dato: Fuente = { inicio: 0, fin: 0, duracion: 0, detenida: false, relojS: NaN };
        f.start = (cuando = 0) => {
          const retraso = Math.max(0, cuando - this.currentTime);
          dato.inicio = performance.now() + retraso * 1000; dato.duracion = f.buffer!.duration; dato.fin = dato.inicio + dato.duracion * 1000;
          dato.relojS = reloj() + retraso; fuentes.push(dato); iniciar(cuando);
        };
        f.stop = (cuando = 0) => { if (dato.fin > performance.now() + 20) dato.detenida = true; dato.fin = Math.min(dato.fin, performance.now() + Math.max(0, cuando - this.currentTime) * 1000); detener(cuando); };
        f.addEventListener("ended", () => { dato.fin = Math.min(dato.fin, performance.now()); });
        return f;
      }
    };
    let previo = "";
    document.addEventListener("DOMContentLoaded", () => new MutationObserver(() => {
      const el = document.querySelector<HTMLElement>('[data-testid="arena-voice-transcript"]');
      if (!el) return;
      // 048: un <p data-narration-role> por fragmento; `texto` es el primero, `roles` todos en orden.
      const ps = [...el.querySelectorAll<HTMLElement>("p[data-narration-role]")];
      const d = { role: el.dataset.narrationRole ?? "", kind: el.dataset.narrationKind ?? "", tick: Number(el.dataset.narrationTick), texto: ps[0]?.textContent ?? "", roles: ps.map(x => x.dataset.narrationRole ?? ""), variante: el.dataset.narrationVariant };
      const clave = JSON.stringify(d); if (clave === previo) return; previo = clave;
      const f = [...fuentes].reverse().find(x => !x.etiqueta); if (f) f.etiqueta = d;
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true }));
  });
}

const asignacion = { modo: "programado", local: { nombre: "Local" }, visita: { nombre: "Visita" } };
async function preparar(page: Page, id: string, registro: RegistroArena, intervenciones: IntervencionArena[], corte: number) {
  const inicial = prefijo(registro, corte);
  const enSnapshot = intervenciones.filter(i => i.tick <= corte), despues = intervenciones.filter(i => i.tick > corte);
  await page.route(`**/api/arena/sesiones/${id}/emision`, r => r.fulfill({ json: { registro: inicial, comentarios: [], intervenciones: enSnapshot, asignacion, metricas: {}, estado: "ejecutando", ultimoMensaje: 1 } }));
  const publicaciones = [
    ...registro.rondas.filter(x => x.inicioTick >= corte).map(ronda => ({ tipo: "ordenes", ronda })),
    { tipo: "avance", estado: registro.final, fotogramas: registro.fotogramas.filter(f => f.tick > corte), eventos: registro.eventos.filter(e => e.tick > corte) },
    ...despues.map(intervencion => ({ tipo: "intervencion", intervencion })),
    { tipo: "terminada", estado: "completa", metricas: { decisiones: 4, respaldos: 0, duracionMs: 0 } },
  ];
  await page.route(`**/api/arena/sesiones/${id}/eventos*`, r => r.fulfill({ headers: { "content-type": "text/event-stream" }, body: publicaciones.map((publicacion, i) => `id: ${i + 2}\nevent: arena\ndata: ${JSON.stringify({ id: i + 2, publicacion })}\n\n`).join("") }));
  await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { voz: true, analista: false } }));
}

/** Segmento del narrador con una sola fuente, a la manera de construirRelato. */
const segmento = (p: { desdeTick: number; hastaTick: number; idioma: string; entradaTick?: number }, tick: number, texto: string, prioridad: number, base64: string | null, extra: object = {}) => ({
  desdeTick: p.desdeTick, hastaTick: p.hastaTick, modo: "buffer", idioma: p.idioma, ...(p.entradaTick === undefined ? {} : { entradaTick: p.entradaTick }), texto,
  fragmentos: texto ? [{ tick, texto, emocion: "serena", intensidad: .2, variante: 0, fuentes: [], fotogramas: [] }] : [], fuentes: [], fotogramas: [],
  eventosDisponibles: 0, eventosNarrados: texto ? 1 : 0, conduccionesNarradas: 0, prioridad, cierre: false, tipoRelato: "comentario", claveVoz: texto ? `prueba:${tick}` : undefined, audio: base64 ? { base64, tipo: "audio/wav" } : null, ...extra,
});

test("mesa: narrador, comentarista y estadista se ceden la palabra sin solaparse en una línea de tiempo controlada", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const registro = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  const id = "00000000-0000-4000-8000-000000000045", corte = 200, s = ARENA.pasoS;
  const fiel: Parameters<typeof comentarArena>[2] = { id: "modelo-prueba", completar: async (_s, m) => { const c = JSON.parse(m[0]!.contenido); const h = c.hechos.find((h: { id: string }) => h.id === c.principal); return JSON.stringify({ oraciones: [{ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id, apoyo: [] }] }); } };
  const est1 = intervencionEstadista(conPlaza(registro, 10).slice(0, 1), 10);
  const com1 = (await comentarArena(prefijo(registro, 200), 200, fiel))!;
  const est2 = intervencionEstadista(conPlaza(registro, 300).slice(0, 1), 300);
  const com2 = (await comentarArena(prefijo(registro, 400), 400, undefined))!;
  const estFinal = intervencionEstadista(conPlaza(registro, 600).slice(1, 2), 600);
  expect(com1.modo).toBe("llm"); expect(com2.modo).toBe("plantilla");
  expect(est2.oraciones[0]!.texto_en).not.toBe(est1.oraciones[0]!.texto_en); // dato cambiado (gol en el tick 231)
  const intervenciones = [est1, com1, est2, com2, estFinal];
  const duracion: Record<string, number> = { [est1.id]: 4, [com1.id]: 6, [est2.id]: 3, [com2.id]: 3.2, [estFinal.id]: 2.6 };
  const clips: Record<string, string> = {};
  for (const d of new Set([1.5, 1.7, 2, 2.5, ...Object.values(duracion)])) clips[d] = await audio(d);
  // Ventanas del narrador (desdeTick → tick, texto, prioridad, duración): rellenan los huecos sin dejar 2 s de silencio,
  // salvo antes del reinicio, donde entra una reserva que el reinicio corta.
  const narrador: Record<number, [number, string, number, number]> = {
    0: [30, "Ed 3 s", 10, 2], 50: [100, "Ed 10 s", 10, 2], 100: [150, "Reinicio 15 s", PRIORIDAD_REINICIO, 1.5], 150: [175, "Ed 17 s", 10, 2],
    200: [230, "Tiro 23 s", PRIORIDAD_TIRO, 1.5], 250: [260, "Ed 26 s", 10, 2.5], 300: [340, "Ed 34 s", 10, 2.5], 350: [375, "Ed 37 s", 10, 2],
  };
  const textosNarrador = new Set(["Apertura", "Final del partido.", ...Object.values(narrador).map(v => v[1]), ...catalogoReserva.es.map(c => c.texto), ...catalogoReserva.en.map(c => c.texto)]);
  const pedidos: Pedido[] = [], respondidas: Record<string, number> = {};
  await preparar(page, id, registro, intervenciones, corte);
  await page.route(`**/api/arena/sesiones/${id}/relato`, async (r: Route) => {
    const p = r.request().postDataJSON() as Pedido; pedidos.push(p);
    if (p.intervencion) {
      await esperar(300);
      const i = intervenciones.find(x => x.id === p.intervencion)!;
      respondidas[i.id] ??= Date.now();
      return r.fulfill({ json: { ...relatoIntervencion(i, registro.config.partido.seed, p.idioma as "es" | "en"), audio: { base64: clips[duracion[i.id]!], tipo: "audio/wav" } } }).catch(() => {});
    }
    // C8: la apertura responde más tarde que el primer invitado (tick 10).
    if (p.entradaTick !== undefined) { await esperar(1200); respondidas.entrada ??= Date.now(); return r.fulfill({ json: segmento(p, p.entradaTick, "Apertura", 10, clips[1.5]!, { tipoRelato: "entrada" }) }).catch(() => {}); }
    await esperar(200);
    if (p.cierre) return r.fulfill({ json: segmento(p, p.hastaTick, "Final del partido.", 0, clips[1.7]!, { cierre: true, tipoRelato: "cierre" }) }).catch(() => {});
    const v = narrador[p.desdeTick];
    return r.fulfill({ json: v ? segmento(p, v[0], v[1], v[2], clips[v[3]]!, { tipoRelato: v[2] >= VOZ_BUFFER.prioridadInterrupcion ? "jugada" : "comentario" }) : segmento(p, p.hastaTick, "", 10, null) }).catch(() => {});
  });
  await instrumentar(page);
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  const t0 = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: "Enable narration", exact: true }).click();
  const transcripcion = page.getByTestId("arena-voice-transcript");
  await expect(transcripcion).toHaveAttribute("data-narration-kind", "entrada", { timeout: 5000 });
  await expect(transcripcion).toHaveAttribute("data-narration-role", "estadista", { timeout: 12000 });
  await expect(transcripcion).toHaveAttribute("data-narration-tick", String(est1.tick));
  await expect(page.getByTestId("arena-mesa-estadista")).toContainText(est1.oraciones[0]!.texto_en);
  await expect(transcripcion).toHaveAttribute("data-narration-role", "comentarista", { timeout: 25000 });
  await expect(page.getByTestId("arena-mesa-comentarista-modo")).toContainText("IA / AI");
  await expect(page.getByTestId("arena-voice-status")).toHaveText("End of narration", { timeout: 70000 });
  await page.waitForTimeout(1500);
  const fuentes = (await page.evaluate(() => (window as unknown as { mesa: Fuente[] }).mesa)).map(f => ({ ...f, inicioS: (f.inicio - t0) / 1000, finS: (f.fin - t0) / 1000 }));
  await testInfo.attach("mesa-linea-de-tiempo.json", { body: JSON.stringify({ fuentes, pedidos }, null, 2), contentType: "application/json" });
  await mkdir(".cache", { recursive: true }); await writeFile(".cache/arena-mesa-linea.json", JSON.stringify({ fuentes, pedidos, narrador }, null, 2));
  const de = (pred: (f: typeof fuentes[number]) => boolean) => fuentes.filter(pred);
  const invitado = (i: IntervencionArena) => de(f => f.etiqueta?.kind === "invitado" && f.etiqueta.tick === i.tick)[0];
  // 0: arranca el narrador, aunque su apertura respondió después que el primer invitado.
  expect(respondidas.entrada).toBeGreaterThan(respondidas[est1.id]!);
  expect(fuentes[0]!.etiqueta).toMatchObject({ kind: "entrada", role: "narrador" });
  // Cada intervención: un clip, un rol, una petición por su id del diario (desde = hasta = tick), sin memoria.
  for (const i of [est1, com1, est2, com2]) { expect(invitado(i), i.id).toBeDefined(); expect(invitado(i)!.etiqueta!.role).toBe(i.rol); }
  const deInvitados = pedidos.filter(p => p.intervencion);
  for (const p of deInvitados) { const i = intervenciones.find(x => x.id === p.intervencion)!; expect([p.desdeTick, p.hastaTick, p.modo]).toEqual([i.tick, i.tick, "buffer"]); expect(p).not.toHaveProperty("memoria"); }
  expect(new Set(deInvitados.map(p => p.intervencion)).size).toBe(deInvitados.length);
  // C2: la memoria de las peticiones del narrador solo lleva textos del narrador o ids de intervención.
  const recuerdos = pedidos.filter(p => !p.intervencion).flatMap(p => p.memoria ?? []).map(m => m.texto);
  for (const texto of recuerdos) expect(textosNarrador.has(texto) || /^(comentarista|estadista):/.test(texto), texto).toBe(true);
  expect(recuerdos.some(t => /^(comentarista|estadista):/.test(t))).toBe(true);
  // C11a: cursor visible en cada arranque de invitado.
  cursorEnVentana(fuentes, intervenciones);
  // ≈2: estadista #1 sin noticia previa ≥ prioridadInterrupcion (calma null), tras la apertura.
  const reinicio = de(f => f.etiqueta?.texto === "Reinicio 15 s")[0]!, tiro = de(f => f.etiqueta?.texto === "Tiro 23 s")[0]!;
  expect(invitado(est1)!.inicio).toBeGreaterThanOrEqual(fuentes[0]!.fin - 60);
  expect(invitado(est1)!.inicio).toBeLessThan(reinicio.inicio);
  // 15: el reinicio corta la reserva que sonaba.
  const cortada = de(f => f.fin <= reinicio.inicio + 50 && f.fin >= reinicio.inicio - 80 && f !== reinicio);
  expect(cortada.some(f => f.detenida && f.etiqueta?.role === "narrador" && f.etiqueta.kind === "comentario" && !f.etiqueta.texto.startsWith("Ed "))).toBe(true);
  // 20: comentarista #1 tras calma (desde el fin del reinicio) y separación; una sola fuente.
  const c1 = invitado(com1)!;
  expect(c1.inicio - reinicio.fin).toBeGreaterThanOrEqual(MESA_ARENA.calmaMinS * 1000 - 50);
  expect(c1.inicio - invitado(est1)!.fin).toBeGreaterThanOrEqual(MESA_ARENA.separacionInvitadosS * 1000 - 50);
  // 23: el tiro corta al comentarista; el comentarista no cortó nada.
  expect(c1.detenida).toBe(true); expect(Math.abs(c1.fin - tiro.inicio)).toBeLessThan(100);
  for (const i of [est1, com1, est2, com2]) { const f = invitado(i)!; expect(de(o => o !== f && o.detenida && Math.abs(o.fin - f.inicio) < 60)).toEqual([]); }
  // 30 y 40: orden alternado, separación respetada.
  const orden = [est1, com1, est2, com2].map(i => invitado(i)!).sort((a, b) => a.inicio - b.inicio).map(f => f.etiqueta!.role);
  expect(orden).toEqual(["estadista", "comentarista", "estadista", "comentarista"]);
  expect(invitado(est2)!.inicio - c1.fin).toBeGreaterThanOrEqual(MESA_ARENA.separacionInvitadosS * 1000 - 50);
  await expect(page.getByTestId("arena-mesa-comentarista-modo")).toContainText("Template fallback");
  // 60: cierre del narrador; ningún invitado arranca tras el cierre; el estadista final solo como texto.
  const cierre = de(f => f.etiqueta?.kind === "cierre")[0]!;
  expect(cierre).toBeDefined();
  expect(de(f => f.etiqueta?.kind === "invitado" && f.inicio >= cierre.inicio)).toEqual([]);
  expect(invitado(estFinal)).toBeUndefined();
  await expect(page.getByTestId("arena-mesa-estadista")).toContainText(estFinal.oraciones[0]!.texto_en);
  await expect(page.getByTestId("arena-mesa-estadista")).toContainText(`${(estFinal.tick * s).toFixed(1)} s`);
  // Sin solapes (reservas y transiciones incluidas) y silencio máximo dentro del límite hasta el cierre.
  const ordenadas = [...fuentes].sort((a, b) => a.inicio - b.inicio);
  ordenadas.forEach((f, k) => { if (k) expect(f.inicio, JSON.stringify([ordenadas[k - 1], f])).toBeGreaterThanOrEqual(ordenadas[k - 1]!.fin - 60); });
  let fin = ordenadas[0]!.inicio, silencio = 0;
  for (const f of ordenadas) { silencio = Math.max(silencio, f.inicio - fin); fin = Math.max(fin, f.fin); }
  expect(silencio).toBeLessThanOrEqual(VOZ_BUFFER.silencioMaxS * 1000);
  // Móvil 360 px sin desborde, ES/EN.
  await page.setViewportSize({ width: 360, height: 780 });
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  await expect(page.getByTestId("arena-mesa")).toContainText("Mesa de transmisión");
  for (const r of ["relato", "análisis con hechos citados", "dato del partido"]) await expect(page.getByTestId("arena-mesa")).toContainText(r);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("mesa: con noticias continuas y audio del invitado demorado no arranca ningún invitado ni una cesión suelta", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const original = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  // Sin pausas: ninguna excepción de calma por pausa vigente.
  const registro = structuredClone(original); for (const f of [registro.inicial, ...registro.fotogramas, registro.final]) { delete f.pausa; delete f.saque; }
  const id = "00000000-0000-4000-8000-000000000046", corte = 200;
  const intervenciones = [intervencionEstadista(conPlaza(registro, 60).slice(0, 1), 60), (await comentarArena(prefijo(registro, 120), 120, undefined))!, intervencionEstadista(conPlaza(registro, 180).slice(1, 2), 180)];
  // Observación (C11b): hasta tick·pasoS + caducidadInvitadoS de la última intervención. Las noticias siguen
  // hasta el tramo que contiene ese instante; después hay calma y ningún invitado (ya caducado) puede arrancar.
  const finVentanaS = Math.max(...intervenciones.map(i => i.tick)) * ARENA.pasoS + MESA_ARENA.caducidadInvitadoS;
  const ultimoTramoConNoticia = Math.floor(finVentanaS / ARENA.pasoS / BUFFER_ARENA.tramoTicks) * BUFFER_ARENA.tramoTicks;
  const noticia = await audio(BUFFER_ARENA.tramoTicks * ARENA.pasoS), invitadoAudio = await audio(2);
  await preparar(page, id, registro, intervenciones, corte);
  let invitadas = 0;
  await page.route(`**/api/arena/sesiones/${id}/relato`, async r => {
    const p = r.request().postDataJSON() as Pedido;
    if (p.intervencion) {
      invitadas++; await esperar(3000);
      const i = intervenciones.find(x => x.id === p.intervencion)!;
      return r.fulfill({ json: { ...relatoIntervencion(i, registro.config.partido.seed, p.idioma as "es" | "en"), audio: { base64: invitadoAudio, tipo: "audio/wav" } } }).catch(() => {});
    }
    if (p.entradaTick !== undefined) return r.fulfill({ json: segmento(p, p.entradaTick, "Entrada", PRIORIDAD_TIRO, noticia, { tipoRelato: "entrada" }) }).catch(() => {});
    if (p.desdeTick > ultimoTramoConNoticia) return r.fulfill({ json: segmento(p, p.hastaTick, "", 10, null) }).catch(() => {});
    // Una noticia por ventana del narrador (prioridad creciente: cada una corta a la anterior), sin huecos.
    return r.fulfill({ json: segmento(p, p.desdeTick + 1, `Noticia ${p.desdeTick}`, VOZ_BUFFER.prioridadInterrupcion + p.desdeTick / BUFFER_ARENA.tramoTicks, noticia, { tipoRelato: "jugada" }) }).catch(() => {});
  });
  await instrumentar(page);
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  await page.getByRole("button", { name: "Enable narration", exact: true }).click();
  await expect.poll(() => invitadas, { timeout: 10000 }).toBeGreaterThan(0);
  const reloj = page.getByTestId("arena-clock");
  await expect.poll(async () => relojS(await reloj.textContent() ?? ""), { timeout: 60000 }).toBeGreaterThanOrEqual(finVentanaS);
  const finVentana = await page.evaluate(() => performance.now());
  // Cola de calma tras la ventana: con la caducidad vigente, tampoco aquí arranca nadie.
  await expect.poll(async () => relojS(await reloj.textContent() ?? ""), { timeout: 30000 }).toBeGreaterThanOrEqual(finVentanaS + BUFFER_ARENA.tramoTicks * ARENA.pasoS + 2 * MESA_ARENA.calmaMinS + 1);
  const fuentes = await page.evaluate(() => (window as unknown as { mesa: Fuente[] }).mesa);
  await testInfo.attach("mesa-omision.json", { body: JSON.stringify({ fuentes, finVentana }, null, 2), contentType: "application/json" });
  expect(fuentes.length).toBeGreaterThan(3);
  cursorEnVentana(fuentes, intervenciones);
  expect(fuentes.filter(f => f.etiqueta && f.etiqueta.role !== "narrador")).toEqual([]);
  const cesiones = new Set((["es", "en"] as const).flatMap(idioma => (["comentarista", "estadista"] as const).flatMap(rol => MESA_ARENA.cesiones[idioma][rol].map(c => c.replace("{nombre}", MESA_ARENA.nombres[idioma][rol])))));
  expect(fuentes.some(f => f.etiqueta && (cesiones.has(f.etiqueta.texto) || f.etiqueta.kind === "invitado"))).toBe(false);
  // C11b: dentro de la ventana, solo noticias del narrador y sin hueco ≥ calmaMinS entre fuentes consecutivas.
  const enVentana = [...fuentes].filter(f => f.inicio < finVentana).sort((a, b) => a.inicio - b.inicio);
  expect(enVentana.every(f => f.etiqueta?.kind === "jugada" || f.etiqueta?.kind === "entrada"), JSON.stringify(enVentana)).toBe(true);
  let cubierto = enVentana[0]!.inicio, hueco = 0;
  for (const f of enVentana) { hueco = Math.max(hueco, f.inicio - cubierto); cubierto = Math.max(cubierto, f.fin); }
  hueco = Math.max(hueco, finVentana - cubierto);
  expect(hueco, JSON.stringify(enVentana)).toBeLessThan(MESA_ARENA.calmaMinS * 1000);
  // La Mesa muestra igualmente las tarjetas de texto.
  await expect(page.getByTestId("arena-mesa-estadista")).toContainText(intervenciones[2]!.oraciones[0]!.texto_en);
  await expect(page.getByTestId("arena-mesa-comentarista")).toContainText(intervenciones[1]!.oraciones[0]!.texto_en);
});

test("mesa: «Escuchar desde el inicio» inserta las intervenciones del diario en la pista guardada", async ({ page }) => {
  test.setTimeout(120_000);
  const registro = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  // 048: intercambios con turnos materializados (la repetición pide siempre la completa).
  const seed = registro.config.partido.seed;
  const est = componerIntercambio({ intervencion: intervencionEstadista(conPlaza(registro, 300).slice(0, 1), 300), registro: prefijo(registro, 300), seed, forma: "estadista", memoria: memoriaDialogoVacia() }).intervencion;
  const com = componerIntercambio({ intervencion: (await comentarArena(prefijo(registro, 450), 450, undefined))!, registro: prefijo(registro, 450), seed, forma: "pregunta", memoria: memoriaDialogoVacia() }).intervencion;
  for (const i of [est, com]) { expect(i.turnos!.length).toBeGreaterThan(1); expect(comprobarTurnos(i, registro)).toEqual([]); }
  const intervenciones = [com, est]; // el diario no tiene por qué venir ordenado
  const tramoS = 1, invitadoS = 0.5, largoS = VOZ_BUFFER.duracionMaxS + 1;
  const tramo = await audio(tramoS), voz = await audio(invitadoS), larga = await audio(largoS);
  const tramos = Math.ceil(registro.final.tick / 100);
  // Escenarios: todo bien; el comentarista falla con 503; el estadista trae un clip más largo que duracionMaxS.
  const escenarios = [
    { id: "00000000-0000-4000-8000-000000000047", falla: null, largo: null },
    { id: "00000000-0000-4000-8000-000000000048", falla: com.id, largo: null },
    { id: "00000000-0000-4000-8000-000000000049", falla: null, largo: est.id },
  ];
  for (const { id, falla, largo } of escenarios) {
    const pedidos: Pedido[] = [];
    await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { voz: true, analista: false } }));
    await page.route(`**/api/arena/sesiones/${id}/eventos*`, r => r.fulfill({ headers: { "content-type": "text/event-stream" }, body: [{ tipo: "sesion", id, asignacion }, { tipo: "terminada", estado: "completa", metricas: { decisiones: 4, respaldos: 0, duracionMs: 0, esperaModeloMs: [] } }].map((publicacion, i) => `id: ${i + 1}\nevent: arena\ndata: ${JSON.stringify({ id: i + 1, publicacion })}\n\n`).join("") }));
    await page.route(`**/api/arena/sesiones/${id}/reproduccion`, r => r.fulfill({ json: { registro, comentarios: [], intervenciones, asignacion, metricas: { decisiones: 4, respaldos: 0, duracionMs: 0, esperaModeloMs: [] } } }));
    await page.route(`**/api/arena/sesiones/${id}/relato`, r => {
      const p = r.request().postDataJSON() as Pedido; pedidos.push(p);
      if (p.intervencion) {
        if (p.intervencion === falla) return r.fulfill({ status: 503, json: { error: "Speech no disponible en esta prueba" } });
        const i = intervenciones.find(x => x.id === p.intervencion)!;
        return r.fulfill({ json: { ...relatoIntervencion(i, registro.config.partido.seed, p.idioma as "es" | "en", p.variante as "completa" | "breve"), audio: { base64: i.id === largo ? larga : voz, tipo: "audio/wav" } } });
      }
      return r.fulfill({ json: { ...construirRelato(registro, p.desdeTick, p.hastaTick, p.modo as "completo", p.idioma as "es" | "en"), audio: { base64: tramo, tipo: "audio/wav" } } });
    });
    await page.goto(`/arena?partido=${id}`);
    await expect(page.getByTestId("arena-live-status")).toContainText("Match ready", { timeout: 20000 });
    const narracion = page.getByTestId("arena-narration");
    await narracion.getByRole("button", { name: "Listen from the start" }).click();
    await expect(narracion.locator("audio")).toHaveAttribute("src", /blob:/);
    // El progreso cuenta tramos más intervenciones y descuenta las omitidas: al terminar, listos = total.
    const incluidas = intervenciones.filter(i => i.id !== falla && i.id !== largo);
    const estado = narracion.getByRole("status");
    await expect(estado).toHaveAttribute("data-progress-total", String(tramos + incluidas.length));
    await expect(estado).toHaveAttribute("data-progress-ready", String(tramos + incluidas.length));
    if (!falla && !largo) expect(incluidas).toHaveLength(intervenciones.length);
    // Cada id se pide exactamente una vez, por su id del diario y sin memoria.
    for (const i of intervenciones) {
      const suyos = pedidos.filter(p => p.intervencion === i.id);
      expect(suyos).toHaveLength(1);
      expect(suyos[0]).toMatchObject({ desdeTick: i.tick, hastaTick: i.tick, modo: "buffer", variante: "completa" });
      expect(suyos[0]).not.toHaveProperty("memoria");
    }
    await expect.poll(() => narracion.locator("audio").evaluate((a: HTMLAudioElement) => Number.isFinite(a.duration) ? a.duration : 0)).toBeGreaterThan(0);
    const duracion = await narracion.locator("audio").evaluate((a: HTMLAudioElement) => { a.pause(); return a.duration; });
    expect(Math.abs(duracion - (tramos * tramoS + incluidas.length * invitadoS))).toBeLessThanOrEqual(0.1);
    // Recorrido de la pista: cada invitado incluido aparece con su rol en su instante; los omitidos, nunca.
    const transcripcion = page.getByTestId("arena-narration-transcript");
    const ir = (t: number) => narracion.locator("audio").evaluate((a: HTMLAudioElement, t) => { a.currentTime = t; }, t);
    let inicio = 0;
    for (const tramoInicio of Array.from({ length: tramos }, (_, k) => k * 100)) {
      await ir(inicio + tramoS / 2);
      await expect(transcripcion).toHaveAttribute("data-narration-role", "narrador");
      await expect(transcripcion).toHaveAttribute("data-narration-tick", String(tramoInicio));
      inicio += tramoS;
      for (const i of incluidas.filter(x => x.tick > tramoInicio && x.tick <= tramoInicio + 100)) {
        await ir(inicio + invitadoS / 2);
        await expect(transcripcion).toHaveAttribute("data-narration-role", i.rol);
        await expect(transcripcion).toHaveAttribute("data-narration-tick", String(i.tick));
        // 048: la transcripción muestra el rol de cada turno, en orden.
        await expect.poll(() => transcripcion.locator("p[data-narration-role]").evaluateAll(ps => ps.map(p => (p as HTMLElement).dataset.narrationRole))).toEqual(i.turnos!.map(t => t.rol));
        await expect(transcripcion).toHaveAttribute("data-narration-variant", "completa");
        await expect(page.getByTestId("arena-clock")).toHaveText(new RegExp(`^0:${i.tick * ARENA.pasoS} /`));
        inicio += invitadoS;
      }
    }
    await narracion.getByRole("button", { name: "Stop narration" }).click();
  }
});

// ——— Brief 048 · Diálogo entre voces: línea de tiempo controlada ———
const NOMBRES = ["Ari", "Beto", "Ciro", "Dani", "Eloy", "Fede", "Gael", "Hugo", "Iker", "Joel", "Kai", "Lalo", "Mael", "Nilo", "Otto", "Pau", "Quim", "Rui", "Saúl", "Tito", "Ugo", "Vito", "Xavi", "Yago", "Zeno", "Abel", "Bosco", "Cael", "Dino", "Emi", "Fito", "Gus", "Hilo"];
const APELLIDOS = ["Paz", "Gil", "Ros", "Rey", "Luz"];
type Noticia = { id: string; tipo: EventoArena["tipo"]; tick: number; lado: "local" | "visita"; jugador: string; receptor?: string | null; sale?: string };
/** Registro de la línea de tiempo: nombres ficticios cortos, sin pausas, solo las noticias del guion
 * (prioridad ≥ prioridadInterrupcion) y, si se pide, el balón en las manos del portero. */
function lineaControlada(base: RegistroArena, noticias: Noticia[], manos?: { portero: string; desde: number; hasta: number }): RegistroArena {
  let texto = JSON.stringify(base);
  [...base.inicial.jugadores, ...base.inicial.banco ?? []].forEach((j, k) => { texto = texto.split(JSON.stringify(j.nombre)).join(JSON.stringify(`${NOMBRES[k]} ${APELLIDOS[k % APELLIDOS.length]}`)); });
  texto = texto.split(JSON.stringify(base.config.partido.local.nombre)).join(JSON.stringify("Sol")).split(JSON.stringify(base.config.partido.visita.nombre)).join(JSON.stringify("Mar"));
  const r = JSON.parse(texto) as RegistroArena, pase = r.eventos.find(e => e.tipo === "pase")!;
  r.eventos = [...r.eventos.filter(e => (PRIORIDAD_EVENTO_ARENA[e.tipo] ?? 0) < VOZ_BUFFER.prioridadInterrupcion), ...noticias.map(n => ({ ...pase, motivo: undefined, ...n, receptor: n.receptor ?? null }))].sort((a, b) => a.tick - b.tick);
  for (const f of [r.inicial, ...r.fotogramas, r.final]) {
    delete f.pausa; delete f.saque; delete f.balon.manos;
    if (manos && f.tick >= manos.desde && f.tick < manos.hasta) f.balon.manos = { portero: manos.portero, desdeTick: manos.desde, hastaTick: manos.hasta };
  }
  return r;
}
const fielE2e: Parameters<typeof comentarArena>[2] = { id: "modelo-prueba", completar: async (_s, m) => { const c = JSON.parse(m[0]!.contenido); const h = c.hechos.find((h: { id: string }) => h.id === c.principal); return JSON.stringify({ oraciones: [{ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id, apoyo: [] }] }); } };

test("048 · diálogo: ronda completa, pregunta breve gracias a las manos, estadista completo y final solo texto", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const base = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  const s = ARENA.pasoS, t = (seg: number) => Math.round(seg / s);
  const T = { gol: t(8), atajada: t(25), tiro: t(33), cambio: t(45) }, manosHasta = t(29);
  const registro = lineaControlada(base, [
    { id: "n1", tipo: "gol", tick: T.gol, lado: "local", jugador: "local-10" },
    { id: "n2", tipo: "atajada", tick: T.atajada, lado: "visita", jugador: "visita-0", receptor: "local-10" },
    { id: "n3", tipo: "tiro", tick: T.tiro, lado: "local", jugador: "local-10" },
    { id: "n4", tipo: "cambio", tick: T.cambio, lado: "visita", jugador: "visita-13", sale: "visita-14" },
  ], { portero: "visita-0", desde: T.atajada, hasta: manosHasta });
  const seed = registro.config.partido.seed, fin = registro.final.tick, id = "00000000-0000-4000-8000-000000000480", corte = 200;
  // Los invitados ya fueron presentados antes del tramo (nombres cortos): un estado de memoria del fixture.
  const memoria = { recientes: {}, presentados: ["comentarista", "estadista"] as ("comentarista" | "estadista")[] };
  const pre = (tick: number) => prefijo(registro, tick);
  const dato = datosEstadista(pre(T.gol), T.gol).find(d => d.tema === MESA_ARENA.dialogo.temasPorDisparador.gol[0])!;
  const ronda = componerIntercambio({ intervencion: (await comentarArena(pre(T.gol), T.gol, fielE2e, { principal: "arena:n1", tema: "gol" }))!, registro: pre(T.gol), seed, forma: "ronda", dato, memoria }).intervencion;
  const pregunta = componerIntercambio({ intervencion: (await comentarArena(pre(T.atajada), T.atajada, fielE2e, { principal: "arena:n2", tema: "atajada" }))!, registro: pre(T.atajada), seed, forma: "pregunta", memoria }).intervencion;
  const cambios = componerIntercambio({ intervencion: intervencionEstadista(conPlaza(registro, T.cambio).filter(d => d.tema === "cambios"), T.cambio), registro: pre(T.cambio), seed, forma: "estadista", memoria }).intervencion;
  const final = componerIntercambio({ intervencion: intervencionEstadista(conPlaza(registro, fin).slice(0, 1), fin), registro, seed, forma: "final", memoria }).intervencion;
  const intervenciones = [ronda, pregunta, cambios, final];
  expect([ronda.id, pregunta.id, cambios.id]).toEqual([`comentarista:gol:${T.gol}`, `comentarista:atajada:${T.atajada}`, `estadista:cambios:${T.cambio}`]);
  expect([ronda.forma, pregunta.forma, cambios.forma, final.forma]).toEqual(["ronda", "pregunta", "estadista", "final"]);
  for (const i of intervenciones) { expect(comprobarTurnos(i, registro), i.id).toEqual([]); expect(i.turnosBreve, i.id).toBeDefined(); }
  // Duraciones del fixture por (id, variante), no normativas.
  const duracion: Record<string, number> = { [`${ronda.id}|completa`]: 10, [`${ronda.id}|breve`]: 5, [`${pregunta.id}|completa`]: 8, [`${pregunta.id}|breve`]: 4, [`${cambios.id}|completa`]: 6, [`${cambios.id}|breve`]: 4, [`${final.id}|completa`]: 6, [`${final.id}|breve`]: 4 };
  // Precondiciones del guion (márgenes ≥ 1 s): la completa de la ronda cabe hasta la atajada desde el fin de la
  // calma del gol; la de la pregunta no cabe hasta el tiro desde el fin de la atajada, la breve sí.
  const NOTICIA = { gol: 1.5, atajada: 3, tiro: 1.5, cambio: 1.5 };
  const inicioRonda = 8 + NOTICIA.gol + MESA_ARENA.calmaMinS, finRonda = inicioRonda + duracion[`${ronda.id}|completa`]!;
  expect(25 - inicioRonda - duracion[`${ronda.id}|completa`]!).toBeGreaterThanOrEqual(1);
  expect(estimarDuracionS(ronda.turnos!)).toBeLessThanOrEqual(25 - 8 - 1);  // la completa se pide
  const inicioPregunta = Math.max(25 + NOTICIA.atajada, finRonda + MESA_ARENA.separacionInvitadosS);
  expect(25 + NOTICIA.atajada - (finRonda + MESA_ARENA.separacionInvitadosS)).toBeGreaterThanOrEqual(1);
  expect(manosHasta * s - inicioPregunta).toBeGreaterThanOrEqual(1);
  expect(33 - inicioPregunta - duracion[`${pregunta.id}|completa`]!).toBeLessThanOrEqual(-1);
  expect(33 - inicioPregunta - duracion[`${pregunta.id}|breve`]!).toBeGreaterThanOrEqual(1);
  expect(60 - (45 + NOTICIA.cambio + MESA_ARENA.calmaMinS) - duracion[`${cambios.id}|completa`]!).toBeGreaterThanOrEqual(1);
  expect(estimarDuracionS(cambios.turnos!)).toBeLessThanOrEqual(60 - 45 - 1);
  const clips: Record<string, string> = {};
  for (const d of new Set([1.5, 1.7, 3, ...Object.values(duracion)])) clips[d] = await audio(d);
  const narrador: Record<number, [number, string, number, number, string]> = {
    [Math.floor((T.gol - 1) / 50) * 50]: [T.gol, "Gol 8 s", PRIORIDAD_EVENTO_ARENA.gol!, NOTICIA.gol, "n1"],
    [Math.floor((T.atajada - 1) / 50) * 50]: [T.atajada, "Atajada 25 s", PRIORIDAD_EVENTO_ARENA.atajada!, NOTICIA.atajada, "n2"],
    [Math.floor((T.tiro - 1) / 50) * 50]: [T.tiro, "Tiro 33 s", PRIORIDAD_EVENTO_ARENA.tiro!, NOTICIA.tiro, "n3"],
    [Math.floor((T.cambio - 1) / 50) * 50]: [T.cambio, "Cambio 45 s", PRIORIDAD_EVENTO_ARENA.cambio!, NOTICIA.cambio, "n4"],
  };
  const pedidos: Pedido[] = [];
  await preparar(page, id, registro, intervenciones, corte);
  await page.route(`**/api/arena/sesiones/${id}/relato`, async (r: Route) => {
    const p = r.request().postDataJSON() as Pedido; pedidos.push(p);
    if (p.intervencion) {
      await esperar(300);
      const i = intervenciones.find(x => x.id === p.intervencion)!, v = varianteEfectiva(i, (p.variante ?? "completa") as "completa" | "breve");
      return r.fulfill({ json: { ...relatoIntervencion(i, seed, p.idioma as "es" | "en", p.variante as "completa" | "breve"), audio: { base64: clips[duracion[`${i.id}|${v}`]!], tipo: "audio/wav" } } }).catch(() => {});
    }
    if (p.entradaTick !== undefined) { await esperar(200); return r.fulfill({ json: segmento(p, p.entradaTick, "Apertura", 10, clips[1.5]!, { tipoRelato: "entrada" }) }).catch(() => {}); }
    await esperar(200);
    if (p.cierre) return r.fulfill({ json: segmento(p, p.hastaTick, "Final del partido.", 0, clips[1.7]!, { cierre: true, tipoRelato: "cierre" }) }).catch(() => {});
    const v = narrador[p.desdeTick];
    return r.fulfill({ json: v ? segmento(p, v[0], v[1], v[2], clips[v[3]]!, { tipoRelato: "jugada", fuentes: [v[4]] }) : segmento(p, p.hastaTick, "", 10, null) }).catch(() => {});
  });
  await instrumentar(page);
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  const t0 = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: "Enable narration", exact: true }).click();
  const transcripcion = page.getByTestId("arena-voice-transcript"), dialogo = page.getByTestId("arena-mesa-dialogo");
  // Mientras suena la ronda: la Mesa muestra la ronda y nada posterior al cursor (la ventana conocida no adelanta textos).
  await expect(transcripcion).toHaveAttribute("data-narration-tick", String(ronda.tick), { timeout: 20000 });
  await expect(dialogo).toHaveAttribute("data-dialogo-intervencion", ronda.id);
  await expect(dialogo.locator("li")).toHaveCount(ronda.turnos!.length);
  for (const otra of [pregunta, cambios]) await expect(page.getByTestId("arena-mesa")).not.toContainText(otra.turnos!.find(x => x.rol !== "narrador")!.texto_en);
  expect(await page.locator("[data-intervencion-tick]").evaluateAll(es => es.map(e => Number((e as HTMLElement).dataset.intervencionTick)))).toEqual(expect.not.arrayContaining([pregunta.tick, cambios.tick, final.tick]));
  await expect(page.getByTestId("arena-voice-transcript")).not.toContainText("Atajada 25 s");
  await expect(transcripcion).toHaveAttribute("data-narration-tick", String(pregunta.tick), { timeout: 25000 });
  await expect(dialogo).toHaveAttribute("data-dialogo-intervencion", pregunta.id);
  await expect(transcripcion).toHaveAttribute("data-narration-tick", String(cambios.tick), { timeout: 30000 });
  await expect(transcripcion).toHaveAttribute("data-narration-variant", "completa");
  await expect(dialogo).toHaveAttribute("data-dialogo-intervencion", cambios.id);
  await expect(page.getByTestId("arena-voice-status")).toHaveText("End of narration", { timeout: 40000 });
  await page.waitForTimeout(1500);
  const fuentes = (await page.evaluate(() => (window as unknown as { mesa: Fuente[] }).mesa)).map(f => ({ ...f, inicioS: (f.inicio - t0) / 1000, finS: (f.fin - t0) / 1000 }));
  await testInfo.attach("dialogo-linea-de-tiempo.json", { body: JSON.stringify({ fuentes, pedidos }, null, 2), contentType: "application/json" });
  await mkdir(".cache", { recursive: true }); await writeFile(".cache/arena-dialogo-linea.json", JSON.stringify({ fuentes, pedidos }, null, 2));
  const de = (pred: (f: typeof fuentes[number]) => boolean) => fuentes.filter(pred);
  const invitado = (i: IntervencionArena) => de(f => f.etiqueta?.kind === "invitado" && f.etiqueta.tick === i.tick);
  const noticia = (texto: string) => de(f => f.etiqueta?.texto === texto)[0]!;
  // 0: la apertura del narrador arranca primero.
  expect(fuentes[0]!.etiqueta).toMatchObject({ kind: "entrada", role: "narrador" });
  // ≈ 11: la ronda pide sus dos variantes y arranca la completa, sin cortes, con los cuatro roles en orden.
  // v1.2 (9) G01 · la completa que no cabe en el horizonte conocido no se pide (pregunta y final).
  expect(pedidos.filter(p => (p.intervencion === pregunta.id || p.intervencion === final.id) && p.variante === "completa")).toEqual([]);
  const variantesRonda = pedidos.filter(p => p.intervencion === ronda.id).map(p => p.variante).sort();
  expect(variantesRonda).toEqual(["breve", "completa"]);
  const fRonda = invitado(ronda);
  expect(fRonda).toHaveLength(1);
  expect(fRonda[0]!.etiqueta).toMatchObject({ variante: "completa", roles: ["narrador", "comentarista", "narrador", "estadista"] });
  expect(fRonda[0]!.duracion).toBeCloseTo(duracion[`${ronda.id}|completa`]!, 1);
  expect(fRonda[0]!.detenida).toBe(false);
  const gol = noticia("Gol 8 s"), atajada = noticia("Atajada 25 s"), tiro = noticia("Tiro 33 s"), cambio = noticia("Cambio 45 s");
  expect(fRonda[0]!.inicio - gol.fin).toBeGreaterThanOrEqual(MESA_ARENA.calmaMinS * 1000 - 50);
  expect(fRonda[0]!.fin).toBeLessThanOrEqual(atajada.inicio + 50);
  // ≈ 27: la pregunta arranca la breve (la completa no cabe), al quedar libre la fuente y cumplida la separación,
  // antes de «fin de la noticia + calmaMinS» gracias a las manos del portero, y termina antes del tiro.
  const fPregunta = invitado(pregunta);
  expect(fPregunta).toHaveLength(1);
  expect(fPregunta[0]!.etiqueta).toMatchObject({ variante: "breve", roles: pregunta.turnosBreve!.map(x => x.rol) });
  expect(fPregunta[0]!.duracion).toBeCloseTo(duracion[`${pregunta.id}|breve`]!, 1);
  expect(fPregunta[0]!.inicio - fRonda[0]!.fin).toBeGreaterThanOrEqual(MESA_ARENA.separacionInvitadosS * 1000 - 50);
  expect(fPregunta[0]!.inicio).toBeGreaterThanOrEqual(atajada.fin - 60);
  expect(fPregunta[0]!.inicio).toBeLessThan(atajada.fin + MESA_ARENA.calmaMinS * 1000 - 500);
  expect(fPregunta[0]!.fin).toBeLessThanOrEqual(tiro.inicio + 50);
  expect(fPregunta[0]!.detenida).toBe(false);
  // 45: el estadista arranca la completa.
  const fCambios = invitado(cambios);
  expect(fCambios).toHaveLength(1);
  expect(fCambios[0]!.etiqueta).toMatchObject({ variante: "completa", roles: cambios.turnos!.map(x => x.rol) });
  expect(fCambios[0]!.inicio - cambio.fin).toBeGreaterThanOrEqual(MESA_ARENA.calmaMinS * 1000 - 50);
  expect(fCambios[0]!.detenida).toBe(false);
  // 60: la forma final solo es texto en la Mesa; ningún invitado tras el cierre.
  const cierre = de(f => f.etiqueta?.kind === "cierre")[0]!;
  expect(cierre).toBeDefined();
  expect(invitado(final)).toEqual([]);
  expect(de(f => f.etiqueta?.kind === "invitado" && f.inicio >= cierre.inicio)).toEqual([]);
  await expect(dialogo).toHaveAttribute("data-dialogo-intervencion", final.id);
  await expect(page.getByTestId("arena-mesa-estadista")).toContainText(final.oraciones[final.turnos!.find(x => x.rol === "estadista")!.oraciones[0]!]!.texto_en);
  // Todo el recorrido: sin solapes, cursor en la ventana de caducidad, cuerpos con variante y sin memoria.
  const ordenadas = [...fuentes].sort((a, b) => a.inicio - b.inicio);
  ordenadas.forEach((f, k) => { if (k) expect(f.inicio, JSON.stringify([ordenadas[k - 1], f])).toBeGreaterThanOrEqual(ordenadas[k - 1]!.fin - 60); });
  cursorEnVentana(fuentes, intervenciones);
  const deInvitados = pedidos.filter(p => p.intervencion);
  expect(deInvitados.length).toBeGreaterThan(0);
  for (const p of deInvitados) { expect(p).not.toHaveProperty("memoria"); expect(["completa", "breve"]).toContain(p.variante); }
  // Cada variante se pide una sola vez.
  expect(new Set(deInvitados.map(p => `${p.intervencion}|${p.variante}`)).size).toBe(deInvitados.length);
  // 360 px sin desborde, ES.
  await page.setViewportSize({ width: 360, height: 780 });
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  await expect(dialogo).toContainText("Última conversación");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("048 · con la breve retrasada 3 s y la completa que no cabe, el invitado espera y arranca la breve en cuanto llega", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const base = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  const tickTiro = Math.round(10 / ARENA.pasoS), tickInvitado = Math.round(2 / ARENA.pasoS);
  const registro = lineaControlada(base, [{ id: "n1", tipo: "tiro", tick: tickTiro, lado: "local", jugador: "local-10" }]);
  const seed = registro.config.partido.seed, id = "00000000-0000-4000-8000-000000000481";
  const memoria = { recientes: {}, presentados: [] as ("comentarista" | "estadista")[] };
  const i = componerIntercambio({ intervencion: (await comentarArena(prefijo(registro, tickInvitado), tickInvitado, fielE2e))!, registro: prefijo(registro, tickInvitado), seed, forma: "pregunta", memoria }).intervencion;
  expect(i.turnosBreve).toBeDefined(); expect(comprobarTurnos(i, registro)).toEqual([]);
  const completaS = 9, breveS = 3, retrasoMs = 3000, aperturaS = 2;
  // La completa no cabe hasta el tiro desde el instante del invitado; la breve sí.
  expect(completaS).toBeGreaterThan((tickTiro - tickInvitado) * ARENA.pasoS);
  const clips = { completa: await audio(completaS), breve: await audio(breveS), apertura: await audio(aperturaS), tiro: await audio(1.5) };
  await preparar(page, id, registro, [i], 200);
  const respuestas: Record<string, number> = {}, pedidos: Pedido[] = [];
  await page.route(`**/api/arena/sesiones/${id}/relato`, async r => {
    const p = r.request().postDataJSON() as Pedido; pedidos.push(p);
    if (p.intervencion) {
      if (p.variante === "breve") await esperar(retrasoMs);
      respuestas[p.variante ?? "completa"] = Date.now();
      return r.fulfill({ json: { ...relatoIntervencion(i, seed, p.idioma as "es" | "en", p.variante as "completa" | "breve"), audio: { base64: p.variante === "breve" ? clips.breve : clips.completa, tipo: "audio/wav" } } }).catch(() => {});
    }
    if (p.entradaTick !== undefined) { await esperar(200); return r.fulfill({ json: segmento(p, p.entradaTick, "Apertura", 10, clips.apertura, { tipoRelato: "entrada" }) }).catch(() => {}); }
    if (p.desdeTick === Math.floor((tickTiro - 1) / 50) * 50) return r.fulfill({ json: segmento(p, tickTiro, "Tiro 10 s", PRIORIDAD_EVENTO_ARENA.tiro!, clips.tiro, { tipoRelato: "jugada", fuentes: ["n1"] }) }).catch(() => {});
    return r.fulfill({ json: segmento(p, p.hastaTick, "", 10, null) }).catch(() => {});
  });
  await instrumentar(page);
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  // Relación entre el reloj de la página y el de Node.
  const desfase = await page.evaluate(() => Date.now() - performance.now());
  await page.getByRole("button", { name: "Enable narration", exact: true }).click();
  await expect(page.getByTestId("arena-voice-transcript")).toHaveAttribute("data-narration-kind", "invitado", { timeout: 15000 });
  const arranque = await page.evaluate(() => performance.now());
  // v1.2 (9) G04 · se observa hasta que el invitado caduca: al arrancar la breve se descartó la
  // completa, que no vuelve a pedirse ni a sonar aunque después cupiera (tras el tiro no hay noticias).
  await expect.poll(async () => relojS(await page.getByTestId("arena-clock").textContent() ?? ""), { timeout: 30000 }).toBeGreaterThanOrEqual(tickInvitado * ARENA.pasoS + MESA_ARENA.caducidadInvitadoS + 1);
  const fuentes = await page.evaluate(() => (window as unknown as { mesa: Fuente[] }).mesa);
  await testInfo.attach("dialogo-breve-retrasada.json", { body: JSON.stringify({ fuentes, pedidos, respuestas, desfase }, null, 2), contentType: "application/json" });
  expect(fuentes.filter(f => f.inicio > arranque + 100)).toEqual(fuentes.filter(f => f.inicio > arranque + 100 && f.etiqueta?.kind !== "invitado"));
  const apertura = fuentes.find(f => f.etiqueta?.kind === "entrada")!, invitados = fuentes.filter(f => f.etiqueta?.kind === "invitado");
  expect(invitados).toHaveLength(1);
  expect(invitados[0]!.etiqueta).toMatchObject({ variante: "breve" });
  expect(invitados[0]!.duracion).toBeCloseTo(breveS, 1);
  const llegadaBreve = respuestas.breve! - desfase; // en el reloj de la página
  // Esperó: la apertura terminó y el cursor ya había alcanzado al invitado antes de que llegara la breve…
  expect(llegadaBreve - apertura.fin).toBeGreaterThanOrEqual(300);
  expect(apertura.relojS + aperturaS).toBeGreaterThanOrEqual(tickInvitado * ARENA.pasoS - 1);
  // …y arrancó la breve en cuanto llegó (decodificación incluida).
  expect(invitados[0]!.inicio).toBeGreaterThanOrEqual(llegadaBreve - 50);
  expect(invitados[0]!.inicio - llegadaBreve).toBeLessThan(1000);
  // Nada sonó entre la apertura y la breve (ninguna reserva le ganó el hueco).
  expect(fuentes.filter(f => f.inicio > apertura.inicio && f.inicio < invitados[0]!.inicio)).toEqual([]);
});

test("048 · completa decodificada que ya no cabe cuando llega el turno: arranca la breve y termina antes de la noticia", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const base = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  const s = ARENA.pasoS, tGol = Math.round(8 / s), tTiro = Math.round(20 / s);
  const registro = lineaControlada(base, [
    { id: "n1", tipo: "gol", tick: tGol, lado: "local", jugador: "local-10" },
    { id: "n2", tipo: "tiro", tick: tTiro, lado: "visita", jugador: "visita-9" },
  ]);
  const seed = registro.config.partido.seed, id = "00000000-0000-4000-8000-000000000482";
  const memoria = { recientes: {}, presentados: ["comentarista", "estadista"] as ("comentarista" | "estadista")[] };
  const i = componerIntercambio({ intervencion: (await comentarArena(prefijo(registro, tGol), tGol, fielE2e, { principal: "arena:n1", tema: "gol" }))!, registro: prefijo(registro, tGol), seed, forma: "pregunta", memoria }).intervencion;
  expect(i.forma).toBe("pregunta"); expect(i.turnosBreve).toBeDefined(); expect(comprobarTurnos(i, registro)).toEqual([]);
  const noticiaS = 1.5, inicio = 8 + noticiaS + MESA_ARENA.calmaMinS, completaS = 10.5, breveS = 4;
  // Precondiciones (márgenes ≥ 1 s): la estimación de la completa cabe en la ventana conocida al pedirla
  // (desde el gol), así que se pide y se decodifica; su duración real ya no cabe cuando llega el turno.
  expect(estimarDuracionS(i.turnos!)).toBeLessThanOrEqual(20 - 8 - 1);
  expect(completaS - (20 - inicio)).toBeGreaterThanOrEqual(1);
  expect(20 - inicio - breveS).toBeGreaterThanOrEqual(1);
  const clips = { completa: await audio(completaS), breve: await audio(breveS), apertura: await audio(1.5), noticia: await audio(noticiaS) };
  await preparar(page, id, registro, [i], 200);
  const pedidos: Pedido[] = [];
  await page.route(`**/api/arena/sesiones/${id}/relato`, async r => {
    const p = r.request().postDataJSON() as Pedido; pedidos.push(p);
    if (p.intervencion) { await esperar(300); return r.fulfill({ json: { ...relatoIntervencion(i, seed, p.idioma as "es" | "en", p.variante as "completa" | "breve"), audio: { base64: p.variante === "breve" ? clips.breve : clips.completa, tipo: "audio/wav" } } }).catch(() => {}); }
    if (p.entradaTick !== undefined) { await esperar(200); return r.fulfill({ json: segmento(p, p.entradaTick, "Apertura", 10, clips.apertura, { tipoRelato: "entrada" }) }).catch(() => {}); }
    await esperar(200);
    if (p.desdeTick === Math.floor((tGol - 1) / 50) * 50) return r.fulfill({ json: segmento(p, tGol, "Gol 8 s", PRIORIDAD_EVENTO_ARENA.gol!, clips.noticia, { tipoRelato: "jugada", fuentes: ["n1"] }) }).catch(() => {});
    if (p.desdeTick === Math.floor((tTiro - 1) / 50) * 50) return r.fulfill({ json: segmento(p, tTiro, "Tiro 20 s", PRIORIDAD_EVENTO_ARENA.tiro!, clips.noticia, { tipoRelato: "jugada", fuentes: ["n2"] }) }).catch(() => {});
    return r.fulfill({ json: segmento(p, p.hastaTick, "", 10, null) }).catch(() => {});
  });
  await instrumentar(page);
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  await page.getByRole("button", { name: "Enable narration", exact: true }).click();
  await expect(page.getByTestId("arena-voice-transcript")).toHaveAttribute("data-narration-kind", "invitado", { timeout: 20000 });
  await expect.poll(async () => relojS(await page.getByTestId("arena-clock").textContent() ?? ""), { timeout: 20000 }).toBeGreaterThanOrEqual(21);
  const fuentes = await page.evaluate(() => (window as unknown as { mesa: Fuente[] }).mesa);
  await testInfo.attach("dialogo-completa-no-cabe.json", { body: JSON.stringify({ fuentes, pedidos }, null, 2), contentType: "application/json" });
  // Las dos variantes se pidieron (la completa cabía en la ventana conocida al pedirla).
  expect(pedidos.filter(p => p.intervencion === i.id).map(p => p.variante).sort()).toEqual(["breve", "completa"]);
  const invitados = fuentes.filter(f => f.etiqueta?.kind === "invitado"), gol = fuentes.find(f => f.etiqueta?.texto === "Gol 8 s")!, tiro = fuentes.find(f => f.etiqueta?.texto === "Tiro 20 s")!;
  expect(invitados).toHaveLength(1);
  expect(invitados[0]!.etiqueta).toMatchObject({ variante: "breve", roles: i.turnosBreve!.map(t => t.rol) });
  expect(invitados[0]!.duracion).toBeCloseTo(breveS, 1);
  expect(invitados[0]!.inicio - gol.fin).toBeGreaterThanOrEqual(MESA_ARENA.calmaMinS * 1000 - 50);
  expect(invitados[0]!.detenida).toBe(false);
  expect(invitados[0]!.fin).toBeLessThanOrEqual(tiro.inicio + 50);
});

test("048 v1.2 G03 · una noticia alcanzada pero pendiente de sonar anula la ventana: el invitado espera y no es cortado", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const base = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  const s = ARENA.pasoS, tGol = Math.round(8 / s), tTiro = Math.round(40 / s), tInvitado = Math.round(7.5 / s);
  const registro = lineaControlada(base, [
    { id: "n1", tipo: "gol", tick: tGol, lado: "local", jugador: "local-10" },
    { id: "n2", tipo: "tiro", tick: tTiro, lado: "visita", jugador: "visita-9" },
  ]);
  const seed = registro.config.partido.seed, id = "00000000-0000-4000-8000-000000000483";
  const memoria = { recientes: {}, presentados: ["comentarista", "estadista"] as ("comentarista" | "estadista")[] };
  const i = componerIntercambio({ intervencion: (await comentarArena(prefijo(registro, tInvitado), tInvitado, fielE2e))!, registro: prefijo(registro, tInvitado), seed, forma: "pregunta", memoria }).intervencion;
  expect(comprobarTurnos(i, registro)).toEqual([]);
  // Apertura larga: termina justo después de alcanzar el gol; la noticia del gol llega con el cursor ≥ 9 s.
  const aperturaS = 7.8, noticiaS = 1.5, breveS = 3, completaS = 5, llegaGolS = 9;
  const clips = { completa: await audio(completaS), breve: await audio(breveS), apertura: await audio(aperturaS), noticia: await audio(noticiaS) };
  await preparar(page, id, registro, [i], 200);
  await page.route(`**/api/arena/sesiones/${id}/relato`, async r => {
    const p = r.request().postDataJSON() as Pedido;
    if (p.intervencion) { await esperar(300); return r.fulfill({ json: { ...relatoIntervencion(i, seed, p.idioma as "es" | "en", p.variante as "completa" | "breve"), audio: { base64: p.variante === "breve" ? clips.breve : clips.completa, tipo: "audio/wav" } } }).catch(() => {}); }
    if (p.entradaTick !== undefined) { await esperar(200); return r.fulfill({ json: segmento(p, p.entradaTick, "Apertura", 10, clips.apertura, { tipoRelato: "entrada" }) }).catch(() => {}); }
    if (p.desdeTick === Math.floor((tGol - 1) / 50) * 50) {
      // La noticia del gol llega tarde (dentro del atraso admitido): mientras tanto está pendiente.
      while (relojS(await page.getByTestId("arena-clock").textContent().catch(() => "") ?? "") < llegaGolS) await esperar(100);
      return r.fulfill({ json: segmento(p, tGol, "Gol 8 s", PRIORIDAD_EVENTO_ARENA.gol!, clips.noticia, { tipoRelato: "jugada", fuentes: ["n1"] }) }).catch(() => {});
    }
    await esperar(200);
    return r.fulfill({ json: segmento(p, p.hastaTick, "", 10, null) }).catch(() => {});
  });
  await instrumentar(page);
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  await page.getByRole("button", { name: "Enable narration", exact: true }).click();
  await expect(page.getByTestId("arena-voice-transcript")).toHaveAttribute("data-narration-kind", "invitado", { timeout: 25000 });
  await expect.poll(async () => relojS(await page.getByTestId("arena-clock").textContent() ?? ""), { timeout: 20000 }).toBeGreaterThanOrEqual(20);
  const fuentes = await page.evaluate(() => (window as unknown as { mesa: Fuente[] }).mesa);
  await testInfo.attach("dialogo-noticia-pendiente.json", { body: JSON.stringify({ fuentes }, null, 2), contentType: "application/json" });
  const apertura = fuentes.find(f => f.etiqueta?.kind === "entrada")!, gol = fuentes.find(f => f.etiqueta?.texto === "Gol 8 s")!, invitados = fuentes.filter(f => f.etiqueta?.kind === "invitado");
  expect(gol).toBeDefined();
  // Precondición: hubo un hueco sin fuente entre el fin de la apertura y la noticia del gol, con el
  // cursor ya en el invitado (≥ 7,5 s): ahí un consumidor sin «pendiente» habría arrancado al invitado.
  expect(apertura.relojS + aperturaS).toBeGreaterThanOrEqual(tInvitado * s);
  expect(gol.inicio - apertura.fin).toBeGreaterThanOrEqual(200);
  expect(invitados).toHaveLength(1);
  expect(invitados[0]!.detenida).toBe(false);
  expect(invitados[0]!.inicio - gol.fin).toBeGreaterThanOrEqual(MESA_ARENA.calmaMinS * 1000 - 50);
});
