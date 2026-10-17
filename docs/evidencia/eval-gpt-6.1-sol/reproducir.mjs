// Reproduce la evaluación histórica con el evaluador original archivado, sin red ni credenciales.
// Desde la raíz: node --import tsx docs/evidencia/eval-gpt-6.1-sol/reproducir.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const directory = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = name => readFileSync(resolve(directory, name), 'utf8');
const config = JSON.parse(read('config.json'));
const saved = JSON.parse(read('resultado.json'));
const hash = value => createHash('sha256').update(value).digest('hex');
assert.equal(hash(readFileSync(resolve(directory, config.harnessArchive.path))), config.harnessArchive.sha256, 'Cambió el evaluador original archivado');
assert.equal(hash(readFileSync(resolve(root, 'package-lock.json'))), config.harnessArchive.packageLockSha256, 'Cambió el lockfile de las dependencias de la corrida');
const { correrEval, informe } = await import(new URL(config.harnessArchive.path, import.meta.url));
const responses = read('respuestas.jsonl').trim().split('\n').map(line => JSON.parse(line));
responses.sort((a, b) => config.semillas.indexOf(a.seed) - config.semillas.indexOf(b.seed) || a.n - b.n);
let next = 0;
const result = await correrEval({
  id: config.backend,
  async completar(system, mensajes) {
    const recorded = responses[next++];
    assert.ok(recorded, 'Falta una respuesta registrada');
    assert.equal(hash(JSON.stringify({ system, mensajes })), recorded.requestHash, 'Cambió la solicitud del evaluador');
    return recorded.salida;
  },
});
assert.equal(next, responses.length, 'Quedaron respuestas registradas sin evaluar');
assert.deepEqual(result.filas, saved.filas);
assert.equal(result.baselineConHallazgos, saved.baselineConHallazgos);
assert.equal(result.pipelineConHallazgos, saved.pipelineConHallazgos);
process.stdout.write(informe(result));
process.stdout.write('\nReplay verified: all recorded responses consumed; metrics match; no network calls.\n');
