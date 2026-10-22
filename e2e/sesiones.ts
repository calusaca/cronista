import { expect, type APIRequestContext, type APIResponse } from "@playwright/test";

/** Crea una sesión de arena. El servidor admite pocos encuentros a la vez y responde 429 mientras los de
 * pruebas anteriores terminan: se reintenta hasta que la acepta (201). */
export async function crearSesion(request: APIRequestContext, data: unknown): Promise<APIResponse> {
  let respuesta!: APIResponse;
  await expect(async () => {
    respuesta = await request.post("/api/arena/sesiones", { data });
    expect(respuesta.status()).toBe(201);
  }).toPass({ timeout: 45_000 });
  return respuesta;
}
