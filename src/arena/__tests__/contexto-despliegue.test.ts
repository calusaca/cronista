// Codex 060 (impl., #2) · El contexto que se envía a ACR (stageSource de scripts/deploy-azure.mjs, el mismo que
// admiten .dockerignore y el Dockerfile) solo lleva SOURCE. Ningún módulo de src que entre en el build puede
// importar un archivo fuera de ese contexto; y el catálogo público empaquetado en src sigue a infra/.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = resolve(".");
/** SOURCE de scripts/deploy-azure.mjs, leída del propio script (no copiada a mano). */
function fuentesDespliegue(): string[] {
  const script = readFileSync("scripts/deploy-azure.mjs", "utf8");
  const lista = /const SOURCE = \[([^\]]+)\]/.exec(script)?.[1];
  if (!lista) throw new Error("SOURCE no encontrada en deploy-azure.mjs");
  return [...lista.matchAll(/"([^"]+)"/g)].map(m => m[1]!);
}
function modulos(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "__tests__" || n === "__fixtures__" ? [] : modulos(p);
    return /\.(ts|tsx|mjs|js)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

describe("060 · contexto de despliegue", () => {
  it("todo import relativo de src resuelve dentro de los archivos que copia stageSource", () => {
    const fuentes = fuentesDespliegue();
    const dentro = (archivo: string) => { const r = relative(raiz, archivo).replace(/\\/g, "/"); return fuentes.some(f => r === f || r.startsWith(`${f}/`)); };
    const fuera: string[] = [];
    for (const m of modulos("src")) {
      const texto = readFileSync(m, "utf8");
      for (const [, ruta] of texto.matchAll(/(?:from|import\(|require\()\s*["'](\.{1,2}\/[^"']+)["']/g)) {
        if (!dentro(resolve(dirname(m), ruta!))) fuera.push(`${m} → ${ruta}`);
      }
    }
    expect(fuera).toEqual([]);
  });

  it("el catálogo público de src es la proyección exacta de infra/modelos-arena.json", () => {
    const infra = JSON.parse(readFileSync("infra/modelos-arena.json", "utf8")) as { nombre: string; modelo: string; nombrePublico: string; publicar: boolean }[];
    const publico = JSON.parse(readFileSync("src/arena/catalogo-publico.json", "utf8"));
    expect(publico).toEqual(infra.map(({ nombre, modelo, nombrePublico, publicar }) => ({ nombre, modelo, nombrePublico, publicar })));
  });
});
