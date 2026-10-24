# Smoke simultáneo de capacidad · brief 062 (§ 17.5, § 18.3 y § 19)

**Veredicto: UMBRALES OK.** Todos los umbrales medibles se cumplen. El p99 del bucle de eventos **no se pudo medir**,
porque el servidor no expone `monitorEventLoopDelay`. Hay una medida indirecta más abajo.

- **Producción:** `cronista-arena--0000032`, commit `613d68e`, 1 réplica (mínimo y máximo 1), 0,5 vCPU y 1 GiB.
  El torneo del sitio estaba encendido (`ARENA_TORNEO_SITIO=1`).
- **Ventana:** 24 oct 2026, de 10:57:06 a 11:31:05 UTC.
- **Torneo:** `sitio-prueba-a213fdf1c09f`, una liga de prueba del operador lanzada con el token. No consume el cupo
  del día.

## Cronología (UTC)

| Hora | Hecho |
|---|---|
| 10:57:06 | Barrera de relevo: `GET /api/arena/torneos/sitio` responde `habilitado:true` en el primer sondeo, sin `activo` ni `hoy`. |
| 10:57:08–10:57:38 | Línea base de `/api/health`: 15 muestras, p50 96 ms y máximo 390 ms. |
| 10:57:38 | `POST /api/arena/torneos/sitio?prueba=1` `{formato:"liga"}`, con token y `Origin` público. Responde 202 con `sitio-prueba-a213fdf1c09f`. |
| 10:57:43–10:59:52 | Directo público n.º 1, simultáneo con los partidos P1 y P2. |
| 11:04:43–11:06:51 | Directo público n.º 2, simultáneo con P7 y P8. |
| 11:11:20–11:13:30 | Directo público n.º 3, simultáneo con P13–P15. |
| 11:29:36 | El torneo termina como `completo`: 30 partidos y 3.353.857 µUSD de gasto conocido. |
| 11:29:59–11:31:05 | Validación local, lista y página, repetición narrada y cupo. |

## Umbrales (§ 17.5 / § 18.3) frente a lo medido

| Medida | Umbral | Medido | Resultado |
|---|---|---|---|
| Hueco máximo del SSE (mensaje o *keepalive*) | ≤ 20 s | **1,25 s**. Dos espectadores Node por directo; máximos de 0,74, 1,14 y 1,25 s. Sin saltos de id | OK |
| Respuestas 5xx de las rutas públicas | 0 | **0**: navegador, sondas cada 2 s y métrica `Requests` de Azure. Azure registra 1.543 respuestas 2xx, 2 respuestas 4xx y 0 5xx | OK |
| Respaldos `error_controlador` o `plazo_agotado` del partido público | 0 | **0** en los 3 directos (`metricas.respaldos = 0`; «0 programmed fallbacks») | OK |
| Partidos anulados del torneo | ≤ 1 | **0**: sin `pendientes` y todos los encuentros con `intento = 1` | OK |
| `monitorEventLoopDelay`: p99 ≤ 500 ms y máximo ≤ 2 s | — | **No medido**: no hay ruta ni métrica que lo exponga. Medida indirecta en § «Bucle de eventos» | No medible |
| 429 de cada lado del torneo | se anotan | **0**: 121 intentos con estado 200 y ninguno sin `usage` | — |

## Liga de prueba

- **Resultado:** `completo` y `lanzamiento: "prueba"`. Liga a doble vuelta entre 6 participantes (`equilibrado`,
  `rapido`, `luna6`, `sol6`, `astra6` y `sol61`), con 60 s por partido e intervalo de 30 s. Se jugaron 30 partidos,
  a ≈ 64 s cada uno, en 31 min 58 s en total.
- **Gasto conocido: 3,353857 USD.** El típico era 3,54 y el tope 8. La bolsa queda en 3,35 de 50 USD.
  Es una estimación a precio de lista, no la factura.
- **Validación independiente** (`.cache/capacidad-062-validar.mjs`, ejecutada con `validarTorneo` del repo):
  - las 30 descargas responden 200;
  - los sha256 y los goles coinciden en los 30 partidos;
  - la repetición determinista da `ok`.
- **Motivos de las 120 decisiones:** 119 `valida` y 1 `error_controlador`. Esta última es de P30, `luna6`, ronda 1,
  con HTTP 200 y 2.728 tokens de salida: la respuesta del modelo no sirvió, no fue un fallo de infraestructura.
- **Reintento de órdenes:** uno, en P20 (`rapido`), con HTTP 200.
- **Página `/arena/torneo/sitio-prueba-a213fdf1c09f`** (ES y EN):
  - banda «Torneo de prueba del operador» / «Operator test tournament»;
  - 6 filas en la clasificación, 30 partidos y 30 celdas;
  - ningún estado incoherente, incompleto, cancelado ni interrumpido.

  Clasificación: 1.º GPT-5.6 Luna con 18 puntos, después GPT-6 Luna (17), GPT-6 Astra (15), GPT-6 Sol (13),
  GPT-5.4 mini (9) y GPT-6.1 Sol (6).
- **Lista de `/arena/torneo`:** aparece en el grupo «Torneos de prueba del operador» («24 oct · Liga · completo ·
  1.º GPT-5.6 Luna») y no en «lanzados».
- **Cancelación:** no hizo falta. Ningún umbral se superó.

## Directos públicos simultáneos («Programmed demonstration», 60 s, narración activada)

Cada directo se lanzó así, en Chromium con `--autoplay-policy=user-gesture-required`:

1. Se esperó a `/api/arena/modelos`.
2. Se eligieron «programado», 60 s y «Narrate the match».
3. Se comprobó el valor antes de pulsar «Start live match».

`page.route` abortaba cualquier POST de sesión que no fuera `programado`, y no bloqueó ninguno. Las 3 sesiones
devolvieron `modo: "programado"` (0 LLM).

| | n.º 1 | n.º 2 | n.º 3 |
|---|---|---|---|
| `POST /api/arena/sesiones` | 201 · 963 ms | 201 · 1.076 ms | 201 · 937 ms |
| Estado «Live» tras el clic (antesala hablada) | 58,6 s | 58,2 s | 60,1 s |
| Generación terminada (SSE `terminada`) | 41,1 s | 41,8 s | 41,1 s |
| Emisión al final (`1:00 / 1:00`) | 118,8 s | 118,3 s | 120,2 s |
| Mensajes SSE (A/B) · *keepalives* | 142/142 · 2 | 140/140 · 2 | 141/141 · 2 |
| Hueco SSE máximo (A/B) | 0,74 / 0,74 s | 1,14 / 1,14 s | 1,25 / 1,25 s |
| `/relato` n · p50 · p95 · máx | 30 · 516 · 1.138 · 1.226 ms | 30 · 554 · 774 · 792 ms | 31 · 531 · 1.222 · 2.060 ms |
| `/relato` no 200 | 1 × 429 | 1 × 429 (a los 92,5 s) | 0 |
| Respaldos | 0 | 0 | 0 |
| Estado final | Match complete · recording available | igual | igual |

**Otras latencias** (navegador, directo n.º 1; los otros dos son similares, en `smoke.json`):

| Petición | Latencia |
|---|---|
| `GET /arena` | 2,4 s, primera carga sin caché |
| `/api/arena/modelos` | 124 ms |
| `/api/arena/herramientas` | ≈ 370 ms |
| `/emision` | 280 ms |
| `/voz-reserva/*.mp3` | ≈ 100 ms (31 archivos estáticos precargados) |

**Sondas durante los 32 min:**

| Sonda | Muestras | p50 | p95 | p99 | Máximo | Respuestas no 200 |
|---|---|---|---|---|---|---|
| `/api/health`, cada 2 s | 881 | 93 ms | 96 ms | 510 ms | 1.047 ms | 0 |
| `/api/arena/torneos/sitio` | 112 | 364 ms | 434 ms | — | 1.452 ms | 0 |
| Instantánea del torneo | 89 | 447 ms | 528 ms | — | 1.431 ms | 0 |

## Bucle de eventos (medida indirecta, no es el umbral)

`/api/health` no hace trabajo, así que su latencia, quitando la red (≈ 93 ms), indica bloqueos del proceso.

- **Muestras por encima de 500 ms:** 9 de 881, con un máximo de 1.047 ms (≈ 0,95 s de bloqueo).
- **Origen de los picos:** 8 de los 9 coinciden al segundo con el cierre de un partido del torneo, según las líneas
  `[torneo-sitio] … P<n>` del log: P2, P5, P11, P14, P15, P23, P27 y P28. El noveno coincide con la carga SSR de
  `/arena` del directo n.º 2.
- **Lectura:** el cierre de partido (validación, repetición y escritura) bloquea el proceso entre ≈ 0,4 y 0,95 s.
  Queda por debajo del máximo de 2 s, pero el p99 real del bucle de eventos sigue sin medirse.
- **Contenedor (Azure Monitor):**
  - CPU: máximo de 0,126 núcleos (de 0,5) y media de 0,025;
  - memoria: máximo de 428 MB;
  - 0 reinicios.

## Comprobaciones al terminar

- **Repetición narrada** (`/arena?torneo=sitio-prueba-a213fdf1c09f&encuentro=01&lang=es`, con «Reproducir» y
  «Con narración» activado):
  - preparó una pista de 19 solicitudes `/relato`, todas 200, con p50 de 534 ms y máximo de 987 ms;
  - empezó a sonar a los 15,2 s;
  - «Detener» y otra vez «Reproducir» no añadieron solicitudes (19 → 19). **Se gastó 1 sola pista de Speech.**
- **Cupo público del día:**
  - `GET /api/arena/torneos/sitio` da `habilitado:true`, `motivo:null`, `activo:null` y **`hoy:null`**;
  - el botón «Start new tournament» está habilitado y no se pulsó;
  - la liga de prueba **no consumió el cupo** del 24 oct.

## Desviaciones y límites

- **Sin modelos en el partido público.** El § 17.5 pide un partido público con modelos (180 s, mismo deployment que
  un lado del torneo). Por instrucción de Carlos, el directo fue «Programmed demonstration» sin LLM. **No se ejerció la
  coincidencia de TPM sobre el mismo deployment**, y tampoco se consultó la capacidad TPM con `az`. Los umbrales de
  servidor (SSE, 5xx y bloqueos) sí se midieron con el torneo real y tres directos narrados en paralelo.
- **Una sola tanda.** No mide la variabilidad entre días ni con más espectadores.

## Defectos u observaciones

1. **429 en `POST /api/arena/sesiones/:id/relato`** en los directos n.º 1 y n.º 2: una solicitud por directo, hacia
   los 92 s del clic, cerca del final de la emisión.
   - No llega a 5xx y no hubo aviso visible de respaldo.
   - El cuerpo no se capturó en esas dos tandas, y en la n.º 3 no se repitió. La causa probable es el presupuesto de
     voz por encuentro (`PRESUPUESTO_AUDIO_ENCUENTRO` o su reserva de cierre), pero no está confirmada.
   - Reproducción: `node .cache/capacidad-062-directo.mjs <n> <salida.json>`. El script ya guarda el cuerpo de
     cualquier respuesta 4xx en `respuestas4xx`.
2. **La repetición de un partido de prueba no dice que es de prueba.** La línea de origen muestra «Partido 1 del
   torneo del 24 de octubre de 2026 · …», igual que un torneo del día.
   - Reproducción: abrir `/arena?torneo=sitio-prueba-a213fdf1c09f&encuentro=01&lang=es`.
   - Es menor: la página del torneo y la lista sí lo rotulan.
3. **Bloqueo de ≈ 0,4–0,95 s al cerrar cada partido del torneo** (medida indirecta). Está por debajo de 2 s y no
   afectó al SSE: hueco máximo de 1,25 s.
4. **`error_controlador` en P30** (`luna6`, ronda 1, HTTP 200). Es del lado del torneo y de la salida del modelo; no
   cuenta para los umbrales públicos.

## Archivos

| Archivo | Contenido |
|---|---|
| `smoke.json` | Todas las cifras: barrera, lanzamiento, sondas, validación, directos con latencias por ruta y comprobaciones finales. |
| `monitor.ndjson` | Muestras crudas de las sondas: `/api/health` cada 2 s, `/sitio` cada ≈ 16 s y el torneo cada ≈ 20 s. |
| `directo-{1,2,3}-emitiendo-1440.png`, `directo-{1,2,3}-final-1440.png` | Directos. |
| `torneo-prueba-{es,en}-1440.png`, `lista-torneos-{es,en}.png` | Página y lista del torneo. |
| `repeticion-narrada-01-1440.png` | Repetición narrada. |
| `panel-lanzar-tras-prueba.png` | Panel de lanzamiento tras la prueba. |

Scripts, fuera de git: `.cache/capacidad-062-monitor.mjs`, `.cache/capacidad-062-directo.mjs`,
`.cache/capacidad-062-validar.mjs` y `.cache/capacidad-062-final.mjs`. El token se lee de archivo y no aparece en
ningún archivo de evidencia, comprobado con `grep -F`.
