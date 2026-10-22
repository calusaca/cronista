// Brief 053 (v1.1) · Descargar comentarios y audio de la transmisión. Rutas simuladas como en
// arena-mesa.spec.ts (`reproduccion`/`emision`/`eventos` con un registro público, una intervención
// 048 con turnos, una 045 y un comentario del narrador; `relato` con clips WAV sintéticos
// distinguibles; `herramientas` con voz). La compatibilidad de importación va contra el validador
// real (sin interceptar `/api/arena`).
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test, type Download, type Page } from "@playwright/test";
import { VOZ_BUFFER } from "../src/arena/buffer";
import { componerIntercambio, memoriaDialogoVacia } from "../src/arena/dialogo";
import { datosEstadista, intervencionEstadista } from "../src/arena/estadista";
import { comentarArena, narrarArena } from "../src/arena/narrador";
import { wavMono } from "../src/arena/pista-audio";
import { RELATO_INTERVALOS, type IntervencionArena } from "../src/arena/protocolo";
import { construirRelato, relatoIntervencion } from "../src/arena/relato";
import type { RegistroArena } from "../src/arena/tipos";
import { construirTranscripcion, escaparMarkdown, transcripcionJson, type TranscripcionArena } from "../src/arena/transcripcion";
import { ARENA } from "../src/sim/limites";

const sr = 24000;
const prefijo = (r: RegistroArena, t: number): RegistroArena => ({ ...r, eventos: r.eventos.filter(e => e.tick <= t), fotogramas: r.fotogramas.filter(f => f.tick <= t), rondas: r.rondas.filter(x => x.inicioTick < t), final: [...r.fotogramas].reverse().find(f => f.tick <= t)! });
/** Clip mono distinguible: seno de frecuencia propia y duración propia. */
const muestrasDe = (segundos: number) => Math.round(segundos * sr);
const clip = async (segundos: number, hz: number) => Buffer.from(await wavMono([Float32Array.from({ length: muestrasDe(segundos) }, (_, i) => 0.1 * Math.sin(2 * Math.PI * hz * i / sr))], sr).arrayBuffer()).toString("base64");
const fiel: Parameters<typeof narrarArena>[2] = { id: "modelo-prueba", completar: async (_s, m) => { const c = JSON.parse(m[0]!.contenido); const h = c.hechos.find((h: { id: string }) => h.id === c.principal); return JSON.stringify({ oraciones: [{ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id, apoyo: [] }] }); } };
const asignacion = { modo: "programado", local: { nombre: "Local" }, visita: { nombre: "Visita" } };
const metricas = { decisiones: 4, respaldos: 0, duracionMs: 0, esperaModeloMs: [] };

const registro = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
const seed = registro.config.partido.seed;
const gol = registro.eventos.find(e => e.tipo === "gol")!;
const pGol = prefijo(registro, gol.tick);
const com048 = componerIntercambio({ intervencion: (await comentarArena(pGol, gol.tick, fiel, { principal: `arena:${gol.id}`, tema: "gol" }))!, registro: pGol, seed, forma: "pregunta", memoria: memoriaDialogoVacia() }).intervencion;
const est045 = intervencionEstadista(datosEstadista(prefijo(registro, 300), 300).filter(d => d.ocupaPlaza).slice(0, 1), 300);
const comentario = (await narrarArena(prefijo(registro, 150), 150, fiel))!;
const intervenciones: IntervencionArena[] = [est045, com048]; // el diario no tiene por qué venir ordenado
const turnoComentarista = com048.turnos!.find(t => t.rol === "comentarista")!;
const idsRegistro = new Set(registro.eventos.map(e => e.id));

/** Clips por tramo e idioma (frecuencia y duración propias) y por invitado; el estadista trae un clip
 * más largo que duracionMaxS, que ArenaNarracion omite. */
const tramos = Math.ceil(registro.final.tick / RELATO_INTERVALOS.completo);
const durTramo = (k: number, idioma: string) => 0.3 + 0.07 * k + (idioma === "es" ? 0.05 : 0);
const durInvitado: Record<string, number> = { [com048.id]: 0.65, [est045.id]: VOZ_BUFFER.duracionMaxS + 1 };
const omitido = est045.id;
const hzTramo = (k: number, idioma: string) => 220 + 40 * k + (idioma === "es" ? 15 : 0);
const hzInvitado = (id: string, idioma: string) => (id === omitido ? 300 : 900) + (idioma === "es" ? 25 : 0);
/** Ronda 2 · Montaje esperado (regla de ArenaNarracion, reescrita aquí): cada tramo del narrador y, tras
 * él, los invitados con tick ≤ su hastaTick, en orden de tick; el clip demasiado largo se omite. */
function montaje(idioma: "es" | "en") {
  const invitados = [...intervenciones].sort((a, b) => a.tick - b.tick), piezas: { muestras: number; hz: number }[] = [];
  for (let k = 0, j = 0; k < tramos; k++) {
    piezas.push({ muestras: muestrasDe(durTramo(k, idioma)), hz: hzTramo(k, idioma) });
    const hasta = Math.min((k + 1) * RELATO_INTERVALOS.completo, registro.final.tick);
    while (j < invitados.length && invitados[j]!.tick <= hasta) { const i = invitados[j++]!; if (i.id !== omitido) piezas.push({ muestras: muestrasDe(durInvitado[i.id]!), hz: hzInvitado(i.id, idioma) }); }
  }
  return piezas;
}
/** Frecuencia por cruces por cero en [desde, desde + n) muestras del PCM 16 bits tras la cabecera. */
function frecuencia(wav: Buffer, desde: number, n: number) {
  let cruces = 0, previo = wav.readInt16LE(44 + 2 * desde);
  for (let k = 1; k < n; k++) { const v = wav.readInt16LE(44 + 2 * (desde + k)); if ((previo < 0) !== (v < 0)) cruces++; previo = v; }
  return cruces / 2 / (n / sr);
}
/** Cada pieza suena con su frecuencia en su posición: el orden de montaje es el esperado. */
function comprobarMontaje(wav: Buffer, idioma: "es" | "en") {
  const piezas = montaje(idioma);
  expect(wav.length).toBe(44 + 2 * piezas.reduce((t, x) => t + x.muestras, 0));
  let inicio = 0;
  for (const [k, pieza] of piezas.entries()) {
    const n = Math.min(3600, Math.floor(pieza.muestras / 2));
    expect(Math.abs(frecuencia(wav, inicio + Math.floor(pieza.muestras / 4), n) - pieza.hz), `${idioma} pieza ${k}`).toBeLessThanOrEqual(8);
    inicio += pieza.muestras;
  }
}

async function guardado(page: Page, id: string) {
  const pedidos: { intervencion?: string }[] = [];
  const clips = new Map<string, string>();
  const clipDe = async (clave: string, segundos: number, hz: number) => { if (!clips.has(clave)) clips.set(clave, await clip(segundos, hz)); return clips.get(clave)!; };
  await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { voz: true, analista: false } }));
  await page.route(`**/api/arena/sesiones/${id}/eventos*`, r => r.fulfill({ headers: { "content-type": "text/event-stream" }, body: [{ tipo: "sesion", id, asignacion }, { tipo: "terminada", estado: "completa", metricas }].map((publicacion, i) => `id: ${i + 1}\nevent: arena\ndata: ${JSON.stringify({ id: i + 1, publicacion })}\n\n`).join("") }));
  await page.route(`**/api/arena/sesiones/${id}/reproduccion`, r => r.fulfill({ json: { registro, comentarios: [comentario], intervenciones, asignacion, metricas } }));
  await page.route(`**/api/arena/sesiones/${id}/relato`, async r => {
    const p = r.request().postDataJSON() as { desdeTick: number; hastaTick: number; modo: string; idioma: "es" | "en"; intervencion?: string; variante?: string };
    pedidos.push(p);
    if (p.intervencion) {
      const i = intervenciones.find(x => x.id === p.intervencion)!;
      const base64 = await clipDe(`${i.id}:${p.idioma}`, durInvitado[i.id]!, hzInvitado(i.id, p.idioma));
      return r.fulfill({ json: { ...relatoIntervencion(i, seed, p.idioma, "completa"), audio: { base64, tipo: "audio/wav" } } });
    }
    const k = p.desdeTick / RELATO_INTERVALOS.completo;
    const base64 = await clipDe(`tramo:${k}:${p.idioma}`, durTramo(k, p.idioma), hzTramo(k, p.idioma));
    return r.fulfill({ json: { ...construirRelato(registro, p.desdeTick, p.hastaTick, "completo", p.idioma), audio: { base64, tipo: "audio/wav" } } });
  });
  await page.goto(`/arena?partido=${id}`);
  await expect(page.getByTestId("arena-live-status")).toContainText("Match ready", { timeout: 20000 });
  return pedidos;
}
const leerDescarga = async (d: Download) => readFile((await d.path())!);
async function descargar(page: Page, nombre: string) {
  const descarga = page.waitForEvent("download");
  await page.getByRole("button", { name: nombre, exact: true }).click();
  const d = await descarga;
  return { nombre: d.suggestedFilename(), datos: await leerDescarga(d) };
}

test("053 · guardado: comentarios completos al final y parciales con el cursor a mitad, en EN y ES", async ({ page, request }) => {
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  const id = "00000000-0000-4000-8000-000000000531";
  const pedidos = await guardado(page, id);
  const seccion = page.getByTestId("arena-downloads");
  await page.getByRole("slider", { name: "Match time" }).press("End");
  await expect(seccion).toHaveAttribute("data-partial", "false");
  await expect(seccion).toHaveAttribute("data-until-tick", String(registro.final.tick));
  const json = await descargar(page, "Download commentary (JSON)");
  expect(json.nombre).toBe(`cronista-arena-${seed}-comentarios-en.json`);
  const t = JSON.parse(json.datos.toString("utf8")) as TranscripcionArena;
  expect(t.alcance).toEqual({ hastaTick: registro.final.tick, parcial: false });
  expect(t.importable).toBe(false);
  expect(t.lineas.map(l => l.tick)).toEqual([...t.lineas.map(l => l.tick)].sort((a, b) => a - b));
  expect(new Set(t.lineas.map(l => l.rol))).toEqual(new Set(["narrador", "comentarista", "estadista"]));
  for (const l of t.lineas) for (const e of l.evidencia.eventos) expect(idsRegistro.has(e), e).toBe(true);
  const textos = t.lineas.map(l => l.texto);
  expect(textos).toContain(turnoComentarista.texto_en);
  expect(textos).toContain(comentario.oraciones[0]!.texto_en);
  expect(textos).toContain(est045.oraciones[0]!.texto_en);
  expect(t.diario.comentarios).toEqual([comentario]);
  expect(t.registro.sesion).toBe(id);
  // No es un registro: el validador real lo rechaza.
  expect((await request.post("/api/arena", { data: { accion: "reproducir", registro: t } })).status()).toBe(400);

  const md = await descargar(page, "Download commentary (Markdown)");
  expect(md.nombre).toBe(`cronista-arena-${seed}-comentarios-en.md`);
  const texto = md.datos.toString("utf8");
  expect(md.datos.subarray(0, 3).toString("hex")).not.toBe("efbbbf");
  expect(texto).toContain(`${escaparMarkdown(registro.config.partido.local.nombre)} ${registro.final.marcador.local}–${registro.final.marcador.visita} ${escaparMarkdown(registro.config.partido.visita.nombre)}`);
  expect(texto).toContain("Broadcast");
  for (const x of [turnoComentarista.texto_en, comentario.oraciones[0]!.texto_en, est045.oraciones[0]!.texto_en]) expect(texto).toContain(escaparMarkdown(x));
  expect(/partial/i.test(texto)).toBe(false);

  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  const es = (await descargar(page, "Descargar comentarios (Markdown)"));
  expect(es.nombre).toBe(`cronista-arena-${seed}-comentarios-es.md`);
  expect(es.datos.toString("utf8")).toContain(escaparMarkdown(turnoComentarista.texto_es));
  expect(es.datos.toString("utf8")).toContain("Transmisión");

  // v1.1 § 4 · Repetición pausada a mitad: parcial y nada posterior al cursor.
  await page.getByRole("slider", { name: "Tiempo de juego" }).fill("25");
  await expect(seccion).toHaveAttribute("data-partial", "true");
  await expect(seccion).toHaveAttribute("data-until-tick", "250");
  const mitad = await descargar(page, "Descargar comentarios (JSON)");
  expect(mitad.nombre).toBe(`cronista-arena-${seed}-comentarios-es-parcial-250.json`);
  const p = JSON.parse(mitad.datos.toString("utf8")) as TranscripcionArena;
  expect(p.alcance).toEqual({ hastaTick: 250, parcial: true });
  expect(p.lineas.length).toBeGreaterThan(0);
  expect(p.lineas.every(l => l.tick <= 250)).toBe(true);
  expect([...p.diario.comentarios, ...p.diario.intervenciones].every(x => x.tick <= 250)).toBe(true);
  expect(p.diario.intervenciones.map(i => i.id)).toEqual([com048.id]);
  expect(p.lineas.map(l => l.texto)).not.toContain(est045.oraciones[0]!.texto_es);
  expect(p.partido.marcador).toEqual({ local: gol.lado === "local" ? 1 : 0, visita: gol.lado === "visita" ? 1 : 0 });
  // Descargar no pide relato ni síntesis.
  expect(pedidos).toHaveLength(0);
  // 360 px: la sección no desborda.
  await page.setViewportSize({ width: 360, height: 800 });
  const caja = await seccion.evaluate(el => ({ ancho: el.scrollWidth, visible: el.clientWidth, derecha: el.getBoundingClientRect().right }));
  expect(caja.ancho).toBeLessThanOrEqual(caja.visible);
  expect(caja.derecha).toBeLessThanOrEqual(360);
  expect(errores).toEqual([]);
});

test("053 · en vivo (búfer): parcial hasta el reloj visible, sin nada por delante del cursor", async ({ page }) => {
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  const id = "00000000-0000-4000-8000-000000000532", corte = 300;
  const enSnapshot = intervenciones.filter(i => i.tick <= corte);
  await page.route(`**/api/arena/sesiones/${id}/emision`, r => r.fulfill({ json: { registro: prefijo(registro, corte), comentarios: [comentario], intervenciones: enSnapshot, asignacion, metricas: {}, estado: "ejecutando", ultimoMensaje: 1 } }));
  const tardia = { ...intervencionEstadista(datosEstadista(registro, 450).filter(d => d.ocupaPlaza).slice(0, 1), 450), id: "estadista:tardio:450" };
  const publicaciones = [
    ...registro.rondas.filter(x => x.inicioTick >= corte).map(ronda => ({ tipo: "ordenes", ronda })),
    { tipo: "avance", estado: registro.final, fotogramas: registro.fotogramas.filter(f => f.tick > corte), eventos: registro.eventos.filter(e => e.tick > corte) },
    { tipo: "intervencion", intervencion: tardia },
  ];
  await page.route(`**/api/arena/sesiones/${id}/eventos*`, r => r.fulfill({ headers: { "content-type": "text/event-stream" }, body: publicaciones.map((publicacion, i) => `id: ${i + 2}\nevent: arena\ndata: ${JSON.stringify({ id: i + 2, publicacion })}\n\n`).join("") }));
  await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { voz: true, analista: false } }));
  let relatos = 0;
  await page.route(`**/api/arena/sesiones/${id}/relato`, r => { relatos++; return r.fulfill({ status: 404, json: { error: "Sin voz en esta prueba" } }); });
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  await expect(page.getByTestId("arena-buffer-status")).toContainText("Live");
  const segundosReloj = (s: string) => { const m = /^(\d+):(\d{2})/.exec(s.trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
  await expect.poll(async () => segundosReloj(await page.getByTestId("arena-clock").innerText()), { timeout: 20000 }).toBeGreaterThan(5);
  const seccion = page.getByTestId("arena-downloads");
  await expect(seccion).toHaveAttribute("data-partial", "true");
  // El reloj se lee y el botón se pulsa en la misma tarea de la página: ningún render en medio.
  const descarga = page.waitForEvent("download");
  const reloj = await page.evaluate(() => {
    const texto = document.querySelector('[data-testid="arena-clock"]')!.textContent!;
    [...document.querySelectorAll<HTMLButtonElement>('[data-testid="arena-downloads"] button')].find(b => b.textContent === "Download commentary (JSON)")!.click();
    return texto;
  });
  const d = await descarga;
  const t = JSON.parse((await leerDescarga(d)).toString("utf8")) as TranscripcionArena;
  const tickReloj = segundosReloj(reloj) / ARENA.pasoS;
  expect(t.alcance.parcial).toBe(true);
  expect(t.alcance.hastaTick).toBeGreaterThanOrEqual(tickReloj);
  expect(t.alcance.hastaTick).toBeLessThanOrEqual(tickReloj + 10);
  expect(d.suggestedFilename()).toBe(`cronista-arena-${seed}-comentarios-en-parcial-${t.alcance.hastaTick}.json`);
  expect(t.lineas.length).toBeGreaterThan(0);
  expect(t.lineas.every(l => l.tick <= t.alcance.hastaTick)).toBe(true);
  expect([...t.diario.comentarios, ...t.diario.intervenciones].every(x => x.tick <= t.alcance.hastaTick)).toBe(true);
  // El cliente ya tenía fotogramas, el comentario y las intervenciones (también la tardía) por delante del cursor.
  expect(t.alcance.hastaTick).toBeLessThan(registro.final.tick);
  expect(t.diario.comentarios).toEqual(comentario.tick <= t.alcance.hastaTick ? [comentario] : []);
  expect(t.diario.intervenciones.map(i => i.id)).toEqual([...intervenciones, tardia].filter(i => i.tick <= t.alcance.hastaTick).map(i => i.id));
  expect(t.alcance.hastaTick).toBeLessThan(tardia.tick);
  expect(t.registro.eventos).toBe(registro.eventos.filter(e => e.tick <= t.alcance.hastaTick).length);
  expect(relatos).toBe(0);
  expect(errores).toEqual([]);
});

test("053 · WAV: el mismo blob del <audio> (hash igual), sin síntesis nuevas, y se suelta al cambiar de idioma", async ({ page }) => {
  test.setTimeout(120_000);
  const id = "00000000-0000-4000-8000-000000000533";
  const pedidos = await guardado(page, id);
  const narracion = page.getByTestId("arena-narration"), boton = narracion.getByTestId("arena-narration-download");
  await expect(boton).toBeDisabled();
  await expect(narracion.getByTestId("arena-narration-download-help")).toBeVisible();
  const preparar = async (escuchar: string) => {
    await narracion.getByRole("button", { name: escuchar }).click();
    await expect(narracion.locator("audio")).toHaveAttribute("src", /blob:/, { timeout: 30000 });
    const estado = narracion.getByRole("status");
    await expect(estado).toHaveAttribute("data-progress-total", String(tramos + 1));
    await expect(estado).toHaveAttribute("data-progress-ready", String(tramos + 1));
    await expect(boton).toBeEnabled();
    return narracion.locator("audio").evaluate(async (a: HTMLAudioElement) => {
      const datos = await (await fetch(a.src)).arrayBuffer();
      return [...new Uint8Array(await crypto.subtle.digest("SHA-256", datos))].map(b => b.toString(16).padStart(2, "0")).join("");
    });
  };
  const bajar = async () => { const descarga = page.waitForEvent("download"); await boton.click(); const d = await descarga; return { nombre: d.suggestedFilename(), datos: await leerDescarga(d) }; };

  const hashAudio = await preparar("Listen from the start");
  const antes = pedidos.length;
  // El invitado de duración excesiva se pidió (una vez) y se omitió.
  expect(pedidos.filter(p => p.intervencion === omitido)).toHaveLength(1);
  const wav = await bajar();
  expect(wav.nombre).toBe(`cronista-arena-${seed}-narracion-en-${registro.final.tick}.wav`);
  expect(createHash("sha256").update(wav.datos).digest("hex")).toBe(hashAudio);
  // Tamaño = 44 + 2 · Σ muestras incorporadas, y cada pieza con su frecuencia en su posición.
  comprobarMontaje(wav.datos, "en");
  expect(wav.datos.subarray(0, 4).toString("latin1")).toBe("RIFF");
  expect(wav.datos.subarray(8, 12).toString("latin1")).toBe("WAVE");
  expect(wav.datos.readUInt16LE(22)).toBe(1);
  expect(wav.datos.readUInt32LE(24)).toBe(sr);
  expect(wav.datos.readUInt16LE(34)).toBe(16);
  // Margen para que una petición disparada por el clic llegue a la ruta antes de contar.
  await page.waitForTimeout(1500);
  expect(pedidos.length).toBe(antes);

  await narracion.getByRole("button", { name: "Stop narration" }).click();
  await expect(boton).toBeEnabled();
  await bajar();
  await page.waitForTimeout(1500);
  expect(pedidos.length).toBe(antes);
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  await expect(boton).toBeDisabled();
  await expect(narracion.getByTestId("arena-narration-download-help")).toBeVisible();

  const hashEs = await preparar("Escuchar desde el inicio");
  const wavEs = await bajar();
  expect(wavEs.nombre).toBe(`cronista-arena-${seed}-narracion-es-${registro.final.tick}.wav`);
  expect(createHash("sha256").update(wavEs.datos).digest("hex")).toBe(hashEs);
  expect(hashEs).not.toBe(hashAudio);
  expect(wavEs.datos.equals(wav.datos)).toBe(false);
  comprobarMontaje(wavEs.datos, "es");
});

test("053 · compatibilidad: el validador real importa los registros públicos y rechaza la transcripción", async ({ request }) => {
  for (const archivo of ["arena-llm-v1.json", "arena-llm-v3.json", "arena-duelo-v3.json"]) {
    const r = JSON.parse(await readFile(`public/experimentos/${archivo}`, "utf8")) as RegistroArena;
    const respuesta = await request.post("/api/arena", { data: { accion: "reproducir", registro: r } });
    expect(respuesta.status(), archivo).toBe(200);
    expect(((await respuesta.json()) as RegistroArena).final.tick, archivo).toBe(r.final.tick);
  }
  const t = construirTranscripcion({ registro, comentarios: [comentario], intervenciones, sesion: null, generado: "2026-10-22T12:00:00.000Z" }, registro.final.tick, "en");
  expect((await request.post("/api/arena", { data: { accion: "reproducir", registro: JSON.parse(transcripcionJson(t)) } })).status()).toBe(400);
});
