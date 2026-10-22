# 049 — Cifras del partido, estadísticas por jugador y favoritos en la arena

## Estado

Brief **cerrado** el 22 de octubre de 2026, escrito por Fable. Debe poder implementarse en
**un día** (la entrega cierra el 27 de octubre; meta interna 26). Por eso trae una prioridad
explícita (§ 8): lo marcado **P1** es obligatorio; lo marcado **P2** solo entra si P1 está en
verde a media tarde, y lo recortado se declara tal cual en la bitácora.

Pedido de Carlos (22 de octubre), para la arena en vivo (`/arena`):

1. **Modo club favorito / jugador favorito.** El reto oficial (§4.1(e), personalización)
   nombra «favorite club(s), favorite player(s), player focused mode». Hoy existen el estilo
   fan/analyst, ES/EN y la selección de un jugador en la cancha, pero nada persiste y nada
   se refiere a un club.
2. **Estadísticas por jugador en tiempo real** al seleccionarlo en la cancha: distancia
   recorrida, balones perdidos y recuperados, velocidad máxima, faltas cometidas y
   recibidas, remates directos e indirectos y lo que el registro permita.
3. **Panel de cifras del partido** al estilo «Top Stats» de 365scores (posesión, goles
   esperados, remates, remates a puerta, grandes chances, saques de esquina, fueras de
   juego, pases completados, tarjetas…, con el lado que lidera resaltado), al final del
   partido y, si se puede, en vivo siguiendo el cursor.

Punto de partida: [045](045-tres-voces.md) (estadista determinista), [046](046-portero-centros-y-robo.md)
(`reinicios-v4`: `motivo: "centro"` y `"saque_manos"`, manos del portero), [047](047-rediseno-visual-arena.md)
(tokens `--ar-*`) y [048](048-dialogo-entre-voces.md) (ya implementados y publicados, revisión
`0000015`). Este brief **no cambia** el motor, `RegistroArena`, `hechosArena`, V1–V8, la
crónica principal, el Analista histórico ni el estadista hablado (salvo una extracción sin
cambio de resultado, § 2.3).

## 1. Hechos verificados en el código (22 oct)

- **Cadencia.** `ARENA.pasoS = 0,1` s por tick; el motor guarda un fotograma cada
  `ARENA.fotogramaS = 0,5` s (`tick % 5 === 0`), **más** uno en cada transición (evento
  `plan_equipo`, `cambio`, `falta`, `amarilla`, `roja`, y `reinicio` con reglas de
  reinicios), al final de cada avance y al final anticipado (`motor.ts:683`). Los
  fotogramas **no son equiespaciados**; toda integral temporal pondera por `b.tick − a.tick`.
- **Fotograma** (`EstadoArena`): `jugadores[]` con `posicion`, `velocidad` (vector del
  motor, m/s), `energia`, `puesto`, `lado`; `balon.poseedor`, `balon.vuelo` (`tipo`
  pase/tiro/rechace, `lado`, `autor`), `balon.manos` (v4); `banco`, `retirados`,
  `expulsados`, `marcador`. Un fotograma solo lista en `jugadores` a quienes están en
  cancha en ese instante.
- **Eventos** (`EventoArena`): `pase` (receptor = destinatario previsto; `motivo` `centro` o
  `saque_manos` en v4), `recepcion` / `intercepcion` / `atajada` (`receptor` = autor del
  vuelo; la atajada lleva el `lado` del portero), `recuperacion` (balón suelto,
  `receptor: null`), `tiro`, `gol` (`jugador` = autor; con `autogol: true` el `lado` es el
  beneficiado y el autor es rival), `tiro_fuera`, `fuera_juego` (`jugador` = adelantado,
  su lado), `reinicio` (`jugador` = ejecutor, `reinicio` ∈ centro/banda/esquina/meta, o
  `motivo: "falta"` tras falta, o sin ambos = reanudación del portero), `falta`
  (`jugador` = infractor, `receptor` = víctima, `gravedad`), `amarilla`, `roja`
  (`dobleAmarilla`), `cambio` (`jugador` = entra, `sale`), `plan_equipo`,
  `final_anticipado`. `pase` y `tiro` llevan `tick + 1` respecto del estado en que se
  decidieron (`motor.ts:176`).
- **Desvío pre-v3**: `atajada` con `motivo: "desvio"` seguida, en v1/v2, de un
  `tiro_fuera` o una recepción/intercepción del **mismo vuelo**; desde v3 el desvío es un
  `rechace` del portero y quien lo recoge genera `recuperacion` sin relación.
- **Estadista 045** (`src/arena/estadista.ts`): `rematesPorLado(eventos, tick)` define
  «remate» = solo `tiro` y «a puerta» = primer desenlace posterior sin otro `tiro` en
  medio que sea `gol` del mismo lado y jugador o `atajada` cuyo `receptor` es el
  rematador. Esa regla se **reutiliza**, no se copia (§ 2.3).
- **Fixtures**: `src/arena/__fixtures__/arena-reinicios-v{1,2,3,4}.json` (60/30/40/60 s;
  v1 trae faltas y amarillas, v2 y v3 cambios, v4 `centro` y `saque_manos`, v1 y v2
  desvíos pre-v3) y `arena-v2.json` (legado sin reglas). Ejemplos públicos:
  `public/experimentos/arena-llm-v1.json` (10 s, sin reinicios ni árbitro),
  `arena-llm-v3.json` (60 s: 5 tiros, 3 atajadas, 2 goles) y `arena-duelo-v3.json`.
- **UI**: la ficha del jugador vive en `src/ui/ArenaPlantilla.tsx`
  (`data-testid="arena-player-card"`, con `dl.arena-player-metrics` de nivel y energía);
  la selección (`seleccionado`) y el cursor (`tiempo`, `estado = estadoVisual(...)`) viven
  en `src/ui/Arena.tsx`; el marcador es `.arena-score` (Z4 del 047); el 047 fija tokens
  `--ar-home/-away/-bug/-live/-s1…s7/-r…` y una lista cerrada de selectores e2e que deben
  seguir resolviendo igual. `sessionStorage` ya se usa en `ArenaEnDirecto.tsx` (sin
  `try/catch`); no hay `localStorage` en el proyecto.
- **xG del simulador histórico** (`src/sim/motor.ts`, `sortearXg`): es un **generador**
  lognormal con desplazamientos por fuerza/estilo/fatiga, no un estimador por posición.
  No sirve para estimar un remate de la arena a partir de `desde`. Las bandas por zona
  (`ZONA_XG_BANDAS`, `XG_ALTO.xgMin = 0,3`) solo se citan como referencia de orden de
  magnitud.
- **Nombres de club**: `src/sim/plantillas.ts` sortea prefijo + lugar por semilla; cada
  partido nuevo trae clubes distintos. Los nombres de los tres ejemplos públicos y de
  los fixtures son estables.

## 2. Modelo de datos y funciones puras — `src/arena/estadisticas.ts` (P1)

Código determinista, sin LLM, sin estado de módulo. Todo recibe `(registro, tick)` y usa
**solo** `eventos` con `e.tick ≤ tick` y `fotogramas` con `f.tick ≤ tick`. Nunca lee
`registro.final` ni un fotograma posterior: así vale para el cursor, para la emisión en
búfer (el registro del cliente contiene fotogramas por delante del cursor) y para el
final.

### 2.1 Tipos

```ts
export type ClaseCifra = "registrada" | "estimada";
export interface Cifra<T = number> {
  clave: ClaveCifra; valor: T | null;            // null = no aplicable («—»)
  clase: ClaseCifra;
  evidencia: EvidenciaMesa;                      // de ./protocolo: { eventos, intervalo?, fuente? }
}
export interface CifrasJugador { jugador: string; lado: Lado; tick: number; cifras: Record<ClaveCifraJugador, Cifra>; }
export interface CifrasEquipo { tick: number; filas: FilaPanel[]; final: boolean; }
export interface FilaPanel { clave: ClaveCifraEquipo; clase: ClaseCifra; local: Cifra; visita: Cifra; lider: Lado | null; }
export function cifrasJugador(registro: RegistroArena, tick: number, jugador: string): CifrasJugador;
export function cifrasEquipos(registro: RegistroArena, tick: number): CifrasEquipo;
export function desenlaceRemate(eventos: readonly EventoArena[], indice: number): DesenlaceRemate; // § 2.3
export function xgRemate(desde: Punto, lado: Lado): number;                                        // § 2.5 (P2)
```

`EvidenciaMesa` ya existe en `src/arena/protocolo.ts` (la usa el estadista): `eventos`
lleva los ids que sustentan la cifra, en el orden del registro; las cifras de fotogramas
llevan `intervalo: [0, tick]` y `fuente: "fotogramas"`. `final` es verdadero cuando
`tick ≥ registro.final.tick` y además `registro.final.finalizado` o
`tick · pasoS ≥ config.duracionS` (misma condición que habilita «Descargar registro»).

### 2.2 Máquina de posesión (una pasada sobre los eventos)

Varias cifras necesitan saber **quién tenía el balón** antes de un evento. Se define una
sola pasada, en orden del registro, con este estado: `poseedor: string | null` (último
jugador que **ganó** el balón), `ladoPosesion: Lado | null`, `paseAbierto: EventoArena |
null` (último `pase` sin desenlace), `remateAbierto` (ídem para `tiro`).

Eventos **de balón** (los demás —`plan_equipo`, `cambio`, `amarilla`, `roja`,
`final_anticipado`, `falta`— no alteran el estado):

| Evento | Efecto |
| --- | --- |
| `pase`, `tiro` | `paseAbierto`/`remateAbierto` = el evento; `poseedor` = autor; `ladoPosesion` = su lado |
| `recepcion` | cierra `paseAbierto` como **completado** si `receptor === paseAbierto.jugador` y mismo lado; `poseedor` = receptor del balón (el `jugador`) |
| `intercepcion` | cierra `paseAbierto` como **interceptado** si `receptor === paseAbierto.jugador`; cuenta **recuperación** del `jugador`; `poseedor` = `jugador` |
| `recuperacion` | si `ladoPosesion` ≠ `jugador.lado` y el último ganador no fue una `atajada` con `motivo: "desvio"` ni `poseedor === null`, cuenta **pérdida por desposesión** para `poseedor` y **recuperación** para `jugador`; si `ladoPosesion === jugador.lado` no cuenta nada (balón suelto propio); `poseedor` = `jugador` |
| `atajada` | cierra `remateAbierto` (§ 2.3); `poseedor` = portero; con `motivo: "desvio"` se marca `suelto` para la regla anterior |
| `fuera_juego` | cierra `paseAbierto` como **fuera de juego** (pérdida del pasador); `poseedor = null` |
| `reinicio` | cierra `paseAbierto`/`remateAbierto` sin desenlace («fuera» si el reinicio es del lado rival y hay pase abierto: pérdida del pasador); `poseedor` = ejecutor |
| `gol`, `tiro_fuera` | cierran `remateAbierto` (§ 2.3); `poseedor = null` |

Un pase o remate que sigue abierto cuando se acaba el prefijo es **pendiente**: no cuenta
como completado ni como perdido, y la precisión no lo incluye en el denominador. Esto
evita que una cifra «baje» un instante en vivo.

Esta máquina es **propia del 049**. `resumir` (`src/arena/entorno.ts`, lo que ven los
controladores) conserva su definición por lados y no se toca.

### 2.3 Remates: reutilizar la regla del 045

Se **extrae** de `rematesPorLado` la función `desenlaceRemate(eventos, i)` para el `tiro`
en la posición `i`, y `rematesPorLado` pasa a llamarla. Resultado:

```ts
type DesenlaceRemate = { tipo: "directo" | "indirecto" | "pendiente"; evento: EventoArena | null };
```

Recorriendo los eventos posteriores a `i`: otro `tiro` de cualquier lado cierra como
`indirecto` sin evento; `gol` del mismo lado y jugador → `directo`; `atajada` con
`receptor === tirador` → `directo` (un desvío pre-v3 con `tiro_fuera` posterior cuenta una
vez, por la atajada, como hoy); `tiro_fuera` del tirador → `indirecto`; `recepcion`,
`intercepcion` o `recuperacion` con `receptor === tirador` (bloqueo o control de un
remate) → `indirecto`; un `gol`/`atajada`/`tiro_fuera` que no case con el tirador cierra
como `indirecto` (como hoy); si el prefijo se acaba sin nada de esto → `pendiente`.
**Invariante exigido:** el conteo «a puerta» de `rematesPorLado` sobre los cuatro fixtures
y sobre 20 semillas programadas es idéntico antes y después de la extracción (la prueba
guarda los valores previos en el propio test, calculados con la función anterior copiada
en el archivo de prueba, no con cifras a mano).

Decisión sobre los términos de Carlos: **remate directo = remate a puerta** (gol o
atajada del 045); **remate indirecto = remate con desenlace que no fue a puerta** (fuera,
bloqueado por un jugador de campo o controlado, o cerrado por otro remate sin desenlace).
Los pendientes se cuentan en «remates» pero en ninguna de las dos clases. En la interfaz
ambos términos llevan su glosa («a puerta» / «fuera o bloqueado»).

### 2.4 Cifras por jugador (todas P1 salvo las marcadas)

| Clave | Clase | Fórmula (sobre el prefijo ≤ tick) | Evidencia |
| --- | --- | --- | --- |
| `goles` | registrada | `gol` con `jugador = j` y `lado = j.lado` | ids de los goles |
| `autogoles` | registrada | `gol` con `jugador = j` y `autogol` | ids |
| `remates` | registrada | `tiro` con `jugador = j` (incluye pendientes) | ids de los tiros |
| `remates_directos` | registrada | tiros de j con desenlace `directo` (§ 2.3) | tiro + desenlace |
| `remates_indirectos` | registrada | tiros de j con desenlace `indirecto` | tiro (+ desenlace si lo hay) |
| `pases` | registrada | `pase` con `jugador = j` (centros y saque de manos incluidos) | ids |
| `pases_completados` | registrada | pases de j cerrados como completados (§ 2.2) | pase + recepción |
| `precision_pase` | registrada | `round(100 · completados / resueltos)`; `null` si `resueltos = 0` | los mismos |
| `distancia_media_pase` | registrada | `round(media de distanciaM de los pases de j)`; `null` sin pases | ids |
| `centros` | registrada | pases de j con `motivo: "centro"` (0 en registros < v4) | ids |
| `recuperaciones` | registrada | intercepciones de j + recuperaciones de j que cambian la posesión (§ 2.2) | ids |
| `perdidas` | registrada | pases de j interceptados, en fuera de juego o fuera por reinicio rival + desposesiones (§ 2.2) | pase/evento de cierre; recuperación rival |
| `faltas_cometidas` | registrada | `falta` con `jugador = j` | ids |
| `faltas_recibidas` | registrada | `falta` con `receptor = j` | ids |
| `amarillas`, `rojas` | registrada | `amarilla`/`roja` con `jugador = j` | ids |
| `fueras_juego` | registrada | `fuera_juego` con `jugador = j` | ids |
| `atajadas` | registrada | `atajada` con `jugador = j`; solo se muestra si `puesto === "POR"`; detalle «de ellas N desvíos» (`motivo: "desvio"`) | ids |
| `acciones_balon` | registrada | eventos de j de tipo pase, recepcion, intercepcion, recuperacion, tiro, atajada, reinicio | ids (hasta los últimos 12 en la UI; la cifra cuenta todos) |
| `distancia_m` | registrada (muestreo) | Σ sobre pares de fotogramas consecutivos `(a, b)` con `b.tick ≤ tick`, j presente en ambos y **sin** evento `reinicio` ni `cambio` con `a.tick < e.tick ≤ b.tick`, de `hypot(Δx, Δy)`; redondeo a metros | `{ intervalo: [0, tick], fuente: "fotogramas" }` |
| `velocidad_max_kmh` | registrada (muestreo) | `max` sobre fotogramas `f.tick ≤ tick` de `hypot(j.velocidad) · ESTADISTICAS_ARENA.kmhPorMps`, un decimal; `null` si j no aparece en ningún fotograma | ídem |
| `posesion_s` | registrada (muestreo) | Σ `(b.tick − a.tick) · pasoS` sobre pares con `a.balon.poseedor === j.id`; un decimal | ídem |
| `xg` | **estimada (P2)** | Σ `xgRemate(tiro.desde, j.lado)` sobre tiros de j, dos decimales | ids de los tiros |

Los pares de fotogramas saltados por `reinicio`/`cambio` evitan contar como carrera la
recolocación de los jugadores (saque de centro tras gol, distancias de saque, entrada de un
suplente por la banda). Un jugador que no está en `jugadores` en uno de los dos fotogramas
(banco, retirado, expulsado) no suma ese par.

### 2.5 Cifras por equipo (panel) y líder

Orden normativo de filas = `ESTADISTICAS_ARENA.filasPanel`:

| Clave | Clase | Fórmula por lado | Mejor |
| --- | --- | --- | --- |
| `posesion_pct` | registrada (muestreo) | tiempo atribuido al lado / tiempo atribuido total, en %, redondeado para que sumen 100 (visita = 100 − local); atribución por par `(a, b)`: `a.balon.poseedor` → lado del poseedor; si no, `a.balon.vuelo?.lado` (un `rechace` conserva el lado del remate); si no, `a.balon.manos` → lado del portero; si nada, el par no se atribuye. `null` ambos si no hay tiempo atribuido | mayor |
| `xg` | **estimada (P2)** | Σ `xgRemate` de los tiros del lado | mayor |
| `remates` | registrada | tiros del lado | mayor |
| `remates_directos` | registrada | a puerta (= `rematesPorLado(...).aPuerta`, misma cifra que el estadista) | mayor |
| `remates_indirectos` | registrada | desenlace `indirecto` | mayor |
| `grandes_chances` | **estimada (P2)** | tiros con `xgRemate ≥ XG_ARENA.granChance` | mayor |
| `esquinas` | registrada | `reinicio` con `reinicio: "esquina"` y `lado` | mayor |
| `fueras_juego` | registrada | `fuera_juego` del lado | **menor** |
| `pases_completados` | registrada | Σ por jugadores del lado (se muestra «597 / 640» con intentados en pequeño) | mayor |
| `precision_pase` | registrada | completados / resueltos del lado, % | mayor |
| `recuperaciones` | registrada | Σ por jugadores | mayor |
| `perdidas` | registrada | Σ por jugadores | **menor** |
| `faltas` | registrada | `falta` del lado | **menor** |
| `amarillas` | registrada | `amarilla` del lado | **menor** |
| `rojas` | registrada | `roja` del lado | **menor** |
| `atajadas` | registrada | `atajada` del lado | mayor |

`lider` = el lado con mejor valor según la columna «Mejor» (`ESTADISTICAS_ARENA.mejorMenor`
lista las claves donde gana el menor); `null` en empate o cuando alguno es `null`. Es una
decisión de presentación (365scores resalta el mayor en todas; aquí resaltar más faltas
sería un contrasentido).

Las filas `faltas`, `amarillas`, `rojas` y `esquinas` en un registro sin árbitro o sin
reglas de reinicios (`!registro.inicial.entrenadores` / sin `config.reglas`) muestran
`0` con la nota «no simulado en este registro» (misma condición que ya usa la ficha para
«no se simulan faltas»).

### 2.6 Modelo xG de la arena (P2, estimado)

No se reutiliza el xG del simulador histórico (§ 1). Modelo geométrico determinista, con
constantes en `XG_ARENA` y **rotulado «estimado»** en toda la interfaz:

```
arco rival: x = largoM (local) | 0 (visita); postes en y = anchoM/2 ± arcoM/2
d  = distancia(desde, centro del arco)
θ  = ángulo que abarcan los dos postes vistos desde `desde` (radianes; 0 si desde está
     sobre o detrás de la línea de fondo)
θ₀ = ángulo desde el punto penal centrado: 2 · atan((arcoM/2) / XG_ARENA.puntoPenalM)
xg = clamp(XG_ARENA.base · (θ / θ₀) · exp(−max(0, d − XG_ARENA.distanciaLibreM) / XG_ARENA.escalaM), XG_ARENA.min, XG_ARENA.max)
```

Propiedades exigidas (pruebas): simétrico en `y` respecto del centro; no creciente con
`d` a ángulo fijo; no decreciente con `θ`; siempre en `[min, max]`; el valor en el punto
penal se calcula en la prueba a partir de las constantes (no se escribe a mano). No está
calibrado contra nada: solo ordena remates por geometría. Una «gran chance» es un remate
con `xg ≥ XG_ARENA.granChance`.

### 2.7 Rendimiento

Una llamada a `cifrasEquipos` o `cifrasJugador` es O(eventos + fotogramas) salvo
`desenlaceRemate`, O(remates · eventos). Un partido de 180 s tiene ~360 fotogramas
regulares más transiciones y unos pocos cientos de eventos: muy por debajo de un
milisegundo por llamada. Aun así:

- `Arena.tsx` calcula `const tickCifras = Math.floor(tiempo / ARENA.pasoS + 1e-9)` y
  memoiza `cifrasEquipos` con `useMemo(…, [registro, tickCifras])` y `cifrasJugador` con
  `[registro, tickCifras, jugadorActivo.id]`. Durante la reproducción a 60 fps el tick
  entero cambia como mucho 10 veces por segundo de partido (× velocidad).
- No hay cálculo incremental ni caché entre ticks (la complejidad no lo necesita).
- Prueba de humo (no benchmark): sobre un registro programado de 180 s, 100 llamadas a
  `cifrasEquipos` en el último tick tardan < `ESTADISTICAS_ARENA.humoMsPor100Llamadas`.

## 3. Favoritos (P1)

### 3.1 Modelo y persistencia

```ts
export interface FavoritosArena { club: string | null; jugador: { club: string; dorsal: number; nombre: string } | null; }
export function leerFavoritos(almacen: Pick<Storage, "getItem"> | null): FavoritosArena;   // nunca lanza; inválido ⇒ vacío
export function guardarFavoritos(almacen: Pick<Storage, "setItem"> | null, f: FavoritosArena): boolean;
export function favoritosEn(registro: RegistroArena, f: FavoritosArena): { lado: Lado | null; jugador: string | null };
```

- **Decisión: `localStorage`**, clave `ESTADISTICAS_ARENA.claveFavoritos`
  (`"cronista:arena:favoritos:v1"`), JSON validado con `zod` al leer. Toda lectura y
  escritura va en `try/catch` (modo privado, cuota, `SecurityError`): si falla, la
  interfaz funciona igual y muestra «No se pudo guardar tu favorito en este navegador».
  No se usa un parámetro de URL: el enlace compartido (`?partido=`) identifica una
  transmisión, no a un espectador, y un favorito en la URL se colaría en cada enlace
  copiado. `sessionStorage` no sirve: debe sobrevivir al cierre de la pestaña.
- **Identidad entre partidos**: el club por `nombre`; el jugador por `club + dorsal +
  nombre` (los dorsales se repiten entre clubes). `favoritosEn` resuelve contra
  `registro.config.partido.{local,visita}.nombre` y la plantilla inicial más el banco.
- **Límite honesto**: cada partido nuevo sortea clubes distintos (§ 1), así que el
  favorito solo «reaparece» en los ejemplos archivados, en registros reimportados y
  en partidos con la misma semilla. La interfaz lo dice cuando el favorito no juega.

### 3.2 Efectos en la interfaz

Vive en `src/ui/ArenaFavoritos.tsx` (estrellas y texto) y se cablea en `Arena.tsx`:

- **Estrella por club** en el marcador (`.arena-score`): un `<button type="button"
  className="arena-fav-toggle" aria-pressed data-testid="arena-favorite-club"
  data-side="local|visita">` con `aria-label` «Marcar X como club favorito» / «Quitar X de
  favoritos». Un solo club favorito a la vez. Restricción 047: `.arena-score strong`
  sigue conteniendo solo el marcador y el nombre del local sigue dentro de `.arena-score`
  (el botón va **dentro del `span` del equipo, después del nombre**, con `content`
  decorativo solo por CSS en un `<span aria-hidden>` propio, nunca en `::before`).
- **Estrella por jugador** en la ficha (`arena-player-card`), `data-testid="arena-favorite-player"`.
- **Resaltado**: la ficha del jugador favorito en la cancha lleva `data-favorite="true"`
  (anillo con `--ar-live`, grosor igual al de la selección; sin `transform`, conforme al
  047); el nombre del club favorito en el marcador y su columna en el panel llevan
  `data-favorite="true"`.
- **Preselección**: al cargar o recibir un registro (`ejecutar`, `recibirPreparado`,
  `inicio` en directo), si `favoritosEn` resuelve un jugador, `seleccionado` arranca en él
  en lugar del capitán local; si solo resuelve un club, en el capitán de ese club. La
  selección manual sigue mandando después.
- **Modo centrado en el jugador**: `ArenaInteligencia` arranca en `player` cuando hay
  jugador favorito presente (hoy `fan`); el selector sigue cambiándolo. La pregunta al
  analista «¿Qué ha hecho el jugador seleccionado?» ya usa la selección: sin cambios.
- **Sin favorito presente**: una línea en la ficha, «Tu club favorito, X, no juega este
  partido» (o jugador), con botón «Olvidar favorito».
- P2: casilla «Solo mi jugador» en «Últimas acciones» que filtra `eventos` a los que
  nombran al favorito (`jugador`, `receptor`, `sale`) más los goles; el contador del
  enlace «Descripción completa · N acciones» no cambia.

## 4. Interfaz de cifras

### 4.1 Ficha del jugador en vivo (P1) — `ArenaPlantilla.tsx`

Tras `dl.arena-player-metrics` se añade `<dl className="arena-player-stats"
data-testid="arena-player-stats" data-tick={tick}>` con un `<div data-stat="clave">` por
cifra, en este orden: goles (y autogoles si > 0), remates «directos / indirectos»,
pases «completados / intentados» con precisión, recuperaciones, pérdidas, faltas
«cometidas / recibidas», tarjetas (solo si > 0), fueras de juego (solo si > 0), atajadas
(solo POR), distancia (m), velocidad máxima (km/h), tiempo con el balón (s), acciones con
balón; P2: xG «estimado». Valores `null` se muestran «—». Debajo, un `<details>` «Ver
los eventos de estas cifras» con, por cifra, los ids de evidencia como botones
`arena-evidence-link` que llaman a `saltar(e.tick · pasoS)` cuando el transporte está
habilitado (no en directo ni con audio activo, misma condición que el deslizador).
Los `meter` de rasgos siguen siendo exactamente 9 (e2e vigente).

Nota al pie de la ficha (una vez, `arena-muted`): «Cifras registradas a partir de los
eventos y fotogramas del motor (muestreo cada 0,5 s). Distancia y velocidad son
aproximaciones por muestreo.» / EN equivalente.

### 4.2 Panel «Cifras del partido» (P1) — `src/ui/ArenaCifras.tsx`

Se inserta en `.arena-board` **después** del transporte (`arena-playback`/`arena-seek` y su
párrafo) y antes de cerrar la sección, como `<section className="arena-stats"
data-testid="arena-stats" aria-label="Cifras del partido" data-final={final || undefined}>`.
No altera la alineación superior de `.arena-board` con el acompañante (criterio 047).

Contenido:

- Cabecera: `overline` «Cifras del partido · en vivo» o «Cifras finales» (`final`), y el
  instante del cursor (`reloj(tick · pasoS)`).
- Una fila por `filasPanel`: `<div className="arena-stat-row" data-stat="clave"
  data-leader="local|visita|none" data-class="registrada|estimada">` con el valor local
  a la izquierda, la etiqueta centrada (con sufijo «estimado» en las estimadas) y el
  valor visitante a la derecha; debajo, dos barras (`.arena-stat-bar[data-side]`) cuyo
  ancho es `valor / (local + visita)` (para `%`, el valor), con un mínimo de
  `ESTADISTICAS_ARENA.barraMinPct` cuando el valor es > 0 y 0 cuando es 0. El lado líder
  lleva el valor en negrita con `--ar-live` sobre fondo `--ar-bug` (contraste AA ≥ 4,5:1;
  comprobar en claro y oscuro con `docs/evidencia/rediseno-047/contraste.mjs`); el otro
  en `--ar-bug-muted`. Las barras usan `--ar-home-ui` / `--ar-away-ui`.
- Pie: leyenda «registrado» / «estimado» y un `<details>` «Consultar eventos» con los ids
  por fila (texto; en la ficha ya hay botones de salto).
- Vacío: antes del primer evento, «Esperando el inicio» (`.arena-empty`), sin filas de
  ceros.
- Final (P2): bloque «Destacados» con `ESTADISTICAS_ARENA.destacados` líneas: más remates
  a puerta, más recuperaciones, más distancia (empates: el primero en orden de plantilla,
  local antes que visita), cada una con nombre, dorsal, club y cifra.

Barras y énfasis sin transición cuando `prefers-reduced-motion: reduce`; con movimiento,
`width` transiciona 160 ms (token de movimiento del 047). A 360 px: etiqueta encima de los
dos valores, barras a ancho completo, `scrollWidth ≤ 360`.

### 4.3 Etiquetas ES/EN (lista cerrada)

| Clave | ES | EN |
| --- | --- | --- |
| posesion_pct | Posesión | Possession |
| xg | Goles esperados · estimado | Expected goals · estimated |
| remates | Remates | Shots |
| remates_directos | Remates directos (a puerta) | Shots on target |
| remates_indirectos | Remates indirectos (fuera o bloqueados) | Shots off target or blocked |
| grandes_chances | Grandes chances · estimado | Big chances · estimated |
| esquinas | Saques de esquina | Corners |
| fueras_juego | Fueras de juego | Offsides |
| pases_completados | Pases completados | Passes completed |
| precision_pase | Precisión de pase | Pass accuracy |
| distancia_media_pase | Distancia media de pase | Average pass distance |
| centros | Centros | Crosses |
| recuperaciones | Balones recuperados | Balls recovered |
| perdidas | Balones perdidos | Balls lost |
| faltas / faltas_cometidas / faltas_recibidas | Faltas / cometidas / recibidas | Fouls / committed / suffered |
| amarillas / rojas | Tarjetas amarillas / rojas | Yellow / red cards |
| atajadas | Atajadas | Saves |
| goles / autogoles | Goles / Autogoles | Goals / Own goals |
| acciones_balon | Acciones con balón | Ball actions |
| distancia_m | Distancia recorrida | Distance covered |
| velocidad_max_kmh | Velocidad máxima | Top speed |
| posesion_s | Tiempo con el balón | Time on the ball |

Las etiquetas viven en `src/arena/estadisticas.ts` (`ETIQUETAS_CIFRAS`), no en los
componentes, para que la prueba de completitud ES/EN sea una sola.

### 4.4 Selectores nuevos y restricciones 047

Nuevos: `arena-stats`, `arena-stat-row[data-stat][data-leader][data-class]`,
`arena-player-stats[data-tick]` con `[data-stat]`, `arena-favorite-club[data-side]`,
`arena-favorite-player`, `data-favorite` en `.arena-player`, en los `span` del marcador y
en las columnas del panel. Se conserva **toda** la lista cerrada del 047 (§ Restricciones):
ningún `data-testid`, atributo, clase, rol o texto de esa lista cambia; no se añaden
`<header>`, `<main>` ni `role="region"`; las secciones nuevas usan `aria-label` (permitido
para elementos nuevos con `section`, como ya hace `arena-live-text`); sin `transform` en
fichas; `.arena-score strong` solo con el marcador.

## 5. Constantes nuevas (`src/sim/limites.ts`, comentadas, después de `MESA_ARENA`)

```ts
/** Brief 049 · Cifras del partido y favoritos. */
export const ESTADISTICAS_ARENA = {
  /** Filas del panel, en orden; `xg` y `grandes_chances` solo si está implementado el P2. */
  filasPanel: ["posesion_pct", "xg", "remates", "remates_directos", "remates_indirectos", "grandes_chances", "esquinas", "fueras_juego", "pases_completados", "precision_pase", "recuperaciones", "perdidas", "faltas", "amarillas", "rojas", "atajadas"],
  /** Claves donde lidera el menor valor. */
  mejorMenor: ["fueras_juego", "perdidas", "faltas", "amarillas", "rojas"],
  /** Ancho mínimo (%) de una barra con valor > 0, para que siga visible. */
  barraMinPct: 4,
  /** Líneas de «Destacados» en la vista final. */
  destacados: 3,
  /** m/s → km/h. */
  kmhPorMps: 3.6,
  /** Evidencias listadas por cifra en la ficha (la cifra cuenta todas). */
  evidenciasVisibles: 12,
  /** Clave de localStorage de los favoritos; el sufijo versiona el formato. */
  claveFavoritos: "cronista:arena:favoritos:v1",
  /** Cota generosa de la prueba de humo de rendimiento (no es un benchmark). */
  humoMsPor100Llamadas: 500,
} as const;

/** Brief 049 (P2) · xG geométrico de la arena: SOLO ordena remates por distancia y ángulo.
 * Sin calibrar; no comparable con el xG del simulador histórico. Siempre «estimado». */
export const XG_ARENA = {
  base: 0.35, puntoPenalM: 11, distanciaLibreM: 6, escalaM: 12, min: 0.02, max: 0.6,
  /** Umbral de «gran chance»; coincide en magnitud con XG_ALTO.xgMin, pero es independiente. */
  granChance: 0.3,
} as const;
```

Ninguna prueba repite estas cifras a mano; todas las importan.

## 6. Interacción con 045/048 y con el motor

- El estadista hablado **no** cita cifras nuevas en este brief (posesión, xG, pérdidas…).
  Añadir temas a `TEMAS_ESTADISTA` cambiaría candidaturas, diálogos (048) y sus pruebas:
  queda para un brief posterior. Único punto de contacto: `desenlaceRemate` (§ 2.3), sin
  cambio de resultado.
- `remates_directos` por lado es la misma cifra que dice el estadista («a puerta»), así
  que el panel y la mesa nunca se contradicen (prueba).
- Nada se calcula en el servidor ni se publica en el diario de sesión: el cliente lo
  deriva del registro que ya tiene. No hay API nueva.
- Motor, `RegistroArena`, validador y fixtures intactos.

## 7. Pruebas exigidas

`src/arena/__tests__/estadisticas.test.ts`:

- **Recuento independiente** sobre `arena-reinicios-v1..v4.json` y `arena-v2.json`, en el
  último tick y en el tick del último `gol`: cada cifra de equipo y la de cuatro
  jugadores por fixture (los dos porteros, el máximo rematador y un suplente que entró,
  cuando exista) coincide con un recuento escrito aparte en la prueba con filtros propios
  (sin llamar a `estadisticas.ts`); `remates_directos` coincide con `rematesPorLado`.
- **Invarianza de prefijo / sin futuro**: para cada tick de evento y 10 ticks
  intermedios por fixture, `cifrasEquipos(r, t)` y `cifrasJugador(r, t, j)` son
  `toEqual` a las mismas sobre `prefijo(r, t)` (helper del `estadista.test.ts`); además,
  con un evento futuro extra añadido al registro (un `gol` en `tick + 1`) nada cambia.
- **Asociación a puerta**: secuencia sintética con remates seguidos de ambos lados
  (`tiro` L, `tiro` V, `atajada` con `receptor` del tirador V): L 1 remate 0 directos
  (indirecto), V 1/1; desvío pre-v3 (`atajada` + `tiro_fuera` del mismo vuelo): un
  remate, directo, un solo evento de desenlace; bloqueo (`intercepcion` con `receptor` =
  tirador): indirecto; remate sin desenlace en el prefijo: `remates` 1, directos 0,
  indirectos 0; **extracción sin cambio**: `aPuerta` de `rematesPorLado` idéntico al de
  la función anterior (copiada en el test) sobre fixtures y 20 semillas programadas.
- **Pases**: secuencia sintética con completado, interceptado, fuera de juego, fuera por
  reinicio rival, pase que se detiene y recupera un compañero (no completado, no
  perdido), pendiente; `precision_pase` usa solo resueltos y es `null` sin resueltos.
- **Pérdidas y recuperaciones**: desposesión en duelo (recuperación rival tras recepción
  propia) cuenta pérdida y recuperación; `recuperacion` tras `atajada` con `desvio` no
  cuenta pérdida del portero; recuperación de balón suelto propio no cuenta nada.
- **Distancia y velocidad con fotogramas construidos a mano**: tres fotogramas con
  desplazamientos (3, 4) m → 10 m; un `reinicio` entre el 2.º y el 3.º → 5 m; jugador
  ausente en un fotograma → solo los pares donde está; `velocidad_max_kmh` = máximo de
  `hypot(velocidad) · kmhPorMps`; en los cinco fixtures ningún jugador supera
  `ARENA.velocidadMps · (velocidadMinFactor + velocidadNivelFactor) · max(TECNICA_ARENA.ritmo)`
  en km/h (cota teórica; si falla, Opus reporta en vez de recortar).
- **Posesión con fotogramas construidos**: poseedor, vuelo (incluido `rechace` con lado
  del remate), manos, y par sin atribución; los porcentajes suman 100 o ambos son `null`;
  ponderación por `b.tick − a.tick` (par de 0,5 s y par de 0,1 s).
- **Líder**: `mejorMenor` invierte el sentido; empate ⇒ `null`; `null` en un lado ⇒ `null`.
- **xG (P2)**: simetría en `y`, monotonía en `d` y en `θ`, rango, punto penal calculado
  desde `XG_ARENA`/`ARENA.arcoM`; `grandes_chances` usa `granChance`; el xG de equipo es
  la suma de sus tiros.
- **Etiquetas**: toda clave de `filasPanel` y de la ficha tiene ES y EN; las estimadas
  llevan «estimado»/«estimated»; ninguna etiqueta contiene «xG» (coherencia con el 017:
  el aficionado lee «goles esperados»).
- **Humo de rendimiento** (§ 2.7).

`src/ui/__tests__/arena-cifras.test.tsx` (`renderToStaticMarkup`, fixture v3):

- Panel ES y EN a un tick intermedio: filas en el orden de `filasPanel`, `data-leader`
  coherente con `cifrasEquipos`, `data-class="estimada"` solo en xG/grandes chances,
  «en vivo» vs «Cifras finales» según `final`, estado vacío en el tick 0.
- Ficha: `arena-player-stats` a tick intermedio ≠ al final para el máximo rematador;
  `atajadas` solo con `puesto === "POR"`; render con el registro completo a tick `t`
  idéntico al render con `prefijo(r, t)`.
- Favoritos: `data-favorite` en la ficha de cancha y en el marcador cuando
  `favoritosEn` resuelve; texto «no juega este partido» cuando no.

`src/ui/__tests__/arena-favoritos.test.ts`: `leerFavoritos` con almacén `null`, con
`getItem` que lanza, con JSON inválido y con un objeto de otra forma ⇒ favoritos vacíos
sin lanzar; `guardarFavoritos` con `setItem` que lanza ⇒ `false`; ida y vuelta;
`favoritosEn` resuelve club y jugador por `club + dorsal + nombre` y no confunde dorsales
iguales de clubes distintos.

`e2e/arena-cifras.spec.ts` (un test, serializado como los demás de arena):

1. `/arena` → «Saved matches» → «Load AI coaches example» (v3, 60 s). Panel vacío en 0 s.
2. Clic en una ficha de cancha del local; `arena-player-stats[data-stat="remates"]`
   muestra 0; mover el deslizador «Match time» al final: el panel `arena-stats` muestra
   `remates` locales + visitantes = 5 y `atajadas` = 3 (cifras del fixture público,
   **leídas del JSON en el test**, no escritas a mano), `data-leader` de
   `remates_directos` coincide con el lado de mayor valor calculado en el test, la ficha
   del máximo rematador (determinado en el test desde el JSON) muestra sus remates y una
   distancia > 0.
3. Pulsar `arena-favorite-club` del visitante y `arena-favorite-player` del jugador
   seleccionado; recargar la página y volver a cargar el ejemplo: ambas estrellas
   `aria-pressed="true"`, la ficha de cancha del jugador lleva `data-favorite="true"` y
   la ficha `arena-player-card` muestra su nombre sin clic previo; «Audience» arranca en
   `player`.
4. «Switch to Spanish»: etiquetas ES del panel; a 360 px (`viewport` móvil, oscuro,
   movimiento reducido) `scrollWidth ≤ 360` con el panel y la ficha visibles.
5. «Load recorded AI run» (v1, sin árbitro): las filas de faltas y tarjetas muestran la
   nota «no simulado en este registro».

Mutaciones que deben romper pruebas: contar `tiro_fuera` como remate; asociar la
atajada por `lado`; quitar el filtro `e.tick ≤ tick` o `f.tick ≤ tick` (prefijo); no
saltar los pares con `reinicio` (distancia a mano); ponderar la posesión por número de
fotogramas en vez de por ticks; invertir `mejorMenor`; quitar el `clamp` del xG; quitar
el `try/catch` de `leerFavoritos`; quitar una etiqueta EN; devolver `rematesPorLado`
distinto tras la extracción.

`npm test`, `npm run typecheck`, `npm run lint` y los e2e de arena en verde; comprobación
de contraste con `contraste.mjs` sobre las filas líder en claro y oscuro antes de ✅.

## 8. Prioridad, orden del día y recortes

**P1 (obligatorio, en este orden):**

1. `estadisticas.ts` con la máquina de posesión, cifras por jugador y por equipo (sin
   xG), extracción de `desenlaceRemate`, constantes, pruebas unitarias (§ 7, bloque 1).
2. `ArenaCifras.tsx` + cifras en `ArenaPlantilla.tsx` + CSS con tokens 047 + prueba de UI.
3. `favoritos` (lectura/escritura, `favoritosEn`, estrellas, preselección, resaltado,
   modo `player` por defecto) + prueba.
4. E2e `arena-cifras.spec.ts` y contraste.

**P2 (solo si P1 está en verde antes de las 16:00):** xG geométrico y grandes chances;
«Destacados» finales; casilla «Solo mi jugador». Si P2 no entra, `filasPanel` se publica
sin `xg` ni `grandes_chances` y la bitácora lo declara como recorte del 049 (no como
deuda escondida).

**Recortado de este brief (no se hace):** mapas de calor, sprints, duelos ganados,
mapas de pases, comparación entre dos jugadores, desglose por tiempos, cifras en el
estadista hablado o en el diálogo 048, cálculo en el servidor o API, favoritos por URL,
favoritos en las crónicas históricas (`/match`), exportación CSV, ordenación de columnas
por favorito.

## 9. Fuera de alcance

- Cambios en el motor, en `RegistroArena`, en los fixtures, en el validador de registros
  o en los controladores (incluida `resumir`).
- Cambios en V1–V8, en el comentarista, en el narrador, en `MESA_ARENA` o en `TEMAS_ESTADISTA`.
- Calibrar el xG o cualquier otra cifra contra datos reales.
- Datos de terceros: ni estadísticas ni logotipos ni nombres reales.

## 10. Límites honestos y riesgos

- **Distancia y velocidad son aproximaciones por muestreo**: los fotogramas van cada 0,5 s
  (más transiciones); la suma de cuerdas subestima el recorrido real y la velocidad
  máxima es el mayor valor instantáneo **muestreado**, no el pico. La interfaz lo dice.
- **Posesión** sale de los fotogramas, con una regla de atribución propia (poseedor →
  vuelo → manos); un rechace cuenta para el equipo que remató. No es la posesión «por
  pases» de las transmisiones.
- **Pases completados** exigen el evento `recepcion`; un pase que se detiene y recoge un
  compañero no cuenta como completado ni como perdido. **Pérdidas** y **recuperaciones**
  siguen la máquina del § 2.2, que es una definición del proyecto; `resumir` usa otra, y
  ambas conviven porque sirven a públicos distintos (controladores vs espectador).
- **xG y grandes chances (P2) son un modelo geométrico sin calibrar**, rotulado
  «estimado»; no es el xG del simulador histórico ni es comparable con uno real.
- **Registros v1 y legados** no tienen faltas, tarjetas, esquinas ni centros: las filas
  muestran 0 con nota, no se ocultan (el cero es verdadero: no hay eventos).
- **Favoritos**: por navegador y dispositivo; los clubes cambian en cada partido nuevo,
  así que la persistencia luce sobre todo con los ejemplos archivados y las semillas
  repetidas. No se sincroniza entre dispositivos ni viaja en el enlace compartido.
- **Riesgo de tiempo**: la máquina del § 2.2 y sus pruebas son la parte más larga; si
  se atasca, se entrega antes el panel con las cifras directas por filtro (remates,
  goles, faltas, tarjetas, esquinas, fueras de juego, atajadas, pases intentados,
  distancia, velocidad, posesión) y se recortan «completados», «pérdidas» y
  «recuperaciones», declarándolo.
- **Riesgo de regresión** en el estadista por la extracción: lo cubre la prueba de
  igualdad de `rematesPorLado` y las pruebas vigentes del 045/048.
- **Riesgo visual**: el panel alarga `.arena-board`; a 1440×900 la Mesa sigue en el
  acompañante y la alineación superior no cambia, pero el pliegue baja. Si Carlos
  prefiere el panel en el acompañante, es un cambio de inserción de una línea.

## Versión 1.1 (22 de octubre): decisiones tras la revisión de Codex

Codex (GPT-6.1 Sol, solo lectura) revisó la versión 1 y la declaró **no cerrada**
([informe íntegro](../evidencia/estadisticas-049/codex-brief-v1.md): 2 bloqueantes, 10
mayores, 1 menor). Fable verificó cada hallazgo contra `motor.ts`, `estadista.ts`, los
fixtures y `package.json`. **Lo que sigue prevalece sobre el texto anterior** donde se
contradigan; la numeración es la del informe. Al final hay la lista de lo que cambia para
Opus, que ya implementa la versión 1 en el árbol de trabajo.

### 1. Final solo con el prefijo (bloqueante) — aceptado

Verificado: §2.1 prohibía leer `registro.final` y luego lo exigía; además, `prefijo()` de
`estadista.test.ts:13` sustituye `final` por el último fotograma, así que el registro
completo y su prefijo podían discrepar en `final`.

Regla única: `final = tick · ARENA.pasoS ≥ config.duracionS − 1e-9` **o** existe un evento
`final_anticipado` con `e.tick ≤ tick` **o** existe un fotograma `f.tick ≤ tick` con
`f.finalizado`. `registro.final` no se lee nunca. Prueba: igualdad `toEqual` de **todo**
`CifrasEquipo` (incluido `final` y `cubiertoHastaTick`, § 7) entre el registro completo
y `prefijo(r, t)` en tres cortes: `t = duracionS / pasoS` (final normal), un `t` entre el
último fotograma y la duración, y el tick de un `final_anticipado` en un registro
sintético (fixture v1 con un `final_anticipado` y un fotograma `finalizado` añadidos en
la prueba).

### 2. El pase detenido es un pase completado — aceptado

Verificado en `motor.ts:646–648` («Un pase que se detiene sigue pendiente de contacto:
se conserva quién golpeó») y `motor.ts:566–580`: el vuelo se conserva, y el siguiente
contacto genera `recepcion` (compañero) o `intercepcion` (rival) con el pasador en
`receptor`. Se retiran la frase de §2.2, la viñeta de §10 y la prueba «pase que se
detiene y recupera un compañero (no completado)». Nueva prueba: esa secuencia cuenta
**completado** con evidencia `[pase, recepcion]`. `recuperacion` solo existe con
`vuelo === null` (desposesión en duelo, `motor.ts:598`) o con un `rechace` (v3+).

### 3. Tabla exhaustiva de la máquina (bloqueante) — sustituye a §2.2

Estado: `controlador: string | null` (último jugador que controló el balón),
`ladoControl: Lado | null`, `vuelo: EventoArena | null` (último `pase` o `tiro` cuyo balón
sigue sin contacto), `pase: EventoArena | null` (pase abierto; **a lo sumo uno**),
`suelto: { lado: Lado } | null` (balón suelto tras desvío del portero; `lado` = el del
portero). **Inicial:** `controlador = registro.inicial.balon.poseedor` (todas las
versiones lo fijan: `crearEstadoArena` siempre da el balón a un portador),
`ladoControl` = su lado por la plantilla inicial, el resto `null`.

Los remates **no** pasan por esta máquina (§ 5): su desenlace lo decide `rematesPorLado`.
Eventos sin balón —`plan_equipo`, `amarilla`, `final_anticipado`, `falta`— no cambian
nada. `cambio` con `sale === controlador` y `roja` con `jugador === controlador` ponen
`controlador = ladoControl = null`.

Cierres de un pase: **completado**, **fallido** (interceptado, fuera de juego, fuera por
reinicio rival), **cancelado** (cualquier otro cierre; no entra en precisión) y
**pendiente** (sigue abierto al acabar el prefijo). Cada pase se cierra **como máximo una
vez**: solo `pase` está en el estado y cada fila lo pone a `null` al cerrarlo.
`resueltos = completados + fallidos`; `precision_pase = round(100 · completados /
resueltos)` o `null` si `resueltos = 0`.

| Evento | Condición | Resultado | Contadores (evidencia) | Estado siguiente |
| --- | --- | --- | --- | --- |
| `pase` P | `pase` abierto | ese pase **cancelado** | — | `pase = P`, `vuelo = P`, `controlador = P.jugador`, `ladoControl = P.lado`, `suelto = null` |
| `tiro` T | `pase` abierto | **cancelado** | — | `pase = null`, `vuelo = T`, `controlador = T.jugador`, `ladoControl = T.lado`, `suelto = null` |
| `recepcion` R | `pase` abierto y `R.receptor === pase.jugador` | **completado** | `pases_completados[pasador]` (`[P, R]`) | `pase = null`, `vuelo = null`, `controlador = R.jugador`, `ladoControl = R.lado`, `suelto = null` |
| `recepcion` R | otro caso (p. ej. compañero del rematador controla un remate bloqueado o un desvío pre-v3) | nada | — | ídem |
| `intercepcion` I | `pase` abierto y `I.receptor === pase.jugador` | **fallido (interceptado)** | `perdidas[pasador]` (`[P, I]`), `recuperaciones[I.jugador]` (`[I]`) | `pase = null`, `vuelo = null`, `controlador = I.jugador`, `ladoControl = I.lado`, `suelto = null` |
| `intercepcion` I | `vuelo?.tipo === "tiro"` y `I.receptor === vuelo.jugador` (bloqueo de remate o desvío pre-v3 recogido por un rival) | nada para el rematador | `recuperaciones[I.jugador]` (`[I]`) | ídem |
| `intercepcion` I | ningún caso anterior | `recuperaciones[I.jugador]` solo si `ladoControl !== I.lado` | (`[I]`) | ídem |
| `atajada` A con `motivo: "desvio"` | — | parada parcial | `atajadas[A.jugador]`, subcontador `desvios` (`[A]`) | `pase = null`, `controlador = null`, `ladoControl = null`, `suelto = { lado: A.lado }`; `vuelo` se conserva en v1/v2 (sigue el vuelo del remate) y se pone a `null` en v3+ (el rechace no es un `vuelo` de evento) |
| `atajada` A sin desvío | — | parada | `atajadas[A.jugador]` (`[A]`) | `pase = null`, `vuelo = null`, `controlador = A.jugador`, `ladoControl = A.lado`, `suelto = null` |
| `recuperacion` Rc | `suelto` y `Rc.lado === suelto.lado` (el equipo del portero recoge su rechace, v3+) | **recuperación** | `recuperaciones[Rc.jugador]` (`[A, Rc]`) | `pase = null`, `vuelo = null`, `controlador = Rc.jugador`, `ladoControl = Rc.lado`, `suelto = null` |
| `recuperacion` Rc | `suelto` y `Rc.lado !== suelto.lado` (el atacante recoge el rechace) | nada | — | ídem |
| `recuperacion` Rc | sin `suelto`, `ladoControl !== null` y `ladoControl !== Rc.lado` (desposesión en duelo) | **pérdida + recuperación** | `perdidas[controlador]` (`[Rc]`), `recuperaciones[Rc.jugador]` (`[Rc]`) | ídem; un `pase` abierto (no ocurre en el motor) queda **cancelado** |
| `recuperacion` Rc | `ladoControl === Rc.lado` o `ladoControl === null` | nada | — | ídem |
| `fuera_juego` F | `pase` abierto y `F.lado === pase.lado` | **fallido (fuera de juego)** | `perdidas[pasador]` (`[P, F]`), `fueras_juego[F.jugador]` (`[F]`) | `pase = null`, `vuelo = null`, `controlador = ladoControl = null`, `suelto = null` |
| `fuera_juego` F | sin pase abierto | — | `fueras_juego[F.jugador]` (`[F]`) | ídem |
| `reinicio` Re | `pase` abierto y `Re.lado !== pase.lado` | **fallido (fuera)** | `perdidas[pasador]` (`[P, Re]`) | `pase = null`, `vuelo = null`, `controlador = Re.jugador`, `ladoControl = Re.lado`, `suelto = null` |
| `reinicio` Re | `pase` abierto y `Re.lado === pase.lado` | **cancelado** | — | ídem |
| `reinicio` Re | siempre | — | `esquinas[Re.lado]` si `Re.reinicio === "esquina"` (`[Re]`) | ídem |
| `gol` G | `pase` abierto | **cancelado** (el balón cruzó la línea tras un pase) | `goles`/`autogoles` como en §2.4 (`[G]`) | `pase = null`, `vuelo = null`, `controlador = ladoControl = null`, `suelto = null` |
| `tiro_fuera` | `pase` abierto (no ocurre) | **cancelado** | — | ídem |

Pruebas: en los cinco fixtures y en las secuencias sintéticas, `completados + fallidos +
cancelados + pendientes = pases` por jugador y ningún id de pase aparece en dos cierres;
secuencias con cada fila de la tabla (incluidas las dos familias de desvío: v1/v2
`atajada` + `intercepcion`/`recepcion` con `receptor` = rematador, v3/v4 `atajada` +
`recuperacion` de cada lado) con resultados razonados a mano en el test.

### 4. Toque, control y balón suelto — aceptado, resuelto en § 3

Inicialización desde `inicial.balon.poseedor`; tras un desvío `controlador = null` (como
el motor); las recuperaciones tras desvío se definen por lado y por familia de reglas
(filas `atajada`/`recuperacion`/`intercepcion` de § 3). Nombres cerrados: `recuperaciones`
= «balones recuperados al rival» (intercepciones, bloqueos, desposesiones y rechaces del
propio portero recogidos por su equipo); `perdidas` = «balones perdidos» (pases
interceptados, en fuera de juego o fuera por reinicio rival, y desposesiones). Límite
declarado: en v1/v2 un mismo vuelo desviado puede generar en teoría una segunda
`atajada` del mismo portero; `atajadas` cuenta eventos tal cual (en los fixtures no
ocurre; la prueba lo fija: ninguna pareja de `atajada` comparte `desde`).

### 5. «A puerta» exactamente como el 045, sin extracción — aceptado

Se **retira** la extracción de `desenlaceRemate` y `estadista.ts` **no se toca**.
`estadisticas.ts` importa `rematesPorLado(eventos, tick)` y lee su lista `eventos` por
lado, que por construcción es una secuencia de ids de `tiro` cada uno seguido, como
mucho, de **un** id de desenlace (nunca un `tiro`): un remate es **directo** si el id
siguiente en esa lista existe y no es un `tiro`. Evidencia del directo = `[tiro,
desenlace]`, exactamente los ids del 045. Clasificación nueva, separada y posterior:
un remate no directo es **indirecto** si está cerrado y **pendiente** si no; «cerrado»
= existe un evento posterior en el prefijo, antes de cualquier otro `tiro`, de tipo
`gol`/`atajada`/`tiro_fuera` (el 045 lo descartó ahí), o existe otro `tiro` posterior,
o `final` es verdadero. Un `reinicio`, una `recepcion` o una `intercepcion` **no**
cierran un remate (el 045 tampoco): un remate bloqueado queda pendiente hasta el
siguiente remate, desenlace o final, y la ficha lo dice («en juego: N» solo si N > 0).
Equivalencia exigida en prueba: por lado, `directos === rematesPorLado(...).aPuerta` y la
concatenación de evidencias de los directos, en orden, `toEqual` a
`rematesPorLado(...).eventos` filtrada a ids de desenlace, sobre los cinco fixtures, 20
semillas programadas y las secuencias sintéticas de § 7 (dos lados seguidos, desvío
pre-v3 con `tiro_fuera`, bloqueo, pendiente).

### 6. Capacidades por característica — aceptado

Verificado: `arena-reinicios-v1.json` es **versión** `arena-v3` con **reglas**
`reinicios-v1` y sí trae faltas; §10 confundía versión con reglas. Y `resolverFalta`
devuelve `false` sin `entrenadores` (`motor.ts:529`) aunque exista `arbitro` (lo hay en
`arena-v2`). Se define `capacidades(registro)`:

| Capacidad | Condición | Filas afectadas |
| --- | --- | --- |
| `faltas` | `!!registro.inicial.entrenadores` | faltas, faltas cometidas/recibidas, amarillas, rojas |
| `reinicios` | `registro.config.reglas !== undefined` | esquinas |
| `centros` | `reglasDesde(registro.config, "reinicios-v4")` (exportada por `motor.ts`) | centros |

Capacidad falsa ⇒ `valor: null` y rótulo «no simulado en este registro» / «not simulated
in this recording»; capacidad verdadera y cero eventos ⇒ `0` («cero observado»). Los
eventos siguen siendo la única fuente de verdad: la capacidad solo decide entre `null` y
`0`. Pruebas: `arena-v2.json` ⇒ faltas `null`, esquinas `null`; `reinicios-v1` ⇒ faltas
numéricas, centros `null`; `reinicios-v4` ⇒ centros numéricos. Se retira la condición
conjunta «sin entrenadores / sin reglas» y el e2e del paso 5 pasa a cargar un registro
sin entrenadores («Load recorded AI run», `arena-v1`) y comprobar `null`.

### 7. Posesión: pausas y cola — aceptado

Verificado: `pausa` solo existe con entrenadores (`motor.ts:526`) y `saque.hastaTick` con
reglas de reinicio. Par `(a, b)` con `b.tick ≤ tick`: si `a.pausa && a.tick <
a.pausa.hastaTick` **o** `a.saque && a.tick < a.saque.hastaTick`, el balón está parado y
el par **no se atribuye ni entra en el denominador**. En registros sin ambos campos el
tiempo del ejecutor cuenta como posesión (límite declarado en la nota al pie). El lado
del poseedor se resuelve con un mapa `id → lado` construido de `inicial.jugadores +
banco`, no con `a.jugadores` (sobrevive a expulsiones y ausencias). Cola: se integra solo
hasta `cubiertoHastaTick` = tick del último fotograma `≤ tick`; `CifrasEquipo` y
`CifrasJugador` lo exponen y la nota al pie dice «distancia, velocidad y posesión cubren
hasta el último fotograma (X s)». Pruebas con fotogramas a mano: par en pausa, par en
saque, poseedor expulsado (ausente en `b`), jugador ausente, cursor entre muestras (mismo
resultado que en la muestra anterior), par sin atribución que reduce el denominador,
pares de 0,5 s y 0,1 s.

### 8. Distancia y velocidad: discontinuidades por jugador — aceptado

Par `(a, b)` descartado **para el jugador j** si: hay un `reinicio` con `a.tick < e.tick ≤
b.tick` (descarte conservador para todos: las recolocaciones alcanzan a varios
jugadores; subestima el recorrido real del intervalo y así se declara), o hay un `cambio`
con `e.jugador === j` en ese intervalo (solo el que entra), o j falta en `a` o en `b`.
Velocidad máxima: del vector `velocidad` muestreado, nunca de cuerdas. Cota de la prueba,
con unidades: `cotaKmh = ARENA.velocidadMps · (ARENA.velocidadMinFactor +
ARENA.velocidadNivelFactor) · max(Object.values(TECNICA_ARENA.ritmo)) ·
ESTADISTICAS_ARENA.kmhPorMps`; ningún jugador de los cinco fixtures la supera
(`velocidad_max_kmh ≤ cotaKmh + 1e-6`).

### 9. «Goles esperados» se retira: índice geométrico de remate — aceptado

Se renombra. Cifra `igr` = **índice geométrico de remate**, adimensional, en `[0,
IGR_ARENA.max]`: la fórmula de §2.6 con `clamp(·, min, max)` **solo** cuando `θ > 0` y
`desde` está delante de la línea de fondo rival (`x < largoM` para el local, `x > 0` para
el visitante); en cualquier otro caso (sobre o detrás de la línea, θ = 0) vale **0**, no
`min`. La fila de equipo es la **suma** y se rotula «Índice geométrico de remate (suma)
· estimado» / «Geometric shot index (sum) · estimated». «Grandes chances» pasa a
«Remates cercanos y centrados · estimado» / «Close, central shots · estimated» = remates
con `igr ≥ IGR_ARENA.umbralCercano`. La constante `XG_ARENA` pasa a llamarse
`IGR_ARENA` con los mismos valores y `granChance` → `umbralCercano`; su comentario dice
que ordena geometrías y no es una probabilidad. Ninguna etiqueta contiene «xG», «goles
esperados» ni «expected goals» (prueba). Sigue siendo del nivel 3 (§ 13).

### 10. Ciclo de vida de los favoritos — aceptado

- `almacenFavoritos(): Storage | null` envuelve el acceso a `window.localStorage` en
  `try/catch` (el getter puede lanzar). `leerFavoritos(almacen)` devuelve `{ favoritos,
  error }`: `error = true` si el almacén es `null` o `getItem` lanza; JSON inválido o de
  otra forma ⇒ favoritos vacíos con `error = false`. `guardarFavoritos` devuelve `false`
  si `setItem` lanza o no hay almacén.
- Hidratación: estado `{ valor, error, hidratado }` que arranca vacío y `hidratado =
  false`; un `useEffect` de montaje lee **una vez** y marca `hidratado`. El primer render
  (SSR y cliente) no muestra favoritos: sin desajuste de hidratación.
- Escrituras **solo** en los manejadores de las estrellas y de «Olvidar favorito», y solo
  con `hidratado`; nunca en el montaje. Un fallo al guardar pone `error` y muestra
  `<p role="status">` «No se pudo guardar tu favorito en este navegador» / «Your
  favourite could not be saved in this browser»; el favorito sigue aplicado en memoria
  durante la sesión.
- Preselección **una vez por carga**: `Arena.tsx` lleva `cargaId` (contador) que se
  incrementa en cada carga correcta (`ejecutar` con éxito, `recibirPreparado`,
  publicación `inicio`); un efecto `[cargaId, hidratado]` resuelve `favoritosEn` y, si
  `seleccionado === null` (las cargas ya lo ponen a `null`), selecciona al jugador
  favorito (titular **o suplente**) o al capitán del club favorito, y fija el modo
  inicial de la inteligencia. Las publicaciones `avance` no tocan `cargaId`: las
  elecciones manuales sobreviven al directo. Cambiar el favorito a mitad de partido
  solo cambia el resaltado.
- `ArenaInteligencia` recibe `key={cargaId}` y la prop `modoInicial` (`"fan"` por
  defecto) para su `useState`; nada más cambia en ese componente.
- Pruebas: suplente favorito (en `banco`) resuelve y preselecciona; `window.localStorage`
  cuyo getter lanza ⇒ `error = true`, sin excepción, aviso visible; `setItem` que lanza
  ⇒ aviso y favorito aplicado en memoria; recarga en el e2e (paso 3) conserva ambos.

### 11. Una sola agregación por prefijo — aceptado

`agregarPrefijo(registro, tick): AgregadoPrefijo` recorre **una vez** los eventos
(máquina de § 3, O(E)) y **una vez** los fotogramas con un puntero sobre los eventos en
orden de tick (los emite así el motor; `transicionEnTick` lo asume) para las
discontinuidades (O(F + E)), más una llamada a `rematesPorLado`. Devuelve acumuladores
por jugador y por lado, `cubiertoHastaTick`, `final` y `capacidades`. `cifrasJugador` y
`cifrasEquipos` son **proyecciones** del agregado (sin recorrer nada de nuevo; el equipo
suma los acumuladores de sus jugadores más los contadores de lado). `memoAgregado`
guarda la última entrada `(registro por identidad, tick)`; `Arena.tsx` la usa dentro de
`useMemo([registro, tickCifras])`. Se retiran la afirmación «muy por debajo de un
milisegundo» y la constante `humoMsPor100Llamadas`. Prueba: con la función de agregación
inyectable y contada, dos proyecciones con el mismo `(registro, tick)` cuestan una
agregación; cambiar el tick o la identidad del registro (como hace `aplicarPublicacion`
en cada `avance`) cuesta otra; en una prueba de componente con `renderToStaticMarkup`
repetido al mismo tick el contador no sube.

### 12. Pruebas discriminantes — aceptado

- IGR: en el punto penal centrado `igr = IGR_ARENA.base · exp(−(puntoPenalM −
  distanciaLibreM) / escalaM)` (θ/θ₀ = 1 por definición, independiente del álgebra del
  ángulo); a 0,5 m del centro del arco el resultado es exactamente `IGR_ARENA.max`; desde
  el centro de la propia línea de fondo, exactamente `IGR_ARENA.min`; sobre la línea de
  fondo rival, `0`. Quitar el `clamp` rompe las dos primeras; cambiar una constante
  rompe la de penal.
- UI: los valores esperados se cuentan en la propia prueba con filtros sobre el JSON del
  fixture, nunca llamando a `cifrasEquipos`.
- Evidencia: cada directo lleva `[tiro, desenlace]` y la secuencia por lado iguala la del
  045 (§ 5); cada completado `[pase, recepcion]`; cada pérdida su evento de cierre; cada
  recuperación tras rechace `[atajada, recuperacion]`.
- Selector corregido: `page.getByTestId("arena-player-stats").locator('[data-stat="remates"]')`.
- Las secuencias sintéticas llevan el resultado razonado a mano en un comentario; los
  desplazamientos 3–4–5 y las cifras leídas del JSON son datos de prueba, no normativos.

### 13. Una entrega mínima, una hora de corte, comandos reales — aceptado

Verificado: `package.json` no tiene `lint`. Sustituye a §8 y a la contingencia de §10:

- **Entrega mínima (EM), corte 16:00 del día de implementación.** `agregarPrefijo` con
  los contadores por filtro directo (goles, autogoles, remates/directos/indirectos/
  pendientes vía `rematesPorLado`, pases intentados, distancia media de pase, centros,
  faltas cometidas/recibidas, amarillas, rojas, fueras de juego, esquinas, atajadas con
  desvíos, acciones con balón), los de muestreo (distancia, velocidad máxima, tiempo con
  el balón, posesión), `final` y `capacidades`; panel y ficha con esas filas; favoritos
  completos (§ 10); ES/EN; 360 px; contraste; e2e; pruebas de prefijo, asociación,
  fotogramas a mano, capacidades y memo. `filasPanel` contiene **solo** las filas
  implementadas. La EM es una entrega coherente y cerrable por sí sola.
- **Nivel 2, corte 19:00.** Máquina de § 3: pases completados, precisión, pérdidas,
  recuperaciones (filas y cifras nuevas se añaden a `filasPanel` y a la ficha).
- **Nivel 3, solo con el nivel 2 en verde.** IGR y remates cercanos, «Destacados»,
  casilla «Solo mi jugador».
- La bitácora nombra el nivel alcanzado; lo no alcanzado se anota como recorte del 049,
  no como deuda escondida.
- Validación antes de ✅: `npm test`, `npm run typecheck`, `npm run build` y `npm run e2e
  -- e2e/arena-cifras.spec.ts e2e/arena.spec.ts` (serializados), más `contraste.mjs`
  sobre las filas líder en claro y oscuro.

### Qué cambia respecto de la versión 1 (lista para Opus)

1. **No se extrae nada de `estadista.ts`**; `estadisticas.ts` importa `rematesPorLado` y
   deriva directo/indirecto/pendiente de su lista de ids (§ 5). Si ya extrajiste
   `desenlaceRemate`, revierte `estadista.ts` a su estado de git.
2. `final` y `cubiertoHastaTick` solo desde el prefijo (§ 1, § 7); `CifrasEquipo` y
   `CifrasJugador` exponen `cubiertoHastaTick`.
3. La tabla de § 3 sustituye a §2.2: pase detenido = completado; categoría **cancelado**;
   estado inicial desde `inicial.balon.poseedor`; desvíos por familia de reglas.
4. `capacidades(registro)` con `null` + «no simulado» sustituye a la condición conjunta
   «sin entrenadores / sin reglas» (§ 6).
5. Posesión: pares en `pausa`/`saque` no se atribuyen; lado por mapa de plantilla (§ 7).
6. Distancia: el descarte por `cambio` es solo para el jugador que entra (§ 8).
7. `XG_ARENA` → `IGR_ARENA` (`granChance` → `umbralCercano`), cifra `igr`, filas y
   etiquetas renombradas, caso degenerado = 0 (§ 9). Nivel 3.
8. Favoritos: `leerFavoritos` devuelve `{ favoritos, error }`, `almacenFavoritos()`,
   hidratación en montaje, escritura solo en manejadores, `cargaId`, `ArenaInteligencia`
   con `key` y `modoInicial` (§ 10).
9. `agregarPrefijo` + `memoAgregado`; `humoMsPor100Llamadas` desaparece de
   `ESTADISTICAS_ARENA` (§ 11).
10. Pruebas: anclas del IGR, valores esperados independientes, aserciones de evidencia,
    selector `getByTestId("arena-player-stats").locator('[data-stat=…]')` (§ 12).
11. EM / nivel 2 / nivel 3 con cortes sustituyen a P1/P2; `npm run lint` no existe (§ 13).
