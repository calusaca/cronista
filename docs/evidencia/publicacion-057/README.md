# Brief 057: smoke público (Reproducir con narración, gol en la red y vista del arco)

Fecha: 23 de octubre de 2026, de 01:21 a 01:35 UTC. Smoke del [brief 057](../../disenos/057-play-narrado-y-gol.md)
(v1.1, v1.2 y v1.3) sobre la URL pública, con un navegador real: Chromium headless de Playwright, con
`--mute-audio`. Se usó Speech real y no se generó ningún partido con LLM. No se tocó el código y no se hizo commit.
Los scripts están fuera de git: `.cache/smoke-057.mjs` (fases A–D), `.cache/smoke-057-capturas.mjs`,
`.cache/smoke-057-solape.mjs` y `.cache/smoke-057-zoom.mjs`.

**Veredicto: VISTO OK con un defecto medio en móvil.** Los bloques A, B1 y B2 funcionan en público. El defecto
está en B2: a 360 y 390 px, la vista del arco tapa el arco batido y casi todo el balón en la red (véase «Defecto»).

## Revisión activa

Datos de `az containerapp revision list -n cronista-arena -g rg-cronista-demo` (01:21 UTC):

| Campo | Valor |
| --- | --- |
| Revisión | `cronista-arena--0000022` (latest = latestReady) |
| Tráfico | 100 % |
| Salud / estado | `Healthy` / `RunningAtMaxScale` |
| Réplicas | 1 (mín. 1, máx. 1) |
| Creada | 2026-10-23T01:19:17Z |
| Imagen | `crcronistae1734ecca5ff.azurecr.io/cronista:arena-20261023011655` (commit `368357e`, 01:16:29Z) |

## Resultados

| # | Comprobación | Resultado | Evidencia |
| --- | --- | --- | --- |
| 2 | Ejemplo «Load AI coaches example» (EN), «With narration» marcado por defecto y Play | OK | `smoke-A.json` |
| | Registro automático sin pulsar «Enable narration»: un `POST /api/arena/grabaciones` `{ "archivo": "ejemplo-v3" }`, 200 | OK | sesión `05377400-…` |
| | Progreso junto a Play: «Registering the recording…», luego «Preparing narration 0/9 … 8/9»; el botón dice «Play without narration» y la velocidad queda bloqueada | OK | `barra-preparando-1440.png` |
| | Suena: `audio.paused=false`, `currentTime` 0,12 → 2,12 s en 2 s, `src` blob; pista de 293,4 s | OK | `barra-sonando-1440.png` |
| | El reloj sigue al audio: tras buscar a 0:30, +0,6 s de partido en 3 s de audio. Al poner `audio.currentTime = 249,4` desde el control nativo, el reloj salta a 0:51 | OK | |
| | Pausa con el botón y con el `<audio>` nativo: `currentTime` y reloj quietos 600 ms; Reproducir sigue desde el mismo punto | OK | |
| | Búsqueda con el deslizador a 0:30 (en pausa): `currentTime` 3,4 → 163,3 s, reloj 0:30; Reproducir sigue desde 0:30 | OK | |
| | «Restart» devuelve `currentTime` a 0,4 s y el reloj a 0:00 | OK | |
| | Lo mismo en ES («Con narración», «Registrando la grabación…», «Preparando narración n/9», «Pausar»), con las 9 peticiones de relato en `idioma: "es"` | OK | `smoke-B.json` |
| 3 | «Create recording without AI» de 30 s (reglas `reinicios-v5`, versión `arena-v3`, gol de la visita en el tick 257, en el arco izquierdo; primer intento) | OK | `smoke-C.json` |
| | Cursor movido a 0:22,7 antes de Play. `POST /api/arena/grabaciones` con `{ registro }` (991 KB): 200, id `9d7cf1d0-…`, sin 429 | OK | |
| | Fases «Registering the recording…» y «Preparing narration 0/6 … 5/6»; suena a los 8,2 s del clic | OK | |
| | Empieza desde el cursor: primer fotograma en 0:22,8 (`currentTime` 127,8 s) | OK | |
| | `?partido=9d7cf1d0-…` muestra «Home: programado:geometria-v3 · Away: programado:geometria-v3 · controllers declared by the file, not verified» | OK | |
| 4 | Gol durante la reproducción narrada, muestreado por fotograma (664 muestras antes del gol): **antes del tick 257** no hay recuadro, rótulo, `data-gol` ni fase `red`, y el marcador está 0–0 | OK | `smoke-C.json` → `muestrasResumen` |
| | Vuelo: `data-reconstruccion="vuelo"` de 0:25,5 a 0:25,7, con `cx` 3,0 → 0,03 hasta el cruce (x = 0, y = 37,6) | OK | |
| | En la red: fase `red` durante 1,0 s de partido (3,8 s de reloj con la voz), `cx` = −1 (1 m dentro), `cy` = `hasta.y`, marcador 0–1, recuadro y rótulo desde el primer fotograma del gol | OK | |
| | Saque de centro tras la red: balón en (52,5; 34) y «Kick-off · Club Puertoscuro» | OK | `gol-saque-centro-*.png` |
| | Con el deslizador: en t−0,2 s hay vuelo y nada visible; en t+0,5 s está en la red y las 21 fichas siguen en el fotograma previo (tick 255; hubo una roja en el tick 112); en t+0,9 s sigue `red`; en t+1,0 s hay corte, centro y «Kick-off» | OK | |
| | `arena-goal-view`: `data-arco="local"`, `data-lado="visita"`, «Goal view · Club Puertoscuro · lateral from the record · illustrative height (high)» | OK | `gol-vista-arco-*.png` |
| | Escudo del rótulo de gol: 16 × 18 px a 1440 y a 360 | OK | |
| 5 | Móvil 360: barra preparando y sonando, sin desborde (`scrollWidth ≤ 360`); recuadro dentro de `.arena-pitch-wrap` | OK | `smoke-D.json` |
| | Móvil 360: el recuadro no tapa el balón en la red | **FALLA** | `solape-*.png`, `solape-recuadro.json` |

En las cinco corridas no hubo errores de JavaScript (`pageerror`) ni respuestas 5xx.

## Defecto (medio, solo en móvil): la vista del arco tapa el arco batido

A 360 y 390 px, el `figure.arena-goal-view` (128 × 136–150 px, con fondo al 92 % de opacidad) cubre el área y
la boca del arco batido. El balón en la red queda en el borde izquierdo del recuadro (o en el derecho, si el
arco es el derecho):

| Ancho | Parte del balón (en la red) bajo el recuadro |
| --- | --- |
| 360 | 32 % en los tres goles medidos (85 % en el primer fotograma del gol) |
| 390 | 52 % en los tres goles (100 % en el primer fotograma) |
| 768 y 1440 | 0 % |

En `solape-360-zoom-balon.png` (×4) solo asoma medio balón junto a la franja de color del recuadro. El portero y
los defensores cercanos también quedan detrás del recuadro (`solape-360-sinia.png`,
`solape-360-ejemplo-260.png` y `solape-360-ejemplo-545.png`). La § 5.3 del brief afirma que el recuadro «no
tapa … la boca del arco de la cancha (y = 30–38 de 68)». A ≤ 390 px no se cumple, porque la cancha mide unos
215 px de alto y el recuadro, unos 136.

Reproducción:

1. Abre `/arena` a 360 × 780.
2. Pulsa «Saved matches» y luego «Load AI coaches example».
3. Mueve el deslizador «Match time» a 26,5 (gol en el tick 260, arco izquierdo) o a 55 (gol en el tick 545, arco derecho).
4. El balón (`[data-testid=arena-ball]`, `cx` = −1 o 106) queda en el borde del `arena-goal-view` y la boca del
   arco no se ve.

La intersección de rectángulos está en `solape-recuadro.json`. `elementFromPoint` no sirve para medirla,
porque el recuadro tiene `pointer-events: none`. El e2e `arena-gol-visual.spec.ts` (B2, 360 px) solo comprueba
que el recuadro cabe dentro de la cancha y que no hay desborde, así que no detecta este solape.

## Observaciones (no son defectos del 057)

- **Ritmo con voz.** La pista del ejemplo de 60 s dura 293 s (previa de unos 36 s más seis ventanas de 280–580
  caracteres). Mientras habla el narrador, la cancha avanza a unos 0,2× (0,6 s de partido por cada 3 s de audio),
  y la red del gol se ve durante 3,8 s de reloj. Es coherente con «el audio marca el ritmo» (§ 3.1), pero en una
  demo de menos de 2 minutos conviene buscar antes de pulsar Reproducir.
- **Previa.** Durante los primeros ~36 s suena la previa y el reloj se queda en 0:00. Es lo que dispone v1.1 § 6
  (tramos `[0, 0]`).
- **Velocidad 2× por defecto.** Sin pista, el selector vuelve a 2× (es el valor inicial de `Arena`). Con la pista
  activa muestra 1× bloqueado, como pide el brief.
- **Nombres partidos en el marcador a 360 px.** Se ven cortes como «SPORTIN G MONTEF RÍO BAJO» (055, fuera del
  alcance de este smoke).
- La primera corrida de la fase A (01:24:42 UTC) tardó 19,5 s en sonar porque sintetizó la pista. Las corridas
  siguientes con la pista en caché tardaron 3,5–4 s. `smoke-A.json` es la segunda corrida (pista en caché), con
  resultados idénticos. La fase C esperaba 22 fichas a mano: se corrigió a «las del fotograma previo» (21, por la
  roja) y se confirmó en la fase D (`movil.todos-quietos-en-fotograma-previo`).

## Gasto de Speech

Hubo tres pistas completas sintetizadas: ejemplo EN, ejemplo ES y la grabación sin IA EN. Cada pista incluye las tres piezas
de la previa. Todas las demás reproducciones (segunda corrida de A, móvil y capturas) salieron de la caché del
servidor.

| Pista | Peticiones de síntesis | Caracteres de texto (`audio.caracteres`) | Caracteres SSML presupuestados |
| --- | --- | --- | --- |
| Ejemplo `ejemplo-v3`, EN | 9 (3 previa + 6 ventanas) | 3.345 | 12.229 |
| Ejemplo `ejemplo-v3`, ES | 9 | 3.304 | 11.994 |
| Grabación sin IA de 30 s, EN | 6 (3 + 3) | 1.753 | 6.160 |
| **Total** | **24** | **8.402** | **30.383** |

Azure Monitor del recurso Speech, métrica `SynthesizedCharacters`, consultada entre las 01:10 y las 01:40 UTC:
10.539 (01:25) + 3.227 (01:26) + 12.077 (01:27) = **25.843**. `TotalCalls` = 48 en esos tres minutos. No hay
datos después de las 01:27, aunque hubo 27 peticiones de relato servidas desde la caché entre las 01:27 y las
01:32. El reparto por minuto no coincide con el de cada pista, y el total de llamadas incluye llamadas que no son
síntesis, así que la cifra fiable es el total de caracteres.

## Lo que no se pudo comprobar

- Escucha humana del audio: el navegador estaba silenciado. Se comprobó que hay audio (blob, `currentTime` que
  avanza, 293 s de duración), no cómo suena.
- La reproducción completa hasta «End of narration» con Speech real: habría exigido 5 minutos de escucha por pista.
- Los casos 429 y `retry-after`, el autoplay bloqueado y el error tardío. No se forzaron en público para no gastar
  cuota de subidas ni de Speech. La fase `pulsar` no apareció: Chromium aceptó el autoplay tras el clic.
- La reproducción narrada a 360 px de la grabación sin IA. A 360 px se reprodujo con voz el ejemplo (en caché) y el
  gol se comprobó con el deslizador sobre la grabación sin IA importada.
- Tema oscuro y movimiento reducido en público: las capturas son del tema claro.

## Archivos

- Resultados: `smoke-A.json` (ejemplo EN), `smoke-B.json` (ejemplo ES), `smoke-C.json` (grabación sin IA y gol,
  con el muestreo por fotograma), `smoke-D.json` (móvil 360), `capturas.json`, `solape-recuadro.json`.
- Capturas a 1440 (viewport alto, para que la cabecera fija no tape la cancha):
  - `barra-preparando-1440.png` y `barra-preparando-1440-cancha.png`;
  - `barra-sonando-1440.png`;
  - `gol-red-recuadro-1440.png` y `gol-vista-arco-1440.png`;
  - `gol-saque-centro-1440.png`.
- Capturas a 360:
  - `barra-preparando-360.png` y `barra-preparando-360-cancha.png`;
  - `barra-sonando-360.png`;
  - `gol-red-recuadro-360.png` y `gol-vista-arco-360.png`;
  - `gol-saque-centro-360.png`.
- Defecto: `solape-360-sinia.png`, `solape-360-ejemplo-260.png`, `solape-360-ejemplo-545.png` y
  `solape-360-zoom-balon.png`.
