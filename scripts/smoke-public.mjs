// Lectura desde fuera del despliegue. La home puede generar UNA crónica facturable.
import assert from "node:assert/strict";

const [rawUrl] = process.argv.slice(2);
const options = process.argv.slice(3);
if (options.some(o => o !== "--stub")) throw new Error("La única opción adicional es --stub, reservada para CI/local offline.");
const stub = options.includes("--stub");
if (!rawUrl) throw new Error("Uso: npm run smoke:public -- https://<app>.azurecontainerapps.io");
const base = new URL(rawUrl);
if (base.protocol !== "https:" && base.hostname !== "127.0.0.1" && base.hostname !== "localhost") throw new Error("Usa HTTPS para una demo pública.");
const results = [];
async function get(path, expectedStatus = 200) {
  const started = Date.now();
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(240_000) });
  assert.equal(response.status, expectedStatus, `${path}: HTTP ${response.status}`);
  const body = await response.text();
  results.push({ path, status: response.status, bytes: Buffer.byteLength(body), elapsedMs: Date.now() - started });
  return body;
}
assert.deepEqual(JSON.parse(await get("/api/health")), { status: "ok", service: "cronista" });
const home = await get("/");
assert.match(home, /data-testid="sentence"/);
assert.match(home, /data-testid="verify-bar" data-mode="llm"/);
assert.match(home, /data-testid="llm-label" data-fixture="false"/);
if (stub) assert.match(home, /Offline stub/);
else {
  assert.match(home, /azure-openai|Microsoft Foundry/);
  assert.doesNotMatch(home, /Offline stub|Rehearsal fixture/);
}
const asset = home.match(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+\.js)"/)?.[1];
assert.ok(asset, "La home debe enlazar assets JS del build.");
await get(asset);
assert.match(await get("/datos"), /The CRONISTA match dataset/);
assert.match(await get("/datos/datasheet"), /CRONISTA/);
const sample = (await get("/muestra-10.jsonl")).trim().split("\n").map(line => JSON.parse(line));
assert.equal(sample.length, 10);
await get("/match/not-a-number", 404);
console.log(JSON.stringify({ checkedUtc: new Date().toISOString(), url: base.origin, modelCheck: stub ? "offline-stub" : "real-provider", results, note: "HTTP smoke; no sustituye la inspección visual ni una prueba desde otra red." }, null, 2));
