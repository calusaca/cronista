import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stageSource } from "./deploy-azure.mjs";

test("el contexto enviado a Azure excluye archivos privados y detecta credenciales/enlaces en archivos permitidos", () => {
  const tmp = mkdtempSync(join(tmpdir(), "cronista-context-test-"));
  const root = join(tmp, "repo");
  try {
    for (const f of ["Dockerfile", ".dockerignore", "package.json", "package-lock.json", "tsconfig.json", "next.config.ts", "src/app.ts", "public/sample.json", "docs/dataset/ficha.json", "docs/dataset/DATASHEET.md", ".env", ".env.production", ".git/config", ".primos/privado", ".cache/secret.json", "docs/evidencia/privado.json"]) {
      mkdirSync(join(root, f, ".."), { recursive: true });
      writeFileSync(join(root, f), /^\.(env|git|primos|cache)/.test(f) || f.includes("privado") || f.includes("secret") ? "FAKE-TEST-SECRET" : "public");
    }
    const destination = join(tmp, "staged");
    const manifest = stageSource(root, destination, ["FAKE-TEST-SECRET"]);
    assert.equal(manifest.length, 10);
    assert.deepEqual(readdirSync(destination).sort(), [".dockerignore", "Dockerfile", "docs", "next.config.ts", "package-lock.json", "package.json", "public", "src", "tsconfig.json"].sort());
    assert.equal(readFileSync(join(destination, "docs/dataset/ficha.json"), "utf8"), "public");
    writeFileSync(join(root, "src/app.ts"), "FAKE-TEST-SECRET");
    assert.throws(() => stageSource(root, join(tmp, "bad-secret"), ["FAKE-TEST-SECRET"]), /Credencial encontrada/);
    writeFileSync(join(root, "src/app.ts"), "public");
    symlinkSync(join(root, ".env"), join(root, "public/link"));
    assert.throws(() => stageSource(root, join(tmp, "bad-symlink")), /enlaces simbólicos/);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
