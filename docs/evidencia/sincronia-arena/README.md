# Sincronía de voz y punto central

Implementación del [brief 042](../../disenos/042-sincronia-y-saque-inicial.md).

- `validacion-local.json`: 1.586 pruebas unitarias en 68 archivos, tipado,
  build de producción, standalone y dos pruebas de empaquetado. 35 escenarios
  únicos de arena comprobados entre la corrida general y los focos corregidos.
- `reactivar-voz.json`: un gol a 23,1 s queda preparado durante el silencio.
  La voz vuelve en el segundo 24, cuando ese gol todavía no ha caducado, y entra
  desde el cursor actual. No reproduce el gol anterior, crea un solo contexto y
  reutiliza la preparación futura sin duplicar las ventanas ordinarias.
- `continuidad-voz.json`: con Speech bloqueado y fallido, tres fuentes audibles
  a velocidad natural y pausa máxima de 2,109 s durante 22,298 s. Incluye recuperación
  del búfer. Las pausas de esta prueba local se miden entre fuentes de audio.
- `navegador-publico.json`: Speech real, pausa/reanudación de voz, descarte de
  contenido anterior y caducidad, puntos centrales del motor y compatibilidad de UI.
- `publicacion.json`: revisión, imagen y manifiesto de fuentes publicadas.

El fixture `src/arena/__fixtures__/arena-reinicios-v1.json` procede de la revisión
pública 0000006 mediante una simulación programada de la semilla 7. Su reproducción
exacta está incluida en la suite; se conservan también las pruebas de los archivos
históricos anteriores. Los nuevos registros usan `reinicios-v2`.

En la primera corrida de navegador pasaron 33 casos y fallaron dos expectativas
de los fixtures de voz: una entrada heredó por error el WAV de contexto de 15 s,
y otro caso exigía la entrada cuando el saque inicial actual, de mayor prioridad,
había comenzado correctamente. Se separó el audio de entrada y se comprobó que
el cierre espera al final visual y a la intervención actual. Los dos focos pasaron;
el caso nuevo de reactivación se repitió además antes de caducar el gol anterior.

Las pruebas locales usan MP3 de reserva existentes y WAV de prueba; no consumen
Speech ni modelos. La comprobación pública utiliza selección programada y Speech
real. La medición pública de silencio usa PCM con umbral 0,001 en bloques de 20 ms
y excluye el intervalo silenciado explícitamente por el espectador. No sustituye
una revisión humana de la calidad acústica.

Publicada en `cronista-arena--0000007`, ACR `chg`, con los 294 archivos de fuentes
coincidentes. La demo original conserva `cronista--0000005`. En público se reutilizó
un único contexto de audio y se obtuvieron entradas ancladas a los ticks 12 y 170.
Después de reactivar, la entrada del tick 170 comenzó en el segundo visible 17;
las siguientes jugadas de ticks 231 y 275 comenzaron en los segundos 23 y 27,
sin anunciar hechos futuros ni reproducir intervenciones anteriores a la activación.
La primera entrada, retenida deliberadamente durante la espera, se descartó por vieja.

Pausa máxima PCM: **3,182 s** durante una observación de **26,662 s** que incluyó
cuatro segundos con la voz apagada; ese intervalo voluntario se excluye del cálculo
de silencio. Cinco fuentes audibles, sin aceleración. Punto inicial `(52,5; 34)`,
evento de saque inicial transmitido, puntos de saque posteriores al gol y primer
pase comprobados en la API pública. Capturas de escritorio y móvil revisadas;
cero errores JS y sin desbordamiento a 360 px. La selección fue programada,
sin llamadas a equipos LLM ni al analista.
