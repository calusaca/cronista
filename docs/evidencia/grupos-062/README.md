# Smoke público del formato «grupos + eliminatoria» · brief 062 P1-b

**Veredicto: VISTO OK.** El torneo de grupos de prueba terminó `completo`, con 15 partidos. La validación independiente
da `ok` y la página muestra grupos, matrices, cuadro, campeón y rótulos de prueba en ES y EN, a 1440 y 360 px. Los dos
directos simultáneos cumplen los umbrales de capacidad. Hay tres defectos menores, todos de presentación o de voz
(§ «Defectos»), y ninguno afecta a los datos.

- **Producción:** `cronista-arena--0000033`, commit `420e31a` (`torneo.commit = 420e31a114fd…`).
  - Una réplica (mínimo y máximo 1), 0,5 vCPU y 1 GiB.
  - `ARENA_TORNEO_SITIO=1` y `ARENA_MAX_REPLICAS=1`, comprobados con `az`.
- **Ventana:** 24 oct 2026, de 13:45:33 a 14:17 UTC.
- **Torneo:** `sitio-prueba-32ad2249691f`, de formato `grupos`, con `lanzamiento: "prueba"` y semilla 20261024. No consume
  el cupo del día.

## Cronología (UTC)

| Hora | Hecho |
|---|---|
| 13:45:33 | Barrera de relevo. `GET /api/arena/torneos/sitio` da `habilitado:true` en el primer sondeo, unos 2 min después de crearse la revisión (13:43:48); a las 13:44 aún decía `motivo:"relevo"`. La ficha `grupos` trae `disponible:true` con estas cifras: 15–18 partidos, típico 1,503–2,035 USD (2,655 con desempates), tope 7 USD, reserva por partido 3,685 USD y ≈ 16–20 min. |
| 13:46:05 | `POST /api/arena/torneos/sitio?prueba=1` con `{formato:"grupos"}`, el token y `Origin` público. Responde **202** con `sitio-prueba-32ad2249691f`. En el log: «admitido (grupos, real, prueba)». |
| 13:46:11–13:48:21 | Directo n.º 1, simultáneo con P1 y P2 de la fase de grupos. |
| 13:58:52 | Termina P12: los dos grupos están completos. |
| 13:59:03–14:01:12 | Directo n.º 2, simultáneo con las semifinales P13 y P14. |
| 14:02:04.8 | Termina la final P15. El torneo queda `completo`: 15 partidos y 1.880.365 µUSD de gasto conocido. |
| 14:05:58–14:17 | Validación local, página ES/EN a 1440 y 360 px, repetición de la eliminatoria y cupo. |

## Torneo de grupos de prueba

**Sorteo** (repo, `sorteoGrupos`): A = astra6, sol6 y equilibrado; B = luna6, sol61 y rapido.

| Grupo A | PJ | DG | Pts | Pasa |
|---|---|---|---|---|
| 1. GPT-6 Sol (`sol6`) | 4 | +3 | 9 | Sí (1.º) |
| 2. GPT-6 Astra (`astra6`) | 4 | −1 | 4 | Sí (2.º) |
| 3. GPT-5.6 Luna (`equilibrado`) | 4 | −2 | 4 | No |

| Grupo B | PJ | DG | Pts | Pasa |
|---|---|---|---|---|
| 1. GPT-6.1 Sol (`sol61`) | 4 | +3 | 9 | Sí (1.º) |
| 2. GPT-6 Luna (`luna6`) | 4 | 0 | 5 | Sí (2.º) |
| 3. GPT-5.4 mini (`rapido`) | 4 | −3 | 2 | No |

**Cuadro:**

- **Semifinal 1 (1A–2B):** P13, GPT-6 Sol 0–1 GPT-6 Luna.
- **Semifinal 2 (1B–2A):** P14, GPT-6.1 Sol 0–1 GPT-6 Astra.
- **Final:** P15, GPT-6 Luna 1–0 GPT-6 Astra. GPT-6 Luna, que ganó la semifinal 1, juega de local.

**Campeón: GPT-6 Luna (`luna6`)**, que entró como 2.º del grupo B.

**Desempates: ninguno.**

- Ninguna llave terminó empatada, así que no hubo partido de desempate ni criterio de llave.
- En los grupos todos los cortes se decidieron por `resultado`. En el grupo A, astra6 y equilibrado empatan a 4 puntos y
  los separa la DG (−1 frente a −2), que es el orden declarado del 059: puntos, DG, GF y después liguilla. Equilibrado
  ganó el enfrentamiento directo (1–0 y 0–0), pero la liguilla va después de la DG. Es coherente con la regla escrita en
  la página.
- Por eso no aparece ninguna línea `arena-torneo-criterio-grupo` ni `arena-torneo-criterio-llave`, y es lo correcto.
  **El rótulo de desempate y el de criterio no se ejercieron en producción.**

**Gasto conocido: 1,880365 USD.** El típico máximo era 2,035 y el tope 7.

- La bolsa del periodo pasa de 3,353857 a **5,234222 de 50 USD**. Es una estimación a precio de lista, no la factura.
- Coste por partido según el log: entre 0,020 y 0,268 USD. Los más caros son los que juegan astra6 o sol6.

**Duración:** 15 partidos en 15 min 59 s, a ≈ 64 s cada uno.

**Validación independiente** (`.cache/grupos-062-validar.mjs`, con `validarTorneo` y `coherencia062` del repo):

- las 15 descargas responden 200;
- los sha256 y los goles coinciden en los 15;
- `validarTorneo` da **ok** y `coherencia062` devuelve `[]`;
- 60 decisiones, todas `valida`; 60 intentos HTTP 200, ningún reintento de partido y 0 sin `usage`;
- la suma del coste por partido es igual a `gasto.conocidoMicroUsd`;
- **tabla a mano** (3/1/0, DG) igual a `clasificarGrupo` en A y B (`manoOk: true`);
- **estructura del cuadro:** SF1 = 1A–2B, SF2 = 1B–2A, final con el ganador de la SF1 de local, campeón = ganador de la
  final y ningún empate de llave sin desempate. Todo `true`.

## Página `/arena/torneo/sitio-prueba-32ad2249691f`, en ES y EN, a 1440 y 360 px

| Comprobación | ES 1440 | ES 360 | EN 1440 | EN 360 |
|---|---|---|---|---|
| Banda «Torneo de prueba del operador» / «Operator test tournament» | sí | sí | sí | sí |
| Rótulo «Lanzado en el sitio · validado en el servidor…» | sí | sí | sí | sí |
| Dos tablas de grupo con la columna «Pasa» / «Advances», «Sí (1.º)», «Sí (2.º)» y «No» iguales a la validación | sí | sí | sí | sí |
| Matrices 3×3: 3 columnas, 3 filas, 3 celdas por fila y 6 enlaces por grupo; cada resultado comprobado contra su partido | sí | sí | sí | sí |
| Cuadro: SF1 «P13 … 0–1 …», SF2 «P14 … 0–1 …», final «P15 … 1–0 …» y «Pasa X» / «X advances» | sí | sí | sí | sí |
| «Gana este torneo: GPT-6 Luna» / «Wins this tournament: GPT-6 Luna» más la frase de significación (p = 0,125) | sí | sí | sí | sí |
| 15 partidos por fase y 12 celdas | sí | sí | sí | sí |
| Estados incoherente, incompleto, cancelado, interrumpido o en juego | 0 | 0 | 0 | 0 |
| `scrollWidth` | 1440 | **360** | 1440 | **360** |
| Tablas, matrices o cuadro dentro de un contenedor desplazable | no | no | no | no |

- Las capturas de elemento a 360 px, en ES claro y EN oscuro, también dan `scrollWidth` 360.
- **Lista `/arena/torneo`:** en el grupo «Torneos de prueba del operador» aparece «24 oct · Grupos + eliminatoria ·
  completo · campeón GPT-6 Luna»; en EN, «Oct 24 · Groups + knockout · complete · champion GPT-6 Luna». No aparece entre
  los lanzados.
- **Repetición de la semifinal 1** (`/arena?torneo=…&encuentro=13`):
  - Origen ES: «Partido 13 del torneo del 24 de octubre de 2026 **(torneo de prueba del operador) · Semifinal 1** ·
    Local: Deportivo Nebrisa (GPT-6 Sol) · Visita: Sporting Caleteo (GPT-6 Luna) · Volver al torneo».
  - Origen EN: «Match 13 of the October 24, 2026 tournament **(operator test tournament) · Semi-final 1** · …».
  - Sin error. Al pulsar «Reproducir» sin narración, el reloj pasa de 0:00 a 0:15 en 8 s.
  - El defecto 2 de capacidad-062 (el origen no decía «prueba») **está corregido**.

## Directos públicos simultáneos («Programmed demonstration», 60 s, con narración)

Se usó el mismo procedimiento que en capacidad-062:

1. Chromium con `--autoplay-policy=user-gesture-required`.
2. Se comprobaron `programado`, 60 s y narración antes de pulsar.
3. `page.route` abortaba cualquier POST de sesión que no fuera `programado`. No bloqueó ninguno, y las dos sesiones
   devolvieron `modo: "programado"`.

| | n.º 1 (con P1 y P2) | n.º 2 (con P13 y P14) |
|---|---|---|
| `POST /api/arena/sesiones` | 201 · 1.145 ms | 201 · 1.076 ms |
| «Live» tras el clic | 58,1 s | 59,1 s |
| Generación terminada (SSE `terminada`, espectador) | 41,5 s | 41,1 s |
| Emisión al final (`1:00 / 1:00`) | 118,2 s | 119,2 s |
| Mensajes SSE (A/B) · *keepalives* | 142/142 · 2 | 139/139 · 2 |
| **Hueco SSE máximo (A/B)** | **0,73 / 0,73 s** | **0,66 / 0,66 s** |
| Saltos de id | 0 | 0 |
| `/relato` n · p50 · p95 · máx | 30 · 548 · 1.400 · 2.713 ms | 28 · 583 · 1.026 · 1.208 ms |
| `/relato` no 200 | 0 | **1 × 429** (cierre, a los 93,6 s) |
| **Respaldos** | **0** | **0** |
| **5xx** | **0** | **0** |
| Estado final | Match complete · recording available | igual |

En el directo n.º 1, el campo `generacionTerminadaMs` del JSON (73 s) incluye la espera de 15 s de la captura. La cifra
real es el `finMs` del espectador, 41,5 s.

## Umbrales (§ 17.5 / § 18.3)

| Medida | Umbral | Medido | Resultado |
|---|---|---|---|
| Hueco máximo del SSE | ≤ 20 s | 0,73 s | OK |
| 5xx de las rutas públicas | 0 | 0, en el navegador, en las sondas y en Azure `Requests` (1.042 2xx, 1 4xx y 0 5xx entre 13:45 y 14:17) | OK |
| Respaldos del partido público | 0 | 0 | OK |
| Partidos anulados del torneo | ≤ 1 | 0: todos con `intento = 1` y ningún pendiente | OK |
| `monitorEventLoopDelay` | p99 ≤ 500 ms y máx ≤ 2 s | No medible, como en capacidad-062. Medida indirecta abajo | — |

## Sondas y bucle de eventos (medida indirecta)

| Sonda | Muestras | p50 | p95 | p99 | Máximo | Respuestas no 200 |
|---|---|---|---|---|---|---|
| `/api/health`, cada 2 s | 441 | 94 ms | 96 ms | 819 ms | 1.482 ms | 0 |
| `/api/arena/torneos/sitio` | 57 | 368 ms | 804 ms | — | 1.179 ms | 0 |
| Instantánea del torneo | 45 | 365 ms | 505 ms | — | 525 ms | 0 |

**Muestras de `/api/health` por encima de 500 ms:** 5 de 441.

- Tres coinciden al segundo con el **cierre de un partido** según el log: P1 a las 13:47:06, P2 a las 13:48:10 y P13 a
  las 13:59:56.
- Las otras dos coinciden con la **carga SSR de `/arena`** al empezar cada directo, a las 13:46:15 y a las 13:59:05. El
  máximo, 1.482 ms, equivale a ≈ 1,39 s de bloqueo sin la red. En capacidad-062 el máximo fue de 1.047 ms.
- Siguen por debajo de 2 s y no afectaron al SSE.

**Contenedor (Azure Monitor):** CPU máxima de 0,112 núcleos y media de 0,023; memoria máxima de 387 MB; 0 reinicios.

## Cupo público del día

- `GET /api/arena/torneos/sitio` da `habilitado:true`, `motivo:null`, `activo:null` y **`hoy:null`**, con bolsa
  5.234.222 µUSD.
- El botón «Start new tournament» está habilitado y no se pulsó. **El cupo del 24 oct sigue libre.**
- No se lanzó ningún torneo público, y el navegador abortaba cualquier POST de lanzamiento: hubo 0.

## Defectos

1. **429 en el cierre del relato** (`POST /api/arena/sesiones/:id/relato` con `cierre:true`, ticks 550–600) del
   directo n.º 2, a los 93,6 s.
   - Es el mismo patrón que los directos 1 y 2 de capacidad-062. No hubo aviso visible de respaldo ni 5xx.
   - Efecto: ese directo se queda sin el clip de cierre.
   - El cuerpo de la respuesta tampoco se pudo capturar esta vez.
   - Causa probable, sin confirmar: `rechazoCuotaVoz` agota `PRESUPUESTO_AUDIO_ENCUENTRO` (24.000 caracteres con SSML).
     Las 28 piezas del narrador ya pedidas dejan sin sitio al clip de cierre, aunque tenga reserva de 800 caracteres.
     Alternativa: el tope diario `SPEECH_DIARIO`.
   - Reproducción: `node .cache/grupos-062-directo.mjs <n> <salida.json>`; mirar `respuestas4xx`. Es intermitente: 1 de
     2 directos aquí y 2 de 3 en capacidad-062.
2. **Cabeceras de las matrices pegadas.** En la matriz 3×3 los nombres cortos de columna no llevan separación:
   «6 Sol 6 Astra5.6 Luna» y «6.1 Sol 6 Luna5.4 mini».
   - Ocurre a 1440 y a 360 px. La información sigue disponible en `<abbr title>`.
   - Capturas: `grupos-es-light-360.png` y `torneo-grupos-es-1440.png`.
   - Reproducción: abrir `/arena/torneo/sitio-prueba-32ad2249691f?lang=es` y mirar «Grupo A».
3. **Espacios dentro de los paréntesis del modelo** en el cuadro y en la lista de partidos: «Deportivo Nebrisa ( GPT-6
   Sol ) 0–1 …». Ocurre a 1440 y a 360 px. Captura: `cuadro-es-light-360.png`. Reproducción en la misma página, en
   «Semifinal 1».

**Observaciones (no son defectos):**

- No hubo desempate: el rótulo «Desempate, lados invertidos» y las líneas de criterio solo están cubiertos por los tests
  y el e2e, no por este smoke.
- Los nombres de club de un mismo modelo cambian de un partido a otro: luna6 es «Sporting Caleteo» en P13 y «Deportivo
  Ventolera» en P15. Los clubes son ficticios por partido.
- En la tabla de grupo, las cabeceras PJ, DG, Pts y Pasa van alineadas a la izquierda y las cifras a la derecha.

## Archivos

| Archivo | Contenido |
|---|---|
| `smoke.json` | Barrera, lanzamiento, sondas, picos y su correlación, validación completa, los 2 directos con latencias por ruta, comprobaciones de página, cupo y Azure Monitor. |
| `monitor.ndjson` | Muestras crudas: `/api/health` cada 2 s, `/sitio` cada ≈ 16 s y el torneo cada ≈ 20 s. |
| `torneo-grupos-{es,en}-{1440,360}.png` | Página completa del torneo. |
| `grupos-{es-light,en-dark}-360.png`, `cuadro-{es-light,en-dark}-360.png` | Fase de grupos y cuadro a 360 px, en claro y oscuro. |
| `lista-torneos-{es,en}.png`, `panel-lanzar-tras-prueba.png` | Lista y panel de lanzamiento tras la prueba. |
| `repeticion-eliminatoria-13-1440.png`, `repeticion-eliminatoria-13-en-1440.png` | Repetición de la semifinal 1 (ES reproduciendo y EN con el origen). |
| `directo-{1,2}-emitiendo-1440.png`, `directo-{1,2}-final-1440.png` | Directos. |

Scripts, fuera de git:

- `.cache/grupos-062-monitor.mjs`
- `.cache/grupos-062-directo.mjs`
- `.cache/grupos-062-validar.mjs`
- `.cache/grupos-062-final.mjs`
- `.cache/grupos-062-recortes.mjs`

El token se lee de archivo y no aparece en ningún archivo de evidencia ni en los scripts. Se comprobó con `grep -F`.
