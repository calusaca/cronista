# 055 — Identidad futbolera: emblema, partido primero, escudos y equipaciones, iconos de eventos

## Estado

Brief **cerrado** el 22 de octubre de 2026, escrito por Fable. Debe poder implementarse en
**un día** (la entrega cierra el 27 de octubre; el video demo se vuelve a grabar después).
Prioridad explícita (§ 12): **P1** obligatorio; **P2** solo con P1 en verde a las 16:00; lo que
no entre se declara en la bitácora como recorte del 055, no como deuda escondida.

Pedido de Carlos (22 de octubre): «Logo Cronista debe ser mucho más futbolero» y «la página
debería ser mucho más orientada a fútbol para proveer una experiencia más de fútbol».
Alcance acordado, por orden: (1) emblema propio con favicon e icono de aplicación en las
cabeceras de `/` y `/arena`; (2) partido primero: cancha, marcador y Mesa en el primer
encuadre; (3) identidad de club: escudos y equipaciones ficticios y deterministas por nombre
de club, con contraste garantizado; (4) iconos de eventos en el feed, la descripción y el
panel de cifras. Opcional (P2): cabecera de jornada y alineaciones tipo TV.

Punto de partida: [047](047-rediseno-visual-arena.md) (tokens `--ar-*`, lista cerrada de
selectores, prohibición de `transform` CSS en fichas, pseudoelementos solo con `content: ""`),
[049](049-estadisticas-y-favoritos.md) (panel de cifras, favoritos por nombre de club),
[050](050-canto-de-gol.md) (celebración y anillo del goleador). Este brief **no cambia** el
motor, `RegistroArena`, la API, los textos que usan los e2e, los nombres accesibles ni el
comportamiento de ningún control. Toda la identidad se **deriva** del registro: no hay datos
nuevos en el formato ni en el servidor.

## 1. Hechos verificados en el código (22 oct)

- **Cabeceras.** `/` dibuja `header.topbar` en `src/ui/Simulador.tsx:50` y `/arena` en
  `src/ui/Arena.tsx:204` (`header.topbar.arena-topbar`); las dos llevan
  `a.brand > span.brand-mark («CRONISTA») + span.brand-tag`. `.brand-mark` es texto en
  Archivo 900 de 22 px (`globals.css:144`). No existe ningún `icon.*`, `favicon.ico` ni
  `apple-icon.*` en `src/app/` ni en `public/`; `layout.tsx` no declara `metadata.icons`.
  `e2e/actividad.spec.ts:21` navega con el selector `.brand` (debe seguir siendo un enlace a `/`).
- **Next.js 16.3.8** (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`):
  `app/icon.svg` genera `<link rel="icon" href="/icon?<hash>" type="image/svg+xml" sizes="any">`;
  `favicon.ico` solo en la raíz de `app/`; `apple-icon` admite `.png/.jpg` o generación con
  `ImageResponse` desde `next/og`. En este repo `app/` es `src/app/`.
- **Primer encuadre hoy** (`docs/evidencia/rediseno-047/capturas-despues.txt`, revisión pública
  0000012; la 0000018 no cambió el orden): a 1440×900 el marcador termina en y = 713 y la cancha
  empieza en ≈ 730, así que **no se ve** al cargar; a 360×740 el marcador termina en y = 1118.
  La Mesa arranca en 305 dentro del acompañante. Orden del DOM en `main.arena-shell`:
  `.arena-intro` → `.arena-source-tabs` → `details.arena-setup` → `section.arena-live`
  (`ArenaEnDirecto`) → avisos → `.arena-grid#arena-watch` (`.arena-board` + `aside.arena-companion`)
  → planes → asistente → contexto → plantillas → descripción → límites.
- **Los e2e exigen el formulario abierto al cargar**: `arena-formaciones.spec.ts:38` selecciona
  «Home formation» y pulsa «Start live match» sin abrir nada; `arena-buffer.spec.ts:144` pulsa
  «Start live match» dentro de `arena-live` nada más cargar; `arena.spec.ts:95–101` usa
  «Controller selection» y «Generate match» tras pulsar «Saved matches». Los demás flujos pulsan
  una pestaña (que pone `configurando = true`) antes de usar los controles. **Conclusión:**
  no se puede colapsar la configuración por defecto; hay que **reubicarla**, no esconderla.
- **Alineación exigida** (`arena-formaciones.spec.ts:64–71`): `.arena-board` y
  `[data-testid="arena-companion"]` arrancan a la misma altura (|Δy| < 2) con el acompañante a la
  derecha; tras `#arena-watch.scrollIntoView`, el acompañante queda por debajo del único
  `header` de la página (`page.locator("header")`). `arena.spec.ts:243` exige visible el
  encabezado «Dos equipos. Una misma cancha.» a 360 px en español.
- **Colores de equipo hoy**: constantes del 047 (`--ar-home #0c1640/#ffffff`,
  `--ar-away #f5f7fb/#13203f`, `--ar-home-ui`, `--ar-away-ui`, `--ar-home-ui-bug`,
  `--ar-away-ui-bug`), consumidos por las fichas (`.arena-local .arena-token > circle`), el
  marcador (barras `::before/::after`), `.arena-shirt`, `.arena-stats-teams`, `.arena-stat-bar`,
  `.arena-coach[data-testid]`, `.arena-team-plan`, `.arena-goal-banner` y `.arena-direction`.
  Reteñir esos tokens retiñe todo sin tocar un consumidor.
- **El césped limita la paleta**: `--ar-grass-a #2f7d47` y `--ar-grass-b #2a7341` tienen
  luminancia ≈ 0,16. Para 3:1 un relleno debe ser **muy oscuro** (L ≤ 0,02) o **claro**
  (L ≥ 0,58): un rojo o azul medio (L 0,1–0,3) queda en 1,1–1,8 y falla. Por eso el 047 acabó
  en marino y blanco, y por eso la paleta de § 5 tiene dos familias (oscura y clara).
- **Nombres de club**: `src/sim/plantillas.ts` sortea `PREFIJOS` (8) × `LUGARES` por semilla;
  nunca repite el nombre entre los dos equipos de un partido (`plantillas.ts:97–99`). Los
  favoritos del 049 identifican al club por `nombre`: derivar la identidad del nombre hace
  que un club favorito conserve escudo y equipación en todos los partidos en que aparece.
- **Iconos existentes**: `src/ui/Iconos.tsx` dibuja trazos de 24 px con `currentColor` para el
  `TipoEvento` del simulador histórico (`gol`, `tiro`, `atajada`, `falta`, `tarjeta_amarilla`,
  `tarjeta_roja`, `corner`, `fuera_de_juego`, `cambio`, …), todos `aria-hidden`. La arena tiene
  16 `TipoEventoArena` (`src/arena/tipos.ts:115`) y `reinicio` ∈ centro/banda/esquina/meta.
- **Celebración 050**: `circle.arena-goal-ring` debe ser el **último hijo** de `.arena-token`
  (`arena-canto-gol.spec.ts:27–31`); `arena-referee` tiene exactamente un `rect` sin tarjeta.
- **Utilidades**: no hay clase `sr-only`/`visually-hidden` en `globals.css`; los iconos
  decorativos irán `aria-hidden` junto a texto, sin texto oculto.
- **Scripts de medida**: `docs/evidencia/rediseno-047/contraste.mjs` (pares WCAG sobre el DOM,
  claro y oscuro, código 1 si falla) y `capturas.mjs` (1440×900 y 360×740, métricas
  `marcadorAbajo`, `mesaEnAcompanante`, `dorsalPx`). Se extienden, no se duplican.

## 2. Dirección

**«Noche de partido»**: el laboratorio deja de parecer un formulario con una cancha debajo y
pasa a ser una transmisión: emblema de cadena deportiva, dos clubes con escudo y camiseta,
la cancha y el marcador como primera imagen, y los iconos de la grafía televisiva (balón,
tarjeta, guante, banderín) marcando cada acción. Todo sigue la paleta del 047; nada se
parece a una marca real (ni Premier League, ni Microsoft, ni clubes ni cadenas: sin leones,
sin cuatro cuadrados, sin tipografías ajenas, todo SVG propio).

## 3. Z1 · Emblema, favicon e icono de aplicación (P1)

### 3.1 Dibujo (único, en `src/ui/Emblema.tsx`)

`EmblemaCronista({ size = 28, className })` devuelve un `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={`brand-emblem ${className}`}>` con `width`/`height` = `size`, sin `<title>` ni texto. Lee como **balón abierto en forma de C** con un **punto «al aire»** en la boca:

```svg
<!-- C: contorno del balón abierto hacia la derecha -->
<path d="M24.6 8.4 A12 12 0 1 0 24.6 23.6" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>
<!-- pentágono central del balón -->
<path d="M16 10.1 l4.7 3.4 -1.8 5.6 h-5.8 l-1.8 -5.6 z" fill="currentColor"/>
<!-- cinco costuras del pentágono al contorno -->
<path d="M16 10.1 V6.2 M20.7 13.5 l3.4 -1.3 M11.3 13.5 l-3.4 -1.3 M18.9 19.1 l2.4 3.2 M13.1 19.1 l-2.4 3.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
<!-- punto «al aire» en la boca de la C -->
<circle cx="26.6" cy="16" r="2.3" fill="var(--emblem-live, currentColor)"/>
```

- Color: `currentColor`. En `/` el enlace `.brand` hereda `--accent`; en `/arena`,
  `.arena-topbar .brand-emblem { color: var(--ar-score-bg); --emblem-live: var(--ar-live); }`.
  En `/` el punto queda del mismo verde (`--emblem-live` sin definir).
- Uso: primer hijo de `a.brand` en `Simulador.tsx` y `Arena.tsx`, antes de `.brand-mark`.
  `.brand { align-items: center }` (hoy `baseline`) y `.brand-emblem { flex: 0 0 auto }`. A
  ≤ 480 px el emblema mide 24 px y `.brand-tag` sigue oculto en la arena como hoy.
- El nombre accesible del enlace no cambia (SVG `aria-hidden`, sin texto): sigue siendo
  «CRONISTA Match reports where…» / «CRONISTA Team agents lab».
- **Lista de no parecido** (Opus la comprueba a ojo y lo anota): sin león ni corona (Premier
  League), sin cuatro cuadrados ni ventana (Microsoft), sin ojo/pavo real/globo/rayas de
  cadena, sin iniciales de clubes reales, sin tipografía ajena. El balón de pentágono es un
  motivo genérico; la C abierta y el punto son propios.

### 3.2 Archivos de icono

- `src/app/icon.svg` (P1): 32×32, fondo `<rect width="32" height="32" rx="7" fill="#0b1220"/>`
  y el **mismo dibujo** de § 3.1 escalado al 80 % y centrado
  (`<g transform="translate(3.2 3.2) scale(0.8)">`) con `stroke`/`fill` `#d4ff3a` y el punto
  `#d1242f`. Es el único SVG del proyecto con hex literales: no puede leer tokens CSS. Los
  tres valores son copias de `--ar-bug`, `--ar-score-bg` y `--ar-live` (claro), y una prueba
  (§ 10) los compara con los tokens leídos de `globals.css`.
- `src/app/apple-icon.png` (P2): 180×180 generado por `scripts/generar-iconos.mjs`
  (Playwright, captura de `icon.svg` a 180 px, PNG sin metadatos; determinista; se ejecuta a
  mano y el PNG se versiona). Sin `next/og`: evita una dependencia de tiempo de ejecución en la
  imagen standalone. Si no entra, el PNG no se crea y la bitácora lo declara.
- No se añade `favicon.ico` (el `.svg` basta; `sizes="any"`), ni `manifest`, ni `metadata.icons`.

## 4. Z2 · Partido primero (P1)

### 4.1 Decisión: la «sala de control» se muda al acompañante

[decisión] Como los e2e exigen el formulario abierto al cargar (§ 1), la única forma de poner
la cancha en el primer encuadre sin cambiar comportamiento es **mover** las pestañas, la
configuración y el panel «Partido en vivo» **dentro de `aside.arena-companion`, como primer
hijo**. El tablero (marcador + cancha) pasa a ser lo primero bajo la cabecera, el acompañante
mantiene su borde superior alineado con el tablero (criterio e2e) y, cuando el partido arranca,
`configurando` ya pasa a `false` (hoy también), así que la configuración se pliega sola y la
Mesa sube. Es un movimiento de DOM, igual que el de la Mesa en el 047: cambia el orden de
lectura (cabecera → tablero → sala de control → narración → Mesa → acciones → inteligencia),
no la función de nada.

Cambios en `Arena.tsx`:

1. Nuevo envoltorio `<div className="arena-control-room" id="arena-control">` que contiene,
   en este orden y sin cambios internos: `div.arena-source-tabs`, `details.arena-setup`
   (con su `form.arena-settings` y `div.arena-tools`) y `<ArenaEnDirecto …/>`. El envoltorio
   es el **primer hijo** de `aside.arena-companion`, antes de `ArenaEmisionBuffer`/`ArenaNarracion`.
2. Los avisos `div.arena-notice` (`role="status"` de carga y `role="alert"` de error) **se quedan**
   en `main` antes de `.arena-grid`: son transitorios y así se ven a todo el ancho sobre la cancha.
3. La cabecera `.arena-intro` recibe un enlace nuevo al final:
   `<a className="arena-intro-cta" href="#arena-control">{t("Set up or choose a match", "Configurar o elegir un partido")}</a>`.
   Es el camino a la sala de control en móvil (donde queda bajo la cancha y las cifras) y un
   atajo en escritorio. El enlace «Go to the pitch and narration» conserva su texto y se mueve
   con las pestañas.
4. Nada más cambia de sitio: planes, asistente, contexto, plantillas, descripción y límites
   siguen debajo de la rejilla, en su orden.

### 4.2 CSS (solo `globals.css`)

- **Cabecera compacta** `.arena-intro`: a ≥ 1100 px pasa a rejilla
  `grid-template-columns: minmax(0, auto) minmax(0, 1fr) auto; align-items: center; column-gap: var(--ar-s5)`
  con el `overline` y el `h1` apilados en la columna 1 (el `overline` conserva su chip), el
  párrafo en la columna 2 (`max-width: 52ch; font-size: 14px`) y `.arena-intro-cta` en la 3
  (botón secundario: borde `--ar-bug-2`, texto `--ar-bug-ink`, radio `--ar-r`, 44 px de alto).
  `h1` en Archivo 900 `clamp(22px, 2.2vw, 30px)/1.1`; `padding: var(--ar-s3) var(--ar-s5)`.
  El motivo de cancha del `::after` se reduce a 180×160 px. **Objetivo: altura ≤ 96 px a 1440 px.**
  Por debajo de 1100 px la cabecera vuelve a apilarse (h1 `clamp(26px, 6vw, 32px)`), con el
  CTA a todo el ancho; a 360 px el `h1` sigue visible (e2e).
- **Sala de control dentro del acompañante** `.arena-companion > .arena-control-room`:
  `padding: var(--ar-s4); border-bottom: 1px solid var(--line)`. Dentro:
  `.arena-source-tabs { grid-template-columns: 1fr 1fr; }` con el enlace a la cancha en una
  segunda fila (`grid-column: 1 / -1`); `.arena-setup`, `.arena-settings label { flex: 1 1 100% }`
  (campos a todo el ancho), `.arena-tools` en columna; `.arena-live { display: block; padding: var(--ar-s3); margin: var(--ar-s3) 0 0 }`
  (anula la rejilla de dos columnas del 047, que solo aplicaba a ≥ 1100 px fuera del acompañante)
  y `.arena-live-controls` en columna con el botón primario a todo el ancho.
- El acompañante conserva `position: sticky; top: 80px; max-height: calc(100vh - 96px); overflow: auto`
  (e2e de alineación). La sala de control abierta mide ≈ 560 px: la narración empieza bajo ella
  y la Mesa queda bajo el pliegue del acompañante **hasta que el partido arranca**. Se acepta y
  se declara (§ 15).
- `.arena-board > .arena-empty:first-child` («Saved preview…») pasa a una sola línea de 36 px.
- **Objetivos medibles** (script § 9) a 1440×900, claro y oscuro, en la portada y con `?partido=`:
  borde inferior de `.arena-score` **≤ 330** (hoy 713) y borde inferior de `.arena-pitch-wrap`
  **≤ 900** (hoy ≈ 1260): la cancha completa entra en el primer encuadre. Cuenta: barra 68 +
  relleno 16 + cabecera ≤ 96 + margen 16 + relleno del tablero 16 + aviso 36 + marcador 58 +
  reloj 28 ≈ 334 de arriba de la cancha; el tablero mide ≈ 807 px (rejilla 1,9fr/1fr sobre
  1256) → cancha ≈ 775 × 78/115 ≈ 526 px → fondo ≈ 860.
- A 360×740: borde inferior de `.arena-score` ≤ 420 (hoy 1118); la cancha sigue midiendo
  ≥ 316 px de ancho; sin desborde.

## 5. Z3 · Identidad de club: escudos y equipaciones (P1)

### 5.1 Módulo puro — `src/arena/identidad.ts`

Sin estado, sin LLM, sin DOM. Todo se deriva del **nombre** del club.

```ts
export type Familia = "oscura" | "clara";
export interface Equipacion { id: ClaveKit; familia: Familia; fondo: string; tinta: string; uiClaro: string; uiOscuro: string; nombre: { es: string; en: string } }
export type Forma = "escudo" | "redondo" | "estandarte";
export type Patron = "liso" | "rayas" | "mitades" | "banda" | "aros";
export interface IdentidadClub { nombre: string; hash: number; principal: Equipacion; alternativa: Equipacion; forma: Forma; patron: Patron; iniciales: string }
export interface EquipacionesPartido { local: Equipacion; visita: Equipacion; visitaAlternativa: boolean }

export function hashClub(nombre: string): number;                 // FNV-1a 32 bits sobre nombre.normalize("NFC").trim().toLowerCase()
export function identidadClub(nombre: string): IdentidadClub;
export function iniciales(nombre: string): string;                 // § 5.3
export function equipaciones(local: string, visita: string): EquipacionesPartido; // § 5.4
export function contrasteWcag(a: string, b: string): number;       // fórmula WCAG 2.x, hex de 6 cifras
export function variablesEquipacion(e: EquipacionesPartido): Record<`--ar-${string}`, string>; // § 5.5
```

### 5.2 Selección determinista

Con `h = hashClub(nombre)` y `P = IDENTIDAD_ARENA.paleta` (10 entradas, § 8; índices 0–4
familia oscura, 5–9 familia clara):

- `principal = P[h % 10]`
- `alternativa = P[(h >>> 24) % 5 + (principal.familia === "oscura" ? 5 : 0)]` — siempre de la
  **familia opuesta**: por construcción contrasta ≥ 11:1 con cualquier principal (§ 8, medido).
- `patron = PATRONES[(h >>> 8) % 5]`, `forma = FORMAS[(h >>> 16) % 3]`.

Se usan bits distintos para cada rasgo para no correlacionar kit y patrón. La normalización
NFC + minúsculas hace que «Olímpico Brezal» y «olímpico brezal» (p. ej. un favorito guardado
con otra capitalización) compartan identidad; los nombres del simulador son siempre idénticos
entre partidos, así que el favorito del 049 conserva escudo y camiseta.

### 5.3 Iniciales

Palabras del nombre (separadas por espacios), se descartan las de ≤ 2 letras («de», «la»);
se toma la primera letra de cada una, mayúscula, hasta **3**; si solo hay una palabra, sus
dos primeras letras. «Sporting Montefrío Bajo» → «SMB», «Olímpico Brezal» → «OB». Sin
transliterar: una Ñ o una Á se conservan (Archivo las tiene).

### 5.4 Regla de equipaciones del partido (choque de colores)

```
local  = identidadClub(nombreLocal).principal
visita = identidadClub(nombreVisita).principal
si contrasteWcag(local.fondo, visita.fondo) < IDENTIDAD_ARENA.minEntreEquipos (3)
    → visita = identidadClub(nombreVisita).alternativa ; visitaAlternativa = true
```

Como la alternativa es de la familia opuesta, el resultado **siempre** cumple ≥ 3:1 entre
equipos (medido: mínimo 11,08 entre familias). El local nunca cambia (como en el fútbol: el
visitante se cambia). Si por error los dos nombres fueran iguales, la regla da la alternativa
igualmente. Si `visitaAlternativa`, la interfaz lo dice en el pie del marcador con un texto
nuevo: «{Visita} viste su segunda equipación» / «{Away} wears its change kit» (en
`.arena-direction`, como tercer `span` con `className="arena-kit-note"`; los dos `span`
existentes conservan su texto y posición).

### 5.5 Aplicación por tokens (sin tocar consumidores)

`Arena.tsx` calcula `const kits = useMemo(() => equipaciones(nombres.local.nombre, nombres.visita.nombre), [nombres])`
y pone en `main.arena-shell` el atributo `style={variablesEquipacion(kits)}`, que devuelve
**exactamente** estas variables (valores de la tabla § 8, nunca hex escritos en el TSX):

| Variable | Valor |
| --- | --- |
| `--ar-home`, `--ar-home-ink`, `--ar-home-ring` | `local.fondo`, `local.tinta`, `local.tinta` |
| `--ar-home-ui-claro`, `--ar-home-ui-oscuro` | `local.uiClaro`, `local.uiOscuro` |
| `--ar-away`, `--ar-away-ink`, `--ar-away-ring` | `visita.fondo`, `visita.tinta`, `visita.tinta` |
| `--ar-away-ui-claro`, `--ar-away-ui-oscuro` | `visita.uiClaro`, `visita.uiOscuro` |

En `globals.css`, **sobre `main.arena-shell` (no sobre `:root`)**, porque una `var()` se resuelve
en el elemento que declara la propiedad:

```css
main.arena-shell { --ar-home-ui: var(--ar-home-ui-claro, #1b2f7a); --ar-away-ui: var(--ar-away-ui-claro, #13203f);
                   --ar-home-ui-bug: var(--ar-home-ui-oscuro, #8fb0ff); --ar-away-ui-bug: var(--ar-away-ui-oscuro, #f5f7fb); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) main.arena-shell { --ar-home-ui: var(--ar-home-ui-oscuro, #8fb0ff); --ar-away-ui: var(--ar-away-ui-oscuro, #f5f7fb); } }
:root[data-theme="dark"] main.arena-shell { --ar-home-ui: var(--ar-home-ui-oscuro, #8fb0ff); --ar-away-ui: var(--ar-away-ui-oscuro, #f5f7fb); }
```

Los valores de reserva son los del 047, por si falta el `style` (SSR sin registro no ocurre:
`inicial` siempre existe). Con esto fichas, dorsales, anillos, `.arena-shirt`, barras de
cifras, bordes de entrenadores y planes, rótulo de gol y dirección cambian de color sin tocar
una regla de consumidor. El valor sale del registro, así que el SSR y el cliente coinciden.

### 5.6 Escudo — `src/ui/Escudo.tsx`

`Escudo({ identidad, equipacion, size = 24, className })` dibuja un
`<svg viewBox="0 0 32 36" aria-hidden="true" focusable="false" className="arena-crest" data-kit={equipacion.id} data-patron data-forma>`
con `width = size` y `height = size · 36/32`. `equipacion` es la que viste **en este partido**
(principal o alternativa): el escudo acompaña a la camiseta. Colores: `c1 = equipacion.fondo`,
`c2 = la otra equipación del club` (alternativa si viste la principal, principal si viste la
alternativa), `tinta = equipacion.tinta`. Los tres llegan como `fill`/`stroke` desde las props;
ningún hex literal en el TSX.

Capas, en orden:

1. **Forma** (también `clipPath` con `id = useId()`, seguro en SSR):
   escudo `M16 2 L29 6 V18 C29 27 22.5 32.5 16 34 C9.5 32.5 3 27 3 18 V6 Z`;
   redondo `circle cx=16 cy=18 r=14`; estandarte `M4 2 H28 V26 L16 34 L4 26 Z`. Relleno `c1`.
2. **Patrón** en `c2`, recortado por la forma: `rayas` = tres `rect` de 3 de ancho en
   x = 6,5 / 14,5 / 22,5; `mitades` = `rect x=16 y=0 width=16 height=36`; `banda` =
   `polygon 3,2 11,2 29,24 29,34` (banda diagonal); `aros` = `rect y=9 h=4` y `rect y=23 h=4`;
   `liso` = nada.
3. **Campo de iniciales** sólido en `c1`: escudo y estandarte `rect x=3 y=19 width=26 height=10`;
   redondo `circle cx=16 cy=18 r=8.5`. Así las iniciales siempre van `tinta` sobre `c1`
   (≥ 11,9:1 en toda la paleta), nunca sobre una raya.
4. **Iniciales**: `<text x=16 y=27 textAnchor=middle dominantBaseline=central>` (redondo: y = 18),
   Archivo 900, `font-size` 8 (2 letras: 9; 3 letras: 7,2), `letter-spacing .02em`, fill `tinta`.
5. **Contorno**: la forma con `fill=none stroke=tinta stroke-width=1.2`.

Tamaños y lugares (el `Escudo` siempre va `aria-hidden`, así que **ningún nombre accesible
cambia**: los `getByRole("button", { name: nombre })` de `arena-cifras.spec.ts` y los
encabezados siguen igual):

| Lugar | Archivo | Inserción | Tamaño |
| --- | --- | --- | --- |
| Marcador | `ArenaCelebracion.tsx` (`ArenaMarcador`) | local: `<Escudo/>{nombre}{estrella}`; visita: `{estrella}{nombre}<Escudo/>` (el orden de la estrella visitante cambia para la simetría [⛨ LOCAL ★ · 0–1 · ★ VISITA ⛨]; `.arena-score strong` sigue siendo solo el marcador y el nombre del local sigue dentro de `.arena-score`) | 28 (22 a ≤ 520 px) |
| Rótulo de gol | `ArenaRotuloGol` | antes de `.arena-goal-word` | 16 |
| Cifras del partido | `ArenaCifras.tsx` (`.arena-stats-teams span`) | antes del nombre (local) / después (visita) | 16 |
| Plantillas: botones de equipo | `ArenaPlantilla.tsx` (`.arena-team-switch .btn`) | antes del nombre | 18 |
| Ficha del jugador | `ArenaPlantilla.tsx` (`.arena-player-card .overline`) | al inicio, seguido de `{club} · ` (texto nuevo: el nombre del club; hoy solo dice puesto y dorsal) | 18 |
| Entrenadores | `ArenaContexto.tsx` (`.arena-coach .overline`) | antes del nombre del club | 20 |
| Planes de equipo | `Arena.tsx` (`.arena-team-plan h2`) | antes del nombre | 22 |
| Reanudación | `Arena.tsx` (`[data-testid="arena-restart"]`) | antes del nombre del club | 16 |

CSS: `.arena-crest { flex: 0 0 auto; vertical-align: middle; }`. En el marcador se **eliminan**
las barras `::before/::after` de `.arena-score > span` (las sustituye el escudo) y la regla de
celebración `.arena-score[data-gol="local"] > span:first-child::before` pasa a
`.arena-score[data-gol="local"] > span:first-child .arena-crest { filter: drop-shadow(0 0 0 2px var(--ar-score-bg)) }`
(el `filter` sobre el escudo está permitido; sigue sin haber `transform` en fichas). La
`.arena-stats-teams span::before` se elimina igualmente.

### 5.7 Fichas en la cancha y anillo de selección

Las fichas heredan la equipación por tokens (§ 5.5). Con una camiseta amarilla el anillo de
selección lima (`--ar-select`) sobre el relleno mide 1,25:1 (medido) y la selección casi no se
ve, y la selección es la interacción central de la demo (clic en jugador → cifras). Por eso:

- En `Arena.tsx`, cuando `jugadorActivo.id === j.id`, se añade dentro de `.arena-token`, **justo
  después del `<text>` del dorsal** (antes de la marca de capitán, la amarilla y el anillo de gol,
  que **sigue siendo el último hijo**), `<circle className="arena-select-ring" r="2.6" aria-hidden="true" />`.
- CSS: `.arena-select-ring { fill: none; stroke: var(--ar-select); stroke-width: .55; }`.
  Las reglas `.arena-player-selected > .arena-token > circle` y `.arena-player:focus-visible > .arena-token > circle`
  **se eliminan**: el primer círculo conserva siempre el anillo de la camiseta. El foco visible
  no depende del estado de React: `.arena-player:focus-visible { outline: 2px solid var(--ar-select); outline-offset: 1px; }`
  (Chromium y Firefox dibujan el `outline` de un `g` alrededor de su caja) y, si el jugador
  enfocado es además el seleccionado, `.arena-player:focus-visible > .arena-token > .arena-select-ring { stroke-dasharray: 1 .5 }`
  distingue foco de selección como hoy.
- El anillo lima mide 4,38 / 5,01 frente a las dos franjas y queda separado del relleno por el
  anillo de la camiseta (`stroke-width .45`): legible con las diez equipaciones.
- `[data-favorite]` sigue pintando el primer círculo con `--ar-live` (049) y
  `.arena-player-selected[data-favorite]` ya no lo sobreescribe (el anillo de selección es otro
  elemento).
- El script de contraste del 047 lee `.arena-local circle` con `querySelector`: el primer
  `circle` sigue siendo el de la camiseta, así que los pares existentes miden lo correcto.

## 6. Z4 · Iconos de eventos (P1)

### 6.1 Correspondencia — `src/ui/IconosArena.tsx`

```ts
export type ClaseIcono = "gol" | "tiro" | "tiro_fuera" | "atajada" | "amarilla" | "roja" | "cambio" | "fuera_juego" | "falta" | "esquina" | "reinicio";
export function claseIcono(e: Pick<EventoArena, "tipo" | "reinicio" | "motivo">): ClaseIcono | null;
export function IconoEventoArena({ evento, size = 14 }: { evento: EventoArena; size?: number }): JSX.Element | null;
```

| `TipoEventoArena` | Clase | Dibujo |
| --- | --- | --- |
| `gol` | `gol` | `IconoEvento tipo="gol"` (balón) |
| `tiro` | `tiro` | `IconoEvento tipo="tiro"` (diana) |
| `tiro_fuera` | `tiro_fuera` | **nuevo**: diana con flecha que sale (`circle r=7 cx=10 cy=14` + `M14 10 l6 -6 M20 4 h-4 M20 4 v4`) |
| `atajada` | `atajada` | `IconoEvento tipo="atajada"` (guante) |
| `amarilla` / `roja` | `amarilla` / `roja` | `IconoEvento tipo="tarjeta_amarilla" / "tarjeta_roja"` (usan `--card-yellow` / `--danger`, ya definidos) |
| `cambio` | `cambio` | `IconoEvento tipo="cambio"` (flechas) |
| `fuera_juego` | `fuera_juego` | `IconoEvento tipo="fuera_de_juego"` (banderín) |
| `falta` | `falta` | `IconoEvento tipo="falta"` (silbato) |
| `reinicio` con `reinicio === "esquina"` | `esquina` | `IconoEvento tipo="corner"` |
| `reinicio` (centro, banda, meta, tras falta, reanudación) | `reinicio` | **nuevo**: balón en el punto (`circle r=4 cx=12 cy=9` + `M4 19 h16` + `M12 13 v6`) |
| `pase`, `recepcion`, `intercepcion`, `recuperacion`, `plan_equipo`, `final_anticipado` | `null` | sin icono: el feed sigue tranquilo |

Los dos dibujos nuevos van en `IconosArena.tsx` con el mismo `base(size)` de `Iconos.tsx`
(exportarlo). `IconoEventoArena` devuelve
`<span className="arena-event-icon" data-kind={clase} aria-hidden="true">…</span>` o `null`.

### 6.2 Dónde

- `.arena-live-feed li` (`Arena.tsx`): entre `<time>` y `<span>`.
- `ArenaDescripcion.tsx` `li`: entre el botón de tiempo y el `<span>`; la rejilla de
  `.arena-events li` pasa a `auto auto minmax(0,1fr) auto`.
- `ArenaCifras.tsx` `.arena-stat-label`: antes de la etiqueta, según la clave:
  `remates`/`remates_directos`/`remates_indirectos`/`remates_cercanos` → `tiro`, `esquinas` →
  `esquina`, `fueras_juego` → `fuera_juego`, `amarillas` → `amarilla`, `rojas` → `roja`,
  `atajadas` → `atajada`, `faltas` → `falta`; el resto sin icono. Se implementa con una función
  `iconoDeCifra(clave): ClaseIcono | null` en el mismo módulo y un componente `IconoClase`.
- `ArenaCifrasJugador.tsx` (`[data-stat]`): mismas claves, mismo icono (P1 si cabe en la hora;
  si no, P2).
- Los iconos siempre acompañan a un texto que ya nombra el evento («Gol de…», «Saques de
  esquina»): por eso son `aria-hidden` y no llevan texto oculto (evita «gol gol de X» en lector
  de pantalla). **Ningún icono transmite información que no esté en el texto adyacente.**
- CSS: `.arena-event-icon { display: inline-flex; width: 18px; height: 18px; align-items: center; justify-content: center; color: var(--muted); flex: 0 0 auto; }`;
  `[data-kind="gol"] { color: var(--accent) }`; `[data-kind="roja"] { color: var(--danger) }`;
  dentro de `.arena-stat-label` (sobre `--ar-bug`) el color es `--ar-bug-muted` y el gol `--ar-score-bg`.
  Sin animaciones.

## 7. P2 (solo con P1 en verde a las 16:00)

### 7.1 Cabecera de jornada

`<p className="arena-matchday" data-testid="arena-matchday">` como **primer hijo** de
`.arena-board` tras el aviso de vista previa, en una línea de 13 px con chips (`--chip`):
«{Clima}{ · N °C} · {superficie} · {Árbitro: nombre} · {Semilla N}», solo con lo que trae el
registro (`config.partido.condiciones`, `inicial.arbitro`, `config.partido.seed`); sin
estadio ni competición, que **no existen en el registro** y serían datos inventados. Textos
reutilizando las traducciones de `ArenaContexto.tsx` (`climas`, superficie) y `t("Referee", "Árbitro")`.
Debe caber en 28 px para no romper el objetivo de § 4.2 (se mide).

### 7.2 Alineaciones tipo TV

`<section className="arena-lineups" aria-label={t("Starting line-ups", "Alineaciones")} data-testid="arena-lineups">`
**después** de `.arena-direction` (nunca sobre la cancha: los e2e pulsan fichas en el tick 0 y
un velo interceptaría el clic) y solo mientras `eventos.length === 0 && !enDirecto && !bufferActivo`.
Dos columnas con escudo, nombre, formación (`registro.config.formaciones[lado]`) y las once
líneas «dorsal · nombre» agrupadas por línea de la formación (`estructura()` de
`src/arena/catalogo.ts`), botones `type="button"` que llaman a `setSeleccionado`. Sin textos
en los e2e; `aria-label` en una `section` nueva es lo que ya hace `arena-stats`.

## 8. Constantes — `src/sim/limites.ts` (comentadas, después de `IGR_ARENA`)

```ts
/** Brief 055 · Identidad de club derivada del nombre: equipaciones, escudos e iconos. Los colores
 * se midieron con la fórmula WCAG 2.x el 22 oct contra --ar-grass-a/-b (3:1 mínimo para el relleno
 * y el anillo), contra el relleno (4,5:1 para el dorsal) y contra --surface/--ar-surface-2 (claro)
 * y --surface/--ar-surface-2/--ar-bug/--ar-bug-2 (oscuro) para los colores de interfaz (4,5:1).
 * Las pruebas vuelven a medir todo con los tokens leídos de globals.css; aquí no se repite ninguna cifra. */
export const IDENTIDAD_ARENA = {
  /** Mínimos WCAG: relleno/anillo frente al césped y entre equipos (gráfico), dorsal e interfaz (texto). */
  minGrafico: 3, minTexto: 4.5, minEntreEquipos: 3,
  /** FNV-1a de 32 bits. */
  fnvDesplazamiento: 0x811c9dc5, fnvPrimo: 0x01000193,
  /** Iniciales: máximo y longitud mínima de palabra. */
  maxIniciales: 3, minLetrasPalabra: 3,
  formas: ["escudo", "redondo", "estandarte"],
  patrones: ["liso", "rayas", "mitades", "banda", "aros"],
  /** Índices 0–4 familia oscura, 5–9 familia clara. tinta = color del dorsal y del anillo.
   * uiClaro/uiOscuro = color del equipo sobre superficies del tema claro/oscuro (barras, tabla, bordes). */
  paleta: [
    { id: "marino",   familia: "oscura", fondo: "#0c1640", tinta: "#ffffff", uiClaro: "#1b2f7a", uiOscuro: "#8fb0ff", nombre: { es: "marino",   en: "navy" } },
    { id: "negro",    familia: "oscura", fondo: "#121418", tinta: "#ffffff", uiClaro: "#2b2f3a", uiOscuro: "#c9ced9", nombre: { es: "negro",    en: "black" } },
    { id: "granate",  familia: "oscura", fondo: "#2e0612", tinta: "#ffffff", uiClaro: "#7a1430", uiOscuro: "#ff9fb4", nombre: { es: "granate",  en: "claret" } },
    { id: "purpura",  familia: "oscura", fondo: "#200a3a", tinta: "#ffffff", uiClaro: "#5a2a9a", uiOscuro: "#cfaaff", nombre: { es: "púrpura",  en: "purple" } },
    { id: "petroleo", familia: "oscura", fondo: "#041c24", tinta: "#ffffff", uiClaro: "#0b5566", uiOscuro: "#7fd6e8", nombre: { es: "petróleo", en: "teal" } },
    { id: "blanco",   familia: "clara",  fondo: "#f5f7fb", tinta: "#0b1220", uiClaro: "#13203f", uiOscuro: "#f5f7fb", nombre: { es: "blanco",   en: "white" } },
    { id: "amarillo", familia: "clara",  fondo: "#ffd23f", tinta: "#0b1220", uiClaro: "#7a5a00", uiOscuro: "#ffd23f", nombre: { es: "amarillo", en: "yellow" } },
    { id: "celeste",  familia: "clara",  fondo: "#a6d6ff", tinta: "#0b1220", uiClaro: "#0b4f8a", uiOscuro: "#a6d6ff", nombre: { es: "celeste",  en: "sky blue" } },
    { id: "rosa",     familia: "clara",  fondo: "#ffbccf", tinta: "#0b1220", uiClaro: "#8a2a4a", uiOscuro: "#ffbccf", nombre: { es: "rosa",     en: "pink" } },
    { id: "naranja",  familia: "clara",  fondo: "#ffc46a", tinta: "#0b1220", uiClaro: "#8a4b00", uiOscuro: "#ffc46a", nombre: { es: "naranja",  en: "amber" } },
  ],
  /** Tamaños del escudo (px de ancho) por lugar; el alto es ×36/32. */
  escudoPx: { marcador: 28, marcadorMovil: 22, rotuloGol: 16, cifras: 16, plantilla: 18, ficha: 18, entrenador: 20, plan: 22, reanudacion: 16 },
  /** Tope de concentración admitido en la prueba de distribución sobre todos los nombres posibles. */
  maxFraccionPorKit: 0.25,
} as const;
```

Medidas con las que se fijó la paleta (22 oct, script de la evidencia): relleno frente a las
dos franjas 3,22–5,40 (mínimo rosa/naranja 3,22 y marino 3,01 en la franja oscura); dorsal
sobre relleno 11,9–18,4; anillo blanco frente al césped 5,07/5,79 y anillo `#0b1220` 3,70/3,23;
`uiClaro` sobre `#ffffff`/`#f4f6fa` ≥ 5,9; `uiOscuro` sobre `#131c2e`/`#1a2540`/`#0b1220`/`#18233a`
≥ 7,1; entre familias ≥ 11,08; dentro de una misma familia 1,0–1,5 (de ahí la regla § 5.4).
Hecho asumido: la equipación oscura frente a `--ar-bug` mide ≈ 1,0, igual que hoy el marino
(deuda del 047 «la barra del local apenas se distingue»): por eso en el marcador la barra
desaparece y el escudo, con contorno en `tinta` blanca (18,7 sobre el bug), toma su lugar.

El hex de `icon.svg` (§ 3.2) y los valores de reserva del CSS (§ 5.5) son las únicas copias de
color fuera de tokens; las pruebas los comparan.

## 9. Accesibilidad y medición

- **Contraste**: `docs/evidencia/rediseno-047/contraste.mjs` recibe estos pares nuevos en
  `PARES` (obligatorios salvo indicación): iniciales del escudo del marcador
  (`.arena-score .arena-crest text`, `fill`, frente a `.arena-score .arena-crest rect:nth-of-type(2)` o
  el `circle` del campo, 4,5); contorno del escudo del marcador frente a `.arena-score`
  (`stroke`, 3); anillo de selección frente a césped (`.arena-select-ring`, `stroke`, 3, no
  obligatorio: solo con selección); icono del feed frente a su tarjeta
  (`.arena-live-feed .arena-event-icon`, `color`, 3, no obligatorio); icono del panel de
  cifras frente al bug (`.arena-stat-label .arena-event-icon`, `color`, 3); nota de
  equipación (`.arena-kit-note`, 4,5, no obligatorio); CTA de la cabecera
  (`.arena-intro-cta`, 4,5); emblema de la barra (`.arena-topbar .brand-emblem`, `color`, 3).
  Los pares existentes (dorsal/ficha, ficha/césped, anillo/césped) siguen midiendo las
  equipaciones **del partido cargado**; el script se ejecuta además sobre **dos partidos** con
  equipaciones distintas: el ejemplo público `arena-llm-v3.json` y el `arena-duelo-v3.json`
  (cargados con las pestañas en la página local), y la unitaria cubre las 10×10 combinaciones.
- **Capturas**: nuevo `docs/evidencia/identidad-055/capturas.mjs` (copiado de `capturas.mjs`,
  mismos encuadres 1440×900 y 360×740, claro y oscuro, portada y `?partido=`), que añade
  las métricas `canchaAbajo` (`.arena-pitch-wrap` bottom), `controlEnAcompanante`
  (`#arena-control.offsetTop`), `altoCabecera` (`.arena-intro`), `favicon` (href y estado
  HTTP de `link[rel="icon"]`), `kits` (`data-kit` de los dos escudos del marcador y
  `fill` computado de `.arena-local circle` / `.arena-visita circle`) y `emblema`
  (bbox de `.brand-emblem`). Guarda `antes-*` y `despues-*` en `docs/evidencia/identidad-055/`
  y falla con desborde, errores JS, `canchaAbajo > 900` en escritorio o `favicon` ≠ 200.
- **Movimiento reducido**: este brief no añade animaciones ni transiciones; el `drop-shadow`
  del escudo en la celebración es estático. Las reglas de `prefers-reduced-motion` del 047/050
  no cambian.
- **Claro y oscuro**: todos los tokens nuevos tienen valor en los dos temas (§ 5.5 por
  `main.arena-shell`); el `icon.svg` es fijo (fondo navy, como el rótulo de TV).
- **360 px**: sin desborde en claro, oscuro, ES/EN y movimiento reducido; cancha ≥ 316 px;
  escudo del marcador 22 px; iconos 14 px; la sala de control va bajo la cancha y el CTA de la
  cabecera lleva a ella.
- **Lector de pantalla**: escudos, emblema e iconos `aria-hidden`; sin texto oculto; el orden de
  lectura nuevo es cabecera → tablero → sala de control → narración → Mesa → acciones.

## 10. Pruebas exigidas

`src/arena/__tests__/identidad.test.ts`:

- **Determinismo**: `identidadClub(n)` es `toEqual` en dos llamadas y en `n.normalize("NFD")`,
  `n.toUpperCase()` y `  n  `; nombres distintos de los ejemplos públicos dan identidades
  distintas (al menos kit o patrón o forma).
- **Garantías de color sobre los tokens reales**: la prueba lee `src/app/globals.css`, extrae
  `--ar-grass-a`, `--ar-grass-b`, `--surface`, `--ar-surface-2`, `--ar-bug`, `--ar-bug-2`
  (claro y oscuro, por los tres bloques) y falla si falta alguno; para **cada** entrada de
  `IDENTIDAD_ARENA.paleta`: `fondo` y `tinta` frente a las dos franjas ≥ `minGrafico`,
  `tinta` sobre `fondo` ≥ `minTexto`, `uiClaro` sobre `--surface`/`--ar-surface-2` claros ≥ `minTexto`,
  `uiOscuro` sobre `--surface`/`--ar-surface-2`/`--ar-bug`/`--ar-bug-2` oscuros ≥ `minTexto`;
  `contrasteWcag` se comprueba con dos pares conocidos (blanco/negro = 21; `#ffffff`/`#777777` ≈ 4,48).
- **Regla del partido**: para las 10×10 combinaciones de principal local × principal visitante
  (forzadas con un doble de `identidadClub` o con nombres buscados), `equipaciones()` devuelve
  `contrasteWcag(local.fondo, visita.fondo) ≥ minEntreEquipos`, `local` nunca cambia y
  `visitaAlternativa` es verdadero exactamente cuando las principales comparten familia; con el
  mismo nombre en ambos lados también cumple.
- **Iniciales**: «Sporting Montefrío Bajo» → «SMB», «Olímpico Brezal» → «OB», «Club de la
  Vega» → «CV» (descarta «de» y «la»), «Ormidia» → «OR», cuatro palabras → tres letras.
- **Distribución**: sobre `PREFIJOS × LUGARES` (importados de `plantillas.ts`) se usan los 10
  kits, los 5 patrones y las 3 formas, y ningún kit supera `maxFraccionPorKit`.
- **Variables**: `variablesEquipacion` devuelve exactamente las 10 claves de § 5.5 con los
  valores de la paleta; ninguna clave más.
- **Sin hex en TSX**: los archivos `src/ui/Escudo.tsx`, `src/ui/Emblema.tsx`,
  `src/ui/IconosArena.tsx` y `src/ui/Arena.tsx` no contienen `#[0-9a-fA-F]{3,8}` fuera de
  comentarios (lectura del fuente en la prueba).

`src/ui/__tests__/identidad-ui.test.tsx` (`renderToStaticMarkup`):

- `Escudo` de los dos clubes del fixture `arena-reinicios-v3.json`: contiene `aria-hidden="true"`,
  `data-kit`, `data-patron`, `data-forma`, las iniciales esperadas, un `clipPath` con `id`
  distinto entre dos escudos en el mismo render, ningún `<title>`; el patrón `liso` no emite
  elementos de patrón; el campo de iniciales existe en las tres formas.
- `Arena` con el fixture: `main` lleva `style` con las 10 variables; el marcador tiene dos
  `.arena-crest` con `data-kit` distintos; con un registro cuyos clubes compartan familia
  (nombres elegidos en la prueba buscando por `identidadClub`) aparece `.arena-kit-note`;
  `.arena-select-ring` existe una sola vez y **no** es el último hijo de su `.arena-token`
  cuando el seleccionado celebra un gol (fixture con gol, `golEnCelebracion`); el goleador
  conserva `circle.arena-goal-ring` como último hijo.
- `EmblemaCronista`: `aria-hidden`, sin texto, `viewBox="0 0 32 32"`; **paridad con el favicon**:
  los atributos `d` y el `circle` de `src/app/icon.svg` coinciden con los del componente, y los
  tres hex del `icon.svg` igualan `--ar-bug`, `--ar-score-bg` y `--ar-live` claros de `globals.css`.
- `IconoEventoArena`: `claseIcono` cubre los 16 `TipoEventoArena` (tabla § 6.1 como datos de la
  prueba, incluidos `reinicio` con cada `reinicio` y `motivo: "falta"`), devuelve `null` para los
  seis sin icono, y el feed renderizado (`Arena` con fixture a un tick con gol y tarjeta) contiene
  `data-kind="gol"` y `data-kind="amarilla"` dentro de `.arena-live-feed li`, siempre `aria-hidden`.
- `ArenaCifras`: `iconoDeCifra` para todas las claves de `ESTADISTICAS_ARENA.filasPanel` y el
  `.arena-stat-label` de `remates` lleva `data-kind="tiro"`; las etiquetas ES/EN no cambian.

`e2e/arena-identidad.spec.ts` (un archivo, serializado como los demás de arena):

1. `/arena` a 1440×900: `link[rel="icon"]` presente, su `href` responde 200 con
   `content-type` `image/svg+xml` (también desde `/`); `.brand-emblem` visible en las dos páginas.
2. En la portada y tras «Saved matches» → «Load AI coaches example»: `boundingBox` de
   `.arena-pitch-wrap` con `y + height ≤ 900` y `.arena-score` con `y + height ≤ 330` **sin
   desplazarse**; `.arena-board.y` y `arena-companion.y` difieren < 2; `#arena-control` está
   dentro de `arena-companion`.
3. Los dos `.arena-score .arena-crest` tienen `data-kit` distintos; el contraste entre el
   `fill` computado de `.arena-local circle` y `.arena-visita circle` (calculado en la prueba
   con la fórmula WCAG) es ≥ 3, y el de cada uno frente a `.arena-grass` ≥ 3.
4. Mover «Match time» hasta el final: `.arena-live-feed li .arena-event-icon[data-kind]` existe;
   el panel `arena-stats` tiene `[data-stat="remates"] .arena-event-icon[data-kind="tiro"]`.
5. Clic en una ficha: `.arena-player-selected .arena-select-ring` tiene `count 1`.
6. 360×780, oscuro, movimiento reducido, español: `scrollWidth ≤ 360`; el encabezado «Dos
   equipos. Una misma cancha.» y el enlace «Configurar o elegir un partido» son visibles; al
   pulsarlo, `#arena-control` queda dentro del viewport.

Mutaciones que deben romper pruebas: quitar la normalización del hash; elegir la alternativa
de la misma familia; cambiar un hex de la paleta a un rojo medio; no poner el `style` en
`main`; dejar `::before` en el marcador (prueba de paridad del DOM: no hay `::before` que medir,
pero el e2e de contraste del escudo falla al no existir `.arena-crest`); hacer que el anillo de
selección sea el último hijo; quitar `aria-hidden` del escudo; perder la paridad entre
`icon.svg` y el componente; devolver icono para `pase`.

## 11. Impacto en los e2e (lista cerrada, debe seguir resolviendo igual)

Toda la lista del 047 (§ Restricciones) y los selectores del 049–053 presentes hoy:
`arena-downloads`, `arena-stats`, `.arena-stat-row[data-stat][data-leader]`, `.arena-stat-value`,
`.arena-stats-teams [data-side]`, `arena-stats-highlights`, `arena-player-stats`,
`arena-favorite-club[data-side]`, `arena-favorite-player`, `arena-only-favourite`,
`arena-mesa-dialogo`, `arena-narration-download(-help)`, `.arena-pitch-wrap > p.arena-goal-banner`,
`.arena-goal-word`, `circle.arena-goal-ring` (último hijo de `.arena-token`),
`.arena-score[data-gol]`, `getByRole("status", { name: /Gol|Goal/ })`.

Flujos que este brief toca y deben seguir en verde sin cambiar `e2e/`:

- `arena-formaciones.spec.ts` «live es el valor inicial…»: «Home formation», «Simulated
  duration» y «Start live match» usables **nada más cargar** (la sala de control va abierta
  dentro del acompañante; Playwright desplaza el contenedor con scroll interno).
- `arena-formaciones.spec.ts` «interfaz: narración y audio junto a la cancha…»: alineación
  tablero/acompañante < 2 px; acompañante a la derecha; bajo el único `header`.
- `arena-buffer.spec.ts:139–166`: «Start live match» dentro de `arena-live` al cargar; 360 px
  sin desborde.
- `arena.spec.ts:236–254` (móvil): encabezado visible, cancha dentro de 360, 22 fichas, un
  árbitro, clic en `arena-roster-person`.
- `arena-cifras.spec.ts`: `getByRole("button", { name: nombre, exact: true })` de los equipos
  (el escudo es `aria-hidden`); estrellas en el marcador (`.arena-score > span` primero =
  local, con `data-favorite`); 360 px con panel y ficha visibles.
- `arena-canto-gol.spec.ts`: `estiloAnillo` (`ultimo === true`), rótulo dentro de
  `.arena-pitch-wrap`, `.arena-score strong` «1–1».
- `actividad.spec.ts:21`: `.brand` sigue siendo el enlace a `/`.

**Nombres accesibles que no cambian**: botones de equipo, encabezados de planes, enlace
`.brand`, «Dos equipos. Una misma cancha.», regiones «Broadcast desk» y «Event narration»,
`aria-label` de la cancha. **Textos nuevos (no usados por e2e)**: «Set up or choose a match» /
«Configurar o elegir un partido»; «{Away} wears its change kit» / «{Visita} viste su segunda
equipación»; el nombre del club en el `overline` de la ficha.

## 12. Prioridad, orden del día y estimación

**P1 (obligatorio, en este orden; ≈ 8 h):**

1. `identidad.ts` + `IDENTIDAD_ARENA` + pruebas unitarias (§ 10, bloque 1) — 1,5 h.
2. `Escudo.tsx`, variables en `main`, CSS de § 5.5–5.7, inserciones de la tabla § 5.6, anillo
   de selección — 2,5 h. Es el mayor salto visual: va primero por si el día se acorta.
3. Z2 partido primero (movimiento de DOM, cabecera compacta, CSS del acompañante) y medida con
   el script — 1,5 h.
4. Z1 emblema + `icon.svg` + cabeceras de `/` y `/arena` + prueba de paridad — 1 h.
5. Z4 iconos (mapa, dos dibujos, tres inserciones) + pruebas — 1 h.
6. `contraste.mjs` ampliado, `capturas.mjs` del 055 antes/después, e2e nuevo, `npm test`,
   `typecheck`, e2e de arena serializados, bitácora — 1 h (más 25 min si la suite completa).

**Corte 16:00**: si el paso 3 no está en verde, se entrega sin Z2 (la identidad y el emblema
valen solos) y se declara. **P2 (≈ 2 h, solo con P1 en verde a las 16:00)**: `apple-icon.png`,
cabecera de jornada, alineaciones TV, iconos en la ficha del jugador.

## 13. Criterios de aceptación (todos vistos correr)

1. `node docs/evidencia/identidad-055/capturas.mjs antes <URL pública>` antes de tocar código y
   `… despues http://127.0.0.1:<puerto>/arena` sobre `npm run build && npm run package:standalone && node .next/standalone/server.js`;
   tras desplegar, de nuevo contra la URL pública. Código 0; `canchaAbajo ≤ 900` y
   `marcadorAbajo ≤ 330` en escritorio (portada y partido); `altoCabecera ≤ 96`; `favicon = 200`;
   `kits` con dos `data-kit` distintos.
2. `node docs/evidencia/rediseno-047/contraste.mjs <URL local>?partido=<id>` con código 0 en
   claro y oscuro, sobre dos partidos con equipaciones distintas; salida en
   `docs/evidencia/identidad-055/contraste-despues.txt`.
3. `npm test`, `npm run typecheck`, `npm run build` en verde; `npm run e2e -- e2e/arena-identidad.spec.ts e2e/arena.spec.ts e2e/arena-formaciones.spec.ts e2e/arena-cifras.spec.ts e2e/arena-canto-gol.spec.ts e2e/arena-buffer.spec.ts e2e/actividad.spec.ts`
   en verde; `git diff --stat e2e/ src/arena/motor.ts src/arena/tipos.ts src/app/api` vacío
   salvo el archivo e2e nuevo.
4. Revisión visual: capturas antes/después comparadas en la bitácora con ≥ 3 mejoras visibles
   y cualquier regresión; alguien distinto del implementador (Fable, Codex o
   `auditor-adversario`) mira el emblema contra la lista de no parecido (§ 3.1) antes de ✅.
5. Dos partidos distintos (`arena-llm-v3`, `arena-duelo-v3`) muestran escudos y camisetas
   distintos, y «Load AI coaches example» da siempre los mismos (determinismo visto).

## 14. Fuera de alcance

- Datos nuevos en `RegistroArena` (colores, estadio, competición) o en la API; cambios en el
  motor, el validador, los fixtures o los controladores.
- Crónicas históricas (`/`, `/match`, `/liga`, `/datos`): solo reciben el emblema en la
  cabecera; su paleta editorial (brief 010) no cambia.
- Escudos con figuras (animales, torres, coronas) o nombres de patrocinador; tipografías nuevas;
  imágenes externas; `favicon.ico`; `manifest`; iconos en el transcript de voz; animación del
  escudo o del emblema; cambio del dorsal o del tamaño de las fichas (047).
- Permitir al espectador elegir colores o editar escudos.
- Un modo «solo cancha» o pantalla completa; rotar la cancha en móvil.

## 15. Límites honestos y riesgos

- **La paleta es estrecha por el césped**: solo colores muy oscuros o claros alcanzan 3:1 sobre
  el verde. No habrá rojo, azul royal ni verde como camiseta; los tonos medios aparecen solo
  como color de interfaz (`uiClaro`/`uiOscuro`) y en el patrón del escudo. Es una decisión de
  legibilidad, declarada en el brief y comprobada en las pruebas.
- **Heráldica genérica**: rayas, mitades, bandas y aros en marino/blanco/granate se parecen a
  los de muchos clubes reales porque son los patrones genéricos del fútbol; los nombres son
  ficticios y ninguna combinación se elige para evocar un club concreto. Si un revisor ve un
  parecido puntual, se cambia la asignación de bits del hash (no la paleta) y se documenta.
- **Camiseta oscura sobre el rótulo de TV**: el relleno oscuro frente a `--ar-bug` mide ≈ 1,0;
  por eso el marcador deja la barra de color y usa el escudo con contorno. La barra de cifras
  usa `uiOscuro` (≥ 7,1) como ya hacía el 049 con `--ar-home-ui-bug`.
- **Sala de control dentro del acompañante**: antes de arrancar, la Mesa queda bajo el pliegue
  del acompañante (≈ 560 px de controles abiertos); al iniciar o cargar un partido la
  configuración se pliega y la Mesa sube. En móvil la sala de control queda bajo la cancha y
  las cifras: el CTA de la cabecera es el camino. Si Carlos prefiere la configuración arriba en
  móvil, es un cambio de CSS (`order`) que no toca el DOM.
- **Orden de lectura**: cambia (tablero antes que configuración). Si un e2e falla **solo** por el
  movimiento, se revierte Z2 y se anota, igual que se previó en el 047 con la Mesa.
- **`display`/`filter` del escudo en la celebración**: `drop-shadow` es un filtro CSS sobre un
  SVG de 28 px; coste despreciable y sin `transform`. Si una captura lo muestra borroso, se
  sustituye por `outline` sobre el `svg`.
- **El `style` en línea sobre `main`** es la única excepción a «sin colores en TSX»: los valores
  vienen de `IDENTIDAD_ARENA` y una prueba vigila que no haya hex literales en los TSX.
- **El favicon SVG** no se muestra en navegadores sin soporte de favicon SVG (Safari anterior
  a 2022 muestra el genérico); el `apple-icon.png` es P2. Sin `favicon.ico` a propósito.
- **Determinismo entre despliegues**: el hash depende solo del nombre y de la paleta; cambiar la
  paleta o el orden de sus entradas cambia el escudo de todos los clubes. Añadir colores debe
  hacerse al final del arreglo y actualizar las pruebas de distribución.
- **El contraste se mide por pares elegidos**, no por auditoría completa; el script no mide
  estados hover ni el escudo sobre la superficie clara (contorno blanco sobre blanco en kits
  oscuros: invisible pero inofensivo, el relleno oscuro delimita la forma).
- **Medidas tomadas sobre la revisión pública 0000018** (22 oct). Si se despliega otra antes
  del «antes», se recaptura.
