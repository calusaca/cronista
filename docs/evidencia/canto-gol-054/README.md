# Brief 054 · Variedad del grito de gol: experimento con Azure Speech (22 oct 2026)

Síntesis real con el recurso de Speech del proyecto, por la misma ruta HTTP que `src/arena/voz.ts`
(`sintetizarVoz`, formato `audio-24khz-48kbitrate-mono-mp3`), con las voces del narrador
(`es-MX-JorgeNeural` `cheerful`, `en-US-JennyNeural` `shouting`) y la misma estructura SSML que
`parteCanto` (un `<s>`, `express-as` + `prosody` por tramo, `break` final de `CANTO_GOL.pausaFinalMs`).
**48 solicitudes y 18.208 caracteres de SSML.** Ningún archivo contiene credenciales; el endpoint
y la clave se leen de `.env` y `.cache/azure-servicios.env` y no se escriben.

- `experimento.mts`: ronda 1 (44 gritos sueltos, 23 ES y 21 EN, con la prosodia de
  `CANTO_GOL.tramos.grito` salvo el `rate` indicado) y ronda 2 (`RONDA=2`, 4 clips de la forma
  completa de tres tramos: cota de duración y escucha en contexto). `SOLO_MEDIR=1` vuelve a medir
  sin llamar a Speech. Se ejecuta desde la raíz con `node --import tsx` (Node ≥ 20.12 por
  `process.loadEnvFile`).
- `indice.json`: por clip, texto, SSML completo, caracteres, bytes y medidas.
- `{es,en}-<id>.mp3`: los clips.

## Método de medida (ffmpeg del venv de video)

Duración por decodificación completa; pico y media (`volumedetect`) del clip y de sus **dos primeros
segundos** (criterio de la v1.1 del 050); **habla** = desde el fin del silencio inicial hasta el inicio
del silencio final (`silencedetect`, −30 dB, ≥ 80 ms; el final es el que termina en el EOF). Los
silencios internos (pausas entre palabras) se listan. La duración del habla es el indicador de
deletreo: si Speech lee una grafía letra por letra, el clip se alarga mucho más de lo que suma la
vocal; si la grafía rompe la palabra, se acorta.

## Ronda 1 · Gritos sueltos (ES, Jorge `cheerful`, pitch +16 %, volumen +30 %, styledegree 2)

| Clip | Texto | rate | Habla (s) | 2 s media (dB) | Pico (dB) | Decisión |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| es-01 | ¡Gooool! | −30 | 1,26 | −19,5 | −7,2 | catálogo (control del 050) |
| es-02 | ¡Goooooooool! | −30 | 1,68 | −20,5 | −8,9 | catálogo |
| es-03 | ¡Gol, gol, gol, gol! | −10 | 1,71 | −19,5 | −4,7 | catálogo |
| es-04 | ¡Gol, gol, gol, gooool! | −20 | 2,52 | −19,1 | −4,1 | catálogo (el más largo) |
| es-05 | ¡Golaaaazo! | −20 | 0,98 | −23,3 | −4,4 | rechazado: la media más baja del lote |
| es-06 | ¡Golazo! | −30 | 0,77 | −24,4 | −7,0 | rechazado: corto y bajo |
| es-07 | ¡Qué golazo! | −25 | 0,80 | −20,7 | −2,8 | reserva |
| es-08 | ¡Qué golaaaazo! | −25 | 1,15 | −20,6 | −3,2 | catálogo (`golazo`) |
| es-09 | ¡Remate y gol! | −20 | 1,05 | −21,9 | −4,0 | reserva |
| es-10 | ¡Remate y gooool! | −25 | 1,56 | −21,7 | −6,3 | catálogo (`remate`) |
| es-11 | ¡Yyyy gooool! | −30 | **3,25** | −20,7 | −3,5 | **rechazado: deletreo** (+1,84 s sobre es-12) |
| es-12 | ¡Y gooool! | −30 | 1,41 | −19,4 | −7,0 | catálogo |
| es-13 | ¡Guuuoooolll! | −30 | 1,40 | −19,0 | −7,1 | rechazado: micro-silencio interno (83 ms), pronunciación incierta, sin ganancia sobre es-02 |
| es-14 | ¡Goooolllll! | −30 | **0,79** | −20,8 | −5,2 | **rechazado: las eles cortan la vocal** (−0,47 s sobre es-01) |
| es-15 | ¡Gooool, gooool! | −30 | 2,33 | −18,1 | −5,3 | reserva (la media ES más alta) |
| es-16 | ¡Gooool del empate! | −30 | 1,95 | −22,3 | −5,7 | catálogo (`empate`) |
| es-17 | ¡Gooool sobre el final! | −30 | 2,18 | −21,4 | −7,7 | catálogo (`tardio`) |
| es-18 | ¡Y otro gooool! | −30 | 1,51 | −20,5 | −5,8 | catálogo (`otro`) |
| es-19 | ¡GOOOL! | −30 | 0,96 | −21,7 | −7,7 | rechazado: más corto que es-01, sin ganancia |
| es-20 | ¡Gol! | −45 | 0,60 | −22,6 | −4,5 | rechazado: la prosodia sola no sostiene la vocal |
| es-21 | ¡Gooool! | −45 | 1,61 | −18,4 | −7,3 | no entra: mismo texto que es-01; −45 alarga el silencio final (1,98 s frente a 1,64) |
| es-22 | ¡Adentro, gooool! | −25 | 1,62 | −17,9 | −5,1 | reserva (la media ES más alta) |
| es-23 | ¡Gooool, gol, gol! | −25 | 2,21 | −18,4 | −5,5 | reserva |

## Ronda 1 · Gritos sueltos (EN, Jenny `shouting`, misma prosodia)

| Clip | Texto | rate | Habla (s) | 2 s media (dB) | Pico (dB) | Decisión |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| en-01 | Goooal! | −30 | 0,53 | −17,2 | −3,4 | catálogo (control del 050) |
| en-02 | Goooooooal! | −30 | 1,03 | −15,5 | −4,5 | catálogo (a −30 % la grafía sí alarga: +0,50 s) |
| en-03 | Goal, goal, goal, goal! | −10 | 1,78 | −13,1 | −2,5 | catálogo (la media más alta) |
| en-04 | Go, go, go, goooal! | −20 | 1,71 | −16,0 | −3,9 | catálogo |
| en-05 | What a goal! | −25 | 1,09 | −17,3 | −3,2 | catálogo (`golazo`) |
| en-06 | What a goooal! | −25 | 1,18 | −18,4 | −5,0 | reserva (1,1 dB más bajo que en-05) |
| en-07 | Shoots and scores! | −20 | 1,33 | −18,3 | −4,4 | reserva |
| en-08 | Shot, and goooal! | −25 | 1,59 | −16,4 | −3,5 | catálogo (`remate`) |
| en-09 | Aaaand goooal! | −30 | 1,15 | −16,1 | −3,8 | catálogo (sin deletreo: +0,13 s sobre en-10) |
| en-10 | And goooal! | −30 | 1,02 | −16,2 | −3,1 | reserva |
| en-11 | Guuuoooal! | −30 | 0,86 | −16,3 | −3,5 | rechazado: pronunciación incierta, grafía no editorial |
| en-12 | Goooallll! | −30 | 0,55 | −19,7 | −5,2 | rechazado: sin efecto sobre en-01 |
| en-13 | Goooal, goooal! | −30 | 1,17 | −15,7 | −4,4 | reserva |
| en-14 | Goooal, they're level! | −25 | 1,74 | −14,2 | −2,6 | catálogo (`empate`) |
| en-15 | A late, late goooal! | −25 | 2,24 | −15,3 | −2,3 | catálogo (`tardio`, el más largo) |
| en-16 | Another goooal! | −30 | 1,58 | −14,5 | −3,5 | catálogo (`otro`) |
| en-17 | GOOOAL! | −30 | 0,53 | −17,2 | −3,4 | rechazado: idéntico a en-01 (mismas medidas) |
| en-18 | Goal! | −45 | 0,72 | −15,0 | −3,1 | rechazado: la prosodia alarga menos que la grafía a −30 |
| en-19 | Goooal! | −45 | 0,67 | −16,1 | −3,5 | rechazado: ídem |
| en-20 | It's in, goooal! | −25 | 1,48 | −16,0 | −2,4 | reserva |
| en-21 | Goooal, goal, goal! | −25 | 1,64 | −13,3 | −2,8 | reserva |

## Ronda 2 · Forma completa (tres tramos en un `<s>`, nombres de 26/27 c, «sobre el final», goleada, cifras)

| Clip | Grito | Texto (c) | Duración (s) | Habla (s) | 2 s media (dB) | Pico (dB) | SSML (c) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| es-30-cota | ¡Gol, gol, gol, gooool! | 148 | **13,87** | 12,45 | −19,1 | −3,7 | 739 |
| en-30-cota | A late, late goooal! | 141 | **14,56** | 13,09 | −15,3 | −2,3 | 735 |
| es-31-contexto | ¡Qué golaaaazo! | 140 | 12,55 | 11,11 | −20,6 | −3,2 | 731 |
| en-31-contexto | Shot, and goooal! | 138 | 14,08 | 12,41 | −16,4 | −3,4 | 732 |

La cota ES coincide en duración y bytes (13,87 s, 83.232 B) con `es-17` del 050; son archivos
distintos (md5 diferente, media de los dos primeros segundos −19,1 frente a −20,3 dB). Ambas cotas
quedan muy por debajo de `VOZ_BUFFER.duracionMaxS` (24 s). El SSML por gol e idioma sube de
689–734 (050) a 731–739.

## Lo que estas medidas no demuestran

Duración, pico y media no miden emoción ni dicen cómo suena una vocal estirada. **La escucha humana
está pendiente.** Orden sugerido para Carlos: primero `es-04`, `es-02`, `es-08`, `es-12` y `es-11`
(este último rechazado por deletreo: confirmarlo), y `en-02`, `en-04`, `en-09`, `en-15`, `en-08`;
después, en contexto, `es-30`, `en-30`, `es-31`, `en-31`. Si alguna grafía suena mal, se sustituye
por su reserva de la misma fila sin cambiar la estructura.
