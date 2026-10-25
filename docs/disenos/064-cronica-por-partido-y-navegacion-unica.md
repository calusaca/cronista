# 064 — Una sola navegación (Arena · Torneo) y una crónica verificada para cada partido de la arena

## Estado

Brief **cerrado v1.2**, domingo 25 de octubre de 2026. Lo escribió Opus como diseñador porque Fable no tiene cupo;
Carlos autorizó que Opus diseñe y Codex revise. No incluye código de producción. Lo implementa `opus-implementador`
bloque por bloque (A, B, C), cada uno publicable por separado.

**Versión 1.2 (25 oct), tras la segunda y última ronda de Codex (1 P1 y 3 P2, aceptados; ver la
[sección v1.2](#versión-12-segunda-ronda-de-codex-prevalece), que prevalece sobre todo).** El coste se presenta como
tope por estimación, no como garantía; la selección de hechos es una sola función para generar y leer; el título
tiene su conjunto temporal; y la e2e del bloque A no depende del B.

**Versión 1.1 (25 oct), tras la revisión de Codex (ronda 1 de 2: 3 P1 y 4 P2, todos aceptados).** Los arreglos ya
están en el texto y la [sección final](#versión-11-decisiones-tras-la-revisión-de-codex-prevalece) los resume y
**prevalece** si algo quedara en contradicción. Lo más importante: las plantillas del acta abren con palabras que V4
admite (los ejemplos de la v1.0 fallaban); «desde fuera del área» exige la posición del remate y no su recorrido; la
entrada y el gasto tienen cotas ejecutables antes de llamar; `equipo` es siempre el nombre del club; el tiro de un gol
se identifica por posición; el tiempo de arena solo se promete como «N s» o en plural; y la raíz por host tiene
prueba propia.

**Decisión de Carlos (25 oct), literal en lo esencial.** La pantalla de crónicas (`/`, `/match/[seed]`, el
`Simulador`) tiene otro menú y otras opciones que la arena, y su información (crónica escrita y verificada, línea de
tiempo) no existe para los partidos de la arena: pertenece a otro simulador, de 90 minutos por semilla y con otros
equipos. Al pulsar «Match reports» desde la arena se acaba en un partido sin relación con el que se veía. Eligió la
**«opción B, la definitiva»**: cada partido de la arena tiene su propia crónica. El menú solo tiene **Arena ·
Torneo** (más ES/EN).

**Sustituye** el § 3 D4 del [061](061-cronica-look-arena-y-volver.md) (navegación «Match reports · League mode · Data ·
Arena» en la barra de las crónicas) y su P2-c. La paleta, los tokens y el «← Arena» del 061 se conservan.

**Convivencia con el 063.** Otro implementador trabaja la publicación 3 del
[063](063-persecucion-atributos-e-identidad.md) (motor `src/arena/**` y tarjetas de alineaciones/entrenador). Este
brief **no modifica** `src/arena/motor.ts`, `persecucion.ts`, `largo.ts`, `atributos.ts`, `controladores.ts`,
`metricas-lote*.ts`, `tipos.ts`, `identidad.ts`, `src/sim/limites.ts` fuera de su bloque nuevo, ni `HANDOFF.md`. Los
cambios en `src/ui/Arena.tsx` (barra, botón, carga por URL) **empiezan cuando la publicación 3 del 063 esté
commiteada**; hasta entonces solo se crean archivos nuevos (§ 9).

## 0. El diseño en quince líneas

1. Una barra única `BarraSitio` (CRONISTA · Arena · Torneo · ES/EN) en arena, torneo, crónica de arena y rutas
   heredadas. La marca lleva a `/arena`.
2. `/` redirige con 307 a `/arena` (conservando la query); con `?perspectiva=` va a `/cronicas`. En el host de la
   demo de crónicas, `CRONISTA_RAIZ=cronicas` mantiene `/` como hoy, para no romper los enlaces ya entregados.
3. La portada de crónicas pasa a `/cronicas`; `/match/[seed]`, `/liga…` y `/datos` siguen por enlace directo, con
   la barra única y una tira propia «Simulador de 90 minutos» que conserva sus enlaces y el formulario.
4. El dataset sintético queda a un clic desde todas las páginas: pie común con «Dataset sintético» → `/datos`.
5. Cada partido completo de la arena tiene una crónica en `/arena/cronica/<huella>`, donde la huella es el SHA-256
   (40 hex) del registro serializado con claves ordenadas.
6. Un Analista de arena determinista (`cronica-hechos.ts`) convierte el registro en ≤ 24 hechos verificables;
   reutiliza el estadista, `rematesPorLado`, `golDeRemate`, `narrarEventoArena` y el tipo `HechoVerificable`.
7. El mismo bucle Cronista ⇄ Verificador de la cadena histórica, extraído de `generarCronica` **sin cambiar su
   conducta**, redacta y verifica la crónica de arena con V1–V8 y una regla de arena: el tiempo va en segundos y
   tiene que ser el del hecho.
8. Redactor fijo: GPT-6.1 Sol (`sol61`) del catálogo, activado con `ARENA_CRONICA_LLM=1`. No es ninguno de los
   modelos que jugaron.
9. Se genera **a demanda**, al pulsar «Crónica / Match report», y se guarda para siempre en el almacén
   (`cronicas-arena/`). Leer una crónica nunca llama a un modelo.
10. Cupo propio: 15 crónicas con modelo por día UTC (`ARENA_CRONICA_DIARIA` lo sustituye), ≤ 3 llamadas cada una.
11. Sin redactor, sin cupo o con fallo: acta determinista de las plantillas del Analista de arena, verificada y
    rotulada como tal. Ese acta es provisional y puede mejorarse más tarde con el modelo.
12. La página tiene el aspecto de la arena: marcador, escudos, quién jugó (con su procedencia), crónica ES/EN con
    estado por frase, «Ver proceso», línea de tiempo de eventos y límites honestos.
13. Clic en una frase: resalta sus eventos; «Ver en la repetición · 0:31» abre la arena en ese segundo.
14. Los partidos del torneo tienen su botón «Crónica» en la página del torneo y en su repetición.
15. Registros v1–v8 (y `arena-v1/v2/v3`) admiten crónica sin campos nuevos: nada se añade a `RegistroArena`.

## 1. Hechos verificados en el código (25 oct, `d1ee955`)

### 1.1 Navegación y rutas

- `/` (`src/app/page.tsx`) renderiza la crónica histórica de `SEMILLA_DESTACADA = 246` con `Simulador` +
  `VistaPartido` + `Pie`. `/match/[seed]`, `/liga`, `/liga/[j]/[p]` y `/datos` usan el mismo `Simulador`.
- `Simulador.tsx:69` es un `<header className="topbar arena-topbar topbar-cronicas">` con marca → `/`, navegación
  «Match reports» (`reports-link`, `/`) · «League mode» (`league-mode`) · «Data» (`data-link`) · «Arena»
  (`arena-link`) y el formulario de simulación (`preset-select`, `seed-input`, `simulate`, `random-match`,
  `.sim-error`). El marco de las crónicas está en inglés (061 D8).
- La barra de la arena (`Arena.tsx:373–375`) tiene marca → `/` con el lema «Team agents lab», «Match reports»/
  «Crónicas» → `/`, «Tournament»/«Torneo» → `/arena/torneo[?lang=es]` y el botón ES/EN («Switch to Spanish» /
  «Cambiar a inglés»).
- La barra del torneo (`ArenaTorneo.tsx:77`, función `Barra`) tiene marca → `/` con el lema «Model tournament»,
  «Match reports»/«Crónicas» → `/`, «Lab»/«Laboratorio» → `/arena` y ES/EN.
- `src/app/error.tsx:15` enlaza «Featured match» → `/`.
- La arena lee `?partido`, `?vista`, `?torneo`, `?encuentro` y `?lang` en un `useEffect` de montaje
  (`Arena.tsx:167–172`); `peticionDeUrl` (`torneo-carga.ts`) da precedencia a `partido` sobre `torneo`.
- No hay `redirect` ni `proxy` en la aplicación. `next.config.ts` no declara `redirects()`. Next es 16.3.8.

### 1.2 Enlaces existentes a rutas de crónica

| Dónde | Enlace | Efecto de este brief |
| --- | --- | --- |
| `README.md:6`, `docs/entrega/pitch.md:44`, `docs/entrega/judges-guide.md:8`, `docs/entrega/despliegue.md:4` | raíz del host de la demo de crónicas (`cronista.…io`) | Ninguno si ese host lleva `CRONISTA_RAIZ=cronicas` o no se redespliega (D3) |
| `README.md:136` | «`npm run dev` → `http://localhost:3000` and `/arena`» | El texto cambia: la raíz local es la arena |
| `docs/entrega/despliegue.md:94` | `/datos` | Sigue igual |
| `docs/entrega/guion-video.md:41, 97` y `scripts/grabar-video-final.mjs:14` | `/match/246` en el host de la arena | La ruta sigue; su barra cambia (§ 3.3). Los `data-testid` que usa el script (`sentence`, `sentence-text`, `llm-label`, `timeline-event`, `open-process`, `process-view`, `verify-bar`) **no cambian**. El script no se toca |
| `docs/arena.md:91` | `/arena?partido=ID` | Sigue igual |
| `scripts/smoke-public.mjs:21` | `get("/")` y espera `data-testid="sentence"` | Pasa a `get("/cronicas")`, que funciona en los dos hosts |
| e2e: `juez`, `vitrina`, `random`, `liga`, `datos`, `reproduccion`, `partido-completo`, `relato-formaciones` | 20 `page.goto("/")` | Pasan a `goto("/cronicas")` (lista cerrada, § 8.4) |
| e2e `actividad.spec.ts:19–21` | desde `/` (`league-mode`, `data-link`) y `.brand` de `/datos` → `/` | Desde `/cronicas`; `.brand` → `/arena` con «Loading page…» |
| e2e `cronica-061.spec.ts`, `arena-identidad.spec.ts:86` | `reports-link`, `arena-link`, `aria-current` en `header`, `a.brand` → `/` | Ajustes de la lista cerrada § 8.4 |
| unitaria `simulador-061.test.tsx` | nav de cuatro enlaces y `header` | Pasa a la tira (§ 8.4) |

### 1.3 La cadena histórica (`src/cadena`, `src/analista`)

- `generarCronica(partido, opciones)` (`cadena.ts:86–184`): guarda de entrada (`validarConfig` + invariantes del
  simulador), `analizar(partido)` → `Hecho[]`, `repriorizar` (007), caché por `(seed, deployment, modo)` re-verificada
  al leer, bucle de 1 + `MAX_REINTENTOS` intentos con `SYSTEM_PROMPT`, `mensajeInicial(hechos)` y `feedback(motivos)`,
  omisión de oraciones rechazadas si V5 aguanta (B6, mejor intento previo), acta (`borradorActa`) como último recurso y
  `asegurarVerificada` al final. Llama `llm.completar(SYSTEM_PROMPT, mensajes)` **sin** `signal` ni `maxTokens`.
- El Verificador ya acepta hechos de arena: `HechoVerificable = Hecho | (Omit<Hecho,"tipo"> & { tipo: "accion_arena" })`
  (`verificador.ts:27`) y `Partido = Pick<PartidoSimulado, "config">`. El plantel sale de
  `config.local/visita.{nombre, jugadores}` y `config.bajas`.
- Las tablas de juicio y de color (`JUICIO`, `EFECTOS_CONDICION`, `CONSECUENCIAS`, `INSOLITOS_JUICIO`, `GRADA_JUICIO`,
  `SANCION_CLUB_JUICIO`) **excluyen** los hechos `accion_arena` (`verificador.ts:505, 581`). Las franjas temporales y
  los periodos leen las claves `minuto`, `desde`, `hasta`, `minuto_desventaja`, `minutos` y `periodo` de `datos`
  (`minutosDe`, `periodosDe`).
- El stub y el fixture de ensayo leen los hechos del bloque `<hechos>` de `mensajeInicial`; no dependen del system
  prompt. El ensayo añade «37 remates» en el primer intento (V3) y corrige en el segundo.
- `src/vista/evidencia.ts:20` filtra los eventos de una oración con `esMacro = /^e\d+$/`: **los ids de la arena
  (`a12`) quedarían fuera**. `estadoOracion`, `historiaDeOracion` y `resumenVerificacion` solo leen la crónica.
- `CajaDeCristal.tsx` (`HistoriaFrase`, `Proceso`) solo depende de `CronicaVerificada`; su marco está en inglés
  (`REGLA_EN`, «Verifier note»).

### 1.4 Lo que la arena ya tiene

- `hechosArena(registro, hastaTick)` (`inteligencia.ts`): un hecho por evento, id `arena:<id>`, texto
  `narrarEventoArena` (`vista.ts`), que ya narra balón largo («lanza un balón largo», `motivo: "largo"`) y remate
  lejano («prueba desde lejos», `motivo: "lejano"`) del 063.
- `contextoNarradorArena` (`narrador.ts`) convierte los últimos hechos en `HechoVerificable` con
  `datos { jugador, equipo, dorsal, distancia, receptor?, distancia_m? }`, y el narrador y el comentarista los
  verifican con `verificarUpdate(…, { config: registro.config.partido }, …)`.
- El estadista (`estadista.ts`) da `rematesPorLado`, atajadas, faltas y tarjetas, cambios, reinicios, proporción de
  acciones y distancia de pase, con `EvidenciaMesa { eventos, intervalo?, fuente? }`. Sus textos con cero
  («Sin remates en los primeros 34 segundos», `estadista.ts:74`) **no pasan V7** si se usan como oración: nunca se
  pensaron como frases de crónica.
- `relato.ts`: `golDeRemate`, `golazo`, `marcadorTrasGol`, `situacionGol`.
- La persecución del 063 **no es un evento**: vive en `EstadoArena.persecucion`. No hay ningún hecho verificable de
  persecución.
- El autogol en el registro lleva `lado` = equipo **beneficiado** (`narrarEventoArena`: «gol para <lado>»). El
  narrador lo pasa como `autogol` con `equipo` = beneficiado (`narrador.ts:27`); el Analista histórico usa
  `equipo` = equipo que lo **sufre** y `beneficiado` aparte (`analista.ts:201`). Este brief sigue la semántica
  histórica y no toca el narrador (deuda D-6).
- Sesiones (`sesiones.ts`): retención de 24 h (`:54`) y como mucho 24 sesiones retenidas (`:137`). Un enlace a una
  sesión **caduca**; no sirve como identidad de una crónica.
- Grabaciones (`/api/arena/grabaciones`): admisión de subidas antes de leer el cuerpo (`admisionSubidas`,
  `PLAY_NARRADO.subida`), `reproducirArena`, `completo(registro)` (`route.ts:22`) y referencia por hash del contenido
  canónico.
- Torneos: `cargarEncuentroTorneo` (cliente) comprueba huella SHA-256 del `.json.gz`, descomprime, `registroDelEncuentro`
  y después la arena valida con `reproducirArena`. En el servidor existen `datosPaginaTorneo(id)`,
  `gestorTorneoSitio().leerArchivo(id, archivo)`, `dirTorneos()`, `descomprimirRegistro` y `sha256`.
- Almacén con plazos por operación, escritura atómica, creación exclusiva (`nuevo: true`) y bytes:
  `almacenTorneosLocal(dir)` / `almacenTorneosBlob(endpoint, contenedor, prefijo)` (`almacen-torneos.ts`), con
  prefijo configurable.
- Cupos: `ENCUENTROS_LLM_DIARIOS = 10` sustituible por `ARENA_LIMITE_LLM_DIARIO` con `enteroPositivoEnv`
  (`sesiones.ts:24`). El host de la arena tiene `CRONISTA_LLM=stub` (`arena-preview.bicep:73`) y narrador `rapido`
  (`:81`); el host de crónicas, `azure-openai` (`app.bicep:54`).
- Catálogo: `sol61` = GPT-6.1 Sol (`infra/modelos-arena.json:63`), precio de lista 2 USD por millón de entrada y 10 USD
  por millón de salida (`docs/evidencia/modelos-052/precios.json:305–309`). El adaptador Azure OpenAI admite
  `maxTokens` y `esquema` (`llm-azure-openai.ts:67–76`).

### 1.5 Fixtures disponibles para la matriz de versiones

`src/arena/__fixtures__/arena-reinicios-v1.json` … `arena-reinicios-v8.json`, `arena-v2.json`,
`public/experimentos/arena-llm-v1.json` (`arena-v1`, 10 s), `arena-llm-v3.json` y `arena-duelo-v3.json` (`arena-v3`,
60 s), `src/arena/__fixtures__/torneos/` y `public/torneos/2026-10-24/e01…`.

## 2. Decisiones

**[D1] Barra única.** Un componente cliente nuevo, `src/ui/BarraSitio.tsx`, es el único `<header>` de todas las
páginas: marca (emblema + «CRONISTA» + lema) → `/arena[?lang=es]`; «Arena» (`data-testid="arena-link"`) →
`/arena[?lang=es]`; «Tournament»/«Torneo» (`data-testid="torneo-link"`) → `/arena/torneo[?lang=es]`; botón ES/EN con
los nombres accesibles de hoy («Switch to Spanish» / «Cambiar a inglés»). `aria-current="page"` según
`seccion: "arena" | "torneo" | null`. Clases `topbar arena-topbar` (reglas Z1 del 047). El lema es uno solo:
«Football agents with evidence» / «Agentes de fútbol con evidencia», oculto a ≤ 480 px como hoy. **No hay** «Match
reports», «League mode» ni «Data» en la barra.

**[D2] `/` lleva a la arena por redirección 307, no montando la arena en `/`.** Motivos:
- una sola URL canónica de la arena (`/arena`): los enlaces compartidos (`?partido=`, `?torneo=`, `?cronica=`), las
  e2e (todas usan `/arena`), `docs/arena.md` y el video siguen valiendo;
- montarla en `/` duplicaría la página `force-dynamic` que simula un partido programado en cada visita, y la
  redirección no añade una entrada de historial;
- 307 (temporal) y no 308: un navegador no la cachea para siempre si hay que volver atrás.
Mecanismo: `src/app/page.tsx` llama a `redirect(destinoRaiz(q))` de `next/navigation` en el servidor (función pura
`destinoRaiz` en `src/vista/raiz.ts`). `destinoRaiz` devuelve `/cronicas?<query>` si la query tiene `perspectiva` (los
enlaces viejos `/?perspectiva=visita` conservan su crónica) y `/arena?<query>` en otro caso, con la query **íntegra y
en su orden**. La e2e N1 exige un **307 HTTP** con `location`; si Next lo emitiera como meta-refresh (contexto de
streaming), el implementador lo mueve a `src/proxy.ts` con `matcher: ["/"]` y la misma función, sin cambiar el
criterio. No se usa `next.config.ts` `redirects()`: se evalúa en el build y no permite el D3.

**[D3] Raíz por host.** Con `CRONISTA_RAIZ=cronicas` (leída en cada petición, no al importar), `/` renderiza la
portada de crónicas en vez de redirigir. Se añade a `infra/app.bicep` (host de la demo de crónicas): los enlaces
«Verified match recap» de README, pitch, guía de jueces y despliegue —y el que Carlos haya pegado en la plataforma—
siguen mostrando la crónica destacada. Si ese host no se redespliega, sigue con el código actual y tampoco cambia. El
host de la arena no la lleva: su `/` es la arena.

**[D4] Portada en `/cronicas`.** `src/app/cronicas/page.tsx` es la portada de hoy (crónica 246, `featured-match`,
etiqueta «Featured match») con `ruta="/cronicas"` para los enlaces de perspectiva. La raíz con `CRONISTA_RAIZ=cronicas`
renderiza el mismo componente con `ruta="/"`.

**[D5] Rutas heredadas por enlace directo, con la barra única y una tira propia.** El `Simulador` deja de ser un
`<header>`: pasa a `<nav className="cronicas-herramientas" aria-label="90-minute simulator">`, debajo de la barra,
con el rótulo visible «90-minute simulator · separate from the arena», tres enlaces —«Featured match»
(`reports-link`, `/cronicas`) · «League mode» (`league-mode`) · «Data» (`data-link`)— y el formulario intacto (mismos
`data-testid`, misma guarda del 061 V2). `aria-current` en la tira según `seccion`. Se conserva el «← Arena»
(`to-arena`) del 061. El marco de estas páginas sigue en inglés (061 D8): el botón ES/EN de la barra cambia la barra y
el `lang` de sus enlaces, no la crónica histórica, que conserva su propio conmutador (límite declarado, § 11.3).

**[D6] Dataset accesible.** Un pie común `src/ui/PieSitio.tsx` en arena, torneo y crónica de arena, con «Every match
is simulated; teams and players are fictitious.» / «Todo partido es simulado; equipos y jugadores son ficticios.» y
dos enlaces: «Synthetic dataset» / «Dataset sintético» (`data-testid="dataset-link"`, `/datos`) y «90-minute
simulator» / «Simulador de 90 minutos» (`/cronicas`). Las páginas heredadas conservan su `Pie` y la tira (D5) con
«Data». `/datos` y `/datos/datasheet` no cambian.

**[D7] Identidad de un partido: huella del registro.** `huellaRegistro(r) = sha256(jsonEstable(r)).slice(0, 40)`, con
`jsonEstable` = `JSON.stringify` con las claves de cada objeto ordenadas de forma recursiva (las listas conservan su
orden). Se aplica al `RegistroArena` validado (salida de `reproducirArena`, de la validación del torneo o el
`.json` de una sesión completa). No depende de la sesión (que caduca a las 24 h) ni del orden de claves del archivo.
Incluye los metadatos declarados de cada decisión (controlador, tiempos), así que dos registros con el mismo juego y
distinta procedencia declarada son dos partidos distintos.

**[D8] A demanda, guardada para siempre, leer no genera.** La crónica se genera solo con `POST /api/arena/cronicas`
(el botón). No se genera al cerrar el partido (casi ningún partido se lee, y obligaría a tocar `sesiones.ts` y el
cierre del 063), ni por *prefetch* (brief 032). Se guarda en el almacén con prefijo `cronicas-arena/` (Blob en
Azure, `.cache/arena-cronicas/` en local). La página y los `GET` solo leen.

**[D9] Redactor fijo, separado de quien jugó.** Con `ARENA_CRONICA_LLM=1`:
- si `ARENA_CRONICA_MODELO` está definido, se usa esa entrada del catálogo (`catalogoModelos()`, exige
  `ARENA_WEB_LLM=1`); en el host de la arena será `sol61` (GPT-6.1 Sol, el modelo con inferencia real probada el 17
  oct para la crónica). Si no está en el catálogo, la petición termina en acta provisional con motivo `redactor` y
  un aviso en el registro del servidor (no tumba la página);
- si no está definido, `crearLlmDesdeEnv(process.env, { maxRetries: 0 })`: el stub en desarrollo y el fixture
  `ensayo` en e2e.
Sin `ARENA_CRONICA_LLM=1` no hay redactor: acta (motivo `desactivado`). Los modelos que jugaron **no** escriben su
propia crónica: sería un juez parcial, el coste dependería del modelo y la comparación entre crónicas no sería justa.

**[D10] Cupo propio.** `CRONICA_ARENA.diarias = 15` generaciones con modelo por día UTC, sustituible por
`ARENA_CRONICA_DIARIA` con el mismo `enteroPositivoEnv` (leído en cada uso). No comparte el cupo de encuentros
(`ARENA_LIMITE_LLM_DIARIO`). Cada generación usa ≤ 1 + `MAX_REINTENTOS` = 3 llamadas (`conPresupuesto`), con
`maxTokens` = `CRONICA_ARENA.maxTokensSalida` y plazos por intento y total. La reserva del cupo se escribe **antes** de
llamar (como `extra()` en `sesiones.ts`): un proceso interrumpido no repite el gasto sin contarlo.

**[D11] Respaldo determinista.** Sin redactor, sin cupo, con fallo del modelo o con la reserva abandonada, la crónica es
el **acta** de los hechos del Analista de arena (`borradorActa`: título = resultado, una oración por hecho), que pasa el
mismo verificador. Se rotula «Deterministic record — template sentences from the arena analyst, no language model» /
«Acta determinista — frases de plantilla del analista de la arena, sin modelo de lenguaje», con el motivo. Ese acta
queda `provisional: true`; una petición posterior con redactor y cupo la sustituye por la del modelo. Un acta a la que
se llega porque el modelo agotó sus 3 intentos sin pasar el verificador es **definitiva** (no se vuelve a pagar).

**[D12] Reutilizar la cadena, no copiarla.** El bucle de redacción y verificación sale de `generarCronica` a una
función exportada, `redactarYVerificar`, sin cambio de conducta (§ 4.4). La crónica de arena la llama con su system
prompt, su verificador extendido y sus opciones de llamada.

**[D13] Del texto al momento.** Al elegir una frase se resaltan sus eventos en la línea de tiempo de la página y aparece
«Watch in the replay · 0:31» / «Ver en la repetición · 0:31», que abre `/arena?cronica=<huella>&t=<s>` (o
`/arena?torneo=<id>&encuentro=<nn>&t=<s>` si el partido es de un torneo), con
`s = max(0, ⌊tick_mín · pasoS⌋ − CRONICA_ARENA.antesDelEventoS)`.

**[D14] Torneos.** «Match report» / «Crónica» en cada partido jugado de la página del torneo (liga y grupos) y en la
repetición de un partido de torneo en la arena, con fuente `{ torneo, encuentro }`: el servidor lee el `.json.gz` del
almacén del torneo, comprueba la huella archivada y valida, sin que el cliente suba nada.

## 3. Bloque A · Navegación única

### 3.1 `BarraSitio` (`src/ui/BarraSitio.tsx`, cliente)

```ts
export type SeccionSitio = "arena" | "torneo" | null;
export function BarraSitio(p: { idioma: "es" | "en"; alCambiarIdioma: () => void; seccion: SeccionSitio }): JSX.Element;
/** Pura, para pruebas: los tres destinos con el `lang` aplicado. */
export function enlacesSitio(idioma: "es" | "en"): { marca: string; arena: string; torneo: string };
```

- Estructura: `<header class="topbar arena-topbar">` → `a.brand` (con `EmblemaCronista`, `.brand-mark`, `.brand-tag`)
  → `<nav class="topbar-links" aria-label="Sections|Secciones">` con «Arena», «Tournament»/«Torneo» y el `button.btn`
  ES/EN. Todos los enlaces con `Enlace` (`prefetch={false}`, aviso del 032).
- La usan: `Arena.tsx` (sustituye las líneas 373–375; `seccion="arena"`), `ArenaTorneo.tsx` (sustituye `Barra`;
  `seccion="torneo"`), la página de crónica de arena (`seccion={null}`) y un envoltorio cliente
  `BarraHeredada` para las páginas del servidor heredadas, que guarda el idioma en estado (inicial `en`, o `es` con
  `?lang=es`).
- **Invariante A1:** en las nueve rutas de la e2e N2 el `header` contiene exactamente dos enlaces de navegación con
  nombres `["Arena", "Tournament"]` (o `["Arena", "Torneo"]`) y un botón. Ninguna página tiene un segundo `<header>`.

### 3.2 Raíz y `/cronicas`

- `src/vista/raiz.ts` (pura): `destinoRaiz(query: URLSearchParams | Record<string, string | string[] | undefined>): string`
  y `raizEsCronicas(env = process.env): boolean` (`env.CRONISTA_RAIZ?.trim() === "cronicas"`).
- `src/ui/PortadaCronicas.tsx` (servidor): el contenido actual de `src/app/page.tsx` con una prop `ruta`.
- `src/app/cronicas/page.tsx`: `force-dynamic`, `<PortadaCronicas ruta="/cronicas" …/>`.
- `src/app/page.tsx`: si `raizEsCronicas()`, `<PortadaCronicas ruta="/" …/>`; si no, `redirect(destinoRaiz(q))`,
  fuera de cualquier `try`.
- `src/app/arena/page.tsx`: `metadata.title` pasa de «Team agents lab — CRONISTA» a «Arena — CRONISTA».
- `src/app/error.tsx`: «Featured match» → `/cronicas`.

### 3.3 Rutas heredadas

`/cronicas`, `/match/[seed]`, `/liga`, `/liga/[j]/[p]` y `/datos` renderizan `BarraHeredada` y después el `Simulador`
convertido en tira (D5). La tira no es un `<header>` ni un `role="region"`. CSS nuevo en un bloque `064` al final de
`globals.css`, bajo `.cronicas-herramientas`: fondo `--surface`, borde inferior `--line`, enlaces `--accent` subrayados,
`[aria-current="page"]` en `--ink` sin subrayado y el formulario con las reglas del 011 y el ajuste del 061 V1 ahora
aplicados a `.cronicas-herramientas` en lugar de `.topbar-cronicas` (la clase `.topbar-cronicas` desaparece; sus reglas
se mueven, no se duplican). **Criterio vinculante:** la e2e N4 (sin desborde de 320 a 1440 px con el error visible).

### 3.4 Pie común

`PieSitio` (D6) va después de `</main>` en `Arena.tsx`, `ArenaTorneo.tsx` y la página de crónica de arena.
`<footer class="footer arena-footer">`; en la arena hereda los tokens de `main.arena-shell` por estar dentro de la
página (`:root:has(main.arena-shell)`).

### 3.5 Lista cerrada de cambios de texto y selectores del bloque A

1. La barra de arena, torneo y heredadas es `BarraSitio`: desaparecen «Match reports»/«Crónicas», «Lab»/«Laboratorio»,
   «League mode», «Data» y los lemas «Team agents lab», «Model tournament» y «Match reports where every sentence shows
   its evidence» de la barra.
2. `a.brand` → `/arena[?lang=es]` en todas las páginas.
3. `arena-link` vive en la barra («Arena», `/arena`); nuevo `torneo-link`.
4. El `Simulador` es la tira `nav.cronicas-herramientas`; `reports-link` dice «Featured match» y va a `/cronicas`; se
   conservan `league-mode`, `data-link`, `preset-select`, `seed-input`, `simulate`, `random-match`, `.sim-error` y
   `.sim-form [role="alert"]`.
5. Nuevo `PieSitio` con `dataset-link`.
6. `/` redirige (D2/D3); nueva ruta `/cronicas`; `error.tsx` → `/cronicas`; título de `/arena`.

Ningún otro texto, `data-testid`, `aria-label` u orden de controles de la arena y del torneo cambia.

## 4. Bloque B · Crónica por partido de la arena

### 4.1 Recorrido

```
botón «Crónica» ──POST /api/arena/cronicas { fuente }──► resolver fuente ─► RegistroArena validado + origen
                                                         │
                                       huella = sha256(jsonEstable(registro))[0:40]
                                                         │
               almacén cronicas-arena/: <h>.registro.json.gz · <h>.origen.json · índices (crear si no existen)
                                                         │
        ¿<h>.cronica.json válido y no provisional? ── sí ──► { huella, url }  (cero llamadas)
                                                         │ no
        seleccionCronicaArena(registro) ─► ¿redactor y cupo? ─ no ─► acta provisional (motivo)
                                                         │ sí: reservar cupo y <h>.reserva.json
                        redactarYVerificar(hechos, { config }, llm, opciones de arena)  ≤ 3 llamadas
                                                         │
                         asegurarVerificada ─► <h>.cronica.json (escritura atómica) ─► { huella, url }
navegador ─► /arena/cronica/<h> (servidor: lee, recalcula hechos, re-verifica; nunca genera)
```

### 4.2 Analista de arena (`src/arena/cronica-hechos.ts`, puro, determinista, sin LLM)

```ts
export interface HechoCronicaArena { hecho: HechoVerificable; evidencia: EvidenciaMesa }
export function hechosCronicaArena(registro: RegistroArena): HechoCronicaArena[];
/** v1.2 · LA selección (catálogo → maxHechos → ajuste a maxCaracteresEntrada). La usan la generación Y la lectura. */
export function seleccionCronicaArena(registro: RegistroArena): { hechos: HechoCronicaArena[]; cabe: boolean };
export const registroCompleto: (r: Pick<RegistroArena, "config" | "final">) => boolean; // la de grabaciones/route.ts:22, movida aquí
```

La ruta de grabaciones importa `registroCompleto` en lugar de su `completo` local (misma expresión). Solo se analizan
registros completos (la función lanza con uno incompleto).

**Catálogo cerrado de hechos** (relevancias en `CRONICA_ARENA.relevancia`, § 6). `segundo(e) = ⌊e.tick · pasoS + 1e-9⌋`,
como `segundosDe` del estadista. `L`, `V`: nombres de los clubes; `nombre (dorsal)` de la plantilla
`inicial.jugadores + inicial.banco`.

| Hecho | `tipo` | Relevancia | `datos` (lista cerrada) | `evidencia.eventos` | Cuándo |
| --- | --- | --- | --- | --- | --- |
| Resultado | `resultado_final` | 100 | `local`, `visita`, `goles_local`, `goles_visita`, `duracion_s` | goles (+ `final_anticipado`) | siempre |
| Gol | `gol_anotado` | 90 | `local`, `visita`, `jugador`, `dorsal`, `equipo`, `segundo`, `marcador_local`, `marcador_visita`, `metros`?, `distancia_m`? | gol + su tiro | cada gol sin `autogol` |
| Autogol | `autogol` | 90 | `local`, `visita`, `jugador`, `dorsal`, `equipo`, `beneficiado`, `segundo`, `marcador_local`, `marcador_visita` | gol | cada gol con `autogol` |
| Varios goles | `doblete_o_mas` | 80 | `jugador`, `equipo`, `goles` | sus goles | ≥ 2 goles sin autogol del mismo jugador |
| Expulsión | `accion_arena` | 75 | `jugador`, `dorsal`, `equipo`, `segundo` | roja (+ falta del mismo jugador con el mismo tick) | cada `roja` |
| Final anticipado | `accion_arena` | 75 | `equipo`, `segundo`, `jugadores` (los que le quedan) | `final_anticipado` | si existe |
| Remates | `accion_arena` | 60 | `local`, `visita`, `remates_local`, `a_puerta_local`, `remates_visita`, `a_puerta_visita` | tiros y desenlaces de `rematesPorLado` | si hay ≥ 1 remate |
| Atajadas de un portero | `accion_arena` | 55 | `jugador`, `dorsal`, `equipo`, `atajadas` | sus `atajada` | cada portero con ≥ 1 |
| Remate lejano | `accion_arena` | 50 | `jugador`, `dorsal`, `equipo`, `segundo`, `metros`, `distancia_m`? | tiro + desenlace | cada `tiro` con `motivo: "lejano"` (v7+), los `maxPorClase.lejanos` de más `metros` |
| Amarilla | `accion_arena` | 45 | `jugador`, `dorsal`, `equipo`, `segundo` | `amarilla` | las primeras `maxPorClase.amarillas` |
| Balones largos | `accion_arena` | 40 | `equipo`, `balones_largos` | sus `pase` con `motivo: "largo"` | cada equipo con ≥ 1 (v7+) |
| Cambio | `accion_arena` | 35 | `equipo`, `entra`, `sale`, `segundo` | `cambio` | los primeros `maxPorClase.cambios` |
| Fueras de juego | `accion_arena` | 30 | `equipo`, `fueras_de_juego` | sus `fuera_juego` | cada equipo con ≥ 1 |

(v1.1: se quitan de la v1.0 los hechos de formación —«4-4-2» se lee como marcador «4-4» en V3— y de condiciones —el
léxico de condiciones exige tipos históricos—.)

Reglas del catálogo:
- **Valores exactos de `datos`.** `local`, `visita`, `equipo` y `beneficiado` son **nombres de club**
  (`config.partido.local.nombre` / `.visita.nombre`), nunca `"local"`/`"visita"`: el Verificador los compara con los
  nombres del resultado (`verificador.ts:439`). En un gol, `equipo` = club del lado del evento (el que marca). En un
  autogol, `equipo` = club del **autor** (el que lo sufre) y `beneficiado` = club del lado del evento. `jugador`,
  `entra` y `sale` son nombres de la plantilla; `dorsal`, `segundo`, `metros`, `distancia_m` y las cuentas, enteros.
- **Tiro de un gol (por posición).** Se extrae de `golDeRemate` (`relato.ts:90`) una función exportada
  `tiroDelGol(gol, registro): EventoArena | null` con su mismo recorrido: desde el índice del gol hacia atrás, el
  primer evento del goleador decide (es el tiro si es `tiro`, con `tick ≤ gol.tick` y el mismo `desde`; si no,
  `null`), y un evento de `CANTO_GOL.gritoRemate.tiposQueRompen` en medio da `null`. `golDeRemate(g, r)` pasa a ser
  `tiroDelGol(g, r) !== null`, sin cambio de conducta (las pruebas de `grito-gol.test.ts` no se editan). Con tiro:
  `metros = Math.round(tiro.distanciaM)` (recorrido del remate hasta su destino).
- **«Desde fuera del área» por geometría.** `distancia_m` (la clave que lee la regla `FUERA_DEL_AREA`, ≥ 17 m) se
  incluye **solo** si el remate salió de fuera del área rival: `!enAreaRival(tiro.desde, tiro.lado)` (`ataque.ts:17`),
  y entonces vale `metros`. Si salió de dentro, no hay `distancia_m` y la frase se rechaza; si salió de fuera con un
  recorrido redondeado < 17 m, también (conservador). `metros` permite decir la cifra («remató desde 28 m») sin
  habilitar la afirmación de posición.
- **Ids:** `c01`, `c02`, … por relevancia descendente; a igual relevancia, por el tick del primer evento; a igual tick,
  por el orden de la tabla. **Recorte:** los hechos con relevancia ≥ `COBERTURA` (70) se conservan siempre; el resto
  se recorta hasta `CRONICA_ARENA.maxHechos` en ese orden, y después hasta que la entrada quepa (§ 4.5).
- **Textos** (ES/EN, en el propio módulo, no en `limites.ts`): frases afirmativas, sin negaciones, sin interrogación,
  sin juicios ni causas, con el tiempo como «a los 34 s» / «after 34 s», y solo con los nombres de la plantilla y de
  los clubes. **Cada texto empieza por una palabra de `FUNCIONALES[lengua]` (`lexico.ts:539`) o por un nombre del
  plantel**, y ninguna otra palabra lleva mayúscula: el léxico **no se amplía**. No incluyen nombres de entrenadores
  ni del árbitro, motivos declarados por un entrenador LLM (texto libre), nombres de modelos ni controladores.
  Ejemplos normativos (ES / EN), que la unitaria 5 verifica literalmente con un registro de prueba:
  - «Final: Juventud Islaverde Sur 2, Atlético Montefrío Bajo 1, en 60 s de juego.» / «Final score: Juventud
    Islaverde Sur 2, Atlético Montefrío Bajo 1, after 60 s of play.»
  - «Gol de Ana Ruiz (9) para Juventud Islaverde Sur a los 34 s; marcador: Juventud Islaverde Sur 1, Atlético
    Montefrío Bajo 0.» / «Goal by Ana Ruiz (9) for Juventud Islaverde Sur after 34 s; score: Juventud Islaverde Sur
    1, Atlético Montefrío Bajo 0.»
  - «Gol en propia puerta de Pablo Gil (4), de Atlético Montefrío Bajo, a los 50 s: …» / «An own goal by Pablo Gil
    (4), of Atlético Montefrío Bajo, after 50 s: …»
  - «Juventud Islaverde Sur remató 5 veces, 2 a puerta; Atlético Montefrío Bajo remató 3 veces, 1 a puerta.» /
    «Juventud Islaverde Sur had 5 shots, 2 on target; Atlético Montefrío Bajo had 3 shots, 1 on target.»
  - «Atajadas de Luis Paz (1), de Atlético Montefrío Bajo: 3.» / «Saves by Luis Paz (1), of Atlético Montefrío
    Bajo: 3.»
  - «Roja para …», «Amarilla para …» / «Red card for …», «Yellow card for …»; «En Juventud Islaverde Sur entró … por
    … a los 45 s.» / «In Juventud Islaverde Sur, … replaced … after 45 s.»
  - «Final anticipado a los 120 s: Atlético Montefrío Bajo se quedó con 6 jugadores.» / «Final whistle after 120 s:
    Atlético Montefrío Bajo were left with 6 players.»
  Si una clase con relevancia < 70 no logra una plantilla que pase I4 en toda la matriz, el implementador puede
  quitarla y lo anota; no puede cambiar el léxico ni el Verificador histórico.
- **Claves prohibidas en `datos`:** `minuto`, `desde`, `hasta`, `minuto_desventaja`, `minutos`, `periodo` (las leen
  las franjas y los periodos del Verificador: la arena no tiene minutos ni tiempos), y ningún tick: un tick en
  `datos` habilitaría su número para V3.
- **Evidencia:** `hecho.eventos === evidencia.eventos`, en el orden del registro, ⊆ ids de `registro.eventos`. Solo el
  resultado 0–0 puede tener `eventos` vacíos; lleva `evidencia.intervalo = [0, final.tick]` y `fuente: "inicial"`.
- **Versiones:** con `arena-v1`/`v2` (sin banco, sin entrenadores, sin árbitro, sin `motivo`) el catálogo se reduce sin
  lanzar. Sin eventos v7 no hay remates lejanos ni balones largos.

### 4.3 Verificador: qué se aplica a una crónica de arena

`src/arena/cronica-verificador.ts`:

```ts
export function reglasTiempoArena(draft: CronicaDraft, hechos: HechoVerificable[]): Motivo[];
export function verificarCronicaArena(draft: CronicaDraft, hechos: HechoVerificable[], config: SimConfig): Motivo[]; // verificarDraft + reglasTiempoArena
```

| Regla | Sobre eventos de arena | Qué hechos la habilitan |
| --- | --- | --- |
| V1 esquema | igual | — |
| V2 ids | igual (ids `cNN`) | — |
| V3 cifras, marcadores, margen, periodo | igual; los periodos y «primer/segundo tiempo» **siempre** se rechazan (no hay `periodo`) | números de `texto_*` y `datos` del principal |
| V3 tiempo de arena (**nueva, solo arena**) | «N s» y «N segundos» (ES), «N s» y «N seconds» (EN) exigen `N ∈ {segundo, duracion_s}` del principal; cualquier número junto a «minuto(s)» / «minute(s)» se rechaza. El singular («1 segundo», «1 second») y «segundo N» / «second N» **no se prometen**: el V3 histórico lee «segundo»/«second» como el ordinal 2 (`lexico.ts:71`) y los rechaza; el prompt pide «N s» | `segundo`, `duracion_s` (en el **título**, que no tiene principal: solo `duracion_s` del resultado) |
| V4 nombres | igual: entrenadores, árbitro, modelos, controladores y sectores de afición **no** son del plantel y se rechazan | `config.partido` |
| V5 cobertura y narración | igual con `COBERTURA = 70`: resultado, goles, autogoles, varios goles, expulsiones y final anticipado son obligatorios | relevancias del § 4.2 |
| V6 ES = EN | igual | — |
| V7 negaciones | igual; «B no marcó» solo con el resultado de B en cero como principal | `goles_*` = 0 |
| V8 juicio, franjas, computables | igual. Con `resultado_final`, `gol_anotado`, `autogol` y `doblete_o_mas` se habilita lo que esos tipos habilitan hoy («goleada» con margen ≥ 3, verbos de resultado con el sujeto correcto, «gol de la victoria», «definitivo», «en propia puerta», y «desde fuera del área» solo con `distancia_m ≥ FUERA_DEL_AREA_M`, clave que el § 4.2 pone únicamente cuando el remate salió de fuera del área por geometría). Las franjas («al final», «temprano») se rechazan siempre (no hay minutos). Los juicios de color y «en inferioridad» se rechazan siempre (exigen tipos históricos) | tipos reales del § 4.2 |

`reglasTiempoArena` devuelve motivos con regla `V3` (ninguna letra nueva: la UI y `feedback` ya la explican),
`oracion` = índice (−1 y prefijo «título: » para el título) y detalle «tiempo «34 s» no coincide con el segundo del
hecho (31)». Busca en ES y EN por separado sobre el texto normalizado (`normalizar` del verificador) con
`(?<![\d.,])(\d+)\s*(?:s|segundos)(?![\p{L}])` (ES), `(?<![\d.,])(\d+)\s*(?:s|seconds)(?![\p{L}])` (EN) y
`(\d+)\s*(?:minutos?|minutes?)(?![\p{L}])` / `(?:minutos?|minutes?)\s+(\d+)` para el rechazo de minutos. El
patrón «m:ss» no se trata: sus números ya los juzga V3 (el «0» de «0:34» no está en ningún hecho) y el prompt pide
segundos.

**Lo que este verificador no comprueba** (se declara en la página y en el § 11): causas, intenciones y tácticas
(«presionó», «persiguió», «se replegó», «cambió el sistema para…»), cualidades del remate o del pase fuera de la tabla
(«potente», «preciso», «filtrado»), relaciones espaciales salvo la distancia del remate («por la banda», «al
segundo palo»), el papel de una cifra fuera de marcadores y tiempo (un dorsal dicho como cantidad pasa V3), y
cualquier frase de prosa libre que no toque las familias mantenidas (la clase del 10 oct sigue abierta).

### 4.4 Cadena: extraer el bucle sin cambiar su conducta (`src/cadena/cadena.ts`)

```ts
export interface OpcionesRedaccion {
  system?: string;                                    // por defecto SYSTEM_PROMPT
  perspectiva?: string;                               // la de 007, por defecto ninguna
  verificarExtra?: (draft: CronicaDraft) => Motivo[]; // se suma a verificar/verificarDraft en cada intento y al final
  opcionesLlm?: (intento: number) => OpcionesLlm;     // por defecto undefined: la llamada de hoy, sin opciones
  feedback?: (motivos: Motivo[]) => string;           // por defecto `feedback` de prompt.ts
  /** Antes de cada intento: si devuelve false, no se llama y el bucle termina como si se agotaran los intentos. */
  antesDeLlamar?: (system: string, mensajes: Mensaje[], intento: number) => boolean;
  /** Una salida más larga cuenta como intento fallido con motivo V1 y no se reenvía en la conversación. */
  maxCaracteresRespuesta?: number;
}
export async function redactarYVerificar(hechos: HechoVerificable[], partido: Pick<Partido, "config">, llm: Llm,
  opciones?: OpcionesRedaccion): Promise<{ cronica: CronicaVerificada; huboErrorLlm: boolean }>;
```

- Contiene exactamente el código de `cadena.ts` desde `const audit` hasta el `asegurarVerificada` final (bucle, B6,
  omisión, acta). `generarCronica` conserva su firma, su guarda, su caché y su regla «no cachear si hubo error del LLM»
  y llama a `redactarYVerificar(hechos, partido, llm, { perspectiva })`.
- `asegurarVerificada`, el veredicto de cada intento, la elección del mejor intento previo y la omisión usan
  `motivos = [...verificar…, ...verificarExtra(draft)]`.
- Con `opcionesLlm` ausente, `llm.completar(system, mensajes)` se llama con **dos** argumentos, como hoy (las pruebas
  existentes con dobles de `Llm` lo detectan).
- Los tipos de `borradorActa`, `tituloActa`, `cobertura` y `mensajeInicial` se amplían de `Hecho[]` a
  `HechoVerificable[]` (solo tipos).

### 4.5 Redactor, prompt, coste y cupos (`src/arena/cronica.ts`)

- `SISTEMA_CRONICA_ARENA` = `SYSTEM_PROMPT` + un anexo fijo: «Es un encuentro sintético de N segundos en un motor 2D.
  El tiempo se cuenta en segundos («a los 34 s»), nunca en minutos ni en tiempos; no hay primer ni segundo tiempo. No
  nombres entrenadores, árbitro, modelos ni controladores. No afirmes persecuciones, presión, intenciones, tácticas ni
  causas: solo lo que dice cada hecho.» (y su versión en inglés en la misma cadena). El mensaje del usuario es
  `mensajeInicial(hechos)` **sin cambios**, para que stub y ensayo funcionen igual.
- Llamada: `opcionesLlm = () => ({ signal: AbortSignal.any([AbortSignal.timeout(plazoIntentoMs), total]), maxTokens:
  maxTokensSalida, esquema: { nombre: "cronica_arena", json: esquemaCronicaArena(hechos) } })`, con `total =
  AbortSignal.timeout(plazoTotalMs)` creado una vez. `esquemaCronicaArena` sigue el patrón de `esquemaNarracionArena`:
  `hecho` y `apoyo` con `enum` de los ids, `apoyo` obligatorio (puede ir vacío), 1–`maxHechos` + 4 oraciones.
- El LLM se envuelve con `conPresupuesto(llm, 1 + MAX_REINTENTOS)` y la generación con
  `trazar("arena.cronica", { "gen_ai.request.model": llm.id, "arena.huella": huella }, …)`.
- **No** se usa `req.signal`: una vez reservada, la generación termina y se guarda aunque el espectador cierre la
  pestaña.
- **Cotas ejecutables, comprobadas antes de reservar y antes de cada llamada** (v1.1):
  1. **Entrada inicial.** Con los hechos ya recortados a `maxHechos`, mientras `SISTEMA_CRONICA_ARENA.length +
     mensajeInicial(hechos).length > maxCaracteresEntrada` se quita el hecho de menor relevancia **no obligatorio**.
     Si solo con los obligatorios (≥ 70) sigue sin caber, **no se reserva ni se llama**: acta con motivo `tamano`,
     definitiva (los hechos son deterministas y no van a encoger).
  2. **Feedback.** `feedbackAcotado(motivos)` = `feedback(motivos)` truncado a `maxCaracteresFeedback` caracteres,
     cortando por línea y terminando con «- … y N motivos más.».
  3. **Conversación.** `antesDeLlamar` comprueba, en cada intento, `system.length + Σ mensajes.length +
     JSON.stringify(esquema).length ≤ maxCaracteresEntrada + maxCaracteresEsquema + 2 · (maxCaracteresFeedback +
     maxCaracteresRespuesta)`; si no, no llama (el bucle sigue por
     la omisión B6 o el acta). Una respuesta del modelo de más de `maxCaracteresRespuesta` caracteres no se devuelve
     en la conversación: cuenta como intento con un motivo V1 «respuesta demasiado larga» y el siguiente intento
     parte de los mensajes previos (como un error del LLM).
  4. **Salida.** `maxTokens = maxTokensSalida` por llamada (lo impone el proveedor) y `esquemaCronicaArena` con
     `maxItems = hechos.length` oraciones.
  5. **Llamadas.** `conPresupuesto(llm, 1 + MAX_REINTENTOS)`.
- **Coste: tope por estimación, no garantía monetaria** (como el 059: el control real del gasto es la facturación de
  Azure). Lo que **sí** está garantizado por construcción: ≤ 15 generaciones con modelo al día, ≤ 3 llamadas por
  generación, ≤ `maxTokensSalida` tokens de salida por llamada (lo impone el proveedor) y un tamaño de petición
  acotado en caracteres (punto 3, que en v1.2 cuenta también `JSON.stringify(esquema)`). La conversión a tokens es una
  estimación conservadora de **1 token por cada 2 caracteres** (el promedio real de estos textos ronda 1 por cada
  3,5–4), más 1 000 tokens por llamada de margen de protocolo. Con precio de lista de `sol61` (2 y 10 USD por millón):
  entrada ≤ 3 × ((22 000 + 6 000 + 2 · (4 000 + 12 000)) / 2 + 1 000) = 93 000 tokens (0,186 USD), con 6 000
  caracteres de esquema como máximo; salida ≤ 3 × 5 000 = 15 000 tokens (0,150 USD). **Tope estimado ≈ 0,34 USD por
  crónica y ≈ 5,04 USD al día** con el cupo de 15. Un caso típico (un intento, ≈ 5 000 de entrada y ≈ 3 000 de salida)
  ronda 0,04 USD. El uso informado por el proveedor (`llm.uso()`) se guarda en `<h>.cronica.json` y el smoke de la
  publicación 2 lo compara con el tope.

### 4.6 Acta y rótulos

- Acta = `borradorActa(hechos)` con `modo: "acta"`, verificada con `verificarCronicaArena` y `asegurarVerificada`.
- `motivoActa`: `desactivado` (sin `ARENA_CRONICA_LLM`), `redactor` (modelo fuera del catálogo o error al crearlo),
  `cupo` (cupo diario agotado), `error` (el bucle terminó en acta habiendo errores del LLM), `abandonada` (reserva
  pendiente más vieja que `reservaAbandonadaMs`), `rechazos` (3 intentos sin pasar; **definitiva**) y `tamano` (los
  hechos obligatorios no caben en `maxCaracteresEntrada`; **definitiva**, sin reservar ni llamar). Todas menos
  `rechazos` y `tamano` son `provisional: true`.
- Rótulo del redactor: `etiquetaLlm(llm.id)` de `vista/servidor.ts` (stub, ensayo con `fixture`, Foundry/Azure)
  sustituyendo el `id` del catálogo por su `nombrePublico` («GPT-6.1 Sol · Azure OpenAI»). El stub es una crónica
  `modo: "llm"` pero se rotula «Offline stub — sentences reuse the analyst's templates», como en `/match`.

### 4.7 Fuentes, almacén e índices (`src/arena/cronica-almacen.ts`, `src/arena/cronica-fuentes.ts`)

**Fuentes** (`resolverFuente(fuente)` → `{ registro, origen }`):

| Fuente | Cómo se obtiene el registro | `origen` |
| --- | --- | --- |
| `{ sesion: uuid }` | `gestorSesiones().registro(id)` (409 si no está completa; 404 si caducó) | `{ tipo: "sesion", contexto: { forma: "sesion", asignacion } }` con `asignacionPublicada(id)` |
| `{ torneo, encuentro: "NN" }` | instantánea por `datosPaginaTorneo(id)` (coherente) → encuentro `n` → bytes: el mismo estático que descarga el cliente, `join(process.cwd(), "public", "torneos", id, archivo)` (archivado; en e2e incluye la copia estática de `ensayo-059`; **no** `dirTorneos()`, que en e2e solo tiene `torneo.json`), o `gestorTorneoSitio().leerArchivo(id, archivo)` (sitio) → `sha256` = `archivoSha256` → `descomprimirRegistro` → `registroDelEncuentro` → `reproducirArena` | `{ tipo: "torneo", contexto: { forma: "torneo" }, torneo: OrigenTorneo }` (club y modelo por lado, fecha, fase, prueba) |
| `{ archivo: "duelo" \| "ejemplo-v3" \| "ejemplo" }` | `public/experimentos/<archivo>` → `reproducirArena` | `{ tipo: "ejemplo", contexto: { forma: "ejemplo" } }` |
| `{ registro }` | admisión (`CRONICA_ARENA.admision`, por IP del primer salto de `x-forwarded-for` y global, decidida con el primer fragmento como en grabaciones) → `reproducirArena` → `registroCompleto` | `{ tipo: "subida", contexto: { forma: "importado" } }` |
| `{ huella }` | `<h>.registro.json.gz` ya guardado | el guardado |

La parte pura de `cargarEncuentroTorneo` que arma `OrigenTorneo` se extrae a una función `origenDeEncuentro(torneo, n)`
en `src/arena/torneo.ts`, que usan el cliente y el servidor (sin cambio de conducta en el cliente).

**Precedencia en la arena (cliente):** `origenTorneo` → `{ torneo }`; `archivoActual` → `{ archivo }`;
`contextoModelos.forma === "sesion"` y `sesionActual` → `{ sesion }`; si no, `{ registro }`. Así una grabación
registrada solo para la voz no se presenta como sesión verificada.

**Almacén:** `almacenCronicasDesdeEnv()` = `almacenTorneosBlob(ARENA_BLOB_ENDPOINT, ARENA_BLOB_CONTENEDOR ?? "arena",
"cronicas-arena/")` o `almacenTorneosLocal(env.ARENA_CRONICAS_DIR || ".cache/arena-cronicas")`. `almacen-torneos.ts` no
se modifica. Archivos (todos cumplen `nombreValidoTorneos`):

| Nombre | Contenido | Escritura |
| --- | --- | --- |
| `<h>.registro.json.gz` | registro validado, gzip 9 | `escribirBytes` una vez (si existe, no se reescribe) |
| `<h>.origen.json` | `origen` de la **primera** fuente | `nuevo: true`; `yaExiste` se ignora |
| `<h>.cronica.json` | `{ version, analista, huella, hashHechos, generadaUtc, redactor: { id, etiqueta, fixture } \| null, provisional, motivoActa?, cronica: CronicaVerificada }` | atómica (sobrescritura) |
| `<h>.reserva.json` | `{ estado: "pendiente", desdeUtc }` | `nuevo: true` antes de llamar; se borra al guardar la crónica |
| `idx-s-<uuid>.json`, `idx-t-<torneo>-<nn>.json`, `idx-a-<archivo>.json` | `{ huella }` | `nuevo: true`; evita revalidar la misma fuente |
| `dia-AAAA-MM-DD.json` | `{ generaciones, registros }` | sobrescritura bajo el mutex del proceso |

**Concurrencia:** un mutex en proceso para el libro diario; un `Map<huella, Promise>` que comparte la generación en
curso entre peticiones del mismo partido; como mucho `generacionesSimultaneas` = 1 generación con modelo a la vez (otra
huella recibe 429 `{ motivo: "en-curso" }` con `retry-after: reintentoOcupadoS`). Supuesto declarado: **una réplica**
(como el 062); con varias, el cupo podría superarse por el número de réplicas.

**Validez al leer:** se recalcula `seleccionCronicaArena(registro)` sobre el registro guardado (la misma selección que al generar). Si `hashHechos` (de `cadena/cache.ts`) no coincide
→ estado `desactualizada`; si la crónica no pasa `verificarCronicaArena` → `invalida`. En los dos casos **no se muestra
la prosa** y el botón ofrece regenerarla (cuenta para el cupo).

### 4.8 API

**`POST /api/arena/cronicas`** (`runtime = "nodejs"`, `force-dynamic`). Cuerpo estricto: una de las cinco fuentes. Tope
del cuerpo: `ARENA.archivoMaxBytes` para `{ registro }` (con admisión), 1 KB para las demás. Respuesta 200:
`{ huella, url: "/arena/cronica/<h>", modo: "llm" | "acta", provisional, motivoActa?, desdeAlmacen }`. Errores: 400
(cuerpo, registro inválido o incompleto), 404 (sesión, torneo, encuentro, archivo o huella inexistentes), 409 (sesión
sin registro completo), 413, 429 (`motivo`: `en-curso`, `subidas` o `registros-diarios`, con `retry-after` cuando es
transitorio), 503 (almacén). Algoritmo: resolver la fuente (o el índice) → huella → guardar registro, origen e índice
(contando `registros` del día; con `registrosDiarios` agotado y huella nueva, 429) → si hay crónica válida y no
provisional, devolverla → si hay generación en curso de la huella, esperarla → hechos → sin redactor o sin cupo, acta
provisional → reservar (`generaciones + 1` y `<h>.reserva.json`) → `redactarYVerificar` → guardar → responder.

**`GET /api/arena/cronicas/[huella]`** → `{ huella, origen, estado: "lista" | "sin-cronica" | "invalida" | "desactualizada", cronica? }`,
`cache-control: no-store`. **`GET /api/arena/cronicas/[huella]/registro`** → el registro JSON,
`cache-control: public, max-age=31536000, immutable` (contenido direccionado). Ningún `GET` escribe ni llama a un
modelo. Huella fuera de `^[a-f0-9]{40}$` → 404.

### 4.9 Página `/arena/cronica/[huella]`

`src/app/arena/cronica/[huella]/page.tsx` (servidor, `force-dynamic`, `metadata.title` «Match report — CRONISTA»):
lee con `leerCronicaArena(huella)` (la misma función que el `GET`, sin HTTP), 404 si no hay registro, y pasa a
`src/ui/CronicaArena.tsx` (cliente) solo lo necesario —**nunca los fotogramas**—:
`{ huella, idiomaInicial, cabecera, cronica?, estado, hechos: { id, tipo, texto_es, texto_en, eventos, datos }[], linea, enlacesRepeticion }`.

Contenido, dentro de `<main className="arena-shell arena-cronica" lang={idioma}>` con las variables de
`identidadPartido` (los mismos tokens de la arena):
1. **Cabecera** (`data-testid="cronica-arena-cabecera"`): escudos, nombres, marcador final, «60 s» y, si hubo,
   «Final anticipado»; reglas del motor (`reinicios-v8` o `arena-v1`); línea de modelos
   `lineaModelos(registro, origen.contexto, catalogoPublico, idioma)` con su rótulo de procedencia; con origen de
   torneo, «Partido N del torneo del <fecha>» y «Volver al torneo».
2. **Redactor** (`data-testid="cronica-redactor"`, `data-fixture`): «Writer: GPT-6.1 Sol · Azure OpenAI» o el rótulo
   del acta con su motivo (§ 4.6).
3. **Barra de verificación** (`verify-bar`, `data-mode`): `resumenVerificacion` (oraciones, intentos, corregidas,
   omitidas).
4. **Título** (`h1`) y **frases** (`data-testid="sentence"`, `data-state` `verificada | corregida | acta`,
   `data-event-ids` con los ids resueltos, `role="button"`, `tabIndex=0`, Enter/Espacio) con
   `sentence-text`. Al elegir una: resaltado, «Fact c03 · <texto del hecho>» y «Watch in the replay · 0:31»
   (`sentence-replay`); en una corregida, «History» (`HistoriaFrase`).
5. **«View process» / «Ver proceso»** (`open-process`) → `Proceso` (`process-view`).
6. **Línea de tiempo** (`data-testid="cronica-arena-linea"`): los eventos de los tipos `gol`, `tiro`, `atajada`,
   `tiro_fuera`, `falta`, `amarilla`, `roja`, `cambio`, `fuera_juego`, `final_anticipado` y los `pase` con `motivo`
   `largo`, **más** todo evento citado por algún hecho, en orden del registro. Cada uno es `timeline-event` con
   `data-event-id`, `data-highlighted`, reloj m:ss, `IconoEventoArena` y el texto de `narrarEventoArena` en el idioma
   activo (calculado en el servidor en los dos idiomas). Clic en un evento: resalta las frases que lo citan.
7. **Límites** (`<details data-testid="cronica-arena-limites">`): lo que se comprueba y lo que no (§ 4.3), y que la
   línea de tiempo son plantillas del motor que no pasan por el verificador.
8. Estados `sin-cronica`, `invalida` y `desactualizada`: sin prosa; un `BotonCronica` con fuente `{ huella }`.
9. ES/EN de la barra: cambia frases, marco y línea de tiempo (página nueva, marco bilingüe completo). `?lang=es`
   inicial.

**Funciones puras nuevas** (`src/arena/cronica-vista.ts`): `eventosDeOracionArena(cronica, hechos, i)` (reusa
`hechosDeOracion`; acepta ids `^a\d+$` y ordena por índice en `registro.eventos`), `oracionesDeEventoArena`,
`lineaTiempoCronica(registro, hechos)` y `segundoDeSalto(eventos, i)`. `estadoOracion`, `historiaDeOracion` y
`resumenVerificacion` se reutilizan tal cual.

**Caja de cristal en dos idiomas:** `HistoriaFrase` y `Proceso` reciben `idiomaMarco?: "es" | "en"` (por defecto
`"en"`: la crónica histórica no cambia) y `textos.ts` añade `REGLA_ES` junto a `REGLA_EN`.

### 4.10 Botón en la arena (`src/ui/BotonCronica.tsx`, cliente)

- Props: `fuente`, `idioma`, `variante: "boton" | "enlace"`. Texto «Match report» / «Crónica»
  (`data-testid="arena-cronica"`), nota breve «Written after the match and checked sentence by sentence» / «Escrita
  al terminar y verificada frase a frase».
- En la arena, después de `ArenaDescargas`, **solo** si `registroCompleto(registro) && !enDirecto && !bufferActivo &&
  !sinPartido`. No aparece durante el directo ni mientras se emite el búfer (no adelanta el resultado); aparece al
  terminar la emisión, en una repetición guardada o compartida y en un partido de torneo.
- Clic: `POST` con `AbortController`; deshabilitado mientras espera; una sola petición por fuente en todo el documento
  (mapa de módulo). `useAvisoCarga(pendiente, "Writing the match report…", "The writer drafts it and the verifier
  checks every sentence. It can take up to two minutes.")` (y ES), sin porcentajes. Éxito → `router.push(url +
  lang)`. 429 `en-curso` → «Another match report is being written. Try again in N s.» + «Retry»; otro error →
  mensaje + «Retry». Plazo del cliente `plazoClienteMs`.

## 5. Bloque C · De la frase a la repetición y crónicas de torneo

### 5.1 Arena: `?cronica=<huella>` y `?t=<s>`

- `src/ui/cronica-carga.ts` (puro): `peticionCronicaDeUrl(q)` → `{ cronica: huella } | null` (huella válida y sin
  `partido`) y `segundoDeUrl(q)` → entero en `[0, ARENA.duracionMaxS]` o `null`. Precedencia: `partido` > `cronica` >
  `torneo` (y `peticionDeUrl` no cambia).
- `Arena.tsx`: el efecto de montaje acepta `{ cronica }`: `ejecutar` la trata como el torneo: lee
  `/api/arena/cronicas/<h>/registro` y `/api/arena/cronicas/<h>` (origen), hace `POST /api/arena` `{ accion:
  "reproducir", registro }` y fija `contextoModelos = origen.contexto` y, si lo hay, `origenTorneo = origen.torneo`.
  Errores → el aviso `arena-torneo-error` con el mismo «Reintentar».
- `t`: se guarda en un `ref` al montar y se aplica **una vez**, cuando termina la carga pedida por la URL (`cronica` o
  `torneo`): `setTiempo(min(t, finS))`, `reproduciendo = false`, sin voz. Se ignora con `partido`, sin carga por URL y
  si el valor no es válido.

### 5.2 Torneo

- `ArenaTorneo.tsx` y `ArenaTorneoGrupos.tsx`: en cada partido con registro, junto a «Ver repetición» y «Descargar
  registro», un `BotonCronica variante="enlace"` con `fuente={{ torneo: t.id, encuentro: nn(n) }}`
  (`data-testid="arena-torneo-cronica"`). La celda de la matriz no cambia.
- En la arena, una repetición de torneo usa esa misma fuente (§ 4.7).
- `enlaceRepeticionCronica(huella, origen, s, idioma)` (pura, `cronica-vista.ts`): origen torneo →
  `/arena?torneo=<id>&encuentro=<nn>&t=<s>`; si no → `/arena?cronica=<h>&t=<s>`; `&lang=es` en ES.

## 6. Constantes nuevas en `src/sim/limites.ts`

Un bloque comentado `CRONICA_ARENA` **al final** del archivo (el 063 edita otros bloques del mismo archivo: se integra
tras su commit, § 9):

| Clave | Valor | Motivo |
| --- | --- | --- |
| `version` | `"cronica-arena-v1"` | versión del archivo `<h>.cronica.json` |
| `analista` | `"hechos-arena-v1"` | versión del catálogo § 4.2; cambiarla invalida las guardadas (`desactualizada`) |
| `maxHechos` | 24 | primer recorte; los ≥ 70 nunca se recortan (después manda `maxCaracteresEntrada`) |
| `maxPorClase` | `{ lejanos: 3, amarillas: 4, cambios: 4 }` | que un partido largo no llene la crónica de una sola clase |
| `relevancia` | `{ resultado: 100, gol: 90, autogol: 90, varios: 80, expulsion: 75, finalAnticipado: 75, remates: 60, atajadas: 55, lejano: 50, amarilla: 45, largos: 40, cambio: 35, fueraJuego: 30 }` | obligatorios = los que V5 exige con `COBERTURA` 70 |
| `diarias` | 15 | tope estimado ≈ 5,04 USD/día (§ 4.5); `ARENA_CRONICA_DIARIA` lo sustituye |
| `maxTokensSalida` | 5 000 | por llamada, razonamiento incluido; JSON bilingüe de ≤ `hechos.length` oraciones |
| `plazoIntentoMs` / `plazoTotalMs` | 60 000 / 150 000 | por debajo de los 240 s del *ingress* |
| `plazoClienteMs` | 165 000 | total + margen |
| `maxCaracteresEntrada` | 22 000 | system prompt + mensaje inicial; sin caber con los obligatorios → acta `tamano` |
| `maxCaracteresFeedback` | 4 000 | `feedbackAcotado` |
| `maxCaracteresRespuesta` | 12 000 | respuesta que se reenvía en la conversación |
| `maxCaracteresEsquema` | 6 000 | `esquemaCronicaArena` serializado; la unitaria 7 lo mide con 24 hechos |
| `generacionesSimultaneas` | 1 | una réplica, coste predecible |
| `reintentoOcupadoS` | 5 | `retry-after` del 429 `en-curso` |
| `reservaAbandonadaMs` | 300 000 | 2 × `plazoTotalMs` |
| `registrosDiarios` | 200 | acota el almacén (≈ 1–2 MB por registro comprimido) |
| `admision` | `{ porIpPorHora: 10, globalPorHora: 60, enCurso: 1, ventanaMs: 3_600_000 }` | protege la CPU de `reproducirArena` en subidas |
| `antesDelEventoS` | 3 | la repetición empieza un poco antes de la jugada |

`llamadasPorCronica` **no** es una constante: es `1 + MAX_REINTENTOS` de `cadena/umbrales.ts`. Ninguna prueba
repite estas cifras a mano: las importan.

## 7. Invariantes verificables

- **I1 (barra):** A1 del § 3.1 en las nueve rutas; la marca nunca apunta a `/`.
- **I2 (raíz):** sin `CRONISTA_RAIZ`, `GET /` → 307 a `/arena` + query; con `perspectiva` → `/cronicas` + query; con
  `CRONISTA_RAIZ=cronicas` → 200 con `featured-match`.
- **I3 (dataset):** desde `/arena`, `/arena/torneo` y `/arena/cronica/<h>`, `dataset-link` → `/datos`, que responde
  200 con «The CRONISTA match dataset».
- **I4 (acta siempre verificable):** para todo registro completo de la matriz (fixtures v1–v8, `arena-v1/v2/v3`,
  torneos y 200 semillas programadas × {10, 60, 180} s), `verificarCronicaArena(borradorActa(h), h, config)` es `[]`.
- **I5 (hechos):** ids `c01…` consecutivos; relevancias del catálogo; ninguna clave prohibida; `eventos` ⊆ ids del
  registro y en su orden; vacíos solo en el resultado 0–0; `SISTEMA_CRONICA_ARENA.length +
  mensajeInicial(hechos).length ≤ maxCaracteresEntrada` en toda llamada; determinismo: dos ejecuciones dan `JSON.stringify` idéntico.
- **I6 (huella):** estable ante reordenar claves; distinta si cambia cualquier evento o un controlador declarado.
- **I7 (lectura sin coste):** ninguna ruta `GET` ni la página llaman a `Llm.completar` ni escriben en el almacén.
- **I8 (cupo):** el número de generaciones con modelo de un día UTC nunca supera el cupo efectivo; cada una hace ≤ 3
  llamadas.
- **I9 (nada sin verificar):** toda crónica servida pasó `verificarCronicaArena` al guardarse **y** al leerse; si no,
  no se muestra prosa.
- **I10 (historia intacta):** `generarCronica` produce el mismo `JSON.stringify` que antes del refactor para las
  semillas 246, 42 y 7, en neutral y `equipo:local`, con stub y con ensayo (*golden* tomado antes del cambio).
- **I11 (registros archivados):** ningún campo nuevo en `RegistroArena`, `ConfigArena` ni `EventoArena`; todo registro
  archivado sigue pasando `reproducirArena`.

## 8. Pruebas exigidas (vistas correr) y mutaciones

### 8.1 Unitarias (vitest, `npm test`)

1. `src/vista/__tests__/raiz.test.ts`: `destinoRaiz` con `{}`, `lang=es`, `perspectiva=visita`, `perspectiva=x&lang=es`
   (orden conservado), `partido=…`; `raizEsCronicas` con `"cronicas"`, `" cronicas "`, `"arena"` y ausente.
   **Mutaciones:** perder la query; mandar `perspectiva` a la arena.
   `src/app/__tests__/raiz-pagina.test.ts` (v1.1, D3): se importa la página de `src/app/page.tsx` y se invoca con
   `searchParams` resueltos. Con `CRONISTA_RAIZ=cronicas` devuelve un elemento `PortadaCronicas` con `ruta="/"` y la
   perspectiva pedida (`/?perspectiva=visita` → `visita`); sin la variable, lanza el error de `redirect` cuyo `digest`
   contiene `/arena?lang=es` (para `lang=es`) y `307`. **Mutación:** ignorar `CRONISTA_RAIZ` hace fallar la primera
   parte.
2. `src/ui/__tests__/BarraSitio.test.tsx` (`renderToStaticMarkup`, `vi.mock("next/navigation")`): un `header` con
   `topbar arena-topbar`; nombres y `href` exactos en ES y EN; `aria-current` por `seccion`; marca → `/arena`; botón
   con el nombre accesible de hoy. **Mutación:** volver a añadir «Match reports».
3. `src/ui/__tests__/simulador-061.test.tsx` (ajustada, § 8.4): la tira es un `nav.cronicas-herramientas`, enlaces
   `["Featured match", "League mode", "Data"]` → `["/cronicas", "/liga", "/datos"]`, `aria-current` por `seccion`, sin
   `header` y sin `style={{`.
4. `src/cadena/__tests__/redactar-064.test.ts`: I10 contra `__fixtures__/golden-064.json` (generado por un script en
   el **primer** commit, antes del refactor, y commiteado). Un doble de `Llm` que registra `arguments.length` = 2 sin
   `opcionesLlm`. `verificarExtra` que rechaza la oración 0 → omitida si V5 aguanta. **Mutación:** no aplicar
   `verificarExtra` en `asegurarVerificada`.
5. `src/arena/__tests__/cronica-hechos.test.ts`: I4 e I5 sobre la matriz; los ejemplos normativos del § 4.2,
   literalmente, pasan `verificarCronicaArena` como acta; un gol de remate desde fuera del área con `metros` y
   `distancia_m`, uno desde dentro con `metros` y **sin** `distancia_m` (el `a6` de `arena-reinicios-v5.json`, que
   recorre 18,9 m desde dentro del área) y uno de rechace sin ninguna de las dos; dos tiros del mismo goleador con
   distancias distintas → se cita el último antes del gol y su distancia; `equipo`, `local`, `visita` y `beneficiado`
   son nombres de club (autogol: `equipo` = club del autor, `beneficiado` = club del lado del evento); «gol de la
   victoria» y «definitivo» aceptados con goles de cada equipo y rechazados en un autogol del perdedor; registro v1
   sin banco ni entrenadores; registro v7/v8 con remate lejano y balón largo; 0–0; final anticipado; recorte a
   `maxHechos` con todos los ≥ 70 presentes; **exceso deliberado**: un registro sintético con tantos goles que los
   obligatorios superan `maxCaracteresEntrada` → acta `tamano` sin reservar ni llamar, y otro con no obligatorios de
   sobra → se quitan los de menor relevancia hasta caber. **Mutaciones:** usar la clave `minuto`; incluir el texto del
   estadista con «Sin …»; usar `"local"`/`"visita"` en `equipo`; usar `equipo` = beneficiado en el autogol; poner
   `distancia_m` sin la comprobación de `enAreaRival`; elegir el primer tiro del goleador en vez de `tiroDelGol`; abrir
   una plantilla con «Remates».
6. `src/arena/__tests__/cronica-verificador.test.ts`: «a los 31 s» con `segundo` 31 pasa y con 34 falla (V3, ES y EN
   por separado); «a los 31 segundos» / «after 31 seconds» pasan; «en el segundo 31» falla (documentado: ordinal 2);
   «en el minuto 1» falla; «en 60 s de juego» pasa con `duracion_s`; nombre del entrenador, del árbitro y «GPT-6.1 Sol»
   → V4; «desde fuera del área» pasa con el hecho del remate de fuera y falla con el del `a6` de dentro (sin
   `distancia_m`); «al final del partido» →
   V8; «en el primer tiempo» → V3; «goleada» con 3–0 pasa y con 2–1 falla. **Prueba de límite** (pasa a propósito y
   queda documentada): «Ana Ruiz persiguió al rival hasta la línea.» con un hecho de Ana Ruiz pasa: el verificador no
   juzga persecuciones.
7. `src/arena/__tests__/cronica-servicio.test.ts` (almacén local en directorio temporal, reloj inyectable, dobles de
   `Llm` que cuentan llamadas): segunda petición = 0 llamadas y `desdeAlmacen`; dos peticiones simultáneas de la
   misma huella = 1 generación; cupo agotado → acta `provisional` `cupo`, 0 llamadas; al día siguiente (reloj) la
   misma huella pasa a `llm`; LLM que lanza → acta `error` y el cupo contado; 3 rechazos → acta `rechazos` no
   provisional y una nueva petición no llama; reserva pendiente reciente → espera/429, vieja → `abandonada`;
   `registrosDiarios` → 429 solo con huella nueva; crónica guardada manipulada → `invalida`; `analista` distinto →
   `desactualizada`; `ARENA_CRONICA_DIARIA=2` respetado; sin `ARENA_CRONICA_LLM` → `desactivado` sin crear LLM.
   **Mutaciones:** contar el cupo después de llamar; servir la caché sin re-verificar; no compartir la promesa en curso.
8. `src/arena/__tests__/cronica-fuentes.test.ts`: torneo de fixture (archivado y del sitio) con huella correcta, con
   huella alterada (rechazo) y con encuentro inexistente; `archivo` desconocido; sesión incompleta → 409; precedencia
   cliente (§ 4.7) como función pura `fuenteCronica(estadoArena)`.
9. `src/arena/__tests__/cronica-vista.test.ts`: `eventosDeOracionArena` con ids `a…` (mutación: reutilizar
   `eventosDeOracion` con `esMacro` → falla); `segundoDeSalto` con `antesDelEventoS` y 0 como cota; `lineaTiempoCronica`
   incluye todo evento citado aunque sea un `pase` normal; `enlaceRepeticionCronica` para torneo y para huella, ES/EN.
10. `src/ui/__tests__/cronica-carga.test.ts`: precedencias `partido` > `cronica` > `torneo`; `t` fuera de rango o no
    entero → `null`.

### 8.2 E2e nuevas

Entorno del `webServer` (playwright): se añaden `ARENA_CRONICA_LLM: "1"` y `ARENA_CRONICAS_DIR:
resolve(".cache/e2e/cronicas")` (borrado por `scripts/e2e-torneos.mjs` al preparar). El redactor es el fixture
`ensayo`, rotulado como tal.

`e2e/navegacion-064.spec.ts` (bloque A):
- **N1** `request.get("/", { maxRedirects: 0 })` → 307 y `location` `/arena`; `/?lang=es` → `/arena?lang=es`;
  `/?perspectiva=visita` → `/cronicas?perspectiva=visita`.
- **N2** En `/arena`, `/arena/torneo`, `/arena/torneo/<id-fixture>`, `/cronicas`, `/match/246`, `/liga`, `/liga/1/1` y `/datos`: I1; en `/arena` y
  `/arena/torneo`, `aria-current` en su enlace; tras ES en la arena, los dos enlaces y la marca llevan `?lang=es`.
- **N3** I3 (clic real en `dataset-link` desde la arena).
- **N4** Sin desborde (`scrollWidth ≤ innerWidth` y `right ≤ innerWidth` de `simulate`, `random-match`,
  `reports-link`, `arena-link`, `torneo-link`, `.sim-form [role="alert"]` con el error visible) de 320 a 1440 px en
  pasos de 20 en `/match/246`; en 360, 480/481, 900/901 y 1279/1280 en las otras ocho rutas; 360 en oscuro.
- **N5** `/cronicas` muestra `featured-match` y `sentence`; la tira tiene `aria-current` en «Featured match».
- **Mutaciones:** `redirect` sin query rompe N1; un «Match reports» en la barra rompe N2; quitar el `flex-wrap` de la
  tira rompe N4 a 320.

`e2e/cronica-arena-064.spec.ts` (bloque B):
- **B1** `/arena` → «Saved matches» → el duelo archivado → `arena-cronica` visible; clic → `match-loading` visible →
  URL `/arena/cronica/<40 hex>`; `h1`; ≥ 2 `sentence`; `cronica-redactor` contiene «Rehearsal fixture» y
  `data-fixture="true"`; una frase `data-state="corregida"` cuya historia muestra un `rule` V3.
- **B2** Clic en una frase → todos los `timeline-event[data-highlighted="true"]` están en su `data-event-ids` y hay ≥ 1;
  clic en un evento resaltado → la frase queda resaltada.
- **B3** Recargar la página no emite ningún `POST` (`page.on("request")`) y muestra el mismo `h1`.
- **B4** Volver a pulsar el botón para el mismo partido → la respuesta trae la misma huella y `desdeAlmacen: true`.
- **B5** Durante un directo programado `arena-cronica` no existe; al terminar la emisión aparece.
- **B6** ES en la barra → frases, «Ver proceso» y reglas de `Proceso` en español; 360 px sin desborde.
- **B8** (v1.2, la parte de N2 que depende de B) En `/arena/cronica/<h>`: I1, `seccion` nula (ningún
  `aria-current` en la barra), `dataset-link` en el pie y, con ES, enlaces con `?lang=es`.
- **B7** Una huella inexistente → 404; una huella de un registro sin crónica (sembrado en el directorio) → estado
  `sin-cronica` sin `sentence` y con el botón.
- **Mutaciones:** mostrar el botón con `bufferActivo` rompe B5; generar en el `GET` rompe B3; usar `esMacro` rompe B2.

`e2e/cronica-torneo-064.spec.ts` (bloque C):
- **C1** En la página del torneo de ensayo, `arena-torneo-cronica` del partido 1 → página de crónica con «Partido 1
  del torneo…» y «Volver al torneo».
- **C2** Frase con gol → `sentence-replay` → `/arena?torneo=…&encuentro=01&t=<s>`; la arena carga ese partido con el
  reloj en `s` (texto del reloj) y en pausa.
- **C3** Partido no de torneo → `sentence-replay` → `/arena?cronica=<h>&t=<s>`; la línea de modelos de la arena es la
  del origen guardado, no «importado».
- **Mutación:** aplicar `t` antes de que termine la carga rompe C2.

### 8.3 Contraste y accesibilidad

Script `docs/evidencia/cronica-064/contraste.mjs` (adaptado del 061) sobre `/arena/cronica/<h>` con una frase elegida y
el proceso abierto, claro y oscuro, 1440 y 360: frase, frase elegida, evento resaltado, rótulo del redactor, barra de
verificación, rechazo en `Proceso`, foco, enlaces de la tira de `/match/246`. Mínimos 4,5 (texto) y 3 (foco y
gráficos). Las frases y los eventos se manejan con teclado (Tab, Enter, Espacio).

### 8.4 Pruebas existentes afectadas (lista cerrada de ediciones autorizadas)

1. 20 `page.goto("/")` → `page.goto("/cronicas")` en `juez`, `vitrina`, `random`, `liga`, `datos`, `reproduccion`,
   `partido-completo`, `relato-formaciones`. Nada más de esos archivos cambia.
2. `actividad.spec.ts`: `de: "/"` → `"/cronicas"` en las dos primeras navegaciones; `.brand` desde `/datos` → `a:
   "/arena"`, `titulo: "Loading page…"`.
3. `cronica-061.spec.ts`: los asertos de `header` sobre `reports-link`, `arena-link` y `aria-current` pasan a la tira
   (`nav.cronicas-herramientas`) o a la barra según el § 3.5; el recorrido `/datos` → `.brand` → … pasa a `/datos` →
   «Featured match» → `/cronicas` → `to-arena`; la identidad de la e2e 6 compara `/cronicas` con `/arena`.
4. `arena-identidad.spec.ts:86`: `a.brand` → `/arena`.
5. `simulador-061.test.tsx`: § 8.1.3.
6. `scripts/smoke-public.mjs`: `get("/")` → `get("/cronicas")` (el aserto del activo JS usa ese cuerpo). Además
   comprueba la raíz con `fetch(…, { redirect: "manual" })`: con `--raiz cronicas` (host de crónicas) exige 200 y
   `data-testid="sentence"`; sin la opción, 307 con `location` `/arena`.

Deben pasar **sin editar**: `arena-torneo.spec.ts` (incluido el 9, «Tournament» → `/arena/torneo`), todas las
`arena-*.spec.ts` (los botones «Switch to Spanish»/«Cambiar a inglés» no cambian), las unitarias de la cadena, del
verificador, del narrador y del estadista, y `npm run test:stats` si existe en el árbol.

## 9. Archivos y convivencia con el 063

**Nuevos:** `src/ui/BarraSitio.tsx`, `src/ui/BarraHeredada.tsx`, `src/ui/PieSitio.tsx`, `src/ui/PortadaCronicas.tsx`,
`src/vista/raiz.ts`, `src/app/cronicas/page.tsx`, `src/arena/cronica-hechos.ts`, `src/arena/cronica-verificador.ts`,
`src/arena/cronica.ts`, `src/arena/cronica-almacen.ts`, `src/arena/cronica-fuentes.ts`, `src/arena/cronica-vista.ts`,
`src/ui/cronica-carga.ts`, `src/ui/BotonCronica.tsx`, `src/ui/CronicaArena.tsx`, `src/ui/textos-cronica-arena.ts`,
`src/app/api/arena/cronicas/route.ts`, `src/app/api/arena/cronicas/[huella]/route.ts`,
`src/app/api/arena/cronicas/[huella]/registro/route.ts`, `src/app/arena/cronica/[huella]/page.tsx`, las pruebas del § 8,
`src/cadena/__fixtures__/golden-064.json` y `docs/evidencia/cronica-064/`.

**Modificados:** `src/app/page.tsx`, `src/app/match/[seed]/page.tsx`, `src/app/liga/page.tsx`,
`src/app/liga/[jornada]/[partido]/page.tsx`, `src/app/datos/page.tsx`, `src/app/arena/page.tsx` (título),
`src/app/error.tsx`, `src/ui/Simulador.tsx`, `src/ui/Arena.tsx`, `src/ui/ArenaTorneo.tsx`, `src/ui/ArenaTorneoGrupos.tsx`,
`src/ui/CajaDeCristal.tsx` y `src/ui/textos.ts` (idioma del marco), `src/ui/torneo-carga.ts` (usa
`origenDeEncuentro`), `src/arena/torneo.ts` (`origenDeEncuentro`), `src/cadena/cadena.ts`, `src/cadena/acta.ts` y
`src/cadena/prompt.ts` (tipos), `src/app/api/arena/grabaciones/route.ts` (`registroCompleto`), `src/arena/relato.ts` (`tiroDelGol`, v1.1), `src/sim/limites.ts`
(bloque `CRONICA_ARENA` al final), `src/app/globals.css` (bloque `064` al final), `playwright.config.ts` (dos
variables), `scripts/e2e-torneos.mjs` (limpia `.cache/e2e/cronicas`), `scripts/smoke-public.mjs`, `infra/app.bicep`
(`CRONISTA_RAIZ`), `infra/arena-preview.bicep` (`ARENA_CRONICA_LLM`, `ARENA_CRONICA_MODELO`, solo con el sí de Carlos),
`.env.example`, `README.md` (raíz local, fila «Match report per arena match»), `docs/arena.md` (sección «Crónica de un
partido») y las e2e del § 8.4.

**No se tocan:** `scripts/grabar-video-final.mjs`, `docs/entrega/cronista-demo-final.*`, `HANDOFF.md`, `CLAUDE.md`
(su «Alcance» lo actualiza el orquestador al cerrar), el motor y los archivos del 063 listados en «Estado»,
`src/arena/narrador.ts`, `sesiones.ts` y `almacen*.ts`.

**Orden con el 063:** los archivos nuevos se pueden escribir ya. `limites.ts`, `Arena.tsx`, `ArenaTorneo.tsx` y
`globals.css` se editan **después** del commit de la publicación 3 del 063, sobre ese commit. Commits con rutas
explícitas, nunca `git add -A`, gitleaks antes de cada commit.

## 10. Orden, estimación, publicación, qué debe notar Carlos y smoke visual

| Bloque | Contenido | Estimación |
| --- | --- | --- |
| A | D1–D6, § 3, unitarias 1–3, e2e N1–N5, ediciones § 8.4, README y `smoke-public` | 4 h 30 min |
| B1 | golden y refactor de la cadena (§ 4.4) + unitaria 4 | 1 h 15 min |
| B2 | Analista de arena, verificador de arena, unitarias 5–6 y matriz de fixtures | 3 h 30 min |
| B3 | fuentes, almacén, servicio, API, unitarias 7–8 | 3 h 30 min |
| B4 | página, `CronicaArena`, `BotonCronica`, Caja de cristal ES, unitaria 9, e2e B1–B7, contraste | 4 h |
| C | `?cronica`/`?t`, torneo, unitaria 10, e2e C1–C3 | 2 h 45 min |
| Cierre por bloque | `npm test`, `npm run typecheck`, e2e completa (≈ 12 min con build), mutaciones, Codex de la implementación, publicación y smoke | ≈ 1 h 30 min × 3 |

Total ≈ **24 h** de trabajo, con revisiones y tres publicaciones.

**Publicación 1 (bloque A).** Qué debe notar Carlos:
- la misma barra en la arena, el torneo y cualquier crónica: CRONISTA · Arena · Torneo · ES/EN;
- abrir la raíz del host de la arena lleva a la arena;
- «Match reports» ya no está en ningún menú;
- `/match/246` sigue abriendo, con la barra nueva y debajo una tira «90-minute simulator · separate from the arena»;
- el pie de la arena enlaza el dataset sintético.

Smoke: capturas 1440 y 360, claro y oscuro, de `/arena`, `/arena/torneo` y `/match/246`; `curl -sI` de la raíz con su
307; un clic en «Dataset sintético». En `docs/evidencia/cronica-064/publicacion-1/`.

**Publicación 2 (bloque B).** Qué debe notar Carlos:
- al terminar un partido, o en una repetición guardada o compartida, aparece «Crónica»;
- tarda unos segundos y abre una página con el aspecto de la arena: marcador, quién jugó, la crónica en ES/EN y quién
  la escribió (GPT-6.1 Sol o «acta determinista», nunca sin rótulo);
- al pulsar una frase se marcan sus jugadas en la línea de tiempo;
- «Ver proceso» muestra los borradores rechazados;
- el enlace de la crónica se puede compartir y no gasta modelo al abrirlo.

Smoke: un partido programado de 60 s y uno con modelos (con el cupo temporal vigente) hasta su crónica, una frase
elegida y el proceso abierto; capturas ES/EN y 360. **Decisión de Carlos antes de publicar:** activar
`ARENA_CRONICA_LLM=1` y `ARENA_CRONICA_MODELO=sol61` en el host de la arena (cupo 15/día, tope estimado ≈ 5,04 USD/día,
típico ≈ 0,04 USD por crónica). Sin su sí se publica con el acta determinista, rotulada.

**Publicación 3 (bloque C).** Qué debe notar Carlos:
- «Ver en la repetición · 0:31» bajo la frase elegida abre la arena con ese partido parado unos segundos antes de la
  jugada;
- cada partido del torneo tiene «Crónica».

Smoke: desde la crónica de un partido del torneo del 24 oct, saltar a un gol y comprobar el reloj; capturas.

**Despliegues:** cada despliegue con bicep quita los cupos temporales (`ARENA_LIMITE_LLM_DIARIO`,
`ARENA_SPEECH_DIARIO_*` y, desde ahora, `ARENA_CRONICA_DIARIA` si se usa); hay que reponerlos con `az containerapp
update` mientras Carlos pruebe. Ningún despliegue sin la revisión de Codex sin P0/P1.

**Calendario (PT) y cortes.** 25 oct: bloque A tras el commit de la publicación 3 del 063. 26 oct: bloque B. 27 oct
hasta las 12:00: bloque C; la tarde del 27 queda para la entrega. Si a las **18:00 del 26** B no está verde, se publica
A sola y B pasa a deuda. Si B está verde pero sin tiempo, se corta en este orden: (1) bloque C entero; (2) la Caja de
cristal en español (queda el marco en inglés, declarado); (3) la fuente `{ registro }` (las subidas y las grabaciones
sin IA quedan sin botón; sesiones, ejemplos y torneos lo conservan). Nunca se cortan el golden de la cadena, la matriz
de fixtures, el cupo ni el rótulo del redactor.

**Reglas de cierre:** ningún bloque se marca ✅ en `BITACORA.md` sin `npm test`, e2e y smoke **vistos correr**; las
deudas van a «Deudas conocidas (honestas)».

## 11. Honestidad, deudas declaradas y riesgos

### 11.1 Qué se promete

Cada frase publicada de una crónica de arena pasó V1–V8 y la regla de tiempo de arena, y cita hechos deterministas
derivados de eventos del registro con sus ids. Es la promesa del 10 oct, no más: **las reglas no demuestran toda la
semántica de la prosa libre**. La página lo dice en «Límites», y el rótulo distingue modelo, stub, fixture y acta.

### 11.2 Deudas declaradas

- **D-1** El verificador no juzga persecuciones, presión, causas, tácticas ni relaciones espaciales (§ 4.3); hay una
  prueba que lo deja a la vista.
- **D-2** El papel de una cifra solo se comprueba en marcadores y tiempo: un dorsal dicho como cantidad pasa V3.
- **D-3** «m:ss» en la prosa no tiene regla propia (lo rechaza V3 por el «0» en casi todos los casos).
- **D-4** No hay hecho de remontada ni de gol tardío para la arena: el Verificador rechaza esas valoraciones.
- **D-5** «En inferioridad» y la doble amarilla como juicio se rechazan aunque haya roja (exigen
  `expulsion_y_efecto`).
- **D-6** El narrador en vivo pasa el autogol con `equipo` = beneficiado (`narrador.ts:27`), al revés que el Analista;
  aquí se usa la semántica del Analista y el narrador no se toca.
- **D-7** El cupo y la exclusión suponen una réplica.
- **D-8** La huella incluye la procedencia declarada; el primer origen registrado de una huella es el que se muestra
  (una subida anterior a la sesión deja el rótulo «importado» aunque luego llegue la sesión).
- **D-9** En las rutas heredadas el ES/EN de la barra no traduce el marco ni la crónica histórica.
- **D-10** En el host de crónicas, «Arena» y «Torneo» llevan a la arena de ese host, como el «Arena» de hoy; enlazar
  la arena pública desde allí es una mejora futura (`CRONISTA_ARENA_URL`).
- **D-11** El video (cuarto corte) muestra la barra anterior y no muestra la crónica de arena.
- **D-12** Sin limpieza del almacén de crónicas; acotado por `registrosDiarios`.

### 11.3 Riesgos

- **Plazo.** ≈ 24 h en dos días con otro implementador en el 063. Mitigación: bloques publicables y cortes del § 10.
- **`redirect()` sin 307** si Next emitiera *streaming*: lo detecta N1; el plan B es `proxy.ts`.
- **Refactor de la cadena:** el golden I10 y las pruebas existentes lo protegen; si el golden no queda idéntico, no se
  publica B.
- **Prosa de GPT-6.1 Sol rechazada** por las reglas de arena: el reintento con `feedback` y el acta cubren el caso; el
  coste está acotado por el cupo.
- **Latencia de hasta 150 s:** espera accesible, generación que sigue en el servidor y caché; en la segunda visita es
  instantánea.
- **Tamaño de registros de 180 s:** solo se envían al cliente los eventos de la línea de tiempo, no los fotogramas.
- **Conflictos con el 063** en `limites.ts`, `Arena.tsx` y `globals.css`: orden del § 9.

## 12. Fuera de alcance

- Generar crónicas al cerrar cada partido o en lote (un CLI de pregeneración para torneos queda para después, con
  autorización de Carlos).
- Que los modelos que jugaron escriban o comenten su crónica; comparar redactores.
- Hechos de remontada, de tramo temporal, de posesión dominante o de persecución.
- Reproductor embebido en la página de la crónica (se salta a la arena).
- Traducir el marco de las rutas heredadas; borrar `/match`, `/liga` o `/datos`.
- Cambios en el motor, el narrador, la Mesa, el estadista, las sesiones o el almacén de sesiones.
- Publicar el repositorio o subir el video (decisión de Carlos).

## Versión 1.1: decisiones tras la revisión de Codex (prevalece)

Revisión adversaria de Codex sobre `d1ee955` más el árbol del 063 sin commit (informe en el scratchpad de la sesión,
`codex-064.md`): **0 P0, 3 P1 y 4 P2**. Cada hallazgo se comprobó contra el código el 25 de octubre; los siete se
aceptan y ya están incorporados en el texto. Donde algo anterior contradiga esta sección, manda esta.

| # | Hallazgo | Comprobado | Resolución (dónde) |
| --- | --- | --- | --- |
| 1 (P1) | Las plantillas normativas del acta («Remates: …», «Shots …») fallan V4: no son aperturas de `FUNCIONALES` (`lexico.ts:539`), y el acta, que las copia, no estaría garantizada | Sí | Las plantillas abren con una palabra de `FUNCIONALES` o un nombre del plantel; el léxico no se amplía; ejemplos nuevos verificados literalmente por la unitaria 5; se quitan los hechos de formación (V3 lee «4-4» como marcador) y de condiciones (léxico de condiciones) (§ 4.2) |
| 2 (P1) | «Desde fuera del área» se certificaba con el recorrido del remate (`distanciaM`, `motor.ts:229`), no con su posición; el `a6` del fixture v5 sale de dentro del área y recorre 18,9 m | Sí | `metros` = recorrido (cifra citable); `distancia_m` solo si `!enAreaRival(tiro.desde, tiro.lado)`; prueba con el `a6` (§ 4.2, § 4.3, unitarias 5 y 6) |
| 3 (P1) | Cotas de entrada y gasto sin política ejecutable al excederse; caracteres ÷ 4 no es un máximo | Sí | Recorte por relevancia hasta caber, acta `tamano` definitiva si no caben los obligatorios, feedback y respuesta acotados, comprobación `antesDeLlamar` en cada intento, cota conservadora de 1 token por 2 caracteres y nuevo peor caso ≤ 0,31 USD por crónica y ≤ 4,65 USD/día; pruebas de exceso deliberado (§ 4.4, § 4.5, § 6, unitaria 5) |
| 4 (P2) | `equipo` oscilaba entre lado y nombre; el Verificador lo compara con nombres de club (`verificador.ts:439`) | Sí | `local`, `visita`, `equipo` y `beneficiado` son siempre nombres de club; pruebas de «gol de la victoria» y «definitivo» con goles de cada equipo y autogoles (§ 4.2, unitaria 5) |
| 5 (P2) | `golDeRemate` devuelve un booleano y no identifica el tiro | Sí | Se extrae `tiroDelGol(gol, registro)` del mismo recorrido por posición; `golDeRemate` = `tiroDelGol(…) !== null` sin cambio de conducta; prueba con dos tiros del goleador (§ 4.2) |
| 6 (P2) | «segundo N» / «second N» chocan con el ordinal 2 del V3 histórico (`lexico.ts:71`) | Sí | Solo se prometen «N s» y el plural «N segundos» / «N seconds»; el singular y «segundo N» quedan rechazados y documentados (§ 4.3, unitaria 6) |
| 7 (P2) | Ninguna prueba ejercía `CRONISTA_RAIZ=cronicas` | Sí | Unitaria de la página raíz con y sin la variable y comprobación en `smoke-public.mjs --raiz cronicas` (§ 8.1.1, § 8.4.6) |

**Cambios en las listas.** Constantes: `maxTokensSalida` 5 000; `maxCaracteresEntrada` 22 000 (system + mensaje
inicial); nuevas `maxCaracteresFeedback` 4 000 y `maxCaracteresRespuesta` 12 000; `maxPorClase` y `relevancia` sin
formación ni condiciones. `OpcionesRedaccion` añade `feedback`, `antesDeLlamar` y `maxCaracteresRespuesta`, todos
opcionales y sin efecto en la cadena histórica (I10). Archivos: `src/arena/relato.ts` pasa a la lista de
modificados (solo `tiroDelGol`) y `src/arena/ataque.ts` se importa, no se modifica. Nueva prueba
`src/app/__tests__/raiz-pagina.test.ts`. Deuda nueva **D-13**: el narrador en vivo sigue dando `distancia_m` a los
remates lejanos por su recorrido (063 § 8.3), y un remate de más de 25 m puede salir de la esquina del área
(≈ 26 m al centro del arco); este brief no toca el narrador.

## Versión 1.2: segunda ronda de Codex (prevalece)

Segunda y última ronda (informe `codex-064-r2.md` en el scratchpad de la sesión): **0 P0, 1 P1, 3 P2**, todos
aceptados. Codex confirmó, ejecutándolas literalmente contra el verificador histórico, que las plantillas
normativas de resultado, gol, remates, atajadas y final anticipado **pasan**; que `tiroDelGol` conserva el recorrido de
`golDeRemate`; y que `!enAreaRival(tiro.desde, tiro.lado)` corrige la posición de salida.

| # | Hallazgo | Resolución |
| --- | --- | --- |
| 1 (P1) | La cota de gasto no es un máximo (caracteres ÷ 2 es estimación, no contaba el esquema) y la aritmética daba 4,68, no 4,65 | El coste pasa a **tope por estimación** (precedente del 059); lo garantizado es cupo, llamadas, `maxTokens` y tamaño en caracteres, que ahora incluye el esquema (`maxCaracteresEsquema`); margen de protocolo de 1 000 tokens por llamada; nuevo tope estimado ≈ 0,34 USD por crónica y ≈ 5,04 USD/día (§ 4.5, § 6) |
| 2 (P2) | El recorte por tamaño se hacía en el servicio y la lectura recalculaba la lista completa: hash distinto o ids distintos | Una sola función determinista, `seleccionCronicaArena(registro)` (catálogo → `maxHechos` → ajuste a `maxCaracteresEntrada`, con `SISTEMA_CRONICA_ARENA` fijo), devuelve `{ hechos, cabe }`; la usan la generación, el `GET` y la página; `hashHechos` se calcula sobre esa selección; `cabe: false` = acta `tamano`. Prueba nueva en la unitaria 7: generar con un registro que obliga a recortar, releer → estado `lista` con los mismos ids |
| 3 (P2) | La regla temporal no definía qué admite el título | En el título, que no tiene principal, solo vale `duracion_s` del resultado; unitaria 6: «… en 60 s» aceptado y «… a los 34 s» rechazado en el título |
| 4 (P2) | N2 visitaba `/arena/cronica/<h>`, que es del bloque B | Esa ruta sale de N2 y pasa a la nueva B8; el bloque A puede quedar verde solo |

Con esta ronda se cierra la revisión del diseño (máximo de dos rondas). La implementación de cada bloque tendrá su
propia ronda de Codex antes de publicar.
