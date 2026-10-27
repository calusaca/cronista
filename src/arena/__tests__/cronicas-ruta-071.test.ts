// Brief 071 (revisión Codex, ronda 2) · La admisión de subidas de POST /api/arena/cronicas usa la identidad del proxy
// de confianza (`claveLimitador`: el ÚLTIMO salto de x-forwarded-for, el que añade el ingreso de Container Apps), no el
// primero, que controla el cliente. Cuerpos `{ registro }` inválidos: pasan por la admisión y fallan barato (400).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Admision } from "../admision";
import { CRONICA_ARENA } from "../../sim/limites";
import { POST } from "../../app/api/arena/cronicas/route";

const compartida = globalThis as typeof globalThis & { __cronistaAdmisionCronicas?: Admision };
const antes = process.env.ARENA_CRONICAS_DIR;
let dir = "";
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "cronicas-ruta-071-")); process.env.ARENA_CRONICAS_DIR = dir; });
afterEach(() => {
  delete compartida.__cronistaAdmisionCronicas;
  if (antes === undefined) delete process.env.ARENA_CRONICAS_DIR; else process.env.ARENA_CRONICAS_DIR = antes;
  rmSync(dir, { recursive: true, force: true });
});

const subida = (xff: string) => new Request("http://localhost:3417/api/arena/cronicas", {
  method: "POST", body: JSON.stringify({ registro: 1 }), headers: { "content-type": "application/json", "x-forwarded-for": xff },
});

describe("071 · /api/arena/cronicas: clave del límite por IP", () => {
  it("rotar el primer salto de x-forwarded-for no evade el tope por IP: cuenta el último (el del ingreso)", async () => {
    for (let i = 0; i < CRONICA_ARENA.admision.porIpPorHora; i++) expect((await POST(subida(`198.18.0.${i + 1}, 10.0.0.7`))).status).toBe(400);
    const r = await POST(subida("198.18.1.1, 10.0.0.7"));
    expect(r.status).toBe(429);
    expect((await r.json()).motivo).toBe("subidas");
    expect((await POST(subida("198.18.1.1, 10.0.0.8"))).status).toBe(400);
  });
});
