import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { crearControladorProgramado, planProgramado } from "../controladores";
import { ejecutarArena, reproducirArena } from "../coordinador";
import { datasetEvaluacionArena, hechosArena } from "../inteligencia";
import { catalogoModelos, elegirModelos, type ModeloConfigurado } from "../modelos";
import { crearConfigArena } from "../motor";
import { aplicarPublicacion, type MensajeSesion } from "../protocolo";
import { GestorSesiones } from "../sesiones";
import type { PublicacionArena, RegistroArena } from "../tipos";

const directorios: string[] = [];
afterEach(async () => { await Promise.all(directorios.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
async function directorio() { const p = await mkdtemp(join(tmpdir(), "cronista-vivo-")); directorios.push(p); return p; }
const ajustes = { seed: 42, segundos: 3, local: "auto", visita: "auto", seleccion: { modo: "programado" } };
const controladores = () => ({ local: crearControladorProgramado(), visita: crearControladorProgramado() });

it("publica un prefijo antes del final y reconstruye el mismo registro reproducible", async () => {
  const config = crearConfigArena({ seed: 42, duracionS: 30 });
  const normal = await ejecutarArena(config, controladores());
  let prefijo: RegistroArena | null = null, avances = 0;
  const vivo = await ejecutarArena(config, controladores(), { alPublicar: async p => {
    prefijo = aplicarPublicacion(prefijo, p);
    if (p.tipo === "avance") {
      avances++;
      expect(p.eventos.every(e => e.tick <= p.estado.tick)).toBe(true);
      expect(prefijo!.final.tick).toBe(p.estado.tick);
      expect(prefijo!.eventos.every(e => e.tick <= prefijo!.final.tick)).toBe(true);
      if (avances === 1) expect(prefijo!.final.tick).toBeLessThan(300);
    }
  } });
  expect(avances).toBeGreaterThan(50);
  expect(prefijo).toEqual(vivo);
  expect(vivo.final).toEqual(normal.final); expect(vivo.eventos).toEqual(normal.eventos); expect(vivo.fotogramas).toEqual(normal.fotogramas);
  expect(reproducirArena(vivo)).toEqual(vivo);
});

it("la publicación no adelanta el estado al esperar decisiones", async () => {
  const publicaciones: PublicacionArena[] = [];
  const config = crearConfigArena({ duracionS: 2 });
  await ejecutarArena(config, controladores(), { alPublicar: async p => { publicaciones.push(p); } });
  expect(publicaciones.slice(0, 3).map(p => p.tipo)).toEqual(["inicio", "esperando", "ordenes"]);
  expect(publicaciones.at(-1)?.tipo).toBe("fin");
});

it("el catálogo cerrado no expone credenciales y descarta fixtures en modo real", () => {
  expect(catalogoModelos({})).toEqual([]);
  const env = { ARENA_WEB_LLM: "1", CRONISTA_LLM: "azure-openai", AZURE_OPENAI_API_KEY: "secreto-no-publicar", AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com", AZURE_OPENAI_DEPLOYMENT: "modelo-a" };
  const modelos = catalogoModelos(env);
  expect(modelos).toHaveLength(1);
  expect(JSON.stringify(modelos.map(m => m.publico))).not.toContain(env.AZURE_OPENAI_API_KEY);
  expect(() => catalogoModelos({ ARENA_WEB_LLM: "1", CRONISTA_LLM: "ensayo" })).toThrow();
  const varios = catalogoModelos({ ...env, ARENA_MODELOS: JSON.stringify([{ id: "a", nombre: "Modelo A", prefijo: "ARENA_A_" }, { id: "b", nombre: "Modelo B", prefijo: "ARENA_B_" }]), ARENA_B_AZURE_OPENAI_DEPLOYMENT: "modelo-b" });
  expect(varios.map(m => m.publico.controlador)).toEqual(["azure-openai:modelo-a", "azure-openai:modelo-b"]);
});

it("el sorteo es estable, elige identidades distintas y admite dos instancias del mismo modelo", () => {
  const catalogo: ModeloConfigurado[] = ["a", "b"].map(id => ({ publico: { id, nombre: id, controlador: id }, crear: () => ({ id, completar: async () => "{}" }) }));
  const a = elegirModelos({ modo: "azar" }, 99, catalogo), b = elegirModelos({ modo: "azar" }, 99, [...catalogo].reverse());
  expect(a.asignacion).toEqual(b.asignacion); expect(a.asignacion.local.controlador).not.toBe(a.asignacion.visita.controlador);
  const mismo = elegirModelos({ modo: "manual", local: "a", visita: "a" }, 0, catalogo);
  expect(mismo.asignacion.local.controlador).toBe(mismo.asignacion.visita.controlador);
  expect(mismo.controladores.local).not.toBe(mismo.controladores.visita);
  expect(() => elegirModelos({ modo: "manual", local: "arbitrario", visita: "b" }, 0, catalogo)).toThrow();
});

it("persistencia, reconexión y descarga no repiten inferencias", async () => {
  const ruta = await directorio();
  let llamadas = 0;
  const catalogo: ModeloConfigurado[] = [{ publico: { id: "prueba", nombre: "Prueba", controlador: "llm-prueba" }, crear: () => ({ id: "llm-prueba", completar: async (_s, mensajes) => {
    llamadas++;
    // El controlador serializa su observación dentro del mensaje de usuario.
    const texto = mensajes[0]!.contenido;
    const obs = JSON.parse(texto) as Parameters<typeof planProgramado>[0];
    return JSON.stringify(planProgramado(obs));
  } }) }];
  const gestor = new GestorSesiones({ directorio: ruta, ritmoMsPorSegundo: 0, catalogo: () => catalogo });
  const { id } = await gestor.crear({ ...ajustes, seleccion: { modo: "manual", local: "prueba", visita: "prueba" } }); await gestor.esperarFinal(id);
  const registro = await gestor.registro(id); expect(reproducirArena(registro)).toEqual(registro);
  const s = await gestor.obtener(id), desde = s.mensajes.length - 3;
  const abort = new AbortController();
  const respuesta = await gestor.escuchar(id, desde, abort.signal);
  const texto = await respuesta.text();
  expect(texto).toContain(`id: ${desde + 1}`); expect(texto).not.toContain("event: error");
  expect(texto.match(/event: arena/g)).toHaveLength(3);
  const restaurado = new GestorSesiones({ directorio: ruta });
  expect((await restaurado.obtener(id)).estado).toBe("completa");
  expect(await restaurado.registro(id)).toEqual(registro); expect(llamadas).toBe(2);
  expect(registro.rondas.flatMap(r => Object.values(r.decisiones)).every(d => d.origen === "controlador")).toBe(true);
});

it("la cancelación conserva el prefijo y no ofrece un registro final falso", async () => {
  const gestor = new GestorSesiones({ directorio: await directorio(), ritmoMsPorSegundo: 100 });
  const { id } = await gestor.crear({ ...ajustes, segundos: 30 });
  await gestor.detener(id); await gestor.esperarFinal(id);
  const sesion = await gestor.obtener(id);
  expect(sesion.estado).toBe("cancelada"); expect(sesion.mensajes.at(-1)?.publicacion.tipo).toBe("terminada");
  await expect(gestor.registro(id)).rejects.toThrow();
});

it("limpiar registros antiguos no reinicia el límite diario de inferencia", async () => {
  const catalogo: ModeloConfigurado[] = [{ publico: { id: "a", nombre: "A", controlador: "a" }, crear: () => ({ id: "a", completar: async (_s, mensajes) => JSON.stringify(planProgramado(JSON.parse(mensajes[0]!.contenido))) }) }];
  const gestor = new GestorSesiones({ directorio: await directorio(), ritmoMsPorSegundo: 0, maxRetenidas: 1, maxLlmDiarias: 1, catalogo: () => catalogo });
  const real = { ...ajustes, segundos: 1, seleccion: { modo: "manual", local: "a", visita: "a" } };
  const primero = await gestor.crear(real); await gestor.esperarFinal(primero.id);
  for (let i = 0; i < 2; i++) { const s = await gestor.crear({ ...ajustes, segundos: 1 }); await gestor.esperarFinal(s.id); }
  await expect(gestor.crear(real)).rejects.toThrow("límite diario");
  await expect(gestor.obtener(primero.id)).rejects.toThrow();
});

it("un reinicio identifica la interrupción sin reiniciar el trabajo", async () => {
  const ruta = await directorio(), gestor = new GestorSesiones({ directorio: ruta, ritmoMsPorSegundo: 100 });
  const { id } = await gestor.crear({ ...ajustes, segundos: 30 });
  // Tomamos una instantánea del diario antes de que el proceso termine.
  const copia = await directorio();
  const { writeFile } = await import("node:fs/promises");
  await writeFile(join(copia, `${id}.meta.json`), await readFile(join(ruta, `${id}.meta.json`)));
  await writeFile(join(copia, `${id}.ndjson`), await readFile(join(ruta, `${id}.ndjson`)));
  await gestor.detener(id); await gestor.esperarFinal(id);
  expect((await new GestorSesiones({ directorio: copia }).obtener(id)).estado).toBe("interrumpida");
});

it("los hechos y el dataset de evaluación excluyen acciones posteriores", async () => {
  const registro = await ejecutarArena(crearConfigArena({ duracionS: 60 }), controladores());
  const hechos = hechosArena(registro, 100), conocidos = new Set(registro.eventos.filter(e => e.tick <= 100).map(e => e.id));
  expect(hechos.every(h => h.tick <= 100 && h.eventos.every(id => conocidos.has(id)))).toBe(true);
  const filas = datasetEvaluacionArena(registro, 15); expect(filas).toHaveLength(4);
  for (const fila of filas) {
    const contexto = JSON.parse(fila.context) as { hechos: { tick: number }[] };
    expect(contexto.hechos.every(h => h.tick <= fila.tick)).toBe(true);
    expect(fila.procedencia).toBe("plantilla_determinista");
  }
});

it("reconstruir rechaza un avance que introduce un evento futuro", async () => {
  const registro = await ejecutarArena(crearConfigArena({ duracionS: 3 }), controladores());
  const evento = { ...registro.eventos[0]!, tick: 999 };
  const prefijo = aplicarPublicacion(null, { tipo: "inicio", version: registro.version, config: registro.config, inicial: registro.inicial });
  expect(() => aplicarPublicacion(prefijo, { tipo: "avance", estado: registro.final, fotogramas: registro.fotogramas, eventos: [evento] })).toThrow();
});
