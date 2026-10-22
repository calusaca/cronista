# Brief 050 · Experimento de canto de gol con Azure Speech (22 oct 2026)

Síntesis real con el recurso de Speech del proyecto, por la misma ruta HTTP que `src/arena/voz.ts`
(`sintetizarVoz`, formato `audio-24khz-48kbitrate-mono-mp3`) y con las voces del narrador
(`es-MX-JorgeNeural`, `en-US-JennyNeural`). 29 solicitudes y 19.236 caracteres de SSML en total
(21 en las rondas 1–3 de la versión 1 del brief; 8 en las rondas 4–5 tras la revisión de Codex).
Ningún archivo contiene credenciales; el endpoint y la clave se leen de `.env` y
`.cache/azure-servicios.env` y no se escriben.

- `experimento.mts` (ronda 1: control y seis candidatos por idioma, más Davis `shouting` informativo),
  `experimento-ronda2.mts` (sin `<s>` por tramo, grito largo, `shouting` en el grito de Jenny) y
  `experimento-ronda3.mts` (la forma de la v1), `experimento-ronda4.mts` (cota de duración de dos tramos y
  variantes de volumen en español) y `experimento-ronda5.mts` (cota de la forma final de tres tramos). Se ejecutan con `node --import tsx <archivo>` desde la raíz.
- `medir.mts` vuelve a medir los MP3 sin llamar a Speech: duración por decodificación completa,
  pico y media (`volumedetect`) del clip entero, de su primer segundo y del resto, con el ffmpeg de
  `.cache/venv-video`.
- `catalogo-estilos.json`: voces es-MX, es-ES y en-US con estilos según `/voices/list` del recurso real.
- `indice.json`: por candidato, texto, SSML completo, caracteres, bytes, duración y medidas.
- `{es,en}-<id>.mp3`: los clips.

## Catálogo real

`es-MX-JorgeNeural`: `cheerful`, `chat`. **Ninguna voz es-MX ni es-ES del recurso tiene `shouting` ni
`excited`.** `en-US-JennyNeural`: `shouting`, `excited`, `cheerful`, `chat`, `newscast`, `angry`,
`sad`, `friendly`, `terrified`, `unfriendly`, `whispering`, `hopeful`, `assistant`, `customerservice`.
`en-US-DavisNeural` y `en-US-GuyNeural` también admiten `shouting`.

## Medidas (ffmpeg; «1er s» = media del primer segundo, donde está el grito)

| Clip | Texto | Dur. (s) | 1er s (dB) | Pico (dB) | SSML (c) | Bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| es-1-control-actual | ¡Gol de Mateo Ferrán! | 2,37 | −20,9 | −6,2 | 359 | 14 256 |
| es-2-texto-largo-prosodia-unica | ¡Gooool! ¡Gol de…! … Minuto 23: uno a cero. | 9,12 | −20,2 | −3,0 | 428 | 54 720 |
| es-3-rampa-segmentos | tres `<s>` con rampa (sd 2 → 1,2) | 10,48 | −18,4 | −2,5 | 736 | 62 928 |
| es-4-triple-gol-crescendo | ¡Gol! ¡Gol! ¡Gooool! + goleador + datos | 13,05 | −22,4 | −2,6 | 1 058 | 78 336 |
| es-5-vocal-estirada-texto | ¡Goooooool! a ritmo normal | 10,32 | −21,0 | −2,6 | 737 | 61 920 |
| es-6-vocal-estirada-prosodia | ¡Gol! a rate −45 % | 10,72 | −19,6 | −2,3 | 733 | 64 368 |
| es-7-nombre-repetido | ¡Gooool! ¡Mateo Ferrán! ¡Mateo Ferrán! … | 11,56 | −18,4 | −3,6 | 740 | 69 408 |
| es-9-compacto | tres `express-as` sin `<s>`, grito a −30 % | 10,96 | −18,9 | −2,6 | 715 | 65 808 |
| es-10-compacto-grito-largo | ¡Goooooool! a −40 % | 11,68 | −21,1 | −2,5 | 718 | 70 128 |
| **es-11-forma-elegida** | ¡Gooool de Mateo Ferrán! + hechos, un solo `<s>` | **8,68** | −22,6 | **−1,8** | 526 | 52 128 |
| en-1-control-actual | Goal by Mateo Ferrán! | 2,85 | −20,6 | −4,1 | 358 | 17 136 |
| en-2-texto-largo-prosodia-unica | Goooal! Goal by…! … Minute 23: one–nil. | 9,98 | −18,9 | −2,4 | 425 | 59 904 |
| en-3-rampa-segmentos | tres `<s>` con rampa | 11,16 | −17,5 | −3,2 | 731 | 66 960 |
| en-4-triple-gol-crescendo | Goal! Goal! Goooal! + … | 14,20 | −17,4 | −3,5 | 1 051 | 85 248 |
| en-5-vocal-estirada-texto | Goooooal! a ritmo normal | 11,04 | −19,9 | −3,4 | 731 | 66 240 |
| en-6-vocal-estirada-prosodia | Goal! a rate −45 % | 12,16 | **−14,1** | −3,6 | 729 | 73 008 |
| en-7-nombre-repetido | Goooal! Mateo Ferrán! Mateo Ferrán! … | 12,60 | −17,5 | −3,2 | 731 | 75 600 |
| en-8-davis-shouting-informativo | Davis `shouting` (no es la voz del narrador) | 11,64 | −25,2 | −4,9 | 730 | 69 840 |
| en-9-compacto | sin `<s>`, grito a −30 %, `excited` | 11,54 | −16,7 | −3,5 | 710 | 69 264 |
| en-10-compacto-grito-shouting | igual, `shouting` solo en el grito | 11,47 | **−14,2** | −3,5 | 711 | 68 832 |
| **en-11-forma-elegida** | Goooal by Mateo Ferrán! (`shouting`) + hechos (`excited`) | **9,07** | −15,9 | −2,3 | 520 | 54 432 |
| es-12-cota-larga | dos tramos, nombres de 26/27 c, «sobre el final», goleada, cifras | 12,45 | −18,6 | −2,9 | 593 | 74 736 |
| en-12-cota-larga | ídem en inglés | 12,93 | −12,1 | −2,3 | 593 | 77 616 |
| es-13-forma-elegida-rate-10 | forma v1 con grito a −10 % | 8,30 | −21,1 | −2,3 | 553 | 49 824 |
| es-14-forma-elegida-xloud | forma v1 con `volume="x-loud"` | 8,68 | −24,9 | −1,8 | 555 | 52 128 |
| es-15-forma-elegida-pitch-8 | forma v1 con pitch +8 % | 8,68 | −22,7 | −1,9 | 552 | 52 128 |
| **es-16-grito-separado-un-s** | **forma final v1.1**: «¡Gooool!» (−30 %) · «¡Gol de Mateo Ferrán!» · hechos, un solo `<s>` | **9,93** | −18,9 | **−1,1** | 689 | 59 616 |
| es-17-cota-larga-tres-tramos | forma final, cota: «¡Gol, gol, gooool!» · «¡Gol, gol de {26 c}!» · sobre el final, goleada, cifras | **13,87** | −20,3 | −3,5 | 734 | 83 232 |
| en-17-cota-larga-tres-tramos | ídem en inglés (`shouting` en el grito) | **14,23** | −13,8 | −2,5 | 734 | 85 392 |

Silencios internos (`silencedetect`, −30 dB, ≥ 80 ms): cada frontera de `<s>`, de `express-as` o
de oración cuesta entre 0,85 y 1,45 s de silencio y el final añade ≈ 1,2 s. En la forma elegida
el habla ocupa ≈ 5,6 s de 8,7 s (ES). Duración del grito: ES «¡Gooool!» 1,03 s a −15 %, 1,26 s a
−30 %, «¡Goooooool!» 1,74 s a −40 %, «¡Gol!» 0,60 s a −45 %; EN «Goooal!» 0,53 s a −15 %,
«Goooooal!» 0,56 s a 0 %, «Goal!» 0,84 s a −45 %.

## Rondas 4–5 (tras la revisión de Codex, hallazgos 8 y 10)

La media del primer segundo penaliza a las formas cuyo grito arrastra la vocal. Medida sobre los
**dos primeros segundos** (`ffmpeg -t 2 -af volumedetect`): control −23,6 dB; forma v1 (es-11)
−21,8; rate −10 % −21,9; pitch +8 % −21,8; `x-loud` −24,0 (peor); rampa de tres `<s>` (es-3) −20,3;
**tres tramos en un solo `<s>` (es-16) −19,5 dB, +4,1 dB sobre el control**, por 1,25 s más de
duración. En inglés, la misma estructura con `shouting` da −12,9 dB (en-17). Cota de duración de
la forma final con los nombres más largos: 13,87 s (ES) y 14,23 s (EN), frente a 24 s del consumidor.
SSML por gol e idioma: 359 hoy, 689–734 con la forma final.

## Lo que estas medidas no demuestran

Pico, media y duración son indicadores indirectos. No miden emoción percibida, entonación ni si
Jorge pronuncia «Gooool» como vocal sostenida o deletrea. **La escucha humana está pendiente**:
Carlos debe oír al menos `es-16` y `en-17` (y `en-10` frente a `en-9` para decidir `shouting`)
antes de dar por cerrada la prosodia.
