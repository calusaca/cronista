import { expect, test } from "@playwright/test";

test("el probe del hosting no depende del modelo y nunca se cachea", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.json()).toEqual({ status: "ok", service: "cronista" });
});
