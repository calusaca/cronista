export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { iniciarTelemetria } = await import("./lib/telemetria");
    await iniciarTelemetria();
    // Brief 062 § 18.1 · Latido de presencia, barrera de relevo y cierre de arranque del torneo del sitio desde el
    // arranque del proceso (con el interruptor encendido o con el almacén de producción, aunque esté apagado: así
    // un torneo que quedó a medias se cierra como «interrumpido»).
    const { debeIniciarGestor, gestorTorneoSitio } = await import("./arena/torneo-sitio");
    if (debeIniciarGestor()) gestorTorneoSitio().iniciar();
  }
}
