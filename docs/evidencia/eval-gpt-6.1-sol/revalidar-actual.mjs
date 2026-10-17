// Reevalúa las respuestas registradas con el código actual. No es una nueva corrida del modelo.
// Desde la raíz: node --import tsx docs/evidencia/eval-gpt-6.1-sol/revalidar-actual.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { analizar } from '../../../src/analista/analista.ts';
import { mensajeInicial } from '../../../src/cadena/prompt.ts';
import { correrEval } from '../../../src/eval/eval.ts';
import { EVAL_SEMILLAS } from '../../../src/eval/umbrales-eval.ts';
import { simular } from '../../../src/sim/motor.ts';
import { configDeSemilla } from '../../../src/sim/plantillas.ts';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const config = JSON.parse(read('config.json'));
assert.deepEqual(EVAL_SEMILLAS, config.semillas);
const hash = text => createHash('sha256').update(text).digest('hex');
const responses = read('respuestas.jsonl').trim().split('\n').map(line => JSON.parse(line));
const prompts = new Map(EVAL_SEMILLAS.map(seed => [mensajeInicial(analizar(simular(configDeSemilla(seed)))), seed]));
const counters = new Map();
const result = await correrEval({
  id: config.backend,
  async completar(system, mensajes) {
    const seed = prompts.get(mensajes[0]?.contenido);
    assert.notEqual(seed, undefined, 'Cambió el prompt inicial');
    const n = (counters.get(seed) || 0) + 1;
    counters.set(seed, n);
    const recorded = responses.find(r => r.seed === seed && r.n === n);
    assert.ok(recorded, 'Falta una respuesta para la conversación actual');
    assert.equal(recorded.requestHash, hash(JSON.stringify({ system, mensajes })), 'La conversación actual difiere de la registrada');
    return recorded.salida;
  },
});
const unused = responses.filter(r => r.n > counters.get(r.seed)).map(({ seed, n }) => ({ seed, n }));
assert.equal(result.baselineConHallazgos, 0);
assert.equal(result.pipelineConHallazgos, 0);
assert.equal(result.filas.every(f => f.pipelineModo === 'llm' && f.pipelineIntentos === 1), true);
assert.deepEqual(unused, [{ seed: 7, n: 3 }]);
process.stdout.write(JSON.stringify({
  tipo: 'reevaluacion_offline_de_respuestas_registradas',
  llamadasDeRed: 0,
  noEsUnaNuevaCorridaDelModelo: true,
  sourceHashes: Object.fromEntries(['verificador.ts', 'lexico.ts'].map(name => [name, hash(readFileSync(new URL('../../../src/cadena/' + name, import.meta.url)))])),
  respuestasUtilizadas: responses.length - unused.length,
  respuestasHistoricasInnecesariasConLaCorreccion: unused,
  ...result,
}, null, 2) + '\n');
