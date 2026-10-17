import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareStandalone } from "./prepare-standalone.mjs";

test("retira las copias de entorno de Next, conserva el original y detecta claves incrustadas", () => {
  const root = mkdtempSync(join(tmpdir(), "cronista-standalone-test-"));
  try {
    for (const f of [".env", ".next/standalone/.env", ".next/standalone/.env.production", ".next/standalone/server.js", ".next/standalone/docs/dataset/ficha.json", ".next/standalone/docs/dataset/DATASHEET.md", ".next/static/chunk.js", "public/muestra.json"]) {
      mkdirSync(join(root, f, ".."), { recursive: true });
      writeFileSync(join(root, f), f.includes(".env") ? "FAKE-TEST-SECRET" : "public");
    }
    prepareStandalone(root, ["FAKE-TEST-SECRET"]);
    assert.equal(existsSync(join(root, ".next/standalone/.env")), false);
    assert.equal(existsSync(join(root, ".next/standalone/.env.production")), false);
    assert.equal(readFileSync(join(root, ".env"), "utf8"), "FAKE-TEST-SECRET");
    assert.equal(readFileSync(join(root, ".next/standalone/.next/static/chunk.js"), "utf8"), "public");
    writeFileSync(join(root, ".next/standalone/server.js"), "FAKE-TEST-SECRET");
    assert.throws(() => prepareStandalone(root, ["FAKE-TEST-SECRET"]), /Credencial encontrada/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
