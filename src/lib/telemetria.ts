import { SpanStatusCode, trace, type Attributes, type Span } from "@opentelemetry/api";

let inicio: Promise<void> | undefined;
export function iniciarTelemetria(): Promise<void> {
  return inicio ??= (async () => {
    if (!process.env.APPLICATIONINSIGHTS_CONNECTION_STRING || process.env.CRONISTA_TELEMETRIA !== "1") return;
    try {
      const { useMicrosoftOpenTelemetry } = await import("@microsoft/opentelemetry");
      useMicrosoftOpenTelemetry({
        azureMonitor: { azureMonitorExporterOptions: { connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING }, enableLiveMetrics: false },
        enableConsoleExporters: false, enableSensitiveData: false,
        tracesPerSecond: 0, samplingRatio: 1,
        instrumentationOptions: { http: { enabled: false }, azureSdk: { enabled: false }, mongoDb: { enabled: false }, mySql: { enabled: false }, postgreSql: { enabled: false }, redis: { enabled: false }, redis4: { enabled: false }, bunyan: { enabled: false }, winston: { enabled: false }, console: { enabled: false }, openaiAgents: { enabled: false }, langchain: { enabled: false } },
      });
    } catch { console.warn("CRONISTA: telemetría no disponible; el juego continúa."); }
  })();
}

/** Atributos explícitos; nunca prompts, claves ni excepciones libres del proveedor. */
export function trazar<T>(nombre: string, atributos: Attributes, tarea: (span: Span) => Promise<T>): Promise<T> {
  return trace.getTracer("cronista", "arena-v3").startActiveSpan(nombre, { attributes: atributos }, async span => {
    try { const resultado = await tarea(span); span.setStatus({ code: SpanStatusCode.OK }); return resultado; }
    catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR }); span.setAttribute("error.type", error instanceof Error ? error.name : "Error");
      const status = (error as { status?: unknown } | null)?.status;
      if (typeof status === "number" && status >= 100 && status <= 599) span.setAttribute("http.response.status_code", status);
      throw error;
    }
    finally { span.end(); }
  });
}

export async function cerrarTelemetria() {
  if (process.env.CRONISTA_TELEMETRIA === "1" && process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
    const { shutdownMicrosoftOpenTelemetry } = await import("@microsoft/opentelemetry");
    await shutdownMicrosoftOpenTelemetry();
  }
}
