# Smoke público 060 · 061 · 062 (24 oct 2026)

- Sitio: https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io
- Revisión: `cronista-arena--0000031`, commit `345e116`, imagen `cronista:arena-20261024082343`. La revisión la
  indicó el coordinador; en esta máquina no hay `az`, así que se dio por buena por el comportamiento observado
  (existen `data-cursor-s`, `arena-models`, `arena-stop` y `to-arena`).
- Hora UTC: de 08:39 a 08:58 (pistas con voz: duelo de 08:49:14 a 08:51:29 y torneo de 08:51:44 a 08:54:08).
- Navegador: Chromium (Playwright) con `--autoplay-policy=user-gesture-required` y `--mute-audio`.
- Scripts:
  - `.cache/smoke-0606162-voz.mjs`: pista con voz, una por invocación;
  - `.cache/smoke-0606162-resto.mjs`: modelos, barra, directo programado, 061 y 062;
  - `.cache/smoke-0606162-selector.mjs`: reproducción del defecto D1.
- Datos: `smoke.json`.

## Veredicto por punto

| # | Punto | Veredicto |
|---|---|---|
| 1 | Reproducir con narración: 1×, nunca delante, adelanto máximo | **VISTO OK** (duelo EN y torneo e04 EN) |
| 2 | Línea de modelos con procedencia | **VISTO OK** (duelo, ejemplo-v3, torneo, sin IA; EN y ES) |
| 3 | Barra: pausa, Stop, «Stop match», espacio, 360 px | **VISTO OK** (y defecto D1 encontrado fuera del 060) |
| 4 | /match/246 y / con el aspecto de la arena, claro y oscuro | **VISTO OK** |
| 5 | «← Arena» lleva a /arena | **VISTO OK** |
| 6 | Atrás sin duplicados | **VISTO OK** |
| 7 | Sin desborde de 320 a 1440 px | **VISTO OK** |
| 8 | `/api/arena/torneos/sitio` responde `habilitado:false`, «desactivado» | **VISTO OK** |
| 9 | /arena/torneo muestra el torneo del 24 oct | **VISTO OK** (no hay interfaz para lanzar) |
| 10 | Ningún 5xx en el uso normal | **VISTO OK** (0 respuestas 5xx y 0 `pageerror`) |

## 1 · Pista al ritmo (Speech real)

| Medida | Duelo EN | Torneo 2026-10-24 · e04 EN |
|---|---|---|
| Cancha por segundo de audio en los tramos que corren | **1,003** (59,86 s / 59,70 s) | **0,999** (59,92 s / 60,00 s) |
| Ventanas de 1 s (mín.–máx.) | 0,989–1,193 (*) | 0,946–1,030 |
| Esperas | previa 44,4 s · final 7,4 s · sin rótulo **0** | previa 43,4 s · `arena-replay-hold` 2,7 s · final 6,7 s · sin rótulo **0** |
| Pista sin la previa / partido | 67,5 s / 60 s = **1,125×** (máximo 1,6) | 69,8 s / 60 s = **1,163×** |
| Gol: hecho → cancha al empezar el clip | 23,1 s → 25,39 s (**+2,29 s**) | 18,4 s → 21,40 s (**+3,00 s**) · 45,5 s → 48,43 s (**+2,93 s**) |
| Final («Full time»): hecho → cancha | 60,0 s → 60,0 s (terminal) | 60,0 s → 60,0 s (terminal) |
| Reacción mínima (sin terminales) | +0,301 s | +0,301 s |
| Adelanto máximo de la voz | **0** (ningún clip empieza antes de su hecho + 0,3 s; los terminales empiezan con la cancha ya en `fin`) | **0** |
| Clips omitidos (todos con prioridad < 60) | 5 | 5 |
| Segunda reproducción | 0 pedidos nuevos a `/relato` | 0 |

(*) Una sola ventana, la que empieza en 76,0 s de audio, da 1,193. Es un salto del muestreo: el RAF se detuvo
≈ 0,3 s y después alcanzó al audio. Las 53 ventanas restantes están entre 0,989 y 1,012.

**Método.** Cada clip se localizó en la pista ensamblada por la huella de sus muestras: el clip servido se
decodificó a 24 kHz y se comparó muestra a muestra. En cada inicio se tomaron dos lecturas de `data-cursor-s`:

- por búsqueda, con el audio en pausa en el instante exacto;
- en reproducción natural, interpolando entre las muestras de 100 ms.

Las dos lecturas coinciden con una diferencia de ≤ 0,09 s.

**Speech.**

- Duelo: 17 solicitudes (3 de previa, 13 de narrador y 1 de cierre) y 1.394 caracteres de texto.
- Torneo: 18 solicitudes (3, 14 y 1) y 1.309 caracteres.
- Ninguna respuesta fue distinta de 200.
- La pista del duelo se sintetizó en un primer intento (ver «Incidencias»), y la medición se repitió desde la
  caché del servidor: 4 s de preparación. En total se sintetizaron 2 pistas.

## 2 · Línea de modelos

| Forma | Texto (EN) | `data-procedencia` |
|---|---|---|
| Inicial | Home: Programmed policy · Away: Programmed policy · programmed, no AI | programado |
| Duelo | Home: GPT-5.6 Luna · Away: GPT-5.4 mini · declared by the project's archived file, not verified | declarada |
| ejemplo-v3 | Home: GPT-6.1 Sol (deployment gpt-6.1-sol) · Away: GPT-6.1 Sol (deployment gpt-6.1-sol) · declared by the project's archived file, not verified | declarada |
| Torneo e04 | Home: GPT-6 Astra · Away: GPT-5.4 mini · declared by the tournament runner, not verified | declarada |
| Sin IA (30 s) | Home: Programmed policy · Away: Programmed policy · programmed, no AI | programado |
| Directo programado | Home: Programmed policy · Away: Programmed policy · programmed, no AI | programado |

- Se comprobó también en ES: «Local: … · Visita: … · declarada por el archivo archivado del proyecto, no
  verificada», «… declarada por el ejecutor del torneo, no verificada» y «Política programada … programado, sin IA».
- La línea va siempre justo después de `.arena-match-clock` y no tiene `role`.

## 3 · Barra

| Caso | Resultado |
|---|---|
| Repetición con voz (duelo y torneo) | Pause: `currentTime` y cursor quietos 1,5 s (Δ 0 y 0). Play: los dos avanzan 1,50 s. Espacio con el foco en `body`: pausa y reanuda. Espacio con el foco en «Speed»: no actúa. Stop: cursor 0,000, «0:00 / 1:00», audio en pausa sin `src`, quieto, Play habilitado y con el foco, Stop deshabilitado |
| Repetición sin voz (1440 y 360 oscuro) | Pause congela; el espacio reanuda y pausa; Stop vuelve a 0:00 y se queda quieto 700 ms; el foco queda en el botón principal |
| Directo programado (1440 y 360) | Un único «Pause broadcast», bajo la cancha y con `aria-keyshortcuts="Space"`. Estado «Broadcast paused · generation continues» y reloj quieto 2 s. El espacio reanuda. «Stop match» envía un DELETE: «Match cancelled», «0:00 / 0:28», la emisión desmontada, sin enlace para compartir, sin audio sonando y «Start live match» habilitado |
| 360 px | Hueco entre la cancha y la barra: **12 px** (en 1440 también). Botones de 44 px de alto. `scrollWidth` = 360 |

## 4–7 · Crónicas (061)

- **Aspecto.** En claro y en oscuro, a 1440 y a 360 px:
  - `/match/246` y `/` comparten con `/arena` `--bg`, el fondo de la barra (`rgb(11, 18, 32)`), la marca y el
    punto del emblema: `#d1242f` en claro y `#ff5a5f` en oscuro;
  - la navegación es exactamente «Match reports · League mode · Data · Arena».
- **«← Arena».** Su nombre accesible es «Arena» y su `href`, `/arena`. El clic lleva a `/arena`, y Atrás vuelve
  a `/match/246`.
- **Historial.** El recorrido fue `/arena` → «Match reports» → `/` → historia → `/match/834` → cuatro cambios de
  perspectiva.
  - Las perspectivas no añaden entradas: el historial quedó en +2 tanto antes como después de los cambios.
  - Atrás lleva a `/` y otro Atrás a `/arena`.
  - Con el precedente `/datos` → marca → `/` → visita, la longitud no cambia y Atrás lleva a `/datos`.
- **Desborde.** 0 px de exceso en 113 anchos (320–1440, en pasos de 10) en tres casos: `/match/246`,
  `/match/246` con el error de semilla visible y `/`. También se miró la barra y el aviso de error.

## 8–10 · Torneo del sitio (062) y errores

- `GET /api/arena/torneos/sitio` responde 200 con `{"habilitado":false,"motivo":"desactivado"}`.
  `POST {formato:"liga"}` responde 503 con `motivo: "desactivado"`.
- `/arena/torneo` muestra «Model tournament», con fecha October 24, 2026, 30/30 partidos, 6 filas y 60 enlaces a
  repeticiones. No hay botón para lanzar (P1-a solo es del servidor).
- Rutas del uso normal: `/`, `/match/246`, `/liga`, `/datos`, `/arena`, `/arena/torneo`,
  `/arena/torneo/2026-10-24`, `/api/arena/{modelos,herramientas}`, `/api/health` y los estáticos. Todas
  respondieron 200, con 0 respuestas 5xx y 0 errores de página en todo el smoke.

## Defectos e incidencias

**D1 (fuera del 060, preexistente, riesgo de gasto).** El selector «Controller selection» del directo vuelve a
«Random models» cuando llega `/api/arena/modelos`, aunque el usuario ya hubiera elegido «Programmed
demonstration». La causa está en `src/ui/ArenaEnDirecto.tsx:47`: `if (r.modelos.length) setModo("azar")`.

- **Reproducción** (`.cache/smoke-0606162-selector.mjs`, sin lanzar nada):
  1. retener `/api/arena/modelos`;
  2. elegir «Programmed demonstration»;
  3. soltar el catálogo.
  El selector pasa de `programado` a `azar`, y «Start live match» queda habilitado.
- **Consecuencia en este smoke.** En la segunda ejecución de `smoke-0606162-resto.mjs`, la elección se hizo antes
  de que llegara el catálogo. Se lanzaron **2 sesiones con modelos al azar** (GPT-6 Astra contra GPT-5.4 mini y
  GPT-5.4 mini contra GPT-6.1 Sol), que «Stop match» canceló a los ≈ 7 s. Sus `/relato` estaban bloqueados en el
  cliente, así que no se gastó Speech. Las tablas de arriba proceden de la reejecución, que espera al catálogo,
  comprueba el valor antes de pulsar y bloquea cualquier `POST /api/arena/sesiones` que no sea programado.

**I1 (no reproducida).** El primer intento de la pista del duelo no empezó a sonar en 300 s y su estado no se
capturó. La segunda ejecución sirvió la pista desde la caché en 4 s, así que la síntesis sí se completó.
Coincidió con el directo programado de la reejecución, lanzado en paralelo por este smoke. La causa probable es
esa interferencia o la fase «pulsar» del autoplay, pero no está verificada. En los dos intentos medidos, la
reproducción arrancó sola tras el clic.
