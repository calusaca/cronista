// PLAYWRIGHT_BROWSERS_PATH=.cache/playwright node docs/evidencia/partido-preparado/comprobar-publicacion.mjs
import { chromium, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const base = JSON.parse(readFileSync('docs/evidencia/azure-arena-publicacion.json', 'utf8')).url;
const folder = 'docs/evidencia/partido-preparado';
const report = {
  checkedUtc: new Date().toISOString(), url: `${base}/arena`,
  scope: 'deployed_application_real_http_and_browser_without_mock_responses',
  newTeamModelCalls: 0, newAnalystCalls: 0,
  speechProviderCalls: 'not instrumented; requests use the existing durable recording/audio cache',
  playbackAcceleratedBySeeking: true, checks: {}, segments: [], errors: [],
};
let browser;
try {
  const health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(90000) });
  assert.equal(health.status, 200);
  report.checks.health = { http: health.status };
  browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  context.on('page', p => p.on('pageerror', e => report.errors.push(e.message)));
  const page = await context.newPage();
  let creations = 0;
  context.on('request', r => { if (r.url().endsWith('/api/arena/sesiones') && r.method() === 'POST') creations++; });
  await page.goto(`${base}/arena`, { timeout: 90000 });
  const panel = page.getByTestId('arena-live');
  await expect(panel.getByRole('combobox', { name: 'Viewing mode' })).toHaveValue('preparada');
  await expect(page.getByTestId('arena-live').getByRole('combobox', { name: 'Controller selection' })).toHaveValue('azar');
  await panel.getByRole('combobox', { name: 'Controller selection' }).selectOption('programado');
  const created = page.waitForResponse(r => r.url().endsWith('/api/arena/sesiones') && r.request().method() === 'POST');
  await panel.getByRole('button', { name: 'Generate match', exact: true }).click();
  const response = await created;
  assert.equal(response.status(), 201);
  const request = response.request().postDataJSON();
  assert.equal(request.presentacion, 'preparada');
  assert.equal(request.seleccion.modo, 'programado');
  const { id } = await response.json();
  await expect(panel.getByRole('status')).toContainText('Match ready', { timeout: 90000 });
  await expect(page.getByTestId('arena-clock')).toHaveText('0:00 / 1:00');
  const saved = await context.request.get(`${base}/api/arena/sesiones/${id}/reproduccion`);
  assert.equal(saved.status(), 200);
  assert.match(saved.headers()['cache-control'], /max-age=86400/);
  const result = await saved.json();
  assert.equal(result.registro.final.tick, 600);
  const link = panel.getByRole('link', { name: 'Open or share this saved match' });
  assert.equal(await link.getAttribute('href'), `/arena?partido=${id}`);
  const another = await context.newPage();
  await another.goto(`${base}/arena?partido=${id}`, { timeout: 90000 });
  await expect(another.getByTestId('arena-live-status')).toContainText('Match ready', { timeout: 60000 });
  await expect(another.getByTestId('arena-clock')).toHaveText('0:00 / 1:00');
  assert.equal(creations, 1);
  await another.close();
  await page.route('**/api/arena/**', r => r.abort());
  const player = page.getByTestId('arena-player').nth(5);
  const before = await player.getAttribute('transform');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => player.getAttribute('transform')).not.toBe(before);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  report.checks.generateFirst = { http: 201, session: id, finalTick: 600, startsPausedAtZero: true, shareRestoresSameMatch: true, sessionCreations: creations, visualPlaybackWithArenaNetworkBlocked: true };
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${folder}/publica-escritorio.png`, fullPage: true });
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Switch to Spanish' }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > 360), false);
  await expect(panel.getByRole('status')).toContainText('Partido listo');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${folder}/publica-movil.png`, fullPage: true });
  await page.screenshot({ path: `${folder}/publica-movil-ventana.png` });
  report.checks.mobile = { width: 360, dark: true, reducedMotion: true, spanish: true, horizontalOverflow: false };
  await context.close();

  const audioContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const audioPage = await audioContext.newPage();
  audioPage.on('pageerror', e => report.errors.push(e.message));
  let passageRequests = 0;
  audioPage.on('request', r => { if (r.url().endsWith('/relato') && r.method() === 'POST') passageRequests++; });
  audioPage.on('response', async r => {
    if (!r.url().endsWith('/relato') || r.request().method() !== 'POST') return;
    try {
      const body = await r.json();
      report.segments.push({ http: r.status(), desdeTick: body.desdeTick, hastaTick: body.hastaTick, version: body.audio?.version, events: body.fuentes, bytes: Buffer.from(body.audio?.base64 ?? '', 'base64').length });
    } catch (e) { report.errors.push(e.message); }
  });
  await audioPage.goto(`${base}/arena`, { timeout: 90000 });
  await audioPage.getByRole('button', { name: 'Switch to Spanish' }).click();
  await audioPage.getByRole('button', { name: 'Cargar duelo de modelos grabado' }).click();
  const voice = audioPage.getByTestId('arena-narration');
  const attached = audioPage.waitForResponse(r => r.url().endsWith('/api/arena/grabaciones') && r.request().method() === 'POST');
  await voice.getByRole('button', { name: 'Activar narración de esta grabación' }).click();
  const attachment = await attached;
  assert.equal(attachment.status(), 200);
  report.checks.recording = { http: 200, session: (await attachment.json()).id };
  await expect(voice.getByRole('button', { name: 'Escuchar desde el inicio' })).toBeEnabled({ timeout: 30000 });
  await voice.getByRole('button', { name: 'Escuchar desde el inicio' }).click();
  await expect(voice.locator('audio')).toHaveAttribute('src', /blob:/, { timeout: 150000 });
  await expect.poll(() => report.segments.length).toBe(6);
  assert.equal(passageRequests, 6);
  const audio = voice.locator('audio');
  await expect.poll(() => audio.evaluate(a => Number.isFinite(a.duration) && a.duration > 200), { timeout: 30000 }).toBe(true);
  const track = await audio.evaluate(async a => { a.pause(); const response = await fetch(a.src); return { type: (await response.blob()).type, durationSeconds: a.duration, sources: a.querySelectorAll('source').length }; });
  assert.equal(track.type, 'audio/wav');
  const recording = JSON.parse(readFileSync('public/experimentos/arena-duelo-v3.json', 'utf8'));
  const covered = new Set(report.segments.flatMap(s => s.events));
  assert(recording.eventos.every(e => covered.has(e.id)));
  assert(report.segments.every(s => s.http === 200 && s.version === 'voz-expresiva-v1' && s.bytes > 0));
  await audioPage.route('**/api/arena/**', r => r.abort());
  await audio.evaluate(a => { a.currentTime = 80; });
  await expect(voice.locator('summary')).toContainText('20–30 s');
  await expect(audioPage.getByTestId('arena-clock')).not.toHaveText('0:00 / 1:00');
  const audioPosition = await audio.evaluate(a => a.currentTime);
  await audio.evaluate(a => a.play());
  await expect.poll(() => audio.evaluate(a => a.currentTime)).toBeGreaterThan(audioPosition + 1);
  await audio.evaluate(a => a.pause());
  await voice.locator('details').evaluate(d => { d.open = true; });
  await voice.screenshot({ path: `${folder}/publica-narracion.png` });
  await audio.evaluate(a => { a.currentTime = a.duration - .25; return a.play(); });
  await expect(voice.getByRole('status')).toHaveText('Fin de la narración', { timeout: 15000 });
  await expect(audioPage.getByTestId('arena-clock')).toHaveText('1:00 / 1:00');
  assert.equal(passageRequests, 6);
  report.checks.audio = { ...track, passagesPreparedBeforePlayback: 6, requestsAfterPlaybackStarted: 0, allEventsCovered: true, recordedEvents: recording.eventos.length, seekUpdatesPitch: true, playbackWithArenaNetworkBlocked: true, realEndedEvent: true };
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (e) {
  report.status = 'failed'; report.error = e.message; process.exitCode = 1;
} finally {
  await browser?.close();
  report.finishedUtc = new Date().toISOString();
  writeFileSync(`${folder}/navegador-publico.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, error: report.error, checks: report.checks, segments: report.segments.length, errors: report.errors }));
}
