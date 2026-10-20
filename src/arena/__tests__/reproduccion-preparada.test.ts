import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { GestorSesiones } from "../sesiones";
import { planProgramado } from "../controladores";
import { reproducirArena } from "../coordinador";
import { instanteNarrado, wavMono } from "../pista-audio";

const rutas: string[] = [];
afterEach(async () => { vi.useRealTimers(); await Promise.all(rutas.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
async function carpeta() { const p = await mkdtemp(join(tmpdir(), "cronista-preparada-")); rutas.push(p); return p; }
const ajustes = { seed: 42, segundos: 3, local: "auto", visita: "auto", seleccion: { modo: "programado" }, presentacion: "preparada" };

it("genera sin esperar al reloj de presentación y sirve el mismo partido tras reiniciar sin inferencias", async () => {
  let llamadas = 0;
  const ruta = await carpeta(), gestor = new GestorSesiones({ directorio: ruta, ritmoMsPorSegundo: 60_000, catalogo: () => [{ publico: { id: "prueba", nombre: "Prueba", controlador: "prueba" }, crear: () => ({ id: "prueba", completar: async (_s, mensajes) => { llamadas++; return JSON.stringify(planProgramado(JSON.parse(mensajes[0]!.contenido))); } }) }] });
  const { id } = await gestor.crear({ ...ajustes, seleccion: { modo: "manual", local: "prueba", visita: "prueba" } });
  await gestor.esperarFinal(id);
  const primera = await gestor.reproduccion(id);
  expect(primera.registro.final.tick).toBe(30);
  expect(reproducirArena(primera.registro)).toEqual(primera.registro);
  const otro = new GestorSesiones({ directorio: ruta });
  expect(await otro.reproduccion(id)).toEqual(primera);
  expect(await otro.reproduccion(id)).toEqual(primera);
  expect(llamadas).toBe(2);
}, 10000);

it("no entrega un partido parcial o cancelado como reproducción preparada", async () => {
  const gestor = new GestorSesiones({ directorio: await carpeta(), ritmoMsPorSegundo: 1000 });
  const { id } = await gestor.crear({ ...ajustes, presentacion: "directo" });
  await expect(gestor.reproduccion(id)).rejects.toMatchObject({ status: 409 });
  await gestor.detener(id); await gestor.esperarFinal(id);
  await expect(gestor.reproduccion(id)).rejects.toMatchObject({ status: 409 });
});

it("dos espectadores comparten una síntesis en curso y su reserva, y la caché sobrevive al reinicio", async () => {
  const ruta = await carpeta(), gestor = new GestorSesiones({ directorio: ruta });
  const { id } = await gestor.crear(ajustes); await gestor.esperarFinal(id);
  let liberar!: () => void, iniciada!: () => void, llamadas = 0;
  const inicio = new Promise<void>(r => { iniciada = r; });
  const esperar = new Promise<void>(r => { liberar = r; });
  const primero = gestor.extra(id, "audio", "misma-pista", async () => { llamadas++; iniciada(); await esperar; return { audio: "mismo" }; }, 100);
  await inicio;
  const segundo = gestor.extra(id, "audio", "misma-pista", async () => { throw new Error("No debe sintetizar otra vez"); }, 100);
  liberar();
  expect(await Promise.all([primero, segundo])).toEqual([{ audio: "mismo" }, { audio: "mismo" }]);
  expect(await new GestorSesiones({ directorio: ruta }).extra(id, "audio", "misma-pista", async () => { throw new Error("No debe sintetizar al reiniciar"); }, 100)).toEqual({ audio: "mismo" });
  expect(llamadas).toBe(1);
});

it("une el PCM sin insertar cabeceras o silencio entre tramos y limita el tamaño", async () => {
  const blob = wavMono([new Float32Array([0, .5]), new Float32Array([-1, 1])], 24000);
  const bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer);
  expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
  expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe("WAVE");
  expect(view.getUint32(24, true)).toBe(24000);
  expect(view.getUint32(40, true)).toBe(8);
  expect([44, 46, 48, 50].map(i => view.getInt16(i, true))).toEqual([0, 16384, -32768, 32767]);
  expect(bytes.length).toBe(52);
  expect(() => wavMono([], 24000)).toThrow();
  expect(() => wavMono([new Float32Array([NaN])], 24000)).toThrow();
  expect(() => wavMono([new Float32Array([0])], 0)).toThrow();
});

it("el reloj del audio respeta duraciones distintas, fronteras, búsquedas hacia atrás y final", () => {
  const tramos = [{ inicioS: 0, finS: 40, desdeTick: 0, hastaTick: 100 }, { inicioS: 40, finS: 50, desdeTick: 100, hastaTick: 200 }];
  expect(instanteNarrado(tramos, 20)).toEqual({ indice: 0, tick: 50 });
  expect(instanteNarrado(tramos, 40)).toEqual({ indice: 1, tick: 100 });
  expect(instanteNarrado(tramos, 45)).toEqual({ indice: 1, tick: 150 });
  expect(instanteNarrado(tramos, 5)).toEqual({ indice: 0, tick: 12.5 });
  expect(instanteNarrado(tramos, 80)).toEqual({ indice: 1, tick: 200 });
  expect(instanteNarrado(tramos, -1)).toEqual({ indice: 0, tick: 0 });
});
