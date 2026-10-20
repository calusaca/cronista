export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { iniciarTelemetria } = await import("./lib/telemetria");
    await iniciarTelemetria();
  }
}
