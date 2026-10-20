import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.argv[2] ?? 'https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io';
const carpeta = 'docs/evidencia/consumidores-arena'; await mkdir(carpeta, { recursive: true });
const browser = await chromium.launch({ headless: true }), page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errores = [], peticiones = []; page.on('pageerror', e => errores.push(e.message));
let id, liberar;
const barrera = new Promise(r => { liberar = r; });
try {
  await page.addInitScript(() => {
    const Base = window.AudioContext; window.pruebaVoz = { duraciones: [], velocidades: [] };
    window.AudioContext = class extends Base {
      async decodeAudioData(datos) { const audio = await super.decodeAudioData(datos); window.pruebaVoz.duraciones.push(audio.duration); return audio; }
      createBufferSource() { const f = super.createBufferSource(), iniciar = f.start.bind(f); f.start = cuando => { window.pruebaVoz.velocidades.push(f.playbackRate.value); iniciar(cuando); }; return f; }
    };
  });
  const modelos = page.waitForResponse(r => r.url().endsWith('/api/arena/modelos'));
  await page.goto(`${base}/arena`);
  const catalogo = await (await modelos).json();
  if (catalogo.modelos.length) await expect(page.getByRole('combobox', { name: 'Controller selection' })).toHaveValue('azar');
  await page.getByRole('combobox', { name: 'Controller selection' }).selectOption('programado');
  await page.getByText('Reproduce a specific match (advanced)', { exact: true }).click();
  await page.getByLabel('Match seed (optional)', { exact: true }).fill('2');
  const creada = page.waitForResponse(r => r.url().endsWith('/api/arena/sesiones') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Start live match', exact: true }).click();
  const respuesta = await creada; expect(respuesta.status()).toBe(201); id = (await respuesta.json()).id;
  await expect(page.getByTestId('arena-buffer-status')).toContainText('Live', { timeout: 30000 });
  await page.route(`**/api/arena/sesiones/${id}/relato`, async ruta => {
    const p = ruta.request().postDataJSON(); peticiones.push({ desdeTick: p.desdeTick, hastaTick: p.hastaTick, cierre: !!p.cierre });
    await barrera;
    try { const r = await ruta.fetch({ timeout: 25000 }); await ruta.fulfill({ response: r }); } catch { await ruta.abort().catch(() => {}); }
  });
  await page.getByRole('button', { name: 'Enable narration', exact: true }).click();
  await expect.poll(() => peticiones.length).toBe(2);
  const segundos = async () => { const texto = await page.getByTestId('arena-clock').textContent(); const [m, s] = texto.split(' / ')[0].split(':').map(Number); return m * 60 + s; };
  const antes = await segundos();
  await expect.poll(segundos).toBeGreaterThan(antes + 1);
  expect(await page.evaluate(() => window.pruebaVoz.duraciones.length)).toBe(0);
  await expect(page.getByTestId('arena-buffer-status')).toContainText('Live');
  liberar();
  await expect.poll(() => page.evaluate(() => window.pruebaVoz.duraciones.some(d => d > 6)), { timeout: 30000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.pruebaVoz.velocidades.length), { timeout: 20000 }).toBeGreaterThan(0);
  const voz = await page.evaluate(() => window.pruebaVoz); expect(voz.velocidades.every(v => v === 1)).toBe(true);
  await expect(page.getByTestId('arena-voice-transcript')).toBeAttached();
  await page.getByRole('button', { name: 'Turn narration off', exact: true }).click();
  const sinVoz = await segundos(); await expect.poll(segundos).toBeGreaterThan(sinVoz);
  await page.getByRole('button', { name: 'Pause broadcast', exact: true }).click();
  const tick = await segundos();
  await page.locator('#arena-watch').evaluate(e => e.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: `${carpeta}/publico-escritorio.png` });
  await page.getByTestId('arena-description').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('arena-description-count')).toContainText('actions');
  const eventos = await page.getByTestId('arena-description').locator('[data-event-id]').count();
  expect(eventos).toBeGreaterThan(0);
  await page.setViewportSize({ width: 360, height: 780 }); await page.getByRole('button', { name: 'Switch to Spanish' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.getByTestId('arena-description').screenshot({ path: `${carpeta}/publico-descripcion-movil.png` });
  expect(errores).toEqual([]);
  await writeFile(`${carpeta}/navegador-publico.json`, JSON.stringify({ checkedUtc: new Date().toISOString(), url: `${base}/arena`, phase: 'passed', match: id, seed: 2, programmed: true, realSpeech: true, voiceRequests: peticiones, decodedSeconds: voz.duraciones, playbackRates: voz.velocidades, visualProgressWhileSpeechBlocked: true, turningVoiceOffDoesNotPauseMatch: true, visibleSecond: tick, descriptionActions: eventos, mobileWidth: 360, horizontalOverflow: false, javascriptErrors: errores }, null, 2) + '\n');
  console.log(JSON.stringify({ phase: 'passed', evidence: `${carpeta}/navegador-publico.json` }));
} finally {
  liberar(); if (id) await page.request.delete(`${base}/api/arena/sesiones/${id}`).catch(() => {}); await browser.close();
}
