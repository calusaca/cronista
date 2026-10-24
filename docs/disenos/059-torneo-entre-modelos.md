# 059 — Torneo entre modelos: todos contra todos con inferencia real, tabla honesta y vista en el sitio

## Estado

Brief **v1.2**, 23 de octubre de 2026. La sección 16 prevalece sobre la 15 y la sección 15 (decisiones tras la revisión de Codex) **prevalece sobre todo lo anterior** y simplifica el alcance a lo que cabe el sábado 24 y el domingo 25. Antes hubo una v1.0 y una v1.0.1 (§ 14, seis participantes). Lo escribió Opus como diseñador, porque Fable no tiene
cupo. No incluye código de producción. **Revisión de Codex pendiente**: las decisiones de una versión
posterior prevalecen sobre este texto donde lo contradigan. Lo implementa Opus por este brief.

Pedido de Carlos (23 oct): «quiero ver cómo van los juegos entre todos los modelos que se puedan» y
«sí quiero lo del torneo, y que sea una opción en el sitio además». Ya se le había ofrecido un todos
contra todos de 5 modelos: 10 cruces, partidos de 60 s y unos 3–5 USD. Después, Carlos pidió
**llegar a 6 modelos** y dijo «en caso necesario agregamos más créditos». Este brief juega **6
modelos en ida y vuelta** (§ 2 D3): 30 partidos, ≈ 7,1 USD típicos, con un tope de 12 USD. La
variante barata está en § 9.

Depende de 052 (catálogo, smoke, precios), 049 (cifras), 057 (Reproducir con narración y la ruta de
grabaciones) y 034 (identidad de controladores, sin reintentos ocultos). El 058
(narración por defecto y la previa como antesala) está en curso en paralelo. El bloque A solo toca archivos nuevos;
el bloque B toca `Arena.tsx` y `ArenaNarracion.tsx` **después** de integrar el 058 (§ 10).

Reglas que no se negocian:

- no cambian el motor, `RegistroArena`, el validador, el protocolo de órdenes, `SISTEMA_ARENA`, el
  límite diario público ni los presupuestos de voz;
- todo número visible sale de un registro archivado o se rotula como **declarado** por el CLI (§ 4.3);
- ningún texto afirma que un modelo «es mejor entrenador» (034, 052).

## 0. El diseño en diez líneas

1. CLI `npm run arena:torneo`: juega por inferencia real un **todos contra todos pareado** (ida y vuelta) entre los 6 modelos publicados. Son 30 partidos de 60 s con intervalo de 15 s: 4 decisiones por lado y 40 por modelo.
2. Cada cruce usa **una sola semilla** para la ida y la vuelta, con los lados invertidos. Así quedan fijos los clubes, los niveles, el clima, el césped, la presión de la grada y el saque; el resto es comportamiento del modelo más la divergencia caótica.
3. No cuenta contra el límite diario público (`maxLlmDiarias`). Tiene su propio camino y su **tope en USD**, que se comprueba antes de cada partido con la cota del peor caso.
4. Los 429, 5xx y errores de red se reintentan en el transporte. Un respaldo causado por la infraestructura **anula** el partido, que se repite (2 veces como máximo). Los respaldos causados por el modelo cuentan.
5. Se reanuda desde `.cache/arena-torneos/<id>/estado.json` con un cerrojo real. Un partido interrumpido se cuenta por su cota y se repite.
6. Archivo: `public/torneos/<id>/torneo.json`, que solo guarda **hechos por partido** (sin tablas ni agregados), y `eNN.json.gz`, que son los registros completos. Cada partido se valida con `reproducirArena` en el CLI, y todos otra vez en CI.
7. Tabla con puntos 3/1/0, GF, GC y DG. Desempates: puntos, DG, GF, liguilla entre empatados, y si persiste, posición compartida. Todo se calcula con funciones puras a partir de los partidos.
8. Métricas por modelo: decisiones, respaldos por causa, latencias, solicitudes, tokens y coste (declarados), y cifras de juego del 049 (registradas).
9. El sitio tiene una ruta propia `/arena/torneo`: tabla, matriz de resultados, lista de partidos con enlace a `/arena?torneo=<id>&encuentro=<nn>` (repetición con «Reproducir con narración» del 057), y procedencia, versiones y coste.
10. **El público no lanza torneos** (§ 2 D1). Ve los torneos archivados y, como P2, puede abrir un cruce suelto en vivo con las reglas y el límite diario actuales.

## 1. Hechos verificados en el código (23 oct)

- **Catálogo.** `infra/modelos-arena.json` tiene 6 entradas con `publicar: true` desde el commit
  `4afe3e9`:

  | id | Deployment | Modelo y versión |
  |---|---|---|
  | `equilibrado` | `cronista-equilibrado` | gpt-5.6-luna 2026-07-09 |
  | `rapido` | `cronista-rapido` | gpt-5.4-mini 2026-03-17 |
  | `luna6` | `cronista-luna6` | gpt-6-luna 2026-09-22 |
  | `sol6` | `cronista-sol6` | gpt-6-sol 2026-09-22 |
  | `astra6` | `cronista-astra6` | gpt-6-astra 2026-09-03 |
  | `sol61` | `cronista-sol61` | gpt-6.1-sol 2026-09-29 |

  Todas usan `llm: "azure-openai"` y tienen capacidad 100. Grok y gpt-oss tienen `publicar: false`.
- **Precios.** Vienen de `docs/evidencia/modelos-052/precios.json` (Retail Prices API, 22 oct), en USD
  por millón de tokens:

  | Modelo | Entrada | Salida | Caché |
  |---|---|---|---|
  | 5.6 Luna | 0,2 | 1,2 | 0,02 |
  | 5.4 mini | 0,75 | 4,5 | 0,075 |
  | 6 Luna | 0,1 | 0,5 | 0,01 |
  | 6 Sol | 2 | 10 | 0,2 |
  | 6 Astra | 10 | 50 | 1 |
  | 6.1 Sol | — | — | — |

  **gpt-6.1-sol no tiene precio de lista en `precios.json`.** Se estima con el de gpt-6-sol (2 / 10 /
  0,2) y la estimación se declara como tal (§ 9).

- **Tokens por decisión.** Medidos en el smoke 052 (`docs/evidencia/modelos-052/<id>.json`):

  | Modelo | Entrada | Salida | Prompt máximo en 60 s |
  |---|---|---|---|
  | Astra | 9.240 | 441 | — |
  | Sol | 9.728 | 552 | — |
  | 6 Luna | 9.308 | 594 | — |
  | 6.1 Sol (`sol61.json`, 22/22, máximo 10,7 s) | 9.297 | 477 | 9.716–9.903 |
  | mini (como rival) | ≈ 9.400 | ≈ 660 por llamada | — |
  | todos los anteriores | — | — | 9.658–9.928 |

  `cronista-equilibrado` no tiene smoke propio.
- **Límite diario público.** `sesiones.ts:131–139` cuenta los `*.meta.json` del almacén público con
  `modo !== "programado"` del día UTC, con un máximo de 10. `sesiones.ts:130` admite **un solo**
  encuentro con modelos a la vez. Nada de esto ve un proceso local que no use `GestorSesiones`.
- **Smoke 052, reutilizable:**
  - `transporteInstrumentado` (`smoke-modelos.ts:24`) registra estado HTTP, ms, `usage` y `model`
    devuelto en cada petición.
  - La fábrica del CLI (`smoke-modelos-cli.ts`) crea `crearLlmAzureOpenAI` con `reasoningEffort: "low"`,
    como la publicación.
  - La fórmula de coste está en `smoke-modelos.ts:244`: `(entrada − caché) × precio de entrada + caché
    × precio de caché + salida × precio de salida`.
  - `serializarEvidencia` (`:263`) redacta los secretos y rechaza `<think>`.
- **El adaptador Azure no reintenta.** Un 429 lanza «cuota o límite de tasa» (`llm-azure-openai.ts:83`).
  `decidir` (`coordinador.ts:31–57`) lo convierte en `origen: "respaldo"`, `motivo: "error_controlador"`.
  El registro **no distingue** entre un 429 y un JSON roto.
- **`reproducirArena`** (`coordinador.ts:118`) vuelve a jugar las órdenes y compara observaciones,
  eventos, fotogramas y final. Su comentario lo dice: «no autentica quién produjo esas órdenes».
  `contenidoCanonico` (`:110`) excluye los metadatos declarados de cada decisión.
- **Qué fija la semilla.** `crearConfigArena({ seed })` → `configDeSemilla(seed)` (`motor.ts:28`) fija
  los clubes, las plantillas con niveles (`prepararPartido`), el clima, la superficie y el césped. La
  **presión de la grada es asimétrica**: el local tiene «baja» o «media» y la visita el nivel siguiente
  (`entorno.ts:16`). Además, no hay cambio de campo (texto de límites en `Arena.tsx`). Por tanto, jugar
  de local o de visita con la misma semilla **no es simétrico**.
- **El azar no queda fijado.** El motor consume su azar según las órdenes. Con órdenes distintas, la
  misma semilla deja de producir las mismas jugadas desde la primera divergencia.
- **Tamaños y tiempos** (medidos hoy):
  - registro de 90 s: 2,9 MB (fotogramas, 2,84 MB), que con `gzip -9` queda en 173 KB;
  - `reproducirArena` sobre ese registro tarda 360 ms en esta máquina;
  - un partido de 60 s ronda 1,9 MB, o ≈ 115 KB comprimido.
- **Ejemplos archivados.** La ruta `/api/arena/grabaciones` solo admite
  `{ archivo: "duelo" | "ejemplo-v3" | "ejemplo" }`, relee el archivo, lo valida y llama a
  `registrarGrabacion`. Un cuerpo que empieza por `{"archivo"` se salta la admisión de subidas.
  `referencia` debe cumplir `^[a-z0-9-]{1,50}$`.
- **Carga de ejemplos en la interfaz.** `Arena.tsx:175–177` descarga el ejemplo y **lo reenvía
  entero** a `POST /api/arena` para validarlo. `?partido=` abre una sesión (`Arena.tsx:134–137`).
  El idioma arranca en `"en"` y no persiste.
- **Narración de una repetición.** `/relato` usa plantillas y Speech, sin LLM. Cada pista nueva gasta
  Speech (≈ 15–20 solicitudes por 60 s), del presupuesto por sesión y del diario (800 audios y 120.000
  caracteres). Las sesiones se retienen 24 h, con un máximo de 24 (`maxRetenidas`).
- **Cerrojos.** `almacenLocal().bloquear()` no bloquea nada (`almacen.ts:25`) y `lote.ts` se niega a
  reanudar una semilla «pendiente». Para reanudar hace falta un cerrojo propio.
- **e2e.** El servidor de e2e usa `CRONISTA_LLM=ensayo` y no tiene `ARENA_VOZ`
  (`playwright.config.ts:27–32`). La narración aparece como «sin voz».

## 2. Decisiones cerradas

**D1 · El público no puede lanzar un torneo.** Cinco motivos, todos verificables:

- **Coste.** Un torneo cuesta ≈ 7,1 USD típicos y tiene una cota de 27 USD (§ 9). Un partido en vivo
  cuesta céntimos.
- **Límite diario.** El torneo necesita 30 partidos con modelos y el límite diario es de 10.
- **Exclusión.** El servidor admite un solo encuentro con modelos a la vez (`sesiones.ts:130`). Un
  torneo ocuparía el banquillo público 20–40 min.
- **Abuso.** Sería un botón público que gasta dólares. La admisión del 057 está en memoria por réplica
  y se puede falsificar con `x-forwarded-for`.
- **Revisión.** Un torneo archivado está validado en CI y fechado por git; uno lanzado en vivo, no.

El sitio **muestra torneos archivados**. Como P2 ofrece «Jugar este cruce en vivo», un enlace a
`/arena` con los dos modelos preseleccionados. Está sujeto al límite diario y a las reglas actuales
(intervalo de 30 s) y **no entra en la tabla**.

**D2 · Camino propio, fuera del límite diario, con tope en USD propio.**

- **Por qué.** El límite diario protege al público de los abusos, no es un presupuesto del operador.
  Contar 30 partidos lo agotaría tres días y dejaría la demo sin partidos con modelos.
- **Cómo.** El CLI corre en la máquina del operador con `.env`, no toca el almacén público y lleva su
  propio libro de gasto (§ 3.6).
- **Coste visible.** El gasto real se anota en la bitácora y en la evidencia, y suma a la proyección de
  crédito (deuda de los briefs 050–053).

**D3 · Formato.**

- **Participantes.** Los 6 publicados.
- **Calendario.** Doble round-robin **pareado**: 15 cruces × 2 = 30 partidos, en 5 jornadas de 3
  partidos por vuelta, sin descansos. La ida son los partidos 1–15 y la vuelta los 16–30, en el mismo
  orden de jornadas y con los lados invertidos.
- **Partido.** 60 s con intervalo de 15 s. Es la configuración corta del smoke 052
  (`SMOKE_MODELOS_ARENA.cortoS/cortoIntervaloS`), así que la admisión de los seis modelos ya la cubre.
  Da 4 decisiones por lado; con 30 s serían 2 y el modelo influiría la mitad.
- **Sin narrador ni mesa.** El partido sale sin LLM de narración (coste 0). La voz llega al
  reproducirlo, por el 057.
- **Ventaja de la ida y vuelta.** Si el torneo se corta después de la ida, queda un todos contra todos
  simple y completo.

**D4 · Separar el azar del motor del modelo: sí, por diseño pareado. No por calibración estadística.**

- **Qué neutraliza.** La misma semilla con los lados invertidos neutraliza **exactamente**:
  - la fuerza de los clubes;
  - los niveles;
  - el clima y el césped;
  - la presión asimétrica de la grada;
  - el saque inicial y la dirección de ataque.
- **Qué no neutraliza.** La suerte de cada jugada, que diverge con las órdenes.
- **Unidad de comparación.** Es el **cruce** (resultado global de los dos partidos), no el partido.
  Un modelo que «gana» porque le tocó el mejor club en la ida lo devuelve en la vuelta.
- **P2.** La «banda de caos» (torneos nulos con políticas programadas perturbadas) y la referencia
  programada por semilla. Ninguna es necesaria para una tabla honesta.

**D5 · Sin significación, y el sitio lo dice con una cifra calculada.**

- **El cálculo.** Cada modelo juega 5 cruces. En una prueba de signos bilateral exacta, incluso ganar
  los 5 cruces da p = 2 · 0,5⁵ = **0,0625** > 0,05.
- **Dónde aparece.** La frase se genera con `pSignosBilateral` y el número de participantes; no se
  escribe a mano. Va **visible** en la página y en el README.
- **Lo que no se hace.** No se publican rangos, ni ELO, ni intervalos de confianza.
- **Lo que no se muestra.** Una p por modelo en la interfaz (se calcula en el README, P2).

**D6 · Los fallos de infraestructura no se cuentan como juego del modelo.**

- El transporte reintenta los estados reintentables, como mucho hasta el plazo de la decisión (§ 3.5).
- Si al final una decisión cae al respaldo por infraestructura, el partido se **anula**, se archiva
  aparte y se repite con la misma semilla y los mismos lados.
- `orden_invalida` y los JSON truncados o inválidos con HTTP 200 son del modelo: cuentan y se muestran.

**D7 · Coste.**

- Antes de jugar, el CLI hace una estimación típica y una cota, y pide confirmación.
- El `--tope-usd` es obligatorio, de 20 como máximo.
- La guarda de cada partido es `gasto + cotaPartido ≤ tope`: **nunca** se supera el tope, ni siquiera
  en el peor caso del partido en curso.

**D8 · Archivo sin agregados.**

- `torneo.json` guarda participantes, calendario y hechos por partido (goles, decisiones, cifras,
  uso, coste y huella).
- La tabla, la matriz, las métricas y los textos se **calculan siempre** con funciones puras de
  `src/arena/torneo.ts`.
- El esquema estricto **rechaza** cualquier campo agregado: no puede existir una tabla guardada que
  contradiga los partidos.

**D9 · Sitio.**

- **Ruta propia** `/arena/torneo` y `/arena/torneo/[id]`, con un componente de cliente nuevo.
- **No es una tercera pestaña de `/arena`**, porque la máquina de vistas de `Arena.tsx` y sus ~190 e2e
  quedarían en riesgo dos días antes de la entrega.
- **Datos estáticos** en `public/torneos/`, leídos por el servidor.
- **Registro validado** por una ruta GET. Así el navegador no descarga 1,9 MB para reenviarlos.

**D10 · Ensayo sin inferencia para pruebas.**

- `--ensayo` juega con controladores programados que llevan ids `ensayo:<x>`.
- La página lo rotula «Torneo de ensayo · sin IA» y nunca lo publica en `public/torneos`.

## 3. Bloque A · CLI `npm run arena:torneo` (P1)

Archivos nuevos:

- `src/arena/torneo.ts`: puro, compartido con la interfaz.
- `src/arena/torneo-ejecucion.ts`: el orquestador, con dependencias inyectables.
- `src/arena/torneo-cli.ts`: el cableado.

En `package.json`: `"arena:torneo": "node --import tsx src/arena/torneo-cli.ts"`.

### 3.1 Argumentos

```
npm run arena:torneo -- --id 2026-10-24 --tope-usd 12 --participantes equilibrado,rapido,luna6,sol6,astra6,sol61
  [--semilla 59] [--intervalo 15|30] [--confirmar] [--reanudar] [--liberar-cerrojo]
  [--ensayo --participantes a,b,c --segundos 20 --salida <dir>]
```

- `--id`: `^[a-z0-9-]{1,30}$`, obligatorio. La referencia de grabación `torneo-<id>-<nn>` cabe así en
  50 caracteres.
- `--participantes`: **obligatorio**, entre 3 y 6 ids (`TORNEO_ARENA.participantes`), sin repetir,
  todos con `publicar: true` en `infra/modelos-arena.json`. No hay valor por defecto: el catálogo puede
  crecer (§ 14) y la lista de participantes tiene que ser una decisión explícita. Un id fuera del
  catálogo, o sin precio en `precios.json`, **aborta antes de llamar a nada**.
- `--semilla`: por defecto `TORNEO_ARENA.semillaDefecto` (59).
- `--intervalo`: solo 15 (por defecto) o 30 (`TORNEO_ARENA.intervalosS`). La duración es fija:
  `TORNEO_ARENA.duracionS`. `--segundos` solo existe en ensayo.
- Sin `--confirmar` solo imprime la estimación (§ 3.6) y sale con 0. Es el ensayo en seco.
- Con `--confirmar` y stdin interactivo, pide además escribir el tope literal (por ejemplo `8`). En un
  stdin no interactivo basta `--confirmar`.
- **Árbol limpio obligatorio** en un torneo real: `git status --porcelain` vacío, ignorando `.cache/`.
  Si no, aborta: el commit que se archiva tiene que ser el código que jugó.

### 3.2 Participantes, versiones y precios

Para cada participante se guarda:

| Campo | De dónde sale |
|---|---|
| `id`, `nombre`, `deployment`, `modelo`, `version`, `formatoJson`, `esfuerzo` | `infra/modelos-arena.json` (`nombrePublico` → `nombre`; `esfuerzo` es `"low"` para `azure-openai`, como la web) |
| `corto` | Generado con 8 caracteres como máximo, quitando el prefijo «GPT-»: «5.6 Luna», «5.4 mini», «6 Luna», «6 Sol», «6 Astra». Lo prueba un test |
| `controlador` | El `id` del `Llm` creado, por ejemplo `azure-openai:cronista-sol6:reasoning-low`. Es lo que debe aparecer en cada decisión de su lado |
| `precio` | Una instantánea de `precios.json` (`entrada`, `salida`, `cache`), con la `fuente` y la fecha de consulta, que se copian a `gasto` |
| `modelosDevueltos` | El conjunto de valores `model` que devolvió la API (`transporteInstrumentado`). Es declarado |

La fábrica es la del smoke 052 (`crearLlmAzureOpenAI` con `reasoningEffort: "low"`; `foundry-modelos`
con su `formatoJson` y su esfuerzo). Se **extrae** a una función exportada compartida sin cambiar la
salida del smoke, cuya prueba sigue en verde.

### 3.3 Calendario y semillas — `calendarioTorneo(ids, semilla)` (puro, en `torneo.ts`)

**Orden de los participantes.** Se barajan con `prngDerivado(semilla, "torneo-059:orden")`.

**Ida con n par (P1: n = 6).** Método del círculo (tabla de Berger): n−1 = 5 jornadas de n/2 = 3
partidos, sin descansos. El participante fijo alterna local y visita por jornada. En cada par de los
demás, el local se invierte en jornadas alternas. Cada uno juega 5 partidos en la ida, un número
impar, así que **no puede tener 3 locales y 3 visitas**: tiene 3 + 2 o 2 + 3. Con 6 participantes,
exactamente 3 participantes tienen 3 locales en la ida y los otros 3 tienen 2. Con la vuelta invertida,
**cada uno juega exactamente 5 de local y 5 de visita** en el torneo.

**Ida con n impar** (ensayo con 3 y P2 con 5). El orden es rotacional: el participante i es local
contra i+1 … i+(n−1)/2 (módulo n), y cada uno es local exactamente (n−1)/2 veces. Se añade un
descanso ficticio para repartir las jornadas, así que cada uno descansa una vez.

En ambos casos, **la diferencia entre locales y visitas de cualquiera en la ida es como máximo 1**, y
nadie juega dos veces en una jornada.

**Jornadas.** El orden de las jornadas se sortea con
`prngDerivado(semilla, "torneo-059:jornadas")`.

**Vuelta.** Mismas jornadas y mismo orden, con los lados invertidos. Los partidos se numeran 1…N en
orden de ejecución: la ida 1…N/2 y la vuelta N/2+1…N.

**Semilla de cada cruce.** Es `prngDerivado(semilla, "torneo-059:cruce:" + [a, b].sort().join("|"))`,
un uint32 que no depende del orden del calendario. Si coincide con la de otro cruce, se reintenta con
el sufijo `":1"`, `":2"`… La ida y la vuelta de un cruce **comparten** semilla.

**Salida.** `EncuentroPlan[] = { n, jornada, cruce, vuelta, seed, local, visita }`.

### 3.4 Un partido

1. **Configuración.** `crearConfigArena({ seed, duracionS, intervaloS })`, con formaciones automáticas
   y entorno por la semilla, como «auto» en la web. `ejecutarArena` recibe `esperaMs: ARENA.esperaMs` y
   no lleva ritmo ni `alPublicar`. Cada lado tiene su `crearControladorLlm(fabrica(espec,
   transporteTorneo(fetch, peticiones[lado])))`.
2. **Peticiones por decisión.** Se separan por ronda con `alProgreso`, como `partidoSmoke` (cortes por
   ronda).
3. **Causa de cada respaldo.** `causaRespaldo(decision, peticionesDeLaDecision)` devuelve
   `"modelo" | "infraestructura"`:
   - es `"infraestructura"` si `motivo ≠ "orden_invalida"` y alguna petición de esa decisión terminó en
     un estado de `TORNEO_ARENA.http.estadosReintentables`, en un error de red (estado `null`) o fue
     reintentada;
   - en cualquier otro caso es `"modelo"`: `orden_invalida`, truncado, JSON inválido con 200, filtro de
     contenido o plazo agotado sin reintentos.
4. **Partido anulado.** Si hay algún respaldo por infraestructura, el partido queda
   `anulado: "infraestructura"`. Se guarda en `docs/evidencia/torneo-059/<id>/anulados/eNN-rK.json.gz`
   con su uso y su coste reales, y se repite (§ 3.5).
5. **Validación.** Con cada partido válido:
   - `rep = reproducirArena(JSON.parse(JSON.stringify(registro)))`;
   - `isDeepStrictEqual(contenidoCanonico(rep), contenidoCanonico(registro))`;
   - cada `rondas[i].decisiones[lado].controlador` es el `controlador` del participante de ese lado;
   - si algo falla, **aborta** el torneo. Es un defecto, no un fallo de red.
6. **Huella.** `huella = sha256(JSON.stringify(contenidoCanonico(registro)))`.
7. **Cifras** de `cifrasEquipos(registro, registro.final.tick)` y `pasesIntentados(…)` del 049:
   - `posesionPct`, `remates`, `rematesDirectos`, `pasesCompletados`, `pasesIntentados` y
     `recuperaciones`;
   - el valor `null` se conserva tal cual (no simulado);
   - **no** se usan las cifras estimadas (`igr`, `remates_cercanos`).
8. **Uso y coste de cada lado.** El uso es el de `llms[lado].uso()` más el resumen del transporte:
   estados HTTP, reintentos y `model` devueltos. El coste es `costoUsd(uso, precio)`, la fórmula de
   `smoke-modelos.ts:244` extraída a una función pura con `TORNEO_ARENA.decimalesUsd`.
9. **Escritura.** `eNN.json.gz` con `gzip` de nivel 9 y una comprobación de ida y vuelta: descomprimido,
   como mucho `ARENA.archivoMaxBytes`; comprimido, como mucho `TORNEO_ARENA.registroGzMaxBytes`.
   Antes de escribir, el texto del registro pasa la redacción de `serializarEvidencia` (claves y
   hosts). Si conserva un secreto, aborta.

### 3.5 429, errores y repeticiones

**`transporteTorneo(base, registro)`.** Envuelve a `transporteInstrumentado` para que cada intento
quede registrado. Ante un estado de `http.estadosReintentables` (408, 429, 500, 502, 503 y 504) o un
error de red:

- espera `retry-after-ms`, si no `retry-after` (en segundos), y si no `http.esperasMs[k]`;
- la espera nunca supera `http.esperaMaxMs`;
- reintenta como mucho `http.reintentos` veces;
- **nunca** pasa del `AbortSignal` de la petición: el plazo de 60 s del coordinador sigue mandando;
- cualquier otro 4xx no se reintenta.

Un 429 no se factura; el uso solo suma las respuestas 200 con `usage`.

**Política de partido:**

- Un partido anulado se repite con la misma semilla y los mismos lados, después de
  `pausaEntrePartidosMs`. Admite hasta `repeticionesMax` repeticiones (2), y luego queda
  `anulado-final`.
- Con `anuladosSeguidosMax − 1` anulaciones seguidas, se espera `enfriamientoMs`.
- Con `anuladosSeguidosMax` (3), el CLI **se detiene** con código 2, «reanudar más tarde».
- La repetición depende solo de la infraestructura, nunca del resultado, así que no hay sesgo de
  selección.
- Entre partidos se espera `pausaEntrePartidosMs`.
- Los partidos se juegan **en serie**, uno a la vez. Así baja la presión de TPM sobre los deployments
  que comparte la arena pública.

### 3.6 Coste: estimación, confirmación y tope

Decisiones previstas por participante: `D = 2(n−1) · ceil(duracionS / intervaloS)`, que da 40 con los
valores por defecto.

**Estimación típica por decisión del modelo m:**

- fórmula: `E_m · precio de entrada + S_m · precio de salida`;
- `E_m` y `S_m` son la entrada y la salida medias por llamada de su deployment en
  `docs/evidencia/modelos-052/*.json`, como candidato o como rival;
- si no hay medición, se usa la mayor media observada de cualquier deployment, con la marca «sin
  medición propia».

**Cota por decisión:**

- fórmula: `ARENA.intentosOrdenes × (P · SMOKE_MODELOS_ARENA.factorEntradaReintento · precio de
  entrada + ARENA.tokensOrdenes · precio de salida)`;
- `P` es el mayor `promptMax` observado en cualquier partido de 60 s de la evidencia;
- es la misma fórmula del 052, § 5.

**Cotas del partido y del torneo.**

- `cotaPartido(a, b)` = `ceil(duracionS / intervaloS) × (cotaDecision(a) + cotaDecision(b))`.
- La cota del torneo es la suma de todas las cotas de partido.

**Salida antes de jugar.** El CLI imprime una tabla por participante: decisiones, típico USD, cota
USD, si tiene medición propia, tiempo estimado (`ceil(dur/int)` × la mayor mediana de latencia del
smoke de cada partido, más pausas) y los totales. La guarda en `docs/evidencia/torneo-059/<id>/
estimacion.json`.

**Rechazos antes de empezar:**

- con `típico total > tope`: «el tope no alcanza para terminar»;
- con `--tope-usd > TORNEO_ARENA.topeMaxUsd`.

**Guarda antes de cada intento de partido.**

- Condición: `gastoAcumulado + cotaPartido ≤ tope`. Si no se cumple, el estado pasa a
  `pausado-por-tope`, el CLI sale con código 3 y se reanuda con `--reanudar --tope-usd <mayor>`.
- **Qué suma `gastoAcumulado`:** el coste real de los partidos completos y anulados (uso conocido) más
  la **cota** de cada intento interrumpido sin uso conocido.
- **El tope no entra en el hash de configuración**, pero nunca puede bajar del `gastoAcumulado`.

### 3.7 Reanudación y cerrojo

- **Estado.** `.cache/arena-torneos/<id>/estado.json` se escribe como temporal y luego con `rename`.
  Contiene:
  - `configHash`: sha256 de participantes, semilla, duración, intervalo, `ARENA.version`,
    `ARENA.reglas` y commit;
  - `plan` (§ 3.3);
  - por partido: `estado` (`pendiente`, `en_curso`, `completo` o `anulado-final`), `intentos[]` (con
    motivo, uso, coste y si es cota) y la fila final;
  - el `gasto`.
- Escribe `en_curso` **antes** de la primera llamada y `completo` **después** de escribir el `.json.gz`.
- **Con estado previo:**
  - si ya existe y no se pasa `--reanudar`, aborta;
  - con `--reanudar`, `configHash` tiene que coincidir; si no, aborta;
  - los partidos `completo` no se repiten nunca;
  - un partido `en_curso` encontrado al reanudar se convierte en un intento `interrumpido` con su
    cota, cuenta como repetición y se vuelve a jugar.
- **Ctrl+C** (`SIGINT`) aborta el `AbortController` del partido y registra un intento `interrumpido`
  con el uso real conocido hasta ese punto. Guarda y sale con 130.
- **Cerrojo.** `.cache/arena-torneos/<id>/cerrojo`, creado con `open(…, "wx")` y que guarda el pid y la
  hora. Si existe, aborta. `--liberar-cerrojo` solo lo borra si el pid ya no vive
  (`process.kill(pid, 0)` lanza).

### 3.8 Salida final

Cuando todos los partidos están en `completo` o en `anulado-final`:

- **`torneo.json`.** Se construye con el esquema de § 4.1, validado con `esquemaTorneo`, y pasa la
  redacción de secretos. `estado` es `"completo"` solo si no hay ningún `anulado-final`.
- **Destinos.** Un torneo real escribe:
  - `public/torneos/<id>/torneo.json` y `public/torneos/<id>/eNN.json.gz`;
  - `public/torneos/indice.json`, con `[{ id, inicioUtc, titulo }]` ordenado por `inicioUtc`
    descendente.
- **Ensayo.** Escribe en `--salida` (el fixture de § 7), nunca en `public/`.
- **Evidencia** en `docs/evidencia/torneo-059/<id>/`, generada por el CLI y no editada a mano:
  - `README.md`, con la misma tabla, matriz, métricas y frase de D5, producidas por las funciones de
    `torneo.ts`;
  - la orden exacta ejecutada, el commit, los costes estimado, cota, tope y real, los anulados y sus
    motivos, y los límites de § 13;
  - `gasto.json` y `anulados/`.

## 4. Datos, clasificación y métricas — `src/arena/torneo.ts` (P1, puro)

### 4.1 Esquema del archivo (zod `strictObject` en todos los niveles)

```ts
export const VERSION_TORNEO = "059-v1";
interface ParticipanteTorneo { id; nombre; corto; deployment; modelo; version; controlador;
  formatoJson: string | null; esfuerzo: "low" | "minimal" | null;
  precio: { entrada: number; salida: number; cache: number | null } | null; modelosDevueltos: string[] }
interface UsoLado { llamadas; respuestasConUso; entrada; salida; cache; reintentosHttp: number;
  http: Record<string, number>; modelos: string[] }                           // DECLARADO por el CLI
interface LadoEncuentro {
  participante: string; club: string; goles: number;
  decisiones: { total: number; validas: number;
    respaldos: { orden_invalida: number; error_controlador: number; plazo_agotado: number };
    llamadas: number | null; tiemposMs: number[]; rondasConReintentoHttp: number[] };      // REGISTRADO salvo rondasConReintentoHttp
  cifras: { posesionPct: number | null; remates: number | null; rematesDirectos: number | null;
    pasesCompletados: number | null; pasesIntentados: number | null; recuperaciones: number | null }; // REGISTRADO
  uso: UsoLado | null; costoUsd: number | null }                                // DECLARADO
interface EncuentroTorneo { n; jornada; cruce; vuelta: boolean; seed; archivo: string /* "e07.json.gz" */;
  huella: string; repeticion: number; local: LadoEncuentro; visita: LadoEncuentro }
interface AnuladoTorneo { n; repeticion; motivo: "infraestructura" | "interrumpido"; costoUsd: number; esCota: boolean; archivo: string | null }
interface TorneoArchivado { version: "059-v1"; id; tipo: "real" | "ensayo"; titulo: { es; en };
  inicioUtc; finUtc; commit; motor: { version; reglas }; duracionS; intervaloS; semilla;
  participantes: ParticipanteTorneo[]; encuentros: EncuentroTorneo[]; pendientes: number[]; anulados: AnuladoTorneo[];
  gasto: { totalUsd: number; estimadoUsd: number; cotaUsd: number; topeUsd: number; fuentePrecios: string; consultaPreciosUtc: string; incluyeCotas: boolean };
  estado: "completo" | "incompleto" }
```

`pendientes` contiene los `n` del plan sin una ejecución válida (los `anulado-final`).

Invariantes que comprueba `validarCoherencia(t)` (pura; la usan la página, la ruta y CI):

- el plan que reconstruye `calendarioTorneo` coincide con los partidos y los pendientes en `n`,
  `jornada`, `cruce`, `vuelta`, `seed`, `local` y `visita`;
- las huellas no se repiten;
- `archivo === "e" + nn + ".json.gz"`;
- `goles` es mayor o igual que cero;
- `tiemposMs.length === total`;
- `validas` más la suma de los respaldos es igual a `total`;
- `gasto.totalUsd` es igual a la suma de los `costoUsd` de los partidos más los anulados, con
  tolerancia `10^-decimalesUsd`;
- cada `participante` está en `participantes`.

Si algo falla, la página no muestra cifras (§ 5.2).

### 4.2 Puntos y desempates — `clasificar(t): FilaClasificacion[]`

`FilaClasificacion = { id, pos, empatada, pj, g, e, p, gf, gc, dg, pts }`, con
`TORNEO_ARENA.puntos` (3/1/0). Solo cuentan los `encuentros`; los anulados y los pendientes no.

Orden:

1. Puntos, de mayor a menor.
2. DG, de mayor a menor.
3. GF, de mayor a menor.
4. Dentro de cada grupo que siga empatado, una **liguilla** con solo los partidos entre ellos: puntos,
   DG y GF. Si la liguilla separa una parte del grupo, se vuelve a aplicar sobre cada subgrupo que
   siga empatado.
5. Si aun así persiste el empate, **posición compartida** con numeración de competición (1, 2, 2, 4),
   `empatada: true`, y para mostrarlos, orden alfabético por `nombre` (`localeCompare` en `es`). No
   hay sorteo ni criterio de respaldos: mezclaría calidad del modelo con infraestructura.

**Cruces** (`cruces(t)`): por cruce, el global de los dos partidos (sin valor doble de los goles de
visitante), `ganador | null` y `completo`.

### 4.3 Métricas por participante — `metricasParticipante(t, id)`

Cada cifra lleva `fuente: "registrada" | "declarada"`. La interfaz y el README rotulan las declaradas:
«declarado por el CLI; no se puede comprobar con el registro».

| Métrica | Cálculo | Fuente |
|---|---|---|
| Partidos, decisiones, válidas | sumas | registrada |
| Respaldos por motivo | sumas por `orden_invalida` / `error_controlador` / `plazo_agotado` | registrada |
| Solicitudes, reintentos de validación | Σ `llamadas`; reintentos = Σ `llamadas` − decisiones. `null` si algún partido tiene `null` | registrada |
| Latencia mediana y máxima (s) | `tiemposMs` excluyendo `rondasConReintentoHttp`. Se informa aparte cuántas decisiones esperaron por un 429 | registrada (y la exclusión, declarada) |
| Tokens de entrada, salida y caché | sumas de `uso`. **`null` si falta en algún partido**: se muestra «—», nunca una suma parcial | declarada |
| Coste USD | Σ `costoUsd`; `null` si falta en algún partido | declarada |
| Posesión media | media de `posesionPct` por partido (cada partido pesa igual). `null` si alguno es `null` | registrada |
| Remates y remates directos por partido | media | registrada |
| Precisión de pase | Σ completados / Σ intentados (no la media de porcentajes) | registrada |
| Recuperaciones por partido | media | registrada |

Las etiquetas son las de `ETIQUETAS_CIFRAS` (049) cuando la clave existe; las nuevas están en § 5.5.

### 4.4 Honestidad calculada

- `pSignosBilateral(ganados, perdidos)` calcula la binomial exacta con p = ½, bilateral y con tope 1,
  excluyendo los empates.
- `pMinimaTorneo(n)` es `pSignosBilateral(n−1, 0)`, que da 0,0625 con 6 participantes (0,125 con 5).
- `textoSignificacion(t, idioma)` construye la frase de D5 con esa cifra y `TORNEO_ARENA.alfa`.

## 5. Bloque B · Sitio (P1)

Antes de escribir las páginas, Opus lee en `node_modules/next/dist/docs/` la guía de esta versión
sobre `params` y `searchParams` (son Promesas) y sobre las rutas de API, como exige CLAUDE.md.

### 5.1 Datos y rutas

**`src/arena/torneo-archivo.ts`.** Solo lo usa el servidor:

- **Directorio** de torneos: `process.env.ARENA_TORNEOS_DIR` (absoluto) o
  `${process.cwd()}/public/torneos`. Se lee con `readFile` y `/* turbopackIgnore: true */`, como la
  ruta de grabaciones.
- **`leerIndice()`** y **`leerTorneo(id)`**: aplican la regex del id, `esquemaTorneo`,
  `validarCoherencia` y una memoria por proceso.
- **`registroEncuentro(id, n)`:**
  - solo admite un `n` que esté en `encuentros`;
  - el archivo sale del manifiesto, nunca de la URL;
  - descomprime con `gunzipSync(…, { maxOutputLength: ARENA.archivoMaxBytes })`;
  - valida con `reproducirArena`, la huella, los goles y los controladores de cada lado;
  - la memoria guarda 24 entradas como máximo y se descarta la más antigua;
  - responde 404 a un id o `n` desconocido o ilegible y 409 «El registro no coincide con el torneo» a
    un desajuste.

**`GET /api/arena/torneos/[id]/encuentros/[n]`** (`runtime = "nodejs"`):

- `n` son dos dígitos;
- la respuesta es `{ registro, encuentro: { n, jornada, vuelta, local: { id, nombre, club, goles },
  visita: {…} }, torneo: { id, titulo, inicioUtc, tipo } }`;
- lleva `cache-control: public, max-age=3600`;
- los errores van por `respuestaErrorSesion`.

**`/api/arena/grabaciones`.** `esquemaArchivo` también acepta `archivo` con
`^torneo:[a-z0-9-]{1,30}:\d{2}$`, que sigue empezando por `{"archivo"` y por eso no pasa por la
admisión. En ese caso:

- llama a `registroEncuentro(id, n)` y luego a `registrarGrabacion(registro, "torneo-" + id + "-" + nn)`;
- no pasa `procedencia`: es un archivo del repositorio, como los ejemplos;
- la guarda 503 (`ARENA_VOZ`) no cambia.

**Archivos estáticos.** `public/torneos/<id>/eNN.json.gz` se sirve tal cual. La página lo ofrece como
«Descargar registro», que se reproduce con «Abrir registro guardado» tras descomprimirlo o con
`npm run arena -- --reproducir`.

### 5.2 Página `/arena/torneo` (el más reciente) y `/arena/torneo/[id]`

**Servidor** (`src/app/arena/torneo/page.tsx`, `src/app/arena/torneo/[id]/page.tsx`):

- `dynamic = "force-dynamic"` y metadatos «Model tournament — CRONISTA»;
- lee el índice y el torneo;
- un id desconocido va a `notFound()`;
- un índice vacío muestra el estado vacío: «Aún no hay torneos archivados» / «No tournaments archived
  yet», con una frase sobre por qué no se lanzan desde el sitio;
- si `validarCoherencia` falla, muestra «Este torneo no supera la comprobación de coherencia; no se
  muestran sus cifras» **sin ninguna cifra**;
- pasa `torneo`, `ediciones` e `idiomaInicial` (de `?lang=es`) a `src/ui/ArenaTorneo.tsx` (cliente).

**Contenido**, en `<main className="arena-shell arena-torneo" lang={idioma}>`, en este orden:

1. **Barra superior.** La misma `header.topbar.arena-topbar`: marca, enlaces «Crónicas» y
   «Laboratorio» y el botón de idioma con los nombres accesibles de la arena.
2. **Cabecera.** Rótulo superior «Experimental · torneo entre modelos». h1 «Torneo entre modelos» /
   «Model tournament». Una línea: «{n} entrenadores de IA, todos contra todos, ida y vuelta, {dur} s
   por partido». Una franja de datos: fecha (UTC, con `Intl.DateTimeFormat` por idioma), modelos,
   partidos jugados de los previstos y coste total (declarado). Con `tipo: "ensayo"`, una banda «Torneo
   de ensayo · sin IA: entrenadores programados con nombre de prueba». Con `incompleto`, una banda
   «Torneo incompleto: {k} partidos sin disputar».
3. **Aviso de honestidad**, visible y no plegado: la frase de D5 más «Cada cruce se juega con la misma
   semilla y los lados invertidos: los clubes, el clima y la grada se compensan, la suerte de cada
   jugada no».
4. **Tabla de posiciones** (`<table>` con `<caption>`, `th scope`). Columnas: Pos | Modelo | PJ |
   G-E-P | Goles (GF:GC) | DG | Pts, con `<abbr title>` en las siglas. Es la misma composición en
   todos los anchos. El modelo aparece por `nombre`; por `corto` a ≤ 520 px, con el nombre completo en
   `title` y en texto oculto. La posición compartida se marca «2=», con el texto accesible «empatado en
   el 2.º puesto».
5. **Matriz de resultados**, con el local en las filas y la visita en las columnas:
   - es un `<table>` de n × n con encabezados `corto` y `<abbr title={nombre}>`;
   - la diagonal es «—», con el texto oculto «no aplica»;
   - cada celda es un enlace «2–1» con el nombre accesible «{local} {gl}, {visita} {gv}. Ver la
     repetición del partido {n}»;
   - un partido pendiente es «s/d», con el texto «sin disputar»;
   - no se colorea por resultado.
6. **Partidos por jornada** (lista; es el camino accesible principal). Cada partido muestra:
   - «J{j} · P{n} · {Club local} ({corto local}) {gl}–{gv} {Club visita} ({corto visita})»;
   - el global del cruce en la vuelta;
   - «Ver repetición» / «Watch replay», que lleva a `/arena?torneo=<id>&encuentro=<nn>` (más
     `&lang=es` en español);
   - «Descargar registro».
7. **«Cómo jugaron los entrenadores»** (§ 4.3). Una tabla con una fila por modelo, en el orden de la
   clasificación. Las declaradas llevan un marcador «†» con su leyenda; el marcador es un carácter en
   el texto, no un `content` de un pseudoelemento. Un `null` es «—». Por debajo de 720 px, la tabla va
   dentro de `div.arena-torneo-scroll` con `overflow-x: auto`, `tabindex="0"` y `role="region"`, con
   el nombre accesible «Métricas por modelo». La **página** no se desborda.
8. **«Procedencia y coste»** (`<dl>`):
   - por modelo: deployment, modelo y versión, `esfuerzo`, `modelosDevueltos` (declarado);
   - motor y reglas, duración e intervalo, semilla del torneo y commit (enlazado al repositorio);
   - precios con su fuente y fecha;
   - coste estimado, cota, tope y real, y los anulados con su motivo.
9. **«Lo que este torneo no demuestra»**: la lista de § 13, en una versión de 5 viñetas.
10. **Otras ediciones**, si hay más de una: enlaces a `/arena/torneo/<id>`.

### 5.3 Repetición con narración, en `/arena`

Cambios mínimos en `Arena.tsx`, **después del 058**:

- **El tipo.** `archivoActual` y la prop `archivo` de `ArenaNarracion` admiten
  `` `torneo:${string}:${string}` ``. `registrar()` sigue enviando `{ archivo }`.
- **El efecto de montaje** (`Arena.tsx:134`). Con `torneo` y `encuentro` válidos:
  1. `setVista("guardados")` y `setConfigurando(false)`;
  2. `GET /api/arena/torneos/<id>/encuentros/<nn>`;
  3. `setRegistro`, `setTiempo(0)`, `setArchivoActual("torneo:<id>:<nn>")`, `setCargaId(c => c+1)`,
     `setImportado(false)`, y guarda `encuentro` en un estado nuevo `origenTorneo`.
  4. Con `lang=es`, además `setIdioma("es")`; sin el parámetro, nada cambia.
  5. Si la petición falla, muestra el error en el patrón actual: «No se pudo abrir este partido del
     torneo. El anterior sigue disponible.» Se conserva el registro inicial.
- **Línea de procedencia** dentro de `.arena-intro`, solo con `origenTorneo`: «Partido {n} del torneo
  del {fecha} · Local: {club} ({modelo}) · Visita: {club} ({modelo})», con un enlace «Volver al
  torneo».
- **Navegación.** `nav.topbar-links` gana un enlace «Torneo» / «Tournament» a
  `/arena/torneo${es ? "?lang=es" : ""}` antes del botón de idioma.
- **Lo que no cambia:** ningún otro texto, nombre accesible, `data-testid` ni orden de controles (047).

El espectador pulsa Reproducir con «Con narración» (057, o activado por defecto si el 058 lo
establece). La primera pista de un partido gasta Speech, como cualquier grabación; las siguientes
salen de la memoria de la sesión durante 24 h.

### 5.4 Estilo, 360 px y accesibilidad

- **Tokens.** Solo tokens 047/055 (`--surface`, `--ar-surface-2`, `--ink`, `--muted`, `--line`,
  `--accent`, `--ar-bug*`, `--ar-r*`, `--ar-s*`), sin hex en TSX ni en SVG. Se heredan por
  `main.arena-shell`. Las clases nuevas solo llevan el prefijo `arena-torneo-`, y ninguna regla
  existente cambia de selector.
- **Tipografía** de la escala del 047: h1 Archivo 900, h2 de panel en Archivo 700 de 20 px, cuerpo
  Source Sans 3 de 15 px y cifras con `tabular-nums`. El emblema y los escudos del 055 (`Escudo`) van
  en la lista de partidos, junto al club.
- **360 px:** `document.documentElement.scrollWidth ≤ 360` en claro, oscuro, ES y EN. La tabla de
  posiciones y la matriz caben **sin desplazamiento** (16 px de margen, celdas de 44 px de alto y 44 px
  de ancho como mínimo, 13 px de cuerpo en la matriz). Solo la tabla de métricas se desplaza dentro de
  su contenedor.
- **Contraste** ≥ 4,5 en texto y ≥ 3 en bordes de foco, en los dos temas. Se mide por estilos
  calculados en el e2e (§ 8), con la misma fórmula que `docs/evidencia/rediseno-047/contraste.mjs`.
- **Accesibilidad:**
  - encabezados h1 → h2 en orden;
  - tablas con `caption` y `scope`;
  - enlaces con nombre descriptivo;
  - foco visible con el anillo de `--accent`;
  - sin `aria-label` en elementos que ya tienen texto;
  - `lang` en `main`;
  - sin animaciones nuevas, y `prefers-reduced-motion` sin efecto que retirar;
  - la posición compartida y la banda de ensayo no se expresan **solo** con color.

### 5.5 Textos ES/EN (lista cerrada; añadirlos donde viven los textos de la arena)

| Clave | ES | EN |
|---|---|---|
| titulo | Torneo entre modelos | Model tournament |
| overline | Experimental · torneo entre modelos | Experimental · model tournament |
| resumen | {n} entrenadores de IA, todos contra todos, ida y vuelta, {s} s por partido | {n} AI coaches, double round robin, {s} s per match |
| tabla | Tabla de posiciones | Standings |
| matriz | Resultados (local en filas, visita en columnas) | Results (home in rows, away in columns) |
| partidos | Partidos por jornada | Matches by round |
| metricas | Cómo jugaron los entrenadores | How the coaches played |
| procedencia | Procedencia y coste | Provenance and cost |
| limites | Lo que este torneo no demuestra | What this tournament does not show |
| repeticion | Ver repetición | Watch replay |
| descargar | Descargar registro | Download record |
| declarado | † declarado por el CLI; no se puede comprobar con el registro | † declared by the CLI; not verifiable from the record |
| ensayo | Torneo de ensayo · sin IA | Rehearsal tournament · no AI |
| incompleto | Torneo incompleto: {k} partidos sin disputar | Incomplete tournament: {k} matches not played |
| vacio | Aún no hay torneos archivados | No tournaments archived yet |
| incoherente | Este torneo no supera la comprobación de coherencia; no se muestran sus cifras | This tournament fails its consistency check; its figures are not shown |
| pareo | Cada cruce se juega con la misma semilla y los lados invertidos: los clubes, el clima y la grada se compensan; la suerte de cada jugada, no. | Each pairing is played with the same seed and sides swapped: clubs, weather and crowd balance out; the luck of each play does not. |
| nav | Torneo | Tournament |
| volver | Volver al torneo | Back to the tournament |
| origen | Partido {n} del torneo del {fecha} | Match {n} of the {date} tournament |
| errorEncuentro | No se pudo abrir este partido del torneo. El anterior sigue disponible. | Could not open this tournament match. The previous one is still available. |
| significacion (plantilla) | {n} partidos no bastan para ordenar modelos por calidad: cada modelo juega {c} cruces, y ni ganarlos todos alcanzaría p < {alfa} en una prueba de signos (p = {p}). La tabla describe este torneo. | {n} matches are not enough to rank models by quality: each model plays {c} pairings, and even winning all of them would not reach p < {alpha} in a sign test (p = {p}). The table describes this tournament only. |

Siglas y columnas: PJ/P, G-E-P/W-D-L, Goles/Goals, DG/GD, Pts/Pts. Métricas: «Decisiones válidas» /
«Valid decisions», «Respaldos programados» / «Programmed fallbacks», «Latencia mediana» / «Median
latency», «Solicitudes» / «Requests», «Tokens (entrada / salida / caché)» / «Tokens (in / out /
cached)», «Coste» / «Cost», y las de juego tomadas de `ETIQUETAS_CIFRAS`.

### 5.6 Qué puede hacer el público

| Acción | Coste | Límite |
|---|---|---|
| Ver tabla, matriz, métricas y procedencia | ninguno | — |
| Repetir un partido con narración | Speech de la primera pista | presupuestos 057 por sesión y diarios |
| Descargar un registro | ninguno | — |
| Lanzar un torneo | — | **no existe** (D1) |
| Jugar este cruce en vivo (P2) | un partido con modelos | `maxLlmDiarias`, un encuentro a la vez; no entra en la tabla |

## 6. Constantes — `src/sim/limites.ts`, comentadas, después de `SMOKE_MODELOS_ARENA`

```ts
/** Brief 059 · Torneo entre modelos (`npm run arena:torneo`). Cotas operativas del CLI y de la tabla;
 * no son parámetros del motor ni del sitio público (que no lanza torneos). */
export const TORNEO_ARENA = {
  version: "059-v1",
  /** Partido corto del smoke 052: 4 decisiones por lado, cubierto por la admisión de los seis. */
  duracionS: SMOKE_MODELOS_ARENA.cortoS,
  /** Intervalo por defecto y la única alternativa (variante barata, § 9). */
  intervalosS: [SMOKE_MODELOS_ARENA.cortoIntervaloS, SMOKE_MODELOS_ARENA.webIntervaloS],
  semillaDefecto: 59,
  participantes: { min: 3, max: 6 },
  puntos: { victoria: 3, empate: 1, derrota: 0 },
  /** Transporte: reintentos solo ante estos estados o error de red, dentro del plazo de la decisión. */
  http: { reintentos: 3, esperasMs: [2_000, 5_000, 10_000], esperaMaxMs: 20_000, estadosReintentables: [408, 429, 500, 502, 503, 504] },
  /** Un partido anulado por infraestructura se repite hasta 2 veces; con 3 anulaciones seguidas se detiene. */
  repeticionesMax: 2, anuladosSeguidosMax: 3, enfriamientoMs: 120_000, pausaEntrePartidosMs: 3_000,
  /** `--tope-usd` obligatorio y nunca mayor que este valor. */
  topeMaxUsd: 20, decimalesUsd: 4,
  /** Registro comprimido (gzip 9) por partido; el descomprimido se acota con ARENA.archivoMaxBytes. */
  registroGzMaxBytes: 1_000_000,
  /** Umbral con el que se redacta la frase de significación (D5). */
  alfa: 0.05,
  /** Ensayo sin inferencia (fixtures): duraciones admitidas en segundos. */
  ensayoSegundos: { min: 10, max: 60 },
} as const;
```

Ninguna prueba repite estas cifras a mano: todas importan `TORNEO_ARENA`, `ARENA` y
`SMOKE_MODELOS_ARENA`.

## 7. Pruebas (vitest) con mutaciones que deben fallar

**Fixture de ensayo** (`src/arena/__fixtures__/torneos/`):

- `indice.json` y `ensayo-059/torneo.json` con 6 `eNN.json.gz`: 3 participantes `ensayo:a|b|c`, 20 s;
- lo genera el CLI con `--ensayo --salida`, documentado en un comentario del generador;
- `ensayo-059-alterado/`: copia con un gol cambiado en `torneo.json` y una orden cambiada dentro de
  `e03.json.gz`, solo para las pruebas de rechazo;
- **un fixture sintético de `TorneoArchivado`** en TS para clasificación y métricas, con 5
  participantes, empates construidos a propósito y nulos.

Archivos:

- `torneo.test.ts` (puro);
- `torneo-ejecucion.test.ts` (orquestador con `fetch` falso y LLM falso que devuelve órdenes válidas
  tomadas de `planProgramado`);
- `torneo-archivo.test.ts` (rutas y lector);
- `torneos-archivados.test.ts` (CI sobre **todo** `public/torneos` y el fixture);
- `ArenaTorneo.test.tsx` (render).

| # | Prueba | Mutación que debe ponerla en rojo |
|---|---|---|
| M1 | Calendario: cada par juega 2 veces, una de local cada uno, con la misma semilla en la ida y la vuelta, y semillas distintas entre cruces | la vuelta con otra semilla; sin invertir lados |
| M2 | Calendario: nadie juega dos veces por jornada; diferencia de locales en la ida ≤ 1 (con 6: tres con 3 y tres con 2; 5/5 exactos en el torneo; con 3 impares, 1/1); determinista por semilla y estable ante el orden de `ids` en la semilla del cruce | sin rotación (un participante 4 veces local); semilla del cruce dependiente de la posición |
| M3 | Ida completa = todos contra todos simple (partidos 1…N/2) | ida y vuelta intercaladas |
| M4 | Puntos 3/1/0 desde `TORNEO_ARENA.puntos` | victoria = 2 |
| M5 | GF, GC y DG por lado (el visitante también suma sus goles) | ignorar goles de visitante; DG con el signo invertido |
| M6 | Desempate por DG y luego por GF | GF antes que DG |
| M7 | Liguilla solo entre los empatados, reaplicada a subgrupos (caso de 3 empatados que la liguilla separa en 1 + 2) | liguilla con todos los partidos; sin reaplicar |
| M8 | Posición compartida (1, 2, 2, 4) y `empatada`; orden alfabético solo para mostrar | posiciones correlativas por alfabeto |
| M9 | Anulados y pendientes fuera de la tabla; PJ refleja partidos jugados | contar el anulado |
| M10 | `cruces`: global sin goles de visitante dobles; `ganador null` en empate global | regla del gol de visitante |
| M11 | `pSignosBilateral(5, 0) = 0,0625`; `(4, 0) = 0,125`; `(3, 1) = 0,625`; empates excluidos | unilateral (0,03125 con 5/0) |
| M12 | Métricas: latencia excluye `rondasConReintentoHttp`; tokens y coste `null` si falta un partido; precisión = Σ/Σ | incluir decisiones con 429; suma parcial; media de porcentajes |
| M13 | `causaRespaldo`: un 429 final, red o petición reintentada = infraestructura; `orden_invalida` tras un 429 recuperado = modelo; plazo sin reintentos = modelo | 429 contado como modelo; todo `error_controlador` como infraestructura |
| M14 | Transporte: respeta `retry-after-ms` / `retry-after`, el tope `esperaMaxMs` y el número de reintentos; no reintenta un 400; se detiene con el `AbortSignal` | reintentar 400; sin tope de espera; ignorar la cancelación |
| M15 | Partido con respaldo por infraestructura → anulado, archivado y repetido con la misma semilla y lados; tras `repeticionesMax`, `anulado-final` y `estado: "incompleto"` | repetir con semilla nueva; contar el partido anulado |
| M16 | Guarda del tope con **cota**: un partido que cabe en el típico pero no en la cota no empieza; se pausa con código 3 | guarda con el típico |
| M17 | Reanudación: `configHash` distinto aborta; completos no se repiten; `en_curso` → interrumpido con la cota y repetido; el tope no baja del gasto | rejugar completos; interrumpido con coste 0 |
| M18 | Cerrojo: segundo proceso aborta; `--liberar-cerrojo` solo con el pid muerto | cerrojo no exclusivo |
| M19 | Árbol sucio aborta un torneo real (no el ensayo); sin `--confirmar` no se llama a `fetch` (contador del `fetch` falso = 0) | llamar durante la estimación |
| M20 | Esquema estricto: rechaza `clasificacion`, `tabla`, `totales` o cualquier campo agregado | `z.object` en lugar de `strictObject` |
| M21 | `validarCoherencia`: plan ≠ `calendarioTorneo`, huella repetida o suma de gasto distinta → incoherente | omitir la comprobación del plan |
| M22 | `torneos-archivados`: cada `eNN.json.gz` pasa `reproducirArena`; huella, goles, controladores por lado, `tiemposMs`, `llamadas` y cifras 049 iguales a lo recalculado; README regenerado idéntico byte a byte | alterar un gol en `torneo.json`; una orden en el `.gz`; intercambiar lados; editar el README |
| M23 | Lector: id o `n` fuera del manifiesto → 404 (incluidos `..`, `e7`, `99`); alterado → 409; `.gz` cuyo descomprimido supera `ARENA.archivoMaxBytes` → rechazo sin agotar memoria | leer el archivo desde la URL; sin `maxOutputLength` |
| M24 | Grabaciones: `{archivo:"torneo:<id>:07"}` → `registrarGrabacion` con referencia `torneo-<id>-07`; patrón inválido → 400; un torneo inexistente → 404 | referencia por hash; aceptar cualquier cadena |
| M25 | Render: «—» para `null` (nunca 0), «†» en todas las declaradas, banda de ensayo e incompleto, sin cifras con `incoherente`, frase de significación con la p calculada | mostrar 0 por `null`; quitar «†»; cifra fija «0,125» escrita a mano |
| M26 | `costoUsd` extraído: la evidencia del smoke 052 se regenera idéntica (`--solo-readme`) | redondeo distinto |
| M27 | Redacción: un registro o `torneo.json` con la clave o el host del `.env` falso aborta | no redactar los registros |

Cada mutación se aplica, se ve fallar y se revierte. Se anota con md5 del archivo mutado en
`docs/evidencia/torneo-059/mutaciones.md`, como en el 051.

## 8. E2E — `e2e/arena-torneo.spec.ts`

`playwright.config.ts` añade `ARENA_TORNEOS_DIR` (ruta absoluta al fixture) al `env` del servidor.
Ningún e2e existente cambia.

1. **Tabla, matriz y lista.** En `/arena/torneo` se ve la banda «Rehearsal tournament · no AI». Las
   filas de la tabla son iguales a `clasificar(fixture)`, importado en la prueba. La matriz tiene
   n(n−1) enlaces con `href` `/arena?torneo=ensayo-059&encuentro=NN`, y la lista tiene el mismo número
   de «Watch replay».
2. **Abrir una repetición.** Un clic en una celda abre `/arena`. El marcador `.arena-score strong` es
   igual al resultado de la fila y aparece la línea de procedencia con «Back to the tournament».
   Reproducir mueve la cancha: el atributo `transform` de `arena-ball` cambia.
3. **Registro de la narración.** Se interceptan `/api/arena/herramientas` (`voz: true`) y
   `/api/arena/grabaciones`, siguiendo el patrón de `arena-play-narrado.spec.ts`. La petición de
   registro lleva exactamente `{"archivo":"torneo:ensayo-059:NN"}`.
4. **Idioma.** El botón de idioma cambia los textos de § 5.5. `?lang=es` arranca en español en
   `/arena/torneo` y en `/arena?torneo=…`.
5. **360 px.** En claro y oscuro, ES y EN: `scrollWidth ≤ 360`. La tabla y la matriz no están dentro de
   un contenedor desplazable y miden ≤ 328 px.
6. **Contraste.** Por estilos calculados, en los dos temas: texto de celdas, encabezados, enlaces de la
   matriz y bandas ≥ 4,5; anillo de foco ≥ 3.
7. **Teclado.** Tab recorre la navegación, la tabla de métricas (contenedor con `tabindex`) y los
   enlaces de la matriz en orden, con el foco visible.
8. **Errores.** `/arena/torneo/no-existe` da 404. `/arena?torneo=ensayo-059&encuentro=99` muestra el
   error de § 5.5 y conserva el partido inicial. Con `ARENA_TORNEOS_DIR` apuntando al fixture alterado
   (prueba aparte, en la unidad M23) se obtiene 409.
9. **Regresión.** El enlace «Tournament» está en `/arena` y todo el resto de la suite de arena sigue en
   verde.

## 9. Coste estimado

Típico = 1 llamada por decisión con los tokens medios del smoke. Cota = 2 llamadas × (9.928 × 1,25 de
entrada + 2.048 de salida). Configuración por defecto: 6 participantes, 30 partidos y 40 decisiones
por modelo.

| Modelo | Típico por decisión | Cota por decisión | Típico en el torneo | Cota en el torneo |
|---|---|---|---|---|
| GPT-6 Astra | 0,1145 | 0,4530 | **4,58** | 18,12 |
| GPT-6 Sol | 0,0250 | 0,0906 | 1,00 | 3,62 |
| GPT-6.1 Sol (**precio estimado con el de gpt-6-sol**, declarado) | 0,0234 | 0,0906 | 0,94 | 3,62 |
| GPT-5.4 mini | 0,0100 | 0,0370 | 0,40 | 1,48 |
| GPT-5.6 Luna (sin medición propia) | ≈ 0,0026 | 0,0099 | 0,10 | 0,40 |
| GPT-6 Luna | 0,0012 | 0,0045 | 0,05 | 0,18 |
| **Total** | | | **≈ 7,1 USD** | **≈ 27,4 USD** |

- **Precio de GPT-6.1 Sol.** No está en `precios.json`. El CLI acepta, **solo para `cronista-sol61`**,
  el precio de `cronista-sol6` con la marca `precioEstimadoDe: "cronista-sol6"`. Esa marca pasa a
  `ParticipanteTorneo.precio` (campo nuevo, opcional, `precioEstimadoDe: string | null`) y la página la
  muestra junto a su coste: «† precio estimado con el de GPT-6 Sol». Si antes de jugar se anota su
  precio de lista en `precios.json`, se usa ese y la marca desaparece. Cualquier otro participante sin
  precio sigue abortando.
- **Tope.** Se propone `--tope-usd 12`.
  - La cota de partido más alta (Astra contra cualquiera de los dos Sol) es 4 × (0,4530 + 0,0906) ≈
    2,17 USD.
  - Con un gasto real hasta ≈ 40 % por encima del típico (≈ 9,9 USD), el último partido de Astra
    todavía cabe: ≈ 9,4 + 2,17 ≤ 12.
  - Si la guarda lo detiene, se reanuda con un tope mayor, porque Carlos aprobó añadir créditos.
  - `TORNEO_ARENA.topeMaxUsd` sigue en 20.
- **Caché.** La caché de prompts (≈ 11 % de la entrada en el smoke) puede bajar el coste; no se cuenta.
- **Duración.** Cada ronda dura lo que el más lento de los dos lados: medianas de 9,4 s Astra, 8,4 s
  6.1 Sol, 6,5 s Sol y 6,1 s 6 Luna, con máximos de unos 11 s. Un partido son 4 rondas (≈ 30–44 s),
  más validación y gzip (≈ 1–2 s) y la pausa de 3 s: ≈ 35–50 s. **30 partidos ≈ 20–25 min sin
  incidencias; hasta ≈ 40 min** con 429, enfriamientos y repeticiones.
- **Speech:** 0 en el CLI.

**Variante barata** (`--intervalo 30`, 2 decisiones por lado): ≈ 3,5 USD típicos y ≈ 13,7 USD de cota,
pero con la mitad de influencia del modelo. Solo si Carlos la prefiere al ver la estimación.

**Segunda edición** con otras semillas (P2): otros ≈ 7,1 USD.

Este gasto suma a la proyección de crédito: la deuda de los briefs 050–053 estimaba ≈ 158 USD de peor
caso hasta el 10 de noviembre.

## 10. Prioridades, calendario y estimación

**P1-A · Ejecución y evidencia:**

- `torneo.ts`: calendario, clasificación, cruces, métricas, signos, esquema y coherencia;
- `torneo-ejecucion.ts`: transporte, causas, anulación, tope, reanudación, cerrojo, archivo y README;
- `torneo-cli.ts`;
- `TORNEO_ARENA`;
- el fixture de ensayo;
- M1–M22, M26 y M27;
- **un torneo real de 30 partidos con 6 participantes** archivado, con el visto bueno de Carlos a la estimación impresa.

**P1-B · Sitio:**

- `torneo-archivo.ts`, la ruta GET y la rama `torneo:` de grabaciones;
- las páginas `/arena/torneo` y `/arena/torneo/[id]` con `ArenaTorneo.tsx` y su CSS;
- la integración en `/arena` (§ 5.3);
- M23–M25 y el e2e de § 8;
- el despliegue y el smoke público.

**P2, por orden:**

1. «Jugar este cruce en vivo»: `?local=<id>&visita=<id>` preselecciona «Elegir modelos» en
   `ArenaEnDirecto` si ambos están en el catálogo, con duración de 60 s. No entra en la tabla.
2. Referencia programada por semilla: un partido programado contra programado por cruce, sin
   inferencia, mostrado como «Sin IA, misma semilla: 1–0».
3. Torneos nulos con políticas programadas perturbadas, para una banda empírica de caos.
4. Segunda edición con otras semillas y la tabla agregada de ediciones con la misma configuración.
5. Un sexto participante «Política programada», fuera de concurso.
6. La p por modelo en el README.
7. Un enlace desde la portada.

**Estimación** (horas de agente):

| Tarea | Horas |
|---|---|
| Revisión de Codex del brief y v1.1 | 1 |
| A · puras y pruebas | 3 |
| A · orquestador y CLI y pruebas | 5 |
| A · fixture, torneo real supervisado y evidencia | 1,5 (+ 20–40 min de reloj) |
| B · lector y rutas | 2 |
| B · página y CSS | 4 |
| B · integración en `/arena` | 1,5 |
| B · e2e | 2,5 |
| Auditoría (Codex) y correcciones | 3 |
| Despliegue y smoke público | 1,5 |
| **Total** | **≈ 25 h** |

**Calendario** (America/Guatemala; el 058 corre en paralelo):

| Día | Trabajo |
|---|---|
| **Jue 23 oct** (tarde y noche) | Codex revisa el brief → v1.1. Opus empieza A · puras (solo archivos nuevos, sin choque con el 058). |
| **Vie 24 oct** | Por la mañana, A · orquestador y CLI, y el fixture de ensayo. **Hacia mediodía**, el ensayo en seco imprime la estimación; Carlos confirma, se juega el torneo real y se archiva (commit de evidencia con `[skip ci]` si solo hay datos). Por la tarde, B · lector y rutas. Por la noche, B · página. |
| **Sáb 25 oct** | Por la mañana, B · página e integración en `/arena` sobre el 058 ya integrado, y el e2e. Por la tarde, la auditoría y las correcciones. **Corte duro a las 20:00**: si B no está en verde, no se publica, y el torneo queda como evidencia (README más registros descargables, que «Abrir registro guardado» reproduce). Si está en verde, se despliega y se hace el smoke público antes de las 23:59. |
| **Dom 26 oct** | Reservado a la entrega. Nada del 059. |

**Recortes ordenados** si falta tiempo el 25:

1. La tabla de métricas pasa a solo registradas más el coste total.
2. Se quita la matriz, porque la lista de partidos ya da el acceso a cada repetición.
3. Se quita la línea de procedencia en `/arena`, y la repetición se abre sin ella.

Nunca se recortan la frase de significación, la marca «†» de lo declarado ni la validación del
archivo.

## 11. Criterios de aceptación (todos vistos correr)

1. `npm test` en verde con M1–M27 vistas en rojo al mutar; typecheck en verde; `npm run e2e` completo
   en verde.
2. `npm run arena:torneo -- --id <id> --tope-usd 12 --participantes …` sin `--confirmar` imprime la estimación y hace
   cero llamadas.
3. Hay un torneo real archivado en `public/torneos/<id>/`. `torneos-archivados.test.ts` reproduce sus
   20 registros. El README y el gasto están en `docs/evidencia/torneo-059/<id>/` y el gasto real es
   menor o igual que el tope.
4. En público:
   - `/arena/torneo` muestra la tabla, la matriz, las métricas y la procedencia en ES y EN y a 360 px,
     sin errores JS ni 5xx;
   - un partido se abre en `/arena` y suena con «Reproducir con narración» (Speech real), con una
     captura en `docs/evidencia/publicacion-059/`;
   - `/api/arena/torneos/<id>/encuentros/99` responde 404.
5. Una fila en BITACORA por la implementación y otra por el despliegue, con el gasto real y las
   deudas nuevas.

## 12. Fuera de alcance

- Lanzar torneos desde el sitio.
- Torneos con modelos no publicados (Grok, gpt-oss) o con narrador o mesa LLM durante el torneo.
- Cambios en el motor, el prompt, el esfuerzo de razonamiento, el límite diario o los presupuestos de
  voz.
- ELO, rankings, intervalos de confianza o «mejor modelo».
- Precalcular las pistas de voz de los partidos del torneo.
- Fabric, AKS, otros idiomas.

## 13. Límites honestos y riesgos

**Límites que el sitio y el README declaran:**

- **Pocos partidos.** 30 partidos de 60 s y 5 cruces por modelo: ningún resultado es significativo
  (p mínima 0,0625). La tabla describe este torneo.
- **La semilla no lo fija todo.** Fija clubes, niveles, condiciones y grada, no la suerte de cada
  jugada: con órdenes distintas, el azar del motor diverge.
- **Motor sintético.** Es un motor 2D con parámetros sintéticos por calibrar y reglas simplificadas;
  no es un partido reglamentario (034). Los goles no son la única medida de calidad.
- **Autoría.** `reproducirArena` prueba que las órdenes archivadas producen exactamente el registro,
  no quién las escribió. La identidad del modelo de cada decisión, los tokens, el `model` devuelto y
  el coste los **declara** el CLI.
- **Coste.** Es el precio de lista por los tokens que informa la API (`usage`), no la factura. La caché
  puede abaratarlo.
- **Mismas condiciones para todos.** Los seis usan el mismo `SISTEMA_ARENA`, ajustado durante el
  desarrollo con modelos GPT, y el esfuerzo «low». Otro prompt u otro esfuerzo pueden cambiar el
  resultado.
- **Latencias.** Dependen de la carga y de la hora, y los deployments se comparten con la arena
  pública. No son un benchmark del modelo.
- **Versiones fijadas.** Las versiones quedan fijas (`NoAutoUpgrade`) y se registran. Un torneo
  posterior con otra versión no es comparable.

**Riesgos:**

- **429 por capacidad compartida** con el público (capacidad 100 por deployment). Puede traer
  partidos anulados y más tiempo. Mitigación: jugar en serie, en hora de poco tráfico, con
  repeticiones acotadas.
- **Astra pesa ≈ 65 % del coste.** Un precio o un uso real mayor que el estimado detiene el torneo por
  la guarda: es **seguro**, pero puede quedar incompleto. Se reanuda subiendo el tope si Carlos lo
  aprueba.
- **Speech en las repeticiones.** Muchas repeticiones narradas pueden agotar el Speech diario
  (800/120.000) y desalojar sesiones retenidas (24). Es el comportamiento actual de cualquier
  grabación, y se declara.
- **El 058 en paralelo.** Puede haber choque en `Arena.tsx` y `ArenaNarracion.tsx`. B3 empieza solo
  tras integrar el 058.
- **Tamaño del repositorio.** ≈ +3,5 MB de registros comprimidos.
- **Resultados incómodos.** Un modelo barato puede ganar. Se publica igual: es honesto, y el diseño
  pareado lo hace defendible.

## 14. Versión 1.0.1 (23 oct): seis participantes

Carlos pidió **llegar a 6 modelos** para el torneo y aceptó añadir créditos si hace falta. GPT-6.1 Sol
(`sol61`, `cronista-sol61`) está en `main` (`4afe3e9`) y pasó su smoke de admisión
(`docs/evidencia/modelos-052/sol61.json`: 22/22 decisiones sin respaldo, máximo 10,7 s). Cambios
respecto de la v1.0, ya aplicados en el cuerpo:

1. **P1 = 6 participantes**, en ida y vuelta: 15 cruces, 30 partidos, 40 decisiones por modelo y 5
   jornadas de 3 partidos por vuelta (§ 2 D3, § 3.3).
2. **Calendario par.** En la ida, cada participante juega 5 partidos: **3 locales y 2 visitas, o 2 y 3**
   (3 de local y 3 de visita en la ida es imposible con 5 partidos). En el torneo, 5 y 5 exactos (§ 3.3,
   M2).
3. **Coste.** ≈ 7,1 USD típicos y ≈ 27,4 USD de cota. **Tope de 12 USD.** Precio de gpt-6.1-sol
   estimado con el de gpt-6-sol y declarado (§ 9).
4. **Duración.** ≈ 20–25 min sin incidencias, hasta ≈ 40 min (§ 9).
5. **Significación.** La p mínima por modelo pasa a 0,0625; sigue sin ser significativa (D5, M11).
6. **Tamaño.** ≈ +3,5 MB de registros comprimidos.
7. **Matriz y tabla a 360 px.** 6 columnas de 46 px más el encabezado de fila de 50 px dan ≤ 328 px.
   El ancho mínimo de celda de § 5.4 baja a 44 px (la altura sigue en 44 px), y el nombre `corto` de
   «6.1 Sol» cabe en 8 caracteres. El e2e 5 lo comprueba.

El ensayo y el e2e siguen con 3 participantes, un número impar, así que también cubren el descanso.

## 15. Versión 1.1 (23 oct): decisiones tras la revisión de Codex

La revisión de Codex de la v1.0.1 dio NO CERRADO: 2 críticos, 7 altos y 4 medios, en la iteración 1 de
3. He comprobado cada hallazgo contra el código y los acepto todos. Además, el coordinador pidió
**simplificar** para que quepa el sábado 24 y el domingo 25. **Esta sección prevalece sobre todo lo
anterior.** Lo que aquí no se menciona sigue vigente si no contradice lo que sigue.

**Qué deja de aplicarse:**

- La garantía «nunca se supera el tope» (D7 y § 3.6).
- La máquina de estados por intento (§ 3.7).
- La ruta `GET /api/arena/torneos/…` y la rama `torneo:` de `/api/arena/grabaciones` (§ 5.1).
- El estado `origenTorneo` fuera del mecanismo de carga (§ 5.3).
- El esquema de § 4.1.
- M26 y M27.
- El calendario de § 10.

### 15.1 Tope por estimación, no garantía monetaria (hallazgos 1 y 2, críticos)

**Lo comprobado en el código:**

- **El segundo intento crece.** El controlador reenvía la observación, la última propuesta y, en el
  segundo intento, también la respuesta anterior y el diagnóstico del validador, de hasta 1.500
  caracteres (`controladores.ts:211`, `:229`). La entrada de ese intento crece por encima del prompt
  observado.
- **El uso solo suma si se lee `usage`.** El adaptador acumula tokens solo cuando lee `usage`
  (`llm-azure-openai.ts:93–94`). Una petición cortada o un 200 sin `usage` no deja rastro.
- **El precio de 6.1 Sol es supuesto.** Viene del de gpt-6-sol.

**Decisión: «tope por estimación» con parada preventiva.** Es el nombre que se usa en el CLI, el
README y el sitio.

**Unidad.** Toda la autorización se calcula en **micro-USD enteros con redondeo al alza**
(`Math.ceil`). Los importes redondeados para mostrar nunca autorizan gasto.

**Máximo estimado por intento HTTP** del participante m:

```
microMaxIntento(m) = ceil(entradaMax × precioEntrada_m + ARENA.tokensOrdenes × precioSalida_m)
entradaMax = ceil(P × SMOKE_MODELOS_ARENA.factorEntradaReintento) + ARENA.tokensOrdenes + TORNEO_ARENA.reserva.margenCorreccionTokens
```

- `P` es el mayor `promptMax` de cualquier partido de 60 s en `docs/evidencia/modelos-052/*.json`
  (hoy 9.928).
- El término `+ tokensOrdenes + margen` cubre la respuesta anterior y el diagnóstico del segundo
  intento.
- Es una estimación, no un límite que imponga el proveedor.

**Reserva de un partido.**

```
reservaPartido = Σ lados  rondas × ARENA.intentosOrdenes × (1 + TORNEO_ARENA.http.reintentos) × microMaxIntento(m)
```

- `rondas` es `ceil(duracionS / intervaloS)`.
- Cuenta **cada intento HTTP potencialmente facturable**, incluidos los reintentos de transporte.
- Los reintentos bajan de 3 a **2**, para que la reserva sea útil.

**Parada preventiva.** Antes de cada partido (y de cada repetición) tiene que cumplirse
`gastoConocido + reservaPartido ≤ tope`. Si no se cumple, el CLI sale con código 3 y se reanuda con un
tope mayor.

**`gastoConocido`:**

- se suma, por cada intento cerrado, el coste de su `usage` cuando lo hay;
- un intento **sin `usage`** (red, cancelación, 5xx, 429, 200 sin `usage`) cuenta su `microMaxIntento`
  entero;
- una reserva abierta sin cierre (el proceso murió) cuenta la `reservaPartido` entera (§ 15.4).

**Límites declarados:**

- El consumo de una petición cortada después de enviarse es **invisible**: se estima por su máximo,
  pero no se puede observar.
- El precio de lista no es la factura.
- **El control real del gasto es la facturación de Azure**, que vigila Carlos con crédito confirmado.

**Cifras:**

| | Astra contra Sol (el partido más caro) | Torneo completo |
|---|---|---|
| Típico | — | ≈ 7,1 USD (sin cambios) |
| Reserva por lado | Astra 6,05 USD; Sol 1,21 USD | — |
| Reserva del partido | **≈ 7,26 USD** | — |
| Peor caso teórico | — | ≈ 92 USD, con todas las llamadas reintentadas al máximo (no es una previsión) |

**Tope por estimación propuesto: 16 USD.** Cabe el típico más la reserva del partido más caro (7,1 +
7,26 ≈ 14,4), con margen para un desvío moderado. Si se detiene, se reanuda con un tope mayor (Carlos
aceptó añadir créditos). `topeMaxUsd` sigue en 20.

### 15.2 Calendario Berger concreto (hallazgo 3, alto)

Lo comprobado: aplicada al pie de la letra, la receta de § 3.3 admite una ida con locales `[3,2,4,2,2,2]`.

**Decisión.** Con n = 6 se usa **esta tabla literal**, sobre los índices 1–6 del orden barajado
(`prngDerivado(semilla, "torneo-059:orden")`). La comprobé con un script: 15 parejas distintas, nadie
repite jornada y locales `[3,3,3,2,2,2]`.

| Jornada | Partido 1 | Partido 2 | Partido 3 |
|---|---|---|---|
| 1 | 1–6 | 2–5 | 3–4 |
| 2 | 6–4 | 5–3 | 1–2 |
| 3 | 2–6 | 3–1 | 4–5 |
| 4 | 6–5 | 1–4 | 2–3 |
| 5 | 3–6 | 4–2 | 5–1 |

(local–visita)

- **Orden de las jornadas.** **No se sortea**: es el de la tabla. Se quita
  `prngDerivado(…, "torneo-059:jornadas")`.
- **Partidos.** Se numeran por jornada y por columna: la ida son los partidos 1–15 y la vuelta los
  16–30, en el mismo orden y con los lados invertidos.
- **Locales en la ida.** Los índices 1, 2 y 3 tienen 3 locales; el 4, el 5 y el 6 tienen 2.
- **Ensayo (n = 3, P1).** Tabla literal con descanso: jornada 1, 1–2 (descansa el 3); jornada 2, 3–1
  (descansa el 2); jornada 3, 2–3 (descansa el 1).
- **Otros n.** Con n = 4 o 5 la función lanza «sin tabla» (P2).
- **Casos esperados en las pruebas.** La tabla de 6 y la de 3, literales. Además: 5 jornadas, 3
  partidos por jornada, ningún descanso con 6, cada pareja una vez por vuelta, ida `[3,3,3,2,2,2]` y
  5/5 en el torneo.

### 15.3 Naturaleza del error y causa terminal (hallazgo 4, alto)

Lo comprobado: `transporteInstrumentado` registra `status: 0` tanto para un fallo de red como para un
aborto por plazo (`smoke-modelos.ts:29`). Un JSON inválido después de recuperar un 429 termina como
`error_controlador` (`controladores.ts:221`).

**Naturaleza de cada intento HTTP**, que registra `transporteTorneo`:

| Naturaleza | Cuándo |
|---|---|
| `ok` | 2xx con cuerpo leído |
| `reintentable` | 408, 429 o 5xx |
| `http_otro` | cualquier otro 4xx |
| `red` | `fetch` lanzó con `init.signal` **no** abortada |
| `abortado` | `fetch` lanzó con `init.signal.aborted`: plazo o cancelación |

Cada intento guarda además `usage` (sí o no) y el `model` devuelto.

**Causa terminal de una decisión** con respaldo, `causaTerminal(decision, intentos)`. Solo cuenta el
**último** intento de la decisión:

| `motivo` | Último intento | Causa |
|---|---|---|
| `orden_invalida` | cualquiera | **modelo** |
| `error_controlador` | `ok` (200 con JSON inválido, truncado, filtro, vacío o malformado) | **modelo**, aunque antes hubiera un 429 |
| `error_controlador` | `reintentable`, `red` o `http_otro` | **infraestructura** |
| `plazo_agotado` | `abortado`, y la decisión tuvo algún intento `reintentable` o `red` | **infraestructura** |
| `plazo_agotado` | `abortado`, sin intentos `reintentable` ni `red` | **modelo** (lento) |

- **Partido anulado.** Un partido con al menos una causa «infraestructura» se anula y se repite. Con
  `repeticionesMax` agotado, queda sin archivo y el torneo queda incompleto.
- **El caso «429 → 200 inválido».** Hay dos intentos de controlador: el primero sufre un 429 que se
  recupera con un 200 de JSON inválido, y el segundo devuelve también un 200 inválido. El último
  intento es `ok`, así que la causa es **modelo**.

### 15.4 Reanudación simple y cerrojo (hallazgos 5 y 6, altos)

**Decisión.** Se elimina la máquina de estados por intento. Directorio de trabajo:
`.cache/arena-torneos/<id>/`.

- **`config.json`.** Se escribe la primera vez y contiene id, participantes, semilla, duración,
  intervalo, `ARENA.version`, `ARENA.reglas` y commit. `--reanudar` exige que sea idéntico; si no,
  aborta.
- **Un partido está hecho** si y solo si `eNN.json.gz` y `eNN.ejecutor.json` existen y
  `validarEncuentro` (§ 15.5) los acepta.
  - Orden de escritura: primero `ejecutor.json`, después el `.gz`, con escritura temporal y `rename`.
  - El `.gz` es el punto de confirmación.
  - Un par incompleto o inválido se borra y el partido **se vuelve a jugar entero**.
  - Al reanudar, se rejuega cualquier partido sin un archivo válido. No hay más estados.
- **Libro de gasto de solo anexión**, `gasto.ndjson`:
  - antes de cada intento de partido se anexa `{ n, intento, tipo: "reserva", microUsd }`;
  - al terminarlo, por la razón que sea, `{ n, intento, tipo: "cierre", microUsd, resultado }`;
  - `microUsd` del cierre es el gasto conocido de § 15.1;
  - una reserva sin cierre cuenta entera;
  - `gastoConocido` es una suma sobre este libro, sin más reconciliación.
- **Ctrl+C.** Cierra el intento en curso con el uso conocido más el máximo de cada intento sin
  `usage` y sale con 130.
- **Repeticiones.** Una repetición por infraestructura es un intento más del mismo partido, hasta
  `1 + repeticionesMax` intentos por ejecución del CLI. Un partido sin archivo al acabar queda en
  `pendientes`, y una reanudación lo vuelve a intentar.
- **Cerrojo:**
  - es el archivo `cerrojo`, creado con `open(…, "wx")`, con `{ pid, inicioUtc }` validado por un
    esquema;
  - `--liberar-cerrojo` lo borra **solo** si `process.kill(pid, 0)` lanza con `code === "ESRCH"`;
  - un `EPERM` o un contenido inválido rechazan la liberación;
  - **límite declarado:** no protege frente a dos liberadores concurrentes. Es un CLI de un solo
    operador.

### 15.5 Validación compartida y página solo con datos validados en CI (hallazgos 7 y 8, altos)

Lo comprobado: `contenidoCanonico` excluye controlador, origen, motivo, tiempo y llamadas
(`coordinador.ts:110–116`). La coherencia interna de § 4.1 no detecta goles cambiados con una
aritmética consistente.

**`validarTorneo(t, leer)` y `validarEncuentro(e, plan, participantes, bytesGz)`.** Son puras, viven en
`src/arena/torneo.ts` y las usan **el CLI** (antes de dar por hecho un partido y al escribir
`torneo.json`) y **CI** (`torneos-archivados.test.ts`). El servidor no valida registros en P1; ver
abajo.

`validarEncuentro` comprueba, por partido:

1. `sha256(bytesGz) === e.archivoSha256` (huella del archivo **íntegro** tal como se publica).
2. Se descomprime (como mucho `ARENA.archivoMaxBytes`) y pasa `reproducirArena`.
3. `config.duracionS`, `config.intervaloS`, `version` y `reglas` coinciden con el torneo, y
   `config.partido.seed === plan.seed`.
4. Los clubes coinciden con `config.partido.local/visita.nombre`.
5. Cada decisión de cada lado lleva el `controlador` del participante que el plan pone en ese lado.
6. `goles` coincide con `final.marcador`.
7. Las 6 cifras del 049, **recalculadas** con `cifrasEquipos` y `pasesIntentados`, coinciden.
8. Los declarados que constan en el archivo (`tiemposMs`, `llamadas`, motivos) coinciden con el
   archivo.

`validarTorneo` además exige:

- `encuentros` más `pendientes` igual al plan completo;
- **30** partidos en el torneo real de 6;
- `n` sin repetir;
- el esquema estricto de § 15.6.

**Página.** Lee **solo** `public/torneos/<id>/torneo.json`, generado por el CLI y comprobado en CI con
los 30 registros. En tiempo de ejecución aplica el esquema y la coherencia interna y, si fallan, no
muestra ninguna cifra.

**Despliegue.** Solo se despliega desde un commit con CI en verde. Es un requisito de proceso,
declarado; la comprobación automática del estado de CI en el script de despliegue queda en P2.

**Rótulos:**

| Rótulo | Qué cubre |
|---|---|
| **Recalculado por el motor** | goles, clubes, configuración, semilla y cifras del 049 |
| **Declarado por el ejecutor** (con la huella SHA-256 del archivo íntegro) | latencias, llamadas, motivos de respaldo, identidad del modelo por lado, tokens, coste y modelos devueltos |

La huella canónica (`contenidoCanonico`) se mantiene solo para la reproducción.

### 15.6 Esquema único y estricto (hallazgo 9, medio)

Sustituye a § 4.1. Todos los objetos usan `z.strictObject`. Los micro-USD son enteros. El mismo módulo
define los esquemas de `config.json`, `eNN.ejecutor.json`, `gasto.ndjson`, `cerrojo` y `torneo.json`.

```ts
PrecioTorneo      = { entrada: number; salida: number; cache: number | null;   // USD por millón (precios.json)
                      fuente: string; consultadoUtc: string; estimadoDe: string | null }  // "cronista-sol6" para sol61
ParticipanteTorneo = { id; nombre /* ← nombrePublico */; corto; deployment /* ← nombre */; modelo; version;
                      llm: "azure-openai" | "foundry-modelos"; controlador; formatoJson: string | null;
                      esfuerzo: "low" | "minimal" | null; precio: PrecioTorneo }
IntentoHttp       = { naturaleza: "ok" | "reintentable" | "http_otro" | "red" | "abortado"; status: number | null;
                      conUso: boolean; ronda: number }
DeclaradoLado     = { tiemposMs: number[]; llamadas: number[]; motivos: string[];           // constan en el archivo
                      intentos: IntentoHttp[]; entrada: number; salida: number; cache: number;   // sumas de usage conocidos
                      sinUso: number; costoMicroUsd: number /* conocido + máximo de cada intento sin usage */;
                      modelosDevueltos: string[] }
LadoEncuentro     = { participante: string; club: string; goles: number;
                      cifras: { posesionPct; remates; rematesDirectos; pasesCompletados; pasesIntentados; recuperaciones }; // number | null
                      declarado: DeclaradoLado }
EncuentroTorneo   = { n; jornada; cruce; vuelta: boolean; seed; archivo /* "eNN.json.gz" */; archivoSha256; intento: number;
                      local: LadoEncuentro; visita: LadoEncuentro }
TorneoArchivado   = { version: "059-v1.1"; id; tipo: "real" | "ensayo"; titulo: { es; en }; inicioUtc; finUtc; commit;
                      motor: { version; reglas }; duracionS; intervaloS; semilla; participantes; encuentros; pendientes: number[];
                      gasto: { conocidoMicroUsd; tipicoMicroUsd; topeMicroUsd; reservaMaxPartidoMicroUsd }; estado: "completo" | "incompleto" }
EjecutorEncuentro = { n; intento; archivoSha256; local: DeclaradoLado; visita: DeclaradoLado }   // eNN.ejecutor.json
```

- **Mapeo desde el catálogo:** `nombrePublico` → `nombre`, `nombre` → `deployment`.
- **Precio.** Un participante sin precio aborta, **salvo** `cronista-sol61`. Ese recibe el de
  `cronista-sol6` con `estimadoDe: "cronista-sol6"`, mientras `precios.json` no tenga el suyo.

### 15.7 Redacción estadística acotada (hallazgo 10, medio)

Sustituye la plantilla `significacion` de § 5.5 y los textos de D4, D5 y § 13.

- **ES:** «En una prueba de signos ilustrativa —que supone cruces independientes y una probabilidad de
  ½ de ganar cada uno—, ni ganar los {c} cruces alcanzaría p < {alfa} (p = {p}). La tabla describe
  este torneo; no ordena los modelos por calidad.»
- **EN:** «In an illustrative sign test — assuming independent pairings, each with a ½ chance of
  winning — even winning all {c} pairings would not reach p < {alpha} (p = {p}). The table describes
  this tournament; it does not rank the models by quality.»
- **Sobre el pareo, ES:** «Cada modelo juega con los dos clubes y en los dos lados de cada cruce; eso
  reparte las condiciones entre los modelos, no elimina su efecto.»
- **Sobre el pareo, EN:** «Each model plays both clubs and both sides of every pairing; this spreads
  the conditions across models, it does not remove their effect.»

No se afirma que «ningún resultado es significativo» ni que el pareo neutralice nada «exactamente».

### 15.8 Integración con la carga existente de `Arena.tsx` (hallazgo 11, medio)

Lo comprobado:

- `ejecutar` ya cancela la solicitud previa y descarta las respuestas no vigentes (`solicitud.current
  !== controlador`, `Arena.tsx:166–190`).
- El 057 registra cualquier registro completo por subida (`{ registro }`, procedencia «declarada»).
- El 058 limita su activación automática a las sesiones propias en directo; los enlaces compartidos y
  las repeticiones siguen pidiendo la pulsación.

**Decisión.** No hay rutas de servidor nuevas en P1:

- **Carga.** `ejecutar` acepta el payload `{ torneo: id, encuentro: n }`, dentro del **mismo**
  `AbortController` y de la misma comprobación de vigencia:
  1. `fetch("/torneos/<id>/eNN.json.gz")`;
  2. `new Response(cuerpo.pipeThrough(new DecompressionStream("gzip"))).json()`;
  3. `POST /api/arena` `{ accion: "reproducir", registro }`, como ya hacen los ejemplos.
- **Narración.** `archivoActual` queda en `null`, así que la narración usa la rama `{ registro }` del
  057, que rotula la procedencia «declarada». Es honesto: la identidad la declara el ejecutor.
- **Procedencia.** El estado `origenTorneo` (club y modelo por lado, desde `torneo.json`) solo se fija
  si la solicitud sigue vigente. Se **limpia** en:
  - el inicio de cada `ejecutar`, con cualquier payload;
  - `recibirPreparado`;
  - `actividadDirecto(true)`;
  - `cargar`.
- **Precedencia de parámetros:**
  - `partido` gana sobre `torneo`;
  - `vista=buffer` sigue igual;
  - `torneo` sin `encuentro` válido (dos dígitos que existen en `torneo.json`) se ignora.
- **Sin `DecompressionStream`.** Se muestra el error del patrón actual, con el texto «Este navegador no
  puede abrir el registro comprimido».
- **El 058 no activa la narración en estas repeticiones.** Se pulsa Reproducir con «Con narración»
  (057).

### 15.9 Pruebas independientes (hallazgo 12, alto)

Sustituye M26 y M27 y corrige M22, M25 y el e2e 1.

- **Clasificación.** Tres fixtures construidos a mano (6, 4 y 3 participantes) con **tablas esperadas
  literales**, calculadas a mano y explicadas en un comentario:
  - empates por DG y por GF;
  - una liguilla de 3 que se separa en 1 + 2 y vuelve a aplicarse;
  - un empate irreducible con posición compartida.

  La recursión termina cuando un grupo ya no se divide. El e2e compara la tabla del fixture de ensayo
  con valores literales, no con `clasificar`.
- **Coste.** Casos con valores literales en micro-USD calculados a mano:
  - Astra, 9.240 de entrada y 441 de salida sin caché: 92.400 + 22.050 = **114.450 µUSD**;
  - un caso con caché;
  - un intento sin `usage`, que vale `microMaxIntento`.
- **Redacción de secretos.** `redactar(texto, secretos)` y `detectarSecretos(texto, secretos)` van
  separados. Un **registro** con un secreto **aborta**: no se redacta, porque eso rompería su
  validación. `torneo.json` y `ejecutor.json` se redactan y después se **detecta**; si queda algún
  secreto, aborta. Después de cualquier transformación (gzip, redacción) se vuelve a validar.
- **Los 30 registros.** `torneos-archivados.test.ts` exige en el torneo real `encuentros.length +
  pendientes.length === 30` y llama a `validarEncuentro` sobre cada uno.

**Mutaciones nuevas** (cada una aplicada, vista en rojo y revertida):

| # | Mutación |
|---|---|
| N1 | Tabla Berger con la orientación del círculo al pie de la letra, que da `[3,2,4,2,2,2]` |
| N2 | `429 → 200 inválido` atribuido a infraestructura |
| N3 | `abortado` tratado como `red` |
| N4 | Un intento sin `usage` contado como 0 |
| N5 | Reserva sin los reintentos HTTP |
| N6 | Redondeo hacia abajo en la autorización |
| N7 | Reserva sin cierre ignorada en el libro |
| N8 | Liberar el cerrojo con `EPERM` |
| N9 | Par `ejecutor.json`/`.gz` incompleto dado por hecho |
| N10 | `config.json` distinto aceptado al reanudar |
| N11 | Cifra del 049 alterada en `torneo.json` sin que falle `validarEncuentro` |
| N12 | `tiemposMs` alterado en el archivo sin que cambie `archivoSha256` |
| N13 | `origenTorneo` sin limpiar al abrir otro registro |
| N14 | Respuesta tardía de un encuentro que reemplaza al elegido después |
| N15 | Redactar el registro en lugar de abortar |

### 15.10 Fechas, CI y alcance simplificado (hallazgo 13, medio, y pedido del coordinador)

- **Fechas.** El 23 de octubre de 2026 es **viernes** (lo comprobé con `date`). El 24 es sábado, el 25
  domingo y el 26, lunes, es la entrega.
- **CI obligatorio.** Los commits con datos del torneo **no** llevan `[skip ci]`: CI tiene que validar
  los 30 registros.

**P1:**

1. CLI con calendario Berger, transporte con naturaleza, causa terminal, tope por estimación, libro de
   gasto, archivos por partido y cerrojo. Al final escribe `torneo.json` y un
   `docs/evidencia/torneo-059/<id>/resumen.md` mínimo (tabla, matriz, gasto y frase de § 15.7,
   generado por las mismas funciones).
2. `validarTorneo` y `validarEncuentro` compartidas, el test de CI sobre los archivos y el fixture de
   ensayo.
3. Página `/arena/torneo` que lee el JSON estático. Muestra cabecera con fecha, modelos, versiones y
   coste total declarado, la frase de § 15.7, la tabla, la matriz y la lista de partidos con «Ver
   repetición». Va en ES/EN, a 360 px y con la accesibilidad de § 5.4.
4. La carga en `Arena.tsx` (§ 15.8) y el enlace «Torneo» en la barra superior.
5. Las pruebas de § 15.9 y las de § 7 que siguen vigentes (M1–M12, M15, M18 y M20–M25 con las
   correcciones de arriba), y el e2e 1, 2, 4 (solo el botón de idioma), 5, 6 y 8.
6. **El torneo real, jugado el sábado 24.**

**P2:** todo lo demás, en este orden:

1. Tabla de métricas por modelo en la página. Los datos ya quedan en `torneo.json` desde P1, porque el
   torneo real no se vuelve a jugar.
2. Sección de procedencia completa.
3. Parámetro `?lang=es` y enlaces con idioma.
4. «Jugar este cruce en vivo».
5. Archivo de los partidos anulados.
6. Validación de registros en el servidor y ruta GET.
7. Comprobación automática de CI en el despliegue.
8. Referencia programada, torneos nulos y segunda edición.
9. README completo con la p por modelo.
10. Calendarios de 4 y 5 participantes.
11. Enlace desde la portada.

**Estimación v1.1** (horas de agente):

| Tarea | Horas |
|---|---|
| Puras (Berger, clasificación, signos, micro-USD, esquemas) con fixtures a mano | 2,5 |
| Orquestador y CLI (transporte, causas, reserva y libro, archivos, cerrojo, resumen) | 4 |
| Validación compartida, test de CI y fixture de ensayo | 1,5 |
| Torneo real (≈ 30–45 min de reloj) y commit con CI | 1 |
| Página y CSS | 3 |
| Integración en `Arena.tsx` | 1,5 |
| e2e | 2 |
| Revisión de Codex de la implementación y correcciones | 2,5 |
| Despliegue y smoke | 1 |
| **Total** | **≈ 19 h**, frente a 25,5 en la v1.0.1 |

**Calendario** (America/Guatemala; el 058 compite por el mismo tiempo el 24 y el 25):

| Día | Trabajo |
|---|---|
| **Vie 23** (noche) | Codex revisa la v1.1. Si queda cerrada, Opus empieza las puras (solo archivos nuevos). |
| **Sáb 24** | Por la mañana, el CLI y la validación. **A las 14:00**, el CLI en verde con el ensayo; si no, se escala a Carlos. **Hacia las 15:00**, ensayo en seco con la estimación, confirmación de Carlos y torneo real. **A las 18:00**, el torneo archivado con CI en verde. Por la noche, la página. |
| **Dom 25** | Por la mañana, la página, la integración en `Arena.tsx` (sobre el 058 integrado) y el e2e. Por la tarde, la revisión y las correcciones. **Corte a las 18:00**: si el sitio no está en verde, se publica solo el torneo (JSON, registros descargables y `resumen.md`) y la página no se despliega. Si está en verde, despliegue y smoke antes de las 22:00. |
| **Lun 26** | Entrega. Nada del 059. |

**Constantes v1.1** (cambian respecto de § 6):

- `http.reintentos: 2` y `http.esperasMs: [2_000, 5_000]`;
- se elimina `decimalesUsd`, porque la autorización va en micro-USD enteros;
- se añade `reserva: { margenCorreccionTokens: 512 }`;
- se añade `topePropuestoUsd: 16`, solo como texto de ayuda del CLI: `--tope-usd` sigue siendo
  obligatorio.

El resto sigue igual.

## 16. Versión 1.2 (23 oct): segunda revisión de Codex

La segunda revisión de Codex cerró 11 de los 13 hallazgos. Quedan el 7 (incompleto) y uno nuevo sobre
la causa terminal. **Esta sección prevalece sobre la 15.**

### 16.1 Configuración completa contra la generada (hallazgo 7)

Lo comprobado: `reproducirArena` valida y reproduce **la configuración que recibe**
(`coordinador.ts:120–125`). Un registro con niveles, plantillas, condiciones o formaciones alterados
—pero rejugado con el motor— pasa la reproducción y la huella del archivo, y los puntos 3 y 4 de
§ 15.5 solo contrastan una parte de la configuración.

**Decisión.** En `validarEncuentro`, los puntos 3 y 4 de § 15.5 se sustituyen por:

```ts
const esperada = crearConfigArena({ seed: plan.seed, duracionS: t.duracionS, intervaloS: t.intervaloS,
  version: t.motor.version, reglas: t.motor.reglas });
if (!isDeepStrictEqual(registro.config, esperada)) throw new Error("Configuración distinta de la prescrita por el plan");
```

- **Transformación del plan.** El plan de P1 **no prescribe ninguna**: no fija formaciones (son
  automáticas por entrenador) ni entorno (sale de la semilla). La igualdad es directa sobre la
  configuración completa: partido, plantillas con niveles, condiciones, variantes, formaciones,
  entrenadores, aficiones, reglas, duración e intervalo.
- **El CLI.** Construye la configuración con esa misma llamada (§ 3.4), así que el CLI y la validación
  no pueden divergir.
- **Los clubes.** Se siguen mostrando desde `config.partido.local/visita.nombre`, que ya cubre la
  igualdad.
- **Límite declarado.** La comprobación ata el archivo al generador actual (`configDeSemilla`,
  `prepararPartido`, `crearConfigArena`). Un cambio futuro de esos generadores, o una nueva
  `ARENA.version`, rompe la validación en CI de los torneos archivados. Para conservarlos habría que
  congelar el generador, como en los fixtures v1–v5. Se prefiere que falle a que pase en silencio.
- **Mutación N16.** Se cambia `config.partido.local.jugadores[0].nivel`, en otro caso
  `config.partido.condiciones.clima` y en otro `config.formaciones.local`. Se rejuega el partido con
  `ejecutarArena` usando las órdenes archivadas sobre esa configuración, para que `reproducirArena`
  pase, y se recalculan `archivoSha256` y las cifras. `validarEncuentro` **tiene que rechazarlo**.
  Caso de control: el registro original pasa.

### 16.2 Plazo agotado durante la espera entre reintentos (hallazgo nuevo)

Lo comprobado: el transporte espera antes de reintentar (§ 3.5) y el coordinador devuelve
`plazo_agotado` cuando vence el plazo de la decisión (`coordinador.ts:35`, `:51`). Si un 429 llega
cerca del límite y el plazo vence durante esa espera, **no se emite otro `fetch`**: el último intento
sigue siendo `reintentable` y ninguna fila de la tabla de § 15.3 lo cubre.

**El transporte.**

- La espera entre reintentos escucha `init.signal`. Si se aborta durante la espera, rechaza con
  `AbortError` **sin emitir ningún `fetch`**.
- Registra un evento de espera `{ ronda, desdeMs, ms, interrumpida: boolean }` en
  `DeclaradoLado.esperas` (campo nuevo del esquema de § 15.6, `strictObject`).
- No crea ningún intento HTTP ficticio: `intentos` solo contiene peticiones realmente enviadas.

**`causaTerminal` exhaustiva.** Sustituye la tabla de § 15.3. La entrada es el `motivo` de la
decisión y la naturaleza del último intento real: `ok`, `reintentable`, `red`, `http_otro`,
`abortado` o `ninguno`.

| `motivo` | Último intento | Causa |
|---|---|---|
| `orden_invalida` | cualquiera | modelo |
| `error_controlador` | `ok` | modelo (aunque antes hubiera un 429) |
| `error_controlador` | `reintentable`, `red`, `http_otro` o `ninguno` | infraestructura |
| `error_controlador` | `abortado` | infraestructura (aborto sin plazo: cancelación del ejecutor) |
| `plazo_agotado` | `reintentable` o `red` | **infraestructura**: el plazo venció durante la espera entre reintentos, o antes del siguiente `fetch` |
| `plazo_agotado` | `abortado`, con algún intento previo `reintentable` o `red`, o con una espera de la decisión | infraestructura |
| `plazo_agotado` | `abortado`, sin intentos `reintentable` ni `red` ni esperas | modelo (lento) |
| `plazo_agotado` | `ok` | modelo: respondió y el plazo venció antes de su segundo intento de controlador |
| `plazo_agotado` | `http_otro` | infraestructura |
| `plazo_agotado` | `ninguno` | infraestructura |

**Pruebas:**

- **La tabla.** Una prueba enumera las 3 × 6 combinaciones y exige que cada una tenga un resultado
  definido y el esperado, escrito literalmente.
- **El caso «429 → espera → plazo».** Usa reloj controlado (`vi.useFakeTimers`):
  - `fetch` falso que responde 429 con `retry-after-ms: 4000` a los 2.000 ms;
  - `ejecutarArena` con `esperaMs: 5000`;
  - la espera terminaría a los 6.000 ms, más tarde que el plazo;
  - se espera exactamente **1** intento (`reintentable`), **1** espera con `interrumpida: true`,
    **ningún** segundo `fetch` (el contador del `fetch` falso es 1), `motivo: "plazo_agotado"`, causa
    `infraestructura` y el partido anulado.
- **Mutación N17.** Exigir `abortado` como último intento en las ramas de `plazo_agotado`: la
  combinación queda en «modelo» o sin resultado, y la prueba falla.
- **Mutación N18.** Una espera que no escucha `init.signal` y emite el segundo `fetch` tras el plazo:
  el contador del `fetch` falso es 2, y la prueba falla.

La estimación no cambia de forma apreciable (+0,5 h, dentro de las 19 h de § 15.10).

