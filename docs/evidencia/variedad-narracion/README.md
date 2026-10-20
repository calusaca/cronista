# Variedad de narración

Implementación del [brief 043](../../disenos/043-variedad-de-la-narracion.md),
autorizada tras revisar los seis transcripts aportados por Carlos.

- `validacion-local.json`: 1.594 unitarias en 69 archivos, tipado, build de
  producción/standalone, dos comprobaciones de empaquetado y 37 escenarios únicos
  de navegador. Documenta la corrección de tres fixtures y la comprobación final
  de sus escenarios; conserva hashes de los archivos de ejecución modificados.
- `memoria-voz.json`: observación de intervenciones iniciadas y solicitudes
  adelantadas. La misma idea preparada en ventanas diferentes se reproduce una
  sola vez; la memoria persiste al silenciar y reactivar. Incluye audios WAV
  sintéticos para aislar la planificación; no es una prueba de calidad de voz.
- `respaldo-variado.json`: cuarenta segundos con Speech fallido, seis MP3 reales
  distintos de respaldo y silencio PCM máximo de 3,127 segundos. La medición usa
  amplitud absoluta superior a 0,001 en bloques de 20 ms, incluyendo pausas
  internas. El reloj del juego llega a recuperación; la voz sigue hablando.
- `ejemplos-editoriales.json`: muestra offline ES/EN de selección de intervenciones
  con fuentes. Supone que cada intervención se reproduce para ejercitar la memoria;
  no representa una sesión de escucha efectiva.
- `comprobar-publicacion.mjs`: comprobación en Chromium del servicio público con
  Speech real, demora controlada, desactivación/reactivación, sincronía, continuidad,
  memoria enviada, textos distintos y capturas en escritorio/móvil. Usa equipos
  programados; no consume llamadas de modelos de lenguaje.
- `navegador-publico.json`: Speech real, cuatro intervenciones distintas, memoria
  enviada y conservada al reactivar, máximo PCM de 3,156 s excluyendo silencio
  voluntario. Registra también solicitudes con estado 429, cubiertas por respaldo;
  no todas las ventanas preparadas produjeron audio disponible.
- `publicacion.json`: revisión `cronista-arena--0000008`, imagen
  `arena-20261019235303`, ACR `chh` y hashes de los 296 archivos publicados.
- `publico-escritorio.png` y `publico-voz-movil.png`: capturas de la revisión
  pública, inspeccionadas; sin desborde a 360 px ni errores JavaScript.

La continuidad y la ausencia de repeticiones en estos escenarios no sustituyen una
evaluación humana de naturalidad de una transmisión completa. El catálogo ampliado
es respaldo neutral; las jugadas y los comentarios específicos usan eventos y
estados confirmados del partido actual. No se entrenó un modelo ni se enviaron
los transcripts al proveedor.
