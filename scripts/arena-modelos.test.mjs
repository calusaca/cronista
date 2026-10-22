// Brief 052 v1.1 §6–7: catálogo publicado derivado de infra/modelos-arena.json, endpoint de
// Foundry Models y lista de secretos de publicación (toda *_KEY + Insights).
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { catalogoPublicado, endpointFoundryModelos, leerCatalogoPublicado } from "./arena-modelos.mjs";
import { secretosDeEntorno } from "./deploy-azure.mjs";

test("el catálogo publicado conserva los dos entrenadores previos primero y solo añade modelos con smoke admitido", () => {
  const publicado = leerCatalogoPublicado();
  assert.deepEqual(publicado.slice(0, 2).map(m => ({ id: m.id, nombre: m.nombre, prefijo: m.prefijo, deployment: m.deployment })), [
    { id: "equilibrado", nombre: "GPT-5.6 Luna", prefijo: "ARENA_EQUILIBRADO_", deployment: "cronista-equilibrado" },
    { id: "rapido", nombre: "GPT-5.4 mini", prefijo: "ARENA_RAPIDO_", deployment: "cronista-rapido" },
  ]);
  // Brief 052 v1.1 §3: un modelo nuevo entra solo con evidencia de smoke real admitida.
  for (const m of publicado.slice(2)) {
    const ruta = `docs/evidencia/modelos-052/${m.id}.json`;
    assert.ok(existsSync(ruta), `${m.id} publicado sin evidencia de smoke`);
    const e = JSON.parse(readFileSync(ruta, "utf8"));
    assert.equal(e.admision.admitido, true, `${m.id} publicado sin admisión`);
    assert.equal(e.candidato.deployment, m.deployment);
    assert.equal(e.candidato.nombrePublico, m.nombre);
    if (m.llm === "foundry-modelos") assert.equal(e.candidato.formatoJson, m.formatoJson, `${m.id}: formato publicado distinto del probado`);
  }
  // Toda entrada (publicada o no) declara el deployment real que reproduce modelos-arena.bicep.
  for (const m of JSON.parse(readFileSync("infra/modelos-arena.json", "utf8"))) {
    for (const k of ["nombre", "modelo", "version", "formato", "capacidad", "id", "nombrePublico", "llm", "publicar"]) assert.ok(k in m, `${m.id} sin ${k}`);
  }
});

test("nombre público, deployment y prefijo salen de la misma entrada; foundry-modelos exige formato", () => {
  const base = { nombre: "cronista-grok", modelo: "grok-4.7", version: "1", formato: "xAI", capacidad: 10, id: "grok", nombrePublico: "Grok 4.7 (Foundry)", llm: "foundry-modelos", formatoJson: "json_schema", publicar: true };
  assert.deepEqual(catalogoPublicado([base, { ...base, id: "x-y", publicar: false }]), [
    { id: "grok", nombre: "Grok 4.7 (Foundry)", prefijo: "ARENA_GROK_", llm: "foundry-modelos", deployment: "cronista-grok", formatoJson: "json_schema", esfuerzoRazonamiento: "" },
  ]);
  assert.equal(catalogoPublicado([{ ...base, esfuerzoRazonamiento: "low" }])[0].esfuerzoRazonamiento, "low");
  assert.throws(() => catalogoPublicado([{ ...base, esfuerzoRazonamiento: "none" }]), /esfuerzoRazonamiento/);
  assert.throws(() => catalogoPublicado([{ ...base, llm: "azure-openai", esfuerzoRazonamiento: "low" }]), /esfuerzoRazonamiento/);
  assert.equal(catalogoPublicado([{ ...base, id: "luna-6" }])[0].prefijo, "ARENA_LUNA_6_");
  assert.throws(() => catalogoPublicado([{ ...base, formatoJson: "xml" }]), /formatoJson/);
  assert.throws(() => catalogoPublicado([{ ...base, llm: "stub" }]), /llm inválido/);
  assert.throws(() => catalogoPublicado([base, base]), /repetido/);
  assert.throws(() => catalogoPublicado([{ ...base, publicar: false }]), /al menos un modelo/);
});

test("foundryEndpoint recorta /anthropic y barras finales", () => {
  assert.equal(endpointFoundryModelos("https://r.services.ai.azure.com/anthropic"), "https://r.services.ai.azure.com");
  assert.equal(endpointFoundryModelos("https://r.services.ai.azure.com/anthropic/"), "https://r.services.ai.azure.com");
  assert.equal(endpointFoundryModelos("https://r.services.ai.azure.com/"), "https://r.services.ai.azure.com");
  assert.throws(() => endpointFoundryModelos(undefined), /FOUNDRY_BASE_URL/);
  assert.throws(() => endpointFoundryModelos("http://r.services.ai.azure.com"), /https/);
});

test("secretos de publicación: toda *_API_KEY / *_KEY, también prefijadas, más Insights", () => {
  const env = {
    AZURE_OPENAI_API_KEY: "s1", FOUNDRY_API_KEY: "s2", ARENA_GROK_FOUNDRY_MODELOS_API_KEY: "s3", AZURE_SPEECH_KEY: "s4",
    APPLICATIONINSIGHTS_CONNECTION_STRING: "s5", FOUNDRY_MODELOS_API_KEY: "s1", VACIA_API_KEY: " ", AZURE_OPENAI_ENDPOINT: "publico", KEYBOARD: "no",
  };
  assert.deepEqual(secretosDeEntorno(env).sort(), ["s1", "s2", "s3", "s4", "s5"]);
});
