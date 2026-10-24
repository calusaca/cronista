// Brief 058 · v1.1 § 13 (C1) · El tope diario de Speech de la réplica sale de SPEECH_DIARIO; las cifras se
// leen de la constante y nunca se repiten a mano.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { SPEECH_DIARIO } from "../../sim/limites";
import { GestorSesiones } from "../sesiones";

const rutas: string[] = [];
afterEach(async () => { await Promise.all(rutas.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
const ajustes = { seed: 42, segundos: 3, local: "auto", visita: "auto", seleccion: { modo: "programado" }, presentacion: "preparada" };

async function preparado(total: Record<string, number>) {
  const directorio = await mkdtemp(join(tmpdir(), "cronista-speech-058-")); rutas.push(directorio);
  const gestor = new GestorSesiones({ directorio });
  const { id } = await gestor.crear(ajustes); await gestor.esperarFinal(id);
  await writeFile(join(directorio, `servicios-${new Date().toISOString().slice(0, 10)}.json`), JSON.stringify(total));
  return { gestor, id };
}

it("C1 · con el total diario en caracteres − 1, una síntesis de 2 c da 429 y una de 1 c pasa", async () => {
  const { gestor, id } = await preparado({ audio: 0, caracteres: SPEECH_DIARIO.caracteres - 1 });
  await expect(gestor.extra(id, "audio", "dos", async () => ({ audio: "no" }), 2)).rejects.toMatchObject({ status: 429, message: "Presupuesto diario de este servicio agotado" });
  expect(await gestor.extra(id, "audio", "uno", async () => ({ audio: "si" }), 1)).toEqual({ audio: "si" });
  await expect(gestor.extra(id, "audio", "otro", async () => ({ audio: "no" }), 1)).rejects.toMatchObject({ status: 429 });
});

it("C1 · el número de audios diarios también sale de la constante", async () => {
  const lleno = await preparado({ audio: SPEECH_DIARIO.audios, caracteres: 0 });
  await expect(lleno.gestor.extra(lleno.id, "audio", "x", async () => ({ audio: "no" }), 1)).rejects.toMatchObject({ status: 429 });
  const casi = await preparado({ audio: SPEECH_DIARIO.audios - 1, caracteres: 0 });
  expect(await casi.gestor.extra(casi.id, "audio", "x", async () => ({ audio: "si" }), 1)).toEqual({ audio: "si" });
});
