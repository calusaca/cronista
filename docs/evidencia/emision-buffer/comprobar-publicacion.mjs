// PLAYWRIGHT_BROWSERS_PATH=.cache/playwright node docs/evidencia/emision-buffer/comprobar-publicacion.mjs
import { chromium, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const base = JSON.parse(readFileSync('docs/evidencia/azure-arena-publicacion.json', 'utf8')).url;
const folder = 'docs/evidencia/emision-buffer';
const report = { checkedUtc: new Date().toISOString(), url: `${base}/arena`, scope: 'real_deployed_application_no_mock_responses', newTeamModelCalls: 0, newAnalystCalls: 0, speechProviderCalls: 'not instrumented; real Speech responses or durable cache used', checks: {}, audioSegments: [], errors: [] };
let browser, id;
try {
  browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    const Base = window.AudioContext;
    window.contextosBufferPrueba = []; window.fuentesBufferPrueba = []; window.finalizadosBufferPrueba = [];
    window.AudioContext = class extends Base {
      constructor(...args) { super(...args); window.contextosBufferPrueba.push(this); }
      createBufferSource() {
        const source = super.createBufferSource(), start = source.start;
        source.start = (...args) => { window.fuentesBufferPrueba.push({ cuando: args[0], reloj: this.currentTime, duracionS: source.buffer?.duration, velocidad: source.playbackRate.value }); return start.apply(source, args); };
        source.addEventListener('ended', () => window.finalizadosBufferPrueba.push({ reloj: this.currentTime, duracionS: source.buffer?.duration }));
        return source;
      }
    };
  });
  const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
  let creations = 0;
  context.on('request', r => { if (r.url().endsWith('/api/arena/sesiones') && r.method() === 'POST') creations++; });
  page.on('response', async r => {
    if (!r.url().endsWith('/relato') || r.request().method() !== 'POST') return;
    try {
      const s = await r.json(); report.audioSegments.push({ http: r.status(), desdeTick: s.desdeTick, hastaTick: s.hastaTick, modo: s.modo, idioma: s.idioma, events: s.fuentes, fragments: s.fragmentos?.map(f => ({ tick: f.tick, emotion: f.emocion, text: f.texto })), bytes: Buffer.from(s.audio?.base64 ?? '', 'base64').length });
    } catch (e) { report.errors.push(e.message); }
  });
  const health = await context.request.get(`${base}/api/health`, { timeout: 90000 }); assert.equal(health.status(), 200);
  await page.goto(`${base}/arena`, { timeout: 90000 });
  const panel = page.getByTestId('arena-live');
  await expect(panel.getByRole('combobox', { name: 'Viewing mode' })).toHaveValue('buffer');
  await expect(panel.getByRole('combobox', { name: 'Controller selection' })).toHaveValue('azar');
  await panel.getByRole('combobox', { name: 'Controller selection' }).selectOption('programado');
  const creation = page.waitForResponse(r => r.url().endsWith('/api/arena/sesiones') && r.request().method() === 'POST');
  await panel.getByRole('button', { name: 'Start buffered match', exact: true }).click();
  const response = await creation; assert.equal(response.status(), 201); assert.equal(response.request().postDataJSON().presentacion, 'buffer');
  id = (await response.json()).id;
  await expect(page.getByTestId('arena-buffer-status')).toContainText('Near live', { timeout: 90000 });
  const pending = await context.request.get(`${base}/api/arena/sesiones/${id}/reproduccion`); assert.equal(pending.status(), 409);
  const snapshot = await (await context.request.get(`${base}/api/arena/sesiones/${id}/emision`)).json();
  assert.equal(snapshot.estado, 'ejecutando'); assert(snapshot.registro.final.tick >= 200 && snapshot.registro.final.tick < 600);
  const player = page.getByTestId('arena-player').nth(5), before = await player.getAttribute('transform');
  await expect.poll(() => player.getAttribute('transform')).not.toBe(before);
  report.checks.startsBeforeFinished = { session: id, replayHttp: 409, snapshotTick: snapshot.registro.final.tick, fullDurationTick: 600, interpolatedMovement: true };
  await page.getByRole('button', { name: 'Pause broadcast', exact: true }).click();
  const other = await context.newPage(); other.on('pageerror', e => report.errors.push(e.message));
  await other.goto(`${base}/arena?partido=${id}&vista=buffer`, { timeout: 90000 });
  await expect(other.getByTestId('arena-buffer-status')).toContainText('Near live', { timeout: 60000 });
  assert.equal(creations, 1); await other.close();
  await page.bringToFront();
  await page.getByRole('button', { name: 'Resume broadcast', exact: true }).click();
  await expect(page.getByTestId('arena-buffer-status')).toContainText('Near live');
  report.checks.sharing = { secondViewerRestoredSameMatch: true, sessionCreations: creations };
  await page.getByRole('button', { name: 'Switch to Spanish' }).click();
  await page.getByRole('button', { name: 'Activar narración con búfer' }).click();
  await expect(page.getByTestId('arena-buffer-status')).toContainText('Casi en vivo', { timeout: 90000 });
  await expect.poll(() => page.evaluate(() => window.contextosBufferPrueba.at(-1)?.state), { timeout: 30000 }).toBe('running');
  await expect.poll(() => page.evaluate(() => window.fuentesBufferPrueba.length), { timeout: 30000 }).toBeGreaterThan(0);
  const t0 = await page.evaluate(() => window.contextosBufferPrueba.at(-1).currentTime);
  await expect.poll(() => page.evaluate(() => window.contextosBufferPrueba.at(-1).currentTime)).toBeGreaterThan(t0 + .5);
  await expect.poll(() => page.evaluate(() => window.finalizadosBufferPrueba.length), { timeout: 30000 }).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pausar emisión', exact: true }).click();
  await expect(page.getByTestId('arena-buffer-status')).toContainText('Emisión pausada');
  await expect.poll(() => page.evaluate(() => window.contextosBufferPrueba.at(-1).state)).toBe('suspended');
  const paused = await page.getByTestId('arena-clock').textContent();
  await page.waitForTimeout(350); assert.equal(await page.getByTestId('arena-clock').textContent(), paused);
  await page.getByRole('button', { name: 'Continuar emisión', exact: true }).click();
  await expect(page.getByTestId('arena-buffer-status')).toContainText('Casi en vivo', { timeout: 30000 });
  await expect.poll(() => page.evaluate(() => window.contextosBufferPrueba.at(-1).state)).toBe('running');
  assert(report.audioSegments.length >= 4);
  assert(report.audioSegments.every(s => s.http === 200 && s.modo === 'buffer' && s.hastaTick - s.desdeTick <= 50 && s.fragments.every(f => f.tick >= s.desdeTick && f.tick <= s.hastaTick)));
  report.checks.audio = { preparedWindows: report.audioSegments.length, realAudioContextRuns: true, realSpeechSourceReachedEnded: true, endedSources: await page.evaluate(() => window.finalizadosBufferPrueba), pauseSuspendsAudioAndPitch: true, resumeWorks: true, scheduledSources: await page.evaluate(() => window.fuentesBufferPrueba), speechQualityListening: 'not measured' };
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `${folder}/publica-escritorio.png`, fullPage: true });
  await page.getByTestId('arena-buffer').screenshot({ path: `${folder}/publica-buffer.png` });
  await page.getByRole('button', { name: 'Desactivar narración' }).click();
  await page.setViewportSize({ width: 360, height: 780 }); await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > 360), false);
  await expect(page.getByRole('button', { name: 'Pausar emisión', exact: true })).toBeEnabled();
  await page.getByTestId('arena-buffer').screenshot({ path: `${folder}/publica-movil.png` });
  await page.getByTestId('arena-pitch').screenshot({ path: `${folder}/publica-cancha-movil.png` });
  report.checks.mobile = { width: 360, dark: true, reducedMotion: true, spanish: true, horizontalOverflow: false };
  await context.request.delete(`${base}/api/arena/sesiones/${id}`);
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (e) { report.status = 'failed'; report.error = e.message; process.exitCode = 1; }
finally {
  if (id) { try { await fetch(`${base}/api/arena/sesiones/${id}`, { method: 'DELETE', signal: AbortSignal.timeout(30000) }); } catch {} }
  await browser?.close(); report.finishedUtc = new Date().toISOString();
  writeFileSync(`${folder}/navegador-publico.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, error: report.error, checks: report.checks, segments: report.audioSegments.length, errors: report.errors }));
}
