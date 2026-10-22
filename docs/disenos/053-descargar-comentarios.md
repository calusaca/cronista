# 053 — Descargar comentarios: transcripción verificable y audio de la transmisión

## Estado

Brief **cerrado** el 22 de octubre de 2026, escrito por Fable. Debe poder implementarse en
**2–3 horas** (la entrega cierra el 27 de octubre; meta interna 26). Lo marcado **P1** es
obligatorio; **P2** solo entra si P1 está en verde; lo recortado se declara en la bitácora.

Pedido de Carlos (22 de octubre), para la arena (`/arena`): hoy un espectador puede descargar
la acción completa (`registro` JSON) pero no la transmisión. Quiere (1) «Descargar
comentarios / Download commentary»: la transcripción completa del partido en el idioma
elegido, con tiempo de juego, voz o rol, las conversaciones de la mesa como diálogo, y la
evidencia (ids de eventos y hechos, veredicto del verificador) en cada línea, legible y
además procesable; (2) el audio completo de «Escuchar desde el inicio» como WAV, sin nuevas
síntesis; (3) que lo descargado incluya las intervenciones de la mesa y los comentarios LLM
sin tocar `RegistroArena` ni romper la importación de archivos anteriores.

Punto de partida: [045](045-tres-voces.md) (candidaturas únicas en el diario, pista completa
con invitados), [047](047-rediseno-visual-arena.md) (tokens y lista cerrada de selectores),
[048](048-dialogo-entre-voces.md) (turnos materializados, D1–D5) y
[049](049-estadisticas-y-favoritos.md) (regla de «final solo con el prefijo»). Este brief
**no cambia** el motor, `RegistroArena`, el validador de registros, el diario de sesión, las
rutas de la API, V1–V8, D1–D5, la voz ni la Mesa. Todo es derivación en el cliente de datos
ya publicados.

## 1. Hechos verificados en el código (22 oct)

- **Descarga actual.** `Arena.tsx:178` (`descargar`) serializa `registro` a
  `cronista-arena-<seed>.json`; el botón «Download run» vive en `.arena-tools`, que está
  `hidden` salvo en la vista «Saved matches», y se habilita solo cuando
  `final.tick · pasoS ≥ duracionS || final.finalizado`. Las pestañas se deshabilitan con
  `bloqueado = pendiente || enDirecto || bufferActivo`: **durante un partido en vivo no hay
  forma de descargar nada**.
- **Importación.** `reproducirArena` (`coordinador.ts`) valida con `z.strictObject`: una
  clave extra en el JSON del registro (por ejemplo, un «sidecar» con la mesa) **se rechaza
  con 400**. `registrarGrabacion` (`sesiones.ts:242`) compara el registro servidor con el
  importado por `JSON.stringify`.
- **Qué hay en el cliente.** `Arena.tsx` guarda `registro`, `comentarios: ComentarioArena[]`
  (comentarios LLM del narrador, con `oraciones`, `hechos`, `audit`, `modo`, `modelo`,
  `principal`) e `intervenciones: IntervencionArena[]` (comentarista y estadista; con el 048,
  `turnos` materializados con `texto_es/texto_en`, `funcion`, `oraciones`, `plantilla`,
  `refiere`, y `auditDialogo`). Ambos se llenan **solo** desde el diario (SSE `comentario` /
  `intervencion`, o `reproduccion`/`emision`); las respuestas del asistente (`extras`
  `analisis`) no entran en ese estado. Un registro abierto desde archivo no trae mesa.
- **Relato por plantillas.** `construirRelato(registro, desde, hasta, "completo", idioma)`
  (`relato.ts:58`) es puro y determinista: ventanas de `RELATO_INTERVALOS.completo = 100`
  ticks, todos los `hechosArena` ≤ `hastaTick`, conducciones comprobadas en fotogramas
  ≤ `hastaTick`, «Comienza el partido…» en la ventana 0 y «Final del partido…» solo si
  `hastaTick` es el final. No usa memoria (solo el modo `buffer` la usa) ni llama a nada
  externo; su cadena de importaciones (`inteligencia`, `entorno`, `vista`, `expresion`,
  `editorial`, `buffer`, `sim/prng`, `sim/limites`) no tiene módulos `node:`; `editorial`
  ya se ejecuta en el navegador (`ArenaEmisionBuffer`). Es exactamente el texto del narrador
  que oye «Escuchar desde el inicio» (`ArenaNarracion` pide `modo: "completo"` por ventanas
  de 100 ticks).
- **Pista completa.** `ArenaNarracion` construye `pista.current = { clave, blob, segmentos,
  tramos }` con `wavMono(muestras, 24000)` (`pista-audio.ts`): WAV PCM 16 bits mono, tope
  60 MB. Se conserva en el `ref` hasta que cambia `sesion`, `archivo` o `idioma`
  (`ArenaNarracion.tsx:32`), también después de que la reproducción termine. Hoy no se
  expone: el `<audio>` recibe un `ObjectURL` del mismo blob.
- **Lo que NO está en el diario** (y por tanto no es reproducible): las reservas de voz
  (043, archivos estáticos), el comentario editorial del modo `buffer` (depende de la
  memoria del espectador), la variante breve que sonó (048), la cesión del narrador del
  045 (se decide en `relatoIntervencion` al sintetizar) y qué intervenciones caducaron.
- **Final sin leer `registro.final`** (049 v1.1 § 1): `tick · pasoS ≥ duracionS − 1e-9`, o
  evento `final_anticipado` ≤ tick, o fotograma ≤ tick con `finalizado`.

## 2. Decisiones

1. **Dos descargas de comentarios, un archivo por clic**: Markdown (legible) y JSON
   (procesable), con el **mismo contenido** derivado de una sola función pura. Un clic que
   descargue dos archivos dispara en Chromium el permiso «descargas múltiples» y rompe el
   e2e; un ZIP exigiría una dependencia (047: ninguna nueva).
2. **Archivo separado, `RegistroArena` y el validador intactos.** Un sidecar dentro del
   JSON del registro obliga a cambiar `esquemaArchivo` (strict) y, aun así, importar el
   registro nunca restauraría la mesa (una sesión adjunta no tiene diario de intervenciones:
   `registrarGrabacion` no publica ninguna). Así que el registro se descarga como hoy, sin
   cambios, y la transmisión va en el JSON de comentarios, que **incluye el diario completo
   tal cual** (`comentarios` e `intervenciones` sin recortar) más una referencia al registro
   (§ 3.1). Importar un archivo de comentarios no existe: `/api/arena reproducir` lo rechaza
   con 400 como a cualquier JSON que no sea un registro (prueba e2e). El pedido (3) queda
   cubierto por el JSON de comentarios; los archivos antiguos se importan igual porque el
   formato del registro no cambia.
3. **Solo lo publicado.** La transcripción se construye con `registro`, `comentarios` e
   `intervenciones` del estado del cliente y con `construirRelato(..., "completo")` sobre el
   registro. Cero peticiones de red, cero LLM, cero síntesis. Las piezas que no están en el
   diario (§ 1, último punto) **no se reconstruyen** y el archivo lo declara.
4. **Descarga permitida en cualquier momento, cortada en lo visto.** `hastaTick` =
   `floor(tiempo / pasoS)` (el reloj visible) mientras `enDirecto || bufferActivo`; si no,
   `registro.final.tick`. Nunca se incluye una frase, un comentario ni una intervención con
   `tick > hastaTick`, aunque el cliente ya tenga fotogramas o intervenciones por delante
   del cursor (emisión en búfer). El archivo se marca **parcial** cuando `hastaTick` no es
   el final del partido (§ 1, regla del 049) y su nombre lleva `-parcial-<tick>`.
5. **Audio = el blob de la pista, byte a byte.** El botón de WAV solo se habilita cuando
   `pista.current` existe para el idioma y la sesión actuales; descarga ese mismo `Blob`.
   Si no hay pista, el texto de ayuda dice que hay que pulsar «Escuchar desde el inicio»
   (que es quien pide las síntesis ya presupuestadas). Ninguna petición nueva por descargar.
6. **Idioma = el de la interfaz** (`idioma` de `Arena.tsx`), como todo lo demás. El JSON
   lleva ambos textos de cada línea (`texto_es` y `texto_en` existen en todas las fuentes)
   para que un archivo valga para los dos idiomas; el Markdown solo lleva el elegido.

## 3. Modelo de datos y funciones puras — `src/arena/transcripcion.ts` (P1)

Sin estado de módulo, sin `fetch`, sin `Date` implícito (se inyecta `generado`). Toda
función recibe datos y devuelve datos; se ejecuta en el navegador y en Vitest.

### 3.1 Tipos

```ts
import type { ComentarioArena } from "./narrador";
import type { FormaDialogo, FuncionTurno, IntervencionArena, RolMesa } from "./protocolo";

export const TRANSCRIPCION_VERSION = "transcripcion-arena-v1" as const;

export interface EntradaTranscripcion {
  registro: RegistroArena; comentarios: readonly ComentarioArena[]; intervenciones: readonly IntervencionArena[];
  sesion?: string | null; generado: string;               // ISO 8601, inyectado por el llamador
}
export type OrigenLinea = "relato" | "comentario" | "intervencion";
export interface EvidenciaLinea {
  eventos: string[];                                       // ids de EventoArena, orden del registro, sin repetir
  hechos: string[];                                        // ids de HechoVerificable citados (principal y apoyos) o [] en el relato
  fotogramas: number[];                                    // ticks de posiciones observadas (conducciones)
  intervalo?: [number, number]; fuente?: string;           // procedencia de un dato del estadista (EvidenciaMesa)
}
export interface VerificacionLinea {
  reglas: "V1-V8" | "V1-V8+D1-D5" | "ninguna";             // «ninguna» = plantilla determinista, no pasa por el verificador
  aprobado: boolean | null;                                 // null cuando reglas === "ninguna"
  intentos?: number; motivos: string[];                     // motivos del ÚLTIMO intento ("V4: …", "D2: …")
}
export interface LineaTranscripcion {
  n: number; tick: number; reloj: string;                   // reloj "m:ss.d" (décimas: los ticks son 0,1 s)
  rol: RolMesa; origen: OrigenLinea; modo: "plantilla" | "llm" | "determinista"; modelo?: string;
  texto: string; texto_es: string; texto_en: string;        // texto = el del idioma pedido
  evidencia: EvidenciaLinea; verificacion: VerificacionLinea;
  comentario?: { principal: string; oracion: number };      // origen "comentario"
  intervencion?: { id: string; tema: string; forma?: FormaDialogo; turno?: number; funcion?: FuncionTurno; plantilla?: string; refiere?: string[]; oracion?: number };
}
export interface TranscripcionArena {
  version: typeof TRANSCRIPCION_VERSION; generado: string; idioma: "es" | "en";
  partido: { seed: number; version: RegistroArena["version"]; local: string; visita: string; duracionS: number; marcador: { local: number; visita: number } };
  registro: { finalTick: number; eventos: number; fotogramas: number; sesion: string | null };
  alcance: { hastaTick: number; parcial: boolean; motivo: "completa" | "en-curso" | "registro-incompleto" };
  resumen: { lineas: number; relato: number; comentarios: number; intervenciones: number; turnos: number };
  omitido: string[];                                        // lista fija ES/EN de lo que no está en el diario (§ 1)
  lineas: LineaTranscripcion[];
  diario: { comentarios: ComentarioArena[]; intervenciones: IntervencionArena[] };  // tal cual, ≤ hastaTick
}
export function construirTranscripcion(entrada: EntradaTranscripcion, hastaTick: number, idioma: "es" | "en"): TranscripcionArena;
export function transcripcionMarkdown(t: TranscripcionArena): string;
export function nombreDescarga(t: TranscripcionArena, extension: "md" | "json" | "wav"): string;
export function finalDelPrefijo(registro: RegistroArena, tick: number): boolean;   // regla 049 v1.1 § 1, reutilizar si ya existe en estadisticas.ts
```

`marcador` se calcula contando `gol` con `tick ≤ hastaTick` (con `autogol` el `lado` ya es el
beneficiado), nunca leyendo `registro.final`.

### 3.2 Construcción de las líneas

`hastaTick` debe ser entero, `0 ≤ hastaTick ≤ registro.final.tick`; si no, lanza. Se generan
tres familias y luego se ordenan.

**Relato (rol `narrador`, origen `relato`, modo `plantilla`).** Para `inicio = 0, 100, 200…`
mientras `inicio < hastaTick`: `construirRelato(registro, inicio, min(inicio + 100, hastaTick),
"completo", "es")` y la misma llamada con `"en"`: ambas devuelven fragmentos alineados uno a
uno (mismos hechos, mismas conducciones, misma `variante` por semilla), de donde salen
`texto_es` y `texto_en`; si las longitudes difieren, se lanza (invariante del relato). Una
línea por `fragmento`: `tick`, `texto`, `evidencia = { eventos: fragmento.fuentes, hechos: [],
fotogramas: fragmento.fotogramas }`, `verificacion = { reglas: "ninguna", aprobado: null,
motivos: [] }`. Con `hastaTick = 0` no hay ventanas (no hay líneas de relato).

**Comentarios LLM del narrador (origen `comentario`).** Por cada `c` de `comentarios` con
`c.tick ≤ hastaTick`, una línea por `c.oraciones[k]`: `rol: "narrador"`, `modo: c.modo`,
`modelo: c.modelo`, `hechos = [o.hecho, ...o.apoyo]` sin repetir, `eventos` = unión en orden
de `c.hechos.find(h).eventos`, `verificacion = { reglas: "V1-V8", aprobado: último
audit.motivos.length === 0, intentos: audit.length, motivos }`, `comentario = { principal:
c.principal, oracion: k }`.

**Intervenciones (origen `intervencion`).** Por cada `i` con `i.tick ≤ hastaTick`, en el
orden del diario:

- Con `i.turnos` (048): **una línea por turno** de la variante **completa** (la breve no se
  transcribe: § 2.3), `rol: turno.rol`, `funcion`, `plantilla`, `refiere`. Evidencia: unión
  de `i.evidencia[o]` para `o ∈ turno.oraciones` (`eventos`, y `citas`/`intervalo`/`fuente`
  cuando el rol es `estadista` o la evidencia los trae) más los `refiere` como `hechos` y
  sus eventos vía `i.hechos`. Un turno del narrador sin oraciones ni `refiere` lleva
  evidencia vacía y `verificacion.reglas: "ninguna"`. Modo: `estadista` ⇒ `determinista`
  (misma regla que `ArenaMesa`), narrador en turno de plantilla ⇒ `plantilla`, resto
  `i.modo`. Verificación de los turnos con oraciones: `reglas: "V1-V8+D1-D5"`, `aprobado` =
  último `i.audit` sin motivos **y** `i.auditDialogo.motivos` vacío, `motivos` = ambos.
- Sin `turnos` (045): **una línea por oración** `i.oraciones[k]` con `rol: i.rol`,
  evidencia `i.evidencia[k]` (más `hechos` de la oración), `reglas: "V1-V8"`, `oracion: k`.
  La cesión del narrador no se transcribe (no está en el diario).

**Orden.** Estable por `(tick, origen: relato 0 < comentario 1 < intervencion 2, posición en
su fuente, k)`. `n` se numera después de ordenar, desde 1. `diario` lleva los objetos
originales filtrados por `tick ≤ hastaTick`, sin modificar.

**Alcance.** `parcial = !finalDelPrefijo(registro, hastaTick)`; `motivo`: `"completa"` si no
es parcial, `"en-curso"` si `hastaTick < registro.final.tick`, `"registro-incompleto"` si
`hastaTick === registro.final.tick` y aun así no es final (partido cancelado o interrumpido).

**`omitido`** (lista fija, en el idioma pedido): reservas de voz, comentario editorial en
vivo, variante breve de los intercambios, cesiones del 045, intervenciones caducadas o no
sonadas, descripción evento a evento (está en el registro). Es texto informativo; la prueba
exige que tenga 6 entradas en ambos idiomas.

### 3.3 Markdown

Listas, **no tablas** (los textos del LLM pueden traer `|`). Estructura:

```
# <Local> <gl>–<gv> <Visita> · Transmisión / Broadcast transcript
Partido simulado · semilla <seed> · <duracionS> s · <version> · idioma ES/EN · sesión <id|—> · generado <ISO>
**Transcripción completa** | **Transcripción parcial hasta <reloj> (lo publicado al descargar)** | **Registro incompleto …**

## Qué contiene / What it contains
- <N> líneas: <a> del relato por plantillas, <b> de comentarios del narrador (IA), <c> de la mesa (<d> turnos).
- No contiene: <omitido…>
- Las líneas «plantilla» no pasan por el verificador V1–V8; las de IA y de la mesa muestran su veredicto.

## Transmisión / Broadcast
### [0:00.0] Narrador · relato · plantilla
Comienza el partido entre A y B.
- Evidencia / Evidence: — · posiciones 0,0 s
- Verificación / Checks: plantilla determinista (sin V1–V8)

### [0:30.0] Conversación · pregunta · comentarista:remates:300
1. **Narrador** (pregunta · plantilla `marco.repaso#2`): …
   - Evidencia: refiere arena:e-12
2. **Comentarista** (respuesta · IA · gpt-…): …
   - Evidencia: arena:e-12 (e-12 · e-13) · arena:e-9 (e-9)
   - Verificación: V1–V8 aprobado (1 intento) · D1–D5 aprobado
3. **Estadista** (dato · determinista): …
   - Evidencia: e-3 · e-7 · intervalo 0,0–30,0 s · inicial
```

Un intercambio (misma `intervencion.id`) se agrupa bajo un solo encabezado con sus turnos
numerados; una intervención 045 se agrupa igual con sus oraciones. El relato y los
comentarios van como encabezados sueltos. Los rótulos ES/EN viven en el módulo
(`ROTULOS_TRANSCRIPCION`), no en el componente, con prueba de completitud.

### 3.4 Nombres de archivo

`cronista-arena-<seed>-comentarios-<idioma>[-parcial-<hastaTick>].md|json` y
`cronista-arena-<seed>-narracion-<idioma>-<hastaTick>.wav`. El JSON se serializa con
`JSON.stringify(t, null, 1)` y salto final; el Markdown en UTF-8 sin BOM.

## 4. Interfaz (P1)

### 4.1 Sección «Descargas de la transmisión» — `src/ui/ArenaDescargas.tsx`

Se inserta en el acompañante (`aside.arena-companion`) **después de `<ArenaMesa>`** y antes de
«Últimas acciones», como `<section className="arena-intelligence arena-downloads"
data-testid="arena-downloads" aria-label="Descargas de la transmisión / Broadcast downloads"
data-partial="true|false" data-until-tick={hastaTick}>`. Visible siempre (en vivo, en búfer,
guardado, archivo abierto). Contenido:

- `h2` «Descargar comentarios» / «Download commentary».
- Párrafo `arena-muted` que dice qué se descarga y, en vivo, «hasta el reloj visible».
- Dos botones `.btn`: «Descargar comentarios (Markdown)» / «Download commentary (Markdown)» y
  «Descargar comentarios (JSON)» / «Download commentary (JSON)». Deshabilitados solo cuando
  no hay partido cargado (`registro === inicial && !sesionActual && !enDirecto`, misma
  condición que el aviso «Saved preview»). `aria-describedby` apunta al párrafo.
- Pie `arena-muted`: «El registro completo (JSON) se descarga en “Partidos guardados” al
  terminar el partido» / EN. No se duplica el botón «Download run» (dos botones con ese
  nombre romperían `getByRole` en los e2e vigentes).
- La descarga usa el mismo patrón de `descargar` (`Blob` + `ObjectURL` + `<a download>` +
  `revokeObjectURL`), extraído a un helper `descargarBlob(nombre, blob)` en el componente, y
  llama a `construirTranscripcion({ registro, comentarios, intervenciones, sesion:
  sesionActual, generado: new Date().toISOString() }, hastaTick, idioma)` **en el momento del
  clic** (nada se precalcula ni se memoiza). `hastaTick` según § 2.4: `Arena.tsx` pasa
  `hastaTick={enDirecto || bufferActivo ? tickCifras : registro.final.tick}` (`tickCifras` ya
  existe) y `enCurso={enDirecto || bufferActivo}`.

Tokens 047, sin animaciones nuevas, 360 px sin desborde, ES/EN completos. Ningún selector de
la lista cerrada del 047 cambia; «Download run» conserva nombre, posición y condición.

### 4.2 Botón de audio en `ArenaNarracion.tsx`

En `.arena-live-controls`, tras «Stop narration»: `<button className="btn"
data-testid="arena-narration-download" disabled={!pistaLista}>` «Descargar audio (WAV)» /
«Download audio (WAV)». Un estado `pistaLista: boolean` se pone a `true` donde se asigna
`pista.current = lista` y a `false` donde se hace `pista.current = null`. Al pulsar:
`descargarBlob(nombreDescarga(…, "wav"), pista.current.blob)` con `hastaTick` de la pista.
Debajo, cuando está deshabilitado y hay sesión con voz, un `arena-muted`: «Pulsa “Escuchar
desde el inicio” para preparar la pista; la descarga no genera audio nuevo» / EN. La pista se
conserva al terminar la reproducción (hoy ya es así), por lo que el botón sigue habilitado
tras «Fin de la narración» y se deshabilita al cambiar idioma, sesión o archivo.

### 4.3 P2 · Guía de tiempos en el JSON

Si P1 está en verde: `ArenaNarracion` recibe `alPista?: (tramos: TramoTemporal[] | null) =>
void` y lo llama al fijar o soltar `pista.current`; `Arena.tsx` guarda los tramos en estado
y los pasa a `ArenaDescargas`, que los añade al JSON como `pista?: { sampleRate: 24000;
tramos: TramoTemporal[] }`. Permite mapear segundo de audio → tick sin reproducir. El
Markdown no cambia.

## 5. Pruebas exigidas

`src/arena/__tests__/transcripcion.test.ts` (fixture `arena-reinicios-v3.json` o v4 y las
intervenciones/comentarios sintéticos que ya construyen `arena-mesa.spec.ts` y
`dialogo.test.ts` con `componerIntercambio`/`intervencionEstadista`; `generado` fijo):

1. **Solo diario y registro.** Con `comentarios = []` e `intervenciones = []` la
   transcripción tiene solo líneas `relato`, y sus textos coinciden **uno a uno** con los
   `fragmentos` de `construirRelato(registro, …, "completo", idioma)` por ventanas de
   `RELATO_INTERVALOS.completo` (la prueba lo recalcula; no escribe textos a mano).
2. **Orden por tiempo.** `lineas` no decreciente en `tick`; a igual tick, relato antes que
   comentario antes que intervención; los turnos de un mismo `intervencion.id` son
   consecutivos y en el orden de `turnos`; `n` es 1..N.
3. **Roles y modos.** Cada línea tiene `rol ∈ {narrador, comentarista, estadista}`; todo
   turno de estadista es `determinista`; un comentario con `modo: "plantilla"` se transcribe
   como `plantilla` con `verificacion.aprobado === false` y los motivos del último intento;
   un comentario aprobado da `aprobado: true`, `intentos` = longitud de `audit`.
4. **Evidencia presente.** Toda línea con `origen ≠ relato` y rol ≠ narrador tiene
   `evidencia.eventos.length > 0` o `intervalo`; **todo** id de `evidencia.eventos` existe en
   `registro.eventos` con `tick ≤ hastaTick`; todo id de `evidencia.hechos` existe en los
   `hechos` de su comentario o intervención; para un turno de estadista, `intervalo` y
   `fuente` coinciden con `i.evidencia[o]`.
5. **Sin futuro.** Para `hastaTick` en {0, tick del primer gol, un tick entre dos eventos,
   `final.tick`}: `construirTranscripcion(entrada, t)` es `toEqual` a la misma sobre
   `prefijo(registro, t)` (helper de `estadista.test.ts`) con `comentarios`/`intervenciones`
   filtrados ≤ t; además, con una intervención y un comentario añadidos en `t + 1` y un
   `gol` extra en `t + 1`, **nada cambia** (ni `lineas`, ni `diario`, ni `marcador`).
   `parcial` es `true` salvo en `final.tick` de un registro completo; `motivo` correcto en
   los tres casos (incluido un registro cancelado sintético: `registro-incompleto`).
6. **Bilingüe.** `texto` de cada línea es `texto_es` en ES y `texto_en` en EN; `omitido`
   tiene 6 entradas en ambos idiomas; `ROTULOS_TRANSCRIPCION` tiene todas las claves en ES
   y EN; la transcripción EN de un diario 048 contiene `turno.texto_en` literal.
7. **Markdown.** `transcripcionMarkdown` contiene el marcador de la cabecera, «parcial» solo
   cuando corresponde, cada `texto` de `lineas` en orden, por cada línea de IA/mesa al menos
   un id de evento, un encabezado por intercambio con sus turnos numerados, y **ninguna
   tabla** (`|` solo si aparece en un texto fuente).
8. **Nombres.** `nombreDescarga` con y sin `parcial`, por idioma y extensión.
9. **Entrada inválida.** `hastaTick` negativo, no entero o `> final.tick` lanza.

`src/ui/__tests__/arena-descargas.test.tsx` (`renderToStaticMarkup`): sección presente con
`data-partial`/`data-until-tick`, botones deshabilitados sin partido, textos ES y EN; en
`ArenaNarracion` el botón de WAV existe y está deshabilitado sin pista.

`e2e/arena-descargas.spec.ts` (serializado como los demás de arena; rutas simuladas como en
`arena-mesa.spec.ts`: `emision`/`reproduccion`/`eventos` con un registro público, dos
intervenciones —una 048 con turnos, una 045— y un comentario; `relato` con clips WAV
sintéticos de duración fija; `herramientas` con `voz: true`):

1. **Guardado, completo.** `/arena?partido=<id>` → «Download commentary (JSON)» →
   `suggestedFilename` sin `parcial`; el JSON parseado tiene `alcance.parcial === false`,
   `lineas` ordenadas, los tres roles presentes, todo `evidencia.eventos` dentro de los ids
   del registro (leídos del fixture en la prueba), el texto del turno 048 y el del
   comentario literalmente. «Download commentary (Markdown)» → el archivo contiene el
   marcador, «Broadcast» y los mismos textos. «Switch to Spanish» → el Markdown contiene
   `texto_es` del turno y «Transmisión».
2. **En vivo, parcial.** `/arena?partido=<id>&vista=buffer` con `estado: "ejecutando"`:
   esperar a que `arena-clock` pase de 5 s; descargar JSON; `alcance.parcial === true`,
   `hastaTick ≤` tick del reloj leído **antes** del clic + 10, ninguna línea ni entrada de
   `diario` con `tick > hastaTick`, nombre con `parcial`; `data-partial="true"` en la sección.
3. **WAV sin síntesis nuevas.** En el guardado, «Listen from the start» hasta que
   `arena-narration` muestre «Narration playing» (o `data-progress-ready === total`);
   contar las peticiones a `relato` hasta ahí; «Download audio (WAV)»; el archivo empieza
   por `RIFF`/`WAVE`, su tamaño es `44 + 2 · Σ muestras` de los clips servidos (calculado en
   la prueba desde las duraciones fijas) y el contador de peticiones a `relato` **no cambió**.
   Tras «Stop narration» el botón sigue habilitado; tras «Switch to Spanish» queda
   deshabilitado.
4. **No es un registro.** `POST /api/arena { accion: "reproducir", registro: <JSON de
   comentarios> }` responde 400; `arena.spec.ts` sigue probando que el registro descargado
   se reimporta con 200 (sin cambios).

Mutaciones que deben romper pruebas: quitar el filtro `tick ≤ hastaTick` en comentarios,
intervenciones o diario; ordenar por orden de llegada en vez de por tick; poner `modo: "llm"`
a un turno de estadista; tomar `aprobado` del primer intento en vez del último; dejar
`evidencia.eventos` vacío en un turno con oraciones; usar `registro.final.marcador` en vez
de contar goles ≤ `hastaTick`; transcribir `turnosBreve`; emitir una tabla Markdown;
habilitar el WAV sin pista; pedir `relato` al descargar.

`npm test`, `npm run typecheck`, `npm run lint` y los e2e de arena en verde antes de ✅.

## 6. Orden del día y recortes

**P1 (en este orden, ~2 h):** `transcripcion.ts` + pruebas unitarias (≈ 60 min) →
`ArenaDescargas.tsx`, cableado en `Arena.tsx`, botón WAV en `ArenaNarracion.tsx`, CSS mínimo
(≈ 30 min) → e2e (≈ 40 min). **P2 (~30 min):** guía de tiempos (§ 4.3).

**Recortado (no se hace):** ZIP, importar comentarios, sidecar en el registro, transcribir
reservas o editorial, marcar qué sonó en la emisión, PDF/SRT/VTT, exportar la descripción
evento a evento (ya está en el registro), descargas desde `/match`, botón de registro en
vivo.

## 7. Fuera de alcance

Motor, `RegistroArena`, `esquemaArchivo`, diario de sesión, rutas de la API, voz y
presupuestos, Mesa, V1–V8, D1–D5, textos existentes de la interfaz y selectores del 047.

## 8. Límites honestos y riesgos

- **La transcripción no es la grabación de lo que sonó.** Es lo publicado: relato por
  plantillas completo (aunque en vivo la voz narró por prioridad y cinco segundos), todas
  las intervenciones publicadas en su variante completa (aunque sonara la breve, o ninguna),
  sin reservas ni editorial. El archivo lo dice en «Qué contiene».
- **Las líneas de plantilla no están verificadas por V1–V8** (misma advertencia que la
  descripción completa); solo las de IA y la mesa llevan veredicto, y ese veredicto cubre
  citas y patrones, no la pertinencia (045/048).
- **Un registro abierto desde archivo no tiene mesa**: su transcripción solo trae el relato,
  y la cabecera lo muestra (`comentarios: 0`, `intervenciones: 0`, `sesion: null`).
- **WAV grande**: 24 kHz × 16 bits mono ≈ 2,9 MB por minuto de audio; un partido de 180 s
  con invitados puede pasar de 20 MB (tope 60 MB de `wavMono`). No se comprime.
- **`construirRelato` en el cliente** añade `relato.ts` al bundle de `/arena` (sus
  dependencias ya están); cualquier cambio futuro en las plantillas cambia la transcripción
  de un mismo registro, igual que cambia la voz. La versión del motor va en la cabecera.
- **Texto del LLM en Markdown**: puede contener `#`, `*` o `|`; se emite tal cual en listas,
  sin escapar, porque es un archivo de texto para leer, no HTML. Un lector Markdown puede
  interpretar esos caracteres.
- **Riesgo de tiempo**: si el e2e del WAV se alarga, se deja el WAV probado solo por unidad
  (botón deshabilitado sin pista) y se declara; la transcripción (P1) no se recorta.

## Versión 1.1 (22 de octubre): decisiones tras la revisión de Codex

Codex (GPT-6.1 Sol, solo lectura) revisó la versión 1 y la declaró **no cerrada**
([informe íntegro](../evidencia/descargas-053/codex-brief-v1.md): 11 hallazgos). Fable verificó
cada uno contra `narrador.ts`, `mesa.ts`, `dialogo.ts`, `estadista.ts`, `Arena.tsx`,
`ArenaNarracion.tsx`, `pista-audio.ts`, `coordinador.ts` y `estadista.test.ts`. **Lo que sigue
prevalece sobre el texto anterior** donde se contradigan; la numeración es la del informe.

### 1. El veredicto describe el texto publicado, no los intentos descartados — aceptado

Verificado: `narrarArena` (`narrador.ts:76–78`) y `comentarArena` (`narrador.ts:150–151`)
**verifican el respaldo por plantilla con V1–V8 antes de publicarlo** (si no pasa, lanzan o
devuelven `null`), y `audit` conserva los intentos LLM rechazados. La v1 convertía esos
rechazos en `aprobado: false` sobre un texto distinto y afirmaba que «las líneas plantilla no
pasan V1–V8», falso para los respaldos. Además `comentarArena` sin `llm` (sesión programada)
publica el respaldo con `audit: []`.

Nuevo modelo (sustituye a `VerificacionLinea` de § 3.1):

```ts
export interface VerificacionLinea {
  /** V1–V8 sobre el TEXTO PUBLICADO de esta línea. */
  v: { estado: "aprobada" | "no-aplica" };
  /** D1–D5 sobre el intercambio al que pertenece la línea. */
  d: { estado: "aprobada" | "no-aplica" };
  /** Historial de generación de la candidatura (informativo): intentos LLM rechazados antes del
   * texto publicado. Nunca describe la línea; nunca se copia a líneas de otro rol. */
  historial?: { intentos: number; rechazados: number; motivos: string[] };
  /** Rótulo cerrado para el Markdown y las pruebas. */
  clase: "plantilla-sin-verificar" | "respaldo-verificado" | "llm-aprobado" | "dato-determinista" | "marco-de-dialogo";
}
```

Reglas (tabla cerrada):

| Línea | `clase` | `v` | `d` | `historial` |
| --- | --- | --- | --- | --- |
| relato (`construirRelato`) | `plantilla-sin-verificar` | no-aplica | no-aplica | — |
| oración de comentario del narrador, `modo: "llm"` | `llm-aprobado` | aprobada | no-aplica | de `c.audit` si hay intentos con motivos |
| oración de comentario del narrador, `modo: "plantilla"` | `respaldo-verificado` | aprobada | no-aplica | ídem |
| oración del comentarista (045 o turno 048), `modo: "llm"` | `llm-aprobado` | aprobada | § 2 | de `i.audit` |
| oración del comentarista, `modo: "plantilla"` (con o sin `audit`) | `respaldo-verificado` | aprobada | § 2 | de `i.audit` si no está vacío |
| oración del estadista (045 o turno E) | `dato-determinista` | no-aplica | § 2 | **nunca** |
| turno del narrador de plantilla (pregunta, cesión, cierre) | `marco-de-dialogo` | no-aplica | aprobada | — |

`v.estado = "aprobada"` para el comentarista y el narrador LLM no se lee de `audit`: es una
propiedad del contrato (solo se publica texto verificado) y la prueba la comprueba contra
los caminos reales (`narrarArena`/`comentarArena` con un LLM falso que falla una vez y acierta
la segunda; con uno que falla dos veces; y sin LLM). `historial.motivos` lleva `"intento 1 ·
V4: …"`, y el Markdown lo rotula «Historial de generación (intentos descartados)», separado de
«Verificación del texto».

### 2. V y D por separado, con el estadista y los marcos cubiertos — aceptado

Verificado: `intervencionEstadista` publica `audit: []` y `modo: "determinista"`
(`estadista.ts:157`); `mesa.ts:58–61` publica un intercambio **con `turnos` solo si D1–D5
aprueban**, y si fallan publica la candidatura **sin `turnos`** (camino 045) con los motivos en
`auditDialogo`. Por tanto: una línea que procede de un `turno` tiene `d: aprobada` **siempre**
(incluidas las preguntas y cierres sin oraciones ni `refiere`, y el turno E del estadista en
una ronda); una línea de una intervención sin `turnos` tiene `d: no-aplica`, y si esa
intervención trae `auditDialogo.motivos` (composición rechazada), se añade
`historial.dialogo = motivos` como información de la candidatura. El `historial` del
comentarista no se copia a los turnos del estadista ni del narrador (tabla del § 1).

Casos nuevos obligatorios en las pruebas, construidos **con los productores reales**:
estadista 045 (`intervencionEstadista`), estadista dentro de una `ronda`
(`componerIntercambio` con `dato`), pregunta y cierre de plantilla, y una composición
rechazada por D1–D5 publicada por `MesaSesion` con `componer` forzado inválido (patrón de
`mesa.test.ts`).

### 3. Auditorías opcionales o vacías — aceptado

Verificado: `componerIntercambio` (`dialogo.ts:246–249`) omite `auditDialogo` cuando no hay
escalones; `audit: []` existe en el estadista y en el comentarista sin LLM. Regla: `audit`
vacío o ausente ⇒ sin `historial`; `auditDialogo` ausente ⇒ nada (la `d` sale de la
existencia de `turnos`, § 2); `auditDialogo.escalones` se copia a `intervencion.escalones`
(informativo). Ningún acceso a `audit.at(-1)` ni a `auditDialogo.motivos` sin comprobar.
Prueba: intervención 048 sin `auditDialogo`, intervención con `auditDialogo: { motivos: [],
escalones: [...] }`, comentarista con `audit: []`.

### 4. El corte sigue al cursor visible en todas las vistas — aceptado

Verificado: `alRepeticion` (`Arena.tsx:286`) pone `tiempo = 0` al abrir la repetición, y en
guardados el espectador puede estar a mitad. Regla única: `hastaTick = tickCifras`
(`floor(tiempo / pasoS + 1e-9)`, el mismo entero que usan las cifras del 049) **en todas las
vistas**. Para descargar el partido entero en un guardado, el espectador lleva el deslizador
al final (el `data-until-tick` y el texto de ayuda lo dicen: «hasta el reloj visible:
m:ss»). No hay segundo botón «completo». Consecuencia: `parcial` también en guardados cuando
el cursor no está al final; el nombre lo refleja. E2e: repetición pausada a mitad (`slider`
«Match time» a un valor intermedio) ⇒ `parcial: true` y ninguna línea posterior.

### 5. Igualdad con el prefijo: proyección independiente — aceptado

Verificado: el helper `prefijo` de `estadista.test.ts:13` sustituye `final` por el último
fotograma ≤ `t`, y `construirRelato` lanza si `hastaTick > registro.final.tick`. Decisiones:

- Los metadatos describen **el corte exportado**, nunca el registro cargado: se elimina
  `registro.finalTick`; `registro.eventos`/`fotogramas` cuentan solo `≤ hastaTick`;
  `alcance = { hastaTick, parcial }` (se elimina `motivo`, que no es derivable del prefijo).
- Validación de entrada: `hastaTick` entero, `0 ≤ hastaTick ≤ registro.final.tick`.
- Prueba (sustituye a § 5.5), en dos partes:
  (a) **Igualdad con el prefijo en ticks con fotograma**: para `t` en {0, tick del fotograma
  que sigue al primer gol, `final.tick`}, la **proyección** `{ lineas, diario,
  partido.marcador, alcance, resumen, registro }` de `construirTranscripcion(completo, t)` es
  `toEqual` a la de `construirTranscripcion(prefijo(r, t), t)` (en esos ticks
  `prefijo(r, t).final.tick === t`, así que la validación no lanza).
  (b) **Tick sin fotograma, sobre el registro completo**: con `t` entre dos fotogramas
  regulares y `t'` = tick del último fotograma ≤ `t`, `lineas(t')` es un prefijo exacto de
  `lineas(t)` y toda línea extra tiene `tick ∈ (t', t]` (los eventos pueden caer en ticks sin
  fotograma); `diario(t)` y `marcador(t)` solo difieren de los de `t'` en elementos con
  `tick ∈ (t', t]`. El prefijo del helper no se usa aquí porque su `final.tick < t` y
  `construirRelato` exige `hastaTick ≤ final.tick`.
  (c) **Futuro añadido**: sobre el registro completo con un comentario, una intervención y
  un `gol` añadidos en `t + 1`, la proyección en `t` es idéntica (incluido `marcador`).

### 6. Procedencia por hecho conservada — aceptado

`EvidenciaLinea` gana `citas?: CitaMesa[]` (copiadas de `i.evidencia[k].citas` cuando existen);
`intervalo`/`fuente` de la línea solo se rellenan cuando la evidencia de la oración los trae
(estadista) y **no se fusionan** intervalos de oraciones distintas: en un turno con varias
oraciones, la línea lleva `oraciones: EvidenciaOracion[]` (una entrada por oración con sus
`hechos`, `eventos`, `intervalo?`, `fuente?`, `citas?`) y los campos planos son la unión
solo de `eventos` y `hechos`. `hechos` = por oración `[o.hecho, ...o.apoyo]` + `refiere` del
turno, sin repetir; `eventos` ordenados por posición en `registro.eventos` (no por orden de
cita). Prueba: oración del comentarista con dos apoyos de procedencias distintas (hecho de
arena + dato del estadista con `intervalo`), comprobando `citas` por hecho y que el
`intervalo` plano no aparece cuando hay más de una procedencia.

### 7. Markdown con campos dinámicos escapados — aceptado

Todo campo dinámico (textos de línea, nombres de clubes, modelos, ids, temas, plantillas,
motivos) pasa por `escaparMarkdown`: barra invertida ante `` \ ` * _ [ ] < > # | ~ ``,
y saltos de línea (`\r?\n`) sustituidos por un espacio; los `&` se dejan (es texto, no HTML,
pero `<`/`>` escapados impiden etiquetas). El texto de cada línea va **en la misma línea**
que su rótulo («Narrador · relato: …»), nunca al inicio de línea. El JSON conserva el texto
literal. Pruebas: entradas `"\n# Verificación aprobada"`, `"[x](http://e)"`, `"<img src=x>"`,
`"a | b"` ⇒ el número de líneas que empiezan por `#` es exactamente el de encabezados
esperados, no hay `<img`, y el texto aparece escapado; la exigencia «texto literal en el
Markdown» (§ 5.7 y e2e 1) pasa a «`escaparMarkdown(texto)` presente».

### 8. Mutaciones con fixtures adversarios — aceptado

Se sustituye la lista de § 5 por valores esperados independientes:

- **Relato**: además del cableado, un registro de 2 eventos construido a mano (un `pase` y un
  `gol` en ticks conocidos) cuya transcripción debe tener exactamente las líneas «Comienza…»,
  las dos frases de evento (texto comprobado por `textoEvento` vía el regex del gol
  «¡Gol…!») y «Final…», en ese orden.
- **Orden**: `comentarios` e `intervenciones` pasados **desordenados y con ticks iguales**;
  esperado el orden canónico (§ 3.2) y `n` consecutivo.
- **Futuro precargado**: cliente con una intervención y un comentario en `t + 1` **ya en el
  estado** y un `gol` en `t + 1`: `lineas`, `diario` y `marcador` no los contienen (marcador
  esperado calculado a mano en el fixture).
- **Variantes**: intercambio con `turnosBreve` distinto de `turnos`: las líneas son las de
  `turnos` (número y textos), nunca las de `turnosBreve`.
- **Historial**: `comentarArena` con LLM falso rechazado→aprobado ⇒ `clase: llm-aprobado`,
  `historial = { intentos: 2, rechazados: 1 }`; rechazado×2 ⇒ `respaldo-verificado` con
  `rechazados: 2`; sin LLM ⇒ `respaldo-verificado` sin `historial`.
- **Evidencia**: regla corregida: toda línea de **oración** (comentarista o estadista) tiene
  `eventos.length > 0` **o** `intervalo`; un dato del estadista con `eventos: []` e
  `intervalo` (marcador 0–0 por `acumulado(…, true)`, `estadista.ts:60`) se acepta y conserva
  `fuente: "inicial"`; los turnos de marco pueden ir sin evidencia.
- **Orden canónico ≠ orden de la pista**: la cabecera del Markdown y `omitido` lo dicen
  («orden canónico por tiempo; la pista de audio inserta a los invitados tras la ventana
  del narrador») y la prueba comprueba la frase.

### 9. WAV idéntico al blob del `<audio>`, con tick y límites exactos — aceptado

Verificado: `Pista` no guarda `hastaTick` (solo dentro de `clave`); `ArenaNarracion` decodifica
a 24 kHz, puede **omitir** invitados inválidos o demasiado largos (`:119`) y el tope real es
`muestras · 2 > 60_000_000` bytes de PCM (`pista-audio.ts:4`) más 44 de cabecera. Decisiones:

- `Pista` gana `hastaTick: number` (el de la construcción) e `idioma`; el nombre del WAV los
  usa. `pistaLista` se deriva de `pista.current !== null` tras cada asignación.
- E2e 3 (sustituye al anterior): clips **distinguibles** (seno de frecuencia distinta y
  duración distinta por tramo e invitado, uno de ellos inválido —estéreo o > `duracionMaxS`—
  para forzar una omisión). Tras «Narration playing»: (a) hash SHA-256 del blob del
  `<audio>` (`fetch(audio.src)` + `crypto.subtle.digest` en la página; 127.0.0.1 es contexto
  seguro) **igual** al SHA-256 del archivo descargado (Node `crypto`); (b) tamaño `= 44 + 2 ·
  Σ muestras` **de los clips incorporados** (la prueba sabe cuál se omitió); (c) cabecera:
  `sampleRate = 24000`, canales = 1, bits = 16; (d) contador de peticiones a `relato` sin
  cambios tras la descarga; (e) tras «Switch to Spanish» el botón queda deshabilitado y, tras
  volver a preparar, el nuevo archivo difiere del primero (idioma distinto).
- Unidad: `wavMono` ya está probada; se añade la prueba del límite `60_000_000 + 44` en el
  nombre del tope dentro de `ArenaNarracion` (constante compartida `PISTA_MAX_PCM_BYTES`
  en `pista-audio.ts`, sin cifra repetida).

### 10. Compatibilidad probada contra el validador real — aceptado

Verificado: `esquemaArchivo` es `z.strictObject` (`coordinador.ts:101`) y `/api/arena`
responde 400 ante un JSON ajeno. E2e 4 (sustituye): **sin interceptar** `/api/arena`, con
`request.post` real: (a) `public/experimentos/arena-llm-v1.json` (motor legado),
`arena-llm-v3.json` y `arena-duelo-v3.json` (motor actual) ⇒ 200 y `final.tick` igual al del
archivo; (b) el JSON de comentarios descargado en el paso 1 ⇒ 400; (c) el registro descargado
por «Download run» ⇒ 200 (ya en `arena.spec.ts`, se mantiene). Importar comentarios queda
**fuera de alcance** y la cabecera del JSON lo dice (`"importable": false`).

### 11. Presupuesto realista y recorte correcto — aceptado

Estimación corregida: contratos §§ 1–3 y 6 + módulo + unitarias ≈ 90 min; UI y WAV con tick
≈ 40 min; e2e (4 pasos, con hashes) ≈ 60 min; ejecución, correcciones, bilingüe y
`typecheck`/`lint` ≈ 45 min. **P1 ≈ 4 h**; P2 (guía de tiempos) fuera del compromiso. Si hay
que recortar: primero el Markdown pasa a lista plana (sin agrupar intercambios), luego se
simplifica la cabecera; la **prueba funcional del WAV (hash igual, sin síntesis nuevas) no se
recorta**.

### Qué cambia para Opus

1. `VerificacionLinea` nuevo (§ 1) con `v`, `d`, `clase` e `historial` opcional; tabla cerrada de
   clases; nunca copiar el `historial` del comentarista a otros roles (§ 2).
2. `d.estado` sale de la existencia de `turnos`; `auditDialogo` opcional; `audit` vacío sin
   `historial` (§§ 2–3).
3. `hastaTick = tickCifras` en todas las vistas; sin botón «completo» (§ 4).
4. Metadatos del corte (sin `finalTick`, sin `motivo`); prueba por proyección con `prefijo`
   y un tick sin fotograma (§ 5).
5. `EvidenciaLinea` con `citas` y `oraciones[]`; eventos por posición en el registro (§ 6).
6. `escaparMarkdown` en todo campo dinámico; texto en la misma línea que el rótulo (§ 7).
7. Fixtures adversarios del § 8 en vez de la lista de mutaciones de § 5.
8. `Pista.hastaTick`/`idioma`, `PISTA_MAX_PCM_BYTES`, e2e del WAV por hash (§ 9).
9. E2e de importación real sin interceptar (§ 10).
10. P1 ≈ 4 h, P2 fuera; orden de recorte del § 11.
