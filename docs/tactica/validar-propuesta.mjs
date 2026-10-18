// Desde la raíz: node docs/tactica/validar-propuesta.mjs
// Valida datos documentales de v1; no ejecuta ni evalúa el simulador.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const path = 'docs/tactica/catalogo-propuesto.v1.json';
const cat = JSON.parse(readFileSync(path, 'utf8'));
const docPath = 'docs/disenos/033-tactica-y-movimiento.md';
const doc = readFileSync(docPath, 'utf8');
const checks = [];
const check = (name, fn) => { fn(); checks.push({ name, passed: true }); };
const slots = lines => lines.flat();
const ordered = values => [...values].sort();
const unique = values => new Set(values).size === values.length;
check('Catálogo explícitamente propuesto, sin activar funciones de la app', () => assert.equal(cat.estado, 'propuesta_no_integrada'));
check('Siete formaciones y siete perfiles con IDs únicos', () => {
  assert.equal(cat.formaciones.length, 7); assert.equal(cat.perfiles.length, 7);
  assert.ok(unique(cat.formaciones.map(f => f.id))); assert.ok(unique(cat.perfiles.map(p => p.id)));
});
check('Cada formación contiene exactamente diez slots de campo, con rol conocido', () => {
  for(const f of cat.formaciones) {
    const ids = slots(f.lineas);
    assert.equal(ids.length, 10); assert.ok(unique(ids)); assert.ok(!ids.includes('POR'));
    assert.deepEqual(f.id.split('-').map(Number), f.lineas.map(l => l.length));
    for (const id of ids) assert.ok(cat.rolesPorSlot[id]);
  }
  assert.equal(cat.rolesPorSlot.POR, 'portero');
});
check('Cada fase conserva los mismos diez slots y su rótulo coincide con las líneas', () => {
  for(const p of cat.perfiles) {
    const base = cat.formaciones.find(f => f.id === p.formacionBase); assert.ok(base);
    for(const fase of [p.conBalon, p.sinBalon]) {
      const ids = slots(fase.lineas);
      assert.ok(unique(ids)); assert.deepEqual(ordered(ids), ordered(slots(base.lineas)));
      assert.deepEqual(fase.nombre.split('-').map(Number), fase.lineas.map(l => l.length));
    }
  }
});
check('Funciones y resguardo se asignan a slots existentes de cada perfil', () => {
  for(const p of cat.perfiles) {
    const ids = slots(cat.formaciones.find(f => f.id === p.formacionBase).lineas);
    assert.ok(unique(p.resguardo));
    for(const id of [...p.resguardo, ...Object.keys(p.funcionesConBalon)]) assert.ok(ids.includes(id));
    assert.ok(['posesion','contragolpe','presion'].includes(p.estiloLegadoSugerido));
  }
});
check('Todos los patrones del catálogo se describen en el documento', () => {
  for (const p of cat.perfiles) for(const id of p.patrones) assert.ok(new RegExp(`\\| ${id} \\|`).test(doc), id);
});
check('Tres juegos de anclas con los mismos once jugadores y coordenadas finitas normalizadas', () => {
  const expected = ordered(['POR', ...slots(cat.formaciones.find(f => f.id === '4-3-3').lineas)]);
  for(const fase of ['base','conBalon','sinBalon']) {
    const a = cat.ejemploAnclas[fase]; assert.deepEqual(ordered(Object.keys(a)),expected);
    for(const punto of Object.values(a)) { assert.equal(punto.length,2); for(const v of punto) assert.ok(Number.isFinite(v) && v>=0 && v<=1); }
    assert.ok(unique(Object.values(a).map(p => JSON.stringify(p))));
  }
});
check('Coordenadas de las tres estructuras concuerdan con el orden de sus líneas', () => {
  const p = cat.perfiles.find(p => p.id === cat.ejemploAnclas.perfil);
  const phases = [['base',cat.formaciones.find(f => f.id === p.formacionBase).lineas],['conBalon',p.conBalon.lineas],['sinBalon',p.sinBalon.lineas]];
  for(const [phase, lines] of phases) {
    const a=cat.ejemploAnclas[phase]; let previousMean=0;
    for(const line of lines) {
      const mean = line.reduce((s,id)=>s+a[id][0],0)/line.length;
      assert.ok(mean>previousMean); previousMean=mean;
      assert.deepEqual(line, [...line].sort((u,v)=>a[u][1]-a[v][1]));
    }
  }
});
check('Parámetros sintéticos positivos y bandas ordenadas; no es calibración física', () => {
  const p=cat.parametrosMovimientoPropuestos;
  for(const key of ['pasoFijoS','aceleracionMaxMps2','toleranciaLlegadaM','minEstadoEstableS','minEntreCambiosPlanMin']) assert.ok(p[key]>0 && Number.isFinite(p[key]));
  for(const key of ['velocidadMarchaMps','velocidadApoyoMps','velocidadCarreraMps','velocidadSprintMps','ventanaContrapresionS']) assert.ok(p[key].length===2 && p[key][0]>0 && p[key][1]>=p[key][0]);
});
check('El ejemplo narrativo conserva las cinco distancias de su geometría', () => {
  for(const [a,b,d] of [[[52.5,34],[45.5,34],7],[[45.5,34],[55.5,34],10],[[55.5,34],[67.5,18],20],[[67.5,18],[70.5,18],3],[[70.5,18],[75.5,6],13]]) assert.equal(Math.hypot(b[0]-a[0],b[1]-a[1]),d);
});
check('Veinticinco referencias primarias y ninguna referencia F sin definir', () => {
  const definitions = new Map([...doc.matchAll(/^\[(F\d+)\]: (https:\/\/\S+)/gm)].map(m=>[m[1],m[2]]));
  assert.equal(definitions.size,25);
  for(const m of doc.matchAll(/\[(F\d+)\]/g)) assert.ok(definitions.has(m[1]),m[1]);
  for(const url of definitions.values()) assert.ok(['www.uefa.com','www.fifatrainingcentre.com','learn.englandfootball.com','community.thefa.com','www.theifab.com','www.red3d.com','arxiv.org'].includes(new URL(url).hostname));
});
check('Los enlaces locales del documento apuntan a archivos existentes', () => {
  for(const m of doc.matchAll(/\]\(([^)]+)\)/g)) {
    if(m[1].startsWith('https:') || m[1].startsWith('#')) continue;
    assert.ok(existsSync(resolve(dirname(docPath),m[1].split('#')[0])),m[1]);
  }
});
check('La figura está enlazada y corresponde a las tres estructuras del catálogo', () => {
  const svg = readFileSync('docs/tactica/estructuras-433.svg','utf8');
  assert.equal((svg.match(/r="7\.5"/g)??[]).length,33);
  for (const name of ['Base: 4-3-3','Con balón: 3-2-5','Sin balón: 4-1-4-1']) assert.ok(svg.includes(name));
});
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const result = { checkedUtc: new Date().toISOString(), type: 'documentation_and_proposed_catalog_validation',
  formaciones: cat.formaciones.length, perfiles: cat.perfiles.length, fuentesPrimarias:25,
  files: [docPath,path,'docs/tactica/estructuras-433.svg','docs/tactica/validar-propuesta.mjs'].map(file => ({file,sha256:sha(file)})), checks,
  limits: ['No runtime code was changed or integrated.', 'Structural checks do not validate real-match tactical quality, physical realism or empirical probabilities.', 'Movement parameters are synthetic initial proposals, not calibrated values.', 'Source links were browsed during research; this checker only validates their definitions and local paths.'] };
writeFileSync('docs/evidencia/validacion-propuesta-tactica.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({ checks:checks.length, passed:checks.length, formaciones:7, perfiles:7, fuentes:25 }));
