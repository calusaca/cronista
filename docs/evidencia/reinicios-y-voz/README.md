# Reinicios y continuidad de voz

El [brief 041](../../disenos/041-reinicios-y-continuidad-de-voz.md) documenta el cambio.

- `corpus.json`: 30 partidos programados de 60 segundos; 7 bandas, 10 esquinas,
  14 saques de meta y 36 saques de centro. Reproducción exacta de los 30 encuentros
  y los cuatro archivos históricos. No representa calibración profesional de frecuencias.
- `continuidad-local.json`: fuentes Web Audio audibles, a velocidad natural,
  durante síntesis bloqueada y fallida. Pausa máxima observada: 2,118 segundos
  durante 22,334 segundos, incluyendo recuperación del búfer del partido.
- `validacion-local.json`: tipado, pruebas, empaquetado y hashes finales.
- `navegador-publico.json`: comprobación de la versión publicada con voz real,
  demora controlada del consumidor, etiquetas de saque y reinicios del servidor.
- `publicacion.json`: revisión y manifiesto de la imagen publicada.

La primera corrida completa de navegador detectó una carrera de cancelación real,
corregida colocando «Cancelando» antes de solicitar DELETE. También se ajustó una
prueba cuyo gol sintético duraba 0,3 s y podía pasar entre dos comprobaciones: ahora
el audio del gol dura 2,4 s. Una nueva prueba consultaba como visible una nota de
importación dentro de un desplegable cerrado; se comprueba su presencia y el equipo
importado antes de mover el cursor. Los recorridos corregidos se volvieron a ejecutar.

Los seis audios neutros de reserva se generaron una vez con Azure Speech (503
caracteres de texto total). Las pruebas locales usan esos MP3 y WAV de prueba;
no realizan nuevas llamadas a los modelos ni a Speech. La comprobación pública
consume Speech real; las observaciones de pausas son de reproducción automática,
no una evaluación humana de calidad acústica.

Publicada en `cronista-arena--0000006`, compilación ACR `chf`. Los 293 archivos del
contexto coinciden con las fuentes finales y la demo original sigue en
`cronista--0000005`. En la comprobación pública, cinco fuentes audibles y ocho
respuestas de voz 200; pausa máxima de **3,166 segundos** durante **22,585 segundos**.
La medición pública examina PCM en bloques de 20 ms con umbral absoluto 0,001 e
incluye pausas internas, silencios iniciales/finales e interrupciones de los clips.
Se observaron esquina a 8 s, gol y saque de centro por el equipo que recibió el gol
a 21 s. API pública comprobada también con bandas y metas. Sin errores JS ni
desbordamiento en móvil de 360 px; capturas revisadas.

El primer smoke público esperaba un gol de la semilla 2 usando el intervalo de
15 s del corpus, pero las sesiones deciden cada 30 s y esa secuencia no genera
ese gol. Se corrigió la prueba usando la semilla 7 y se confirmó explícitamente
la selección programada. No se modificó el motor para forzar el resultado de la prueba.
