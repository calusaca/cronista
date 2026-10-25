// Lectura desde fuera del despliegue. La portada de crónicas puede generar UNA crónica facturable.
// Brief 064 § 8.4.6 · La crónica destacada se lee en /cronicas (vale en los dos hosts). La raíz se comprueba aparte, sin
// seguir redirecciones: con `--raiz cronicas` (host de la demo de crónicas, CRONISTA_RAIZ=cronicas) exige 200 con la
// crónica; sin la opción, 307 hacia /arena.
import assert from "node:assert/strict";

const [rawUrl] = process.argv.slice(2);
const options = process.argv.slice(3);
let stub = false, raiz = "arena";
for (let i = 0; i < options.length; i++) {
  if (options[i] === "--stub") stub = true;
  else if (options[i] === "--raiz" && options[i + 1] === "cronicas") { raiz = "cronicas"; i++; }
  else throw new Error("Opciones: --stub (reservada para CI/local offline) y --raiz cronicas (host de la demo de crónicas).");
}
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
const home = await get("/cronicas");
assert.match(home, /data-testid="sentence"/);
assert.match(home, /data-testid="verify-bar" data-mode="llm"/);
assert.match(home, /data-testid="llm-label" data-fixture="false"/);
if (stub) assert.match(home, /Offline stub/);
else {
  assert.match(home, /azure-openai|Microsoft Foundry/);
  assert.doesNotMatch(home, /Offline stub|Rehearsal fixture/);
}
const asset = home.match(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+\.js)"/)?.[1];
assert.ok(asset, "La portada de crónicas debe enlazar assets JS del build.");
await get(asset);
{
  const started = Date.now();
  const response = await fetch(new URL("/", base), { redirect: "manual", signal: AbortSignal.timeout(240_000) });
  const body = await response.text();
  if (raiz === "cronicas") {
    assert.equal(response.status, 200, `/: HTTP ${response.status} (se esperaba la portada de crónicas)`);
    assert.match(body, /data-testid="sentence"/);
  } else {
    assert.equal(response.status, 307, `/: HTTP ${response.status} (se esperaba 307 hacia /arena)`);
    const destino = new URL(response.headers.get("location") ?? "", base);
    assert.equal(destino.origin + destino.pathname + destino.search, `${base.origin}/arena`, `/: location ${response.headers.get("location")}`);
  }
  results.push({ path: "/", status: response.status, bytes: Buffer.byteLength(body), elapsedMs: Date.now() - started, raiz });
}
assert.match(await get("/datos"), /The CRONISTA match dataset/);
assert.match(await get("/datos/datasheet"), /CRONISTA/);
const sample = (await get("/muestra-10.jsonl")).trim().split("\n").map(line => JSON.parse(line));
assert.equal(sample.length, 10);
await get("/match/not-a-number", 404);
console.log(JSON.stringify({ checkedUtc: new Date().toISOString(), url: base.origin, modelCheck: stub ? "offline-stub" : "real-provider", results, note: "HTTP smoke; no sustituye la inspección visual ni una prueba desde otra red." }, null, 2));
