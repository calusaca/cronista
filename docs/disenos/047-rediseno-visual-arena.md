# Rediseño visual de la arena: transmisión deportiva nocturna

## Alcance de esta revisión

Carlos probó la arena publicada el 21 de octubre y pidió decorarla: «hay que decorar
mejor la página, está muy fea y básica». El video demo (< 2 min) se graba sobre
`/arena` y la entrega cierra el 27 de octubre, así que este brief es **solo visual**:
CSS, tokens y retoques de marcado decorativo. No cambia el comportamiento, los textos,
los datos, el simulador, el protocolo ni las pruebas. Debe poder implementarlo Opus
en un día.

Lo redactó Opus el 21 de octubre porque Fable no tenía cupo. Queda **cerrado** para
implementarse. Si Fable o Codex lo revisan antes de que termine la implementación,
sus hallazgos se añaden como adenda. Las decisiones de diseño que se tomaron sin
revisión se marcan como **[decisión]**.

Evidencia del estado actual en [`docs/evidencia/rediseno-047/`](../evidencia/rediseno-047/).
Son capturas de la URL pública (revisión `cronista-arena--0000011`) y el partido
terminado `cd0e2ad0-…` con el cursor en 0:40. Se reproducen con
`node docs/evidencia/rediseno-047/capturas.mjs antes` y
`node docs/evidencia/rediseno-047/contraste.mjs`, ambos ejecutados desde la raíz del
repo.

## Estado actual medido

Capturas: `antes-{escritorio,movil}-{claro,oscuro}{,-inicio,-cancha,-mesa}.png`
(1440×900 y 360×740). Medidas: [`capturas-antes.txt`](../evidencia/rediseno-047/capturas-antes.txt).
Contraste: [`contraste-antes.txt`](../evidencia/rediseno-047/contraste-antes.txt).

| Área | Problema concreto | Medida |
| --- | --- | --- |
| Jerarquía | El primer viewport de escritorio es un formulario. En la portada (`-inicio`) no aparecen ni la cancha ni el marcador. Con `?partido=` el marcador termina justo en el borde inferior. | Fondo del marcador en y = 900 px, en el límite de un viewport de 900. En móvil está en y = 1172 con un viewport de 740 |
| Jerarquía | La Mesa de transmisión (las tres voces, el núcleo multiagente) queda escondida dentro del acompañante pegajoso, que tiene scroll interno. | `offsetTop` de la Mesa = 714 px en un acompañante de 802 px visibles (2078 px de alto total) |
| Densidad | Todos los paneles son iguales: tarjeta blanca, borde gris de 1 px, título de 21–25 px y párrafo atenuado. Nada indica qué es lo principal. Las secciones `.arena-live` y `.arena-setup` ocupan más que la cancha. | `.arena-live` mide unos 400 px de alto en 1440 px |
| Tipografía | Archivo solo aparece en el titular y el marcador. Los rótulos de rol, el reloj y los equipos usan la misma voz que el cuerpo. Los números del reloj no destacan. | Reloj de 16 px en negrita, centrado bajo la leyenda |
| Color | Hay un solo acento verde, heredado del brief 010 para las crónicas editoriales. El modo oscuro es verde sobre verde. Los equipos no tienen color propio: el local usa el acento y el visitante el color de la superficie. | Visitante frente al césped: **1,18** en claro y **1,32** en oscuro (FALLA) |
| Cancha | El césped es un plano sin franjas. Las líneas casi no se ven, faltan los puntos de penal, las medialunas y los arcos de esquina, y la cancha no tiene entorno. | Líneas frente al césped: **1,70** en claro y **1,59** en oscuro |
| Fichas | El dorsal mide 2,3 unidades del viewBox: se renderiza a 6,0 px a 360 px de ancho (15,3 px en escritorio), ilegible en móvil. En oscuro, el anillo del local se confunde con el césped. | Anillo frente al césped: **1,18** en claro y **1,32** en oscuro (FALLA) |
| Marcador | `.arena-score` es una línea de texto: nombres en negrita y «0–1». No hay caja, colores de equipo, reloj integrado ni indicador de directo. | — |
| Estados vacíos | Los textos de espera («Waiting for kick-off…», «Commentary will appear…») son párrafos sueltos sin forma de estado. Los avisos de carga y error (`.arena-notice`) usan el mismo fondo verde pálido. | — |
| Móvil | No hay desborde (`scrollWidth` = 360), pero la página mide 11 517 px. La cancha mide 302 px y los botones de transporte quedan en 38 px de alto. | 11 517 px de alto |

## Dirección visual

**«Transmisión deportiva nocturna»: un estadio bajo focos, con rótulos de TV en azul
noche y un acento lima. Lo único que ilumina la pantalla es el partido: el marcador, la
cancha y quién tiene la palabra.**

[decisión] La arena deja el verde editorial del brief 010 **solo dentro de `/arena`**.
Es un laboratorio separado y el video necesita una identidad de transmisión. Las
crónicas no cambian. Sin parecido con la marca de la Premier League ni con ninguna
cadena: no se usan su morado y cian ni sus fuentes o logotipos, y todo se dibuja con
CSS y SVG propios.

## Sistema visual

### Cómo se aplican los tokens

1. En `globals.css`, después del bloque de la arena, se **redefinen los tokens
   globales** (`--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--accent`,
   `--accent-ink`, `--hl`, `--hl-line`, `--danger`, `--danger-soft`, `--chip`,
   `--shadow`, `--pitch-line`) y se añaden los nuevos `--ar-*` bajo
   `:root:has(main.arena-shell)`. Así la barra superior, el `body` y los `.btn`/`.field`
   globales se retiñen sin tocar el resto del sitio. La especificidad (0,2,1) gana a
   `:root:not([data-theme="light"])` (0,2,0).
2. Para el modo oscuro se usa el mismo patrón triple que ya tiene el archivo:
   `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]):has(main.arena-shell) {…} }`
   y `:root[data-theme="dark"]:has(main.arena-shell) {…}`.
3. Los colores solo existen como tokens en `globals.css`. No se escriben hex en TSX ni
   en atributos SVG (regla del brief 010).

### Paleta

Todos los pares de texto se midieron con la fórmula WCAG 2.x antes de fijarlos. El
script los vuelve a medir sobre el DOM real.

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `--bg` | `#eef1f6` | `#0b1220` | fondo de página |
| `--surface` | `#ffffff` | `#131c2e` | paneles |
| `--ar-surface-2` | `#f4f6fa` | `#1a2540` | tarjetas internas, transporte, Mesa |
| `--line` | `#d9dfe9` | `#26324a` | bordes |
| `--ink` | `#0f172a` | `#eef2f8` | texto (17,9 / 15,2 sobre la superficie) |
| `--muted` | `#4f5d78` | `#9fb0c9` | texto secundario (6,6 / 7,7 sobre la superficie; 5,9 / 8,5 sobre el fondo) |
| `--accent` | `#3f6a00` | `#d4ff3a` | acento lima (6,4 / 14,7 sobre la superficie) |
| `--accent-ink` | `#ffffff` | `#0b1220` | texto sobre el acento |
| `--ar-primary-bg` / `--ar-primary-ink` | `#0b1220` / `#d4ff3a` | `#d4ff3a` / `#0b1220` | botón primario y pestaña activa (16,2) |
| `--hl` / `--hl-line` | `#eef5dc` / `#b7cf7a` | `#1a2540` / `#3b4d75` | resaltes y estados |
| `--danger` / `--danger-soft` | `#b42318` / `#fdecea` | `#ff8a80` / `#3a1d24` | error y rechazo (6,6 / 7,5) |
| `--chip` | `#e6eaf2` | `#1f2a44` | chips |
| `--ar-live` | `#d1242f` | `#ff5a5f` | punto «en directo», solo como señal |
| `--ar-bug` / `--ar-bug-2` / `--ar-bug-ink` / `--ar-bug-muted` | `#0b1220` / `#18233a` / `#ffffff` / `#a9b8d0` | igual | barra superior, cabecera y marcador (constantes, como un rótulo de TV; 18,7 y 9,3) |
| `--ar-score-bg` / `--ar-score-ink` | `#d4ff3a` / `#0b1220` | igual | caja de goles (16,2) |
| `--ar-home` / `--ar-home-ink` / `--ar-home-ring` | `#0c1640` / `#ffffff` / `#ffffff` | igual | equipación local en la cancha (dorsal 17,4; relleno frente al césped ≥ 3,0; anillo frente al césped ≥ 5,1) |
| `--ar-home-ui` | `#1b2f7a` | `#8fb0ff` | color local en la interfaz: barras, plantilla, tabla (12,1 / 8,0) |
| `--ar-away` / `--ar-away-ink` / `--ar-away-ring` | `#f5f7fb` / `#13203f` / `#13203f` | igual | equipación visitante (dorsal 15,0; relleno frente al césped ≥ 4,7) |
| `--ar-away-ui` | `#13203f` | `#f5f7fb` | color visitante en la interfaz |
| `--ar-grass-a` / `--ar-grass-b` | `#2f7d47` / `#2a7341` | igual | franjas del césped (igual en los dos temas, como en TV) |
| `--ar-runoff` | `#1f5a33` | `#173f27` | zona exterior de la cancha |
| `--pitch-line` | `#e8f2ea` | igual | líneas (≥ 4,4 frente a las dos franjas) |
| `--ar-select` | `#d4ff3a` | igual | anillo del jugador seleccionado (≥ 4,4 frente al césped) |
| `--ar-role-narrador` | `#3f6a00` | `#d4ff3a` | relator (6,4 / 14,7) |
| `--ar-role-comentarista` | `#b4441b` | `#ff9a6b` | comentarista (5,6 / 8,2) |
| `--ar-role-estadista` | `#0b7268` | `#5ee0d0` | estadista (5,8 / 10,6) |
| `--ar-role-ink` | `#ffffff` | `#0b1220` | iniciales sobre el color de rol |

El amarillo del árbitro y del capitán (`#ffce58` con `#171d24`) no cambia. Mide 3,4 y
3,9 frente a las dos franjas del césped.

### Tipografía

[decisión] No se añaden fuentes. Se mantienen **Archivo** (500/700/900, ya cargada en
`layout.tsx` como `--font-display`) y **Source Sans 3** (400/600/700). Escala de la
arena:

| Uso | Fuente | Tamaño / interlínea | Notas |
| --- | --- | --- | --- |
| Titular h1 | Archivo 900 | `clamp(30px, 4.2vw, 52px)` / 1.05 | `letter-spacing: -0.035em` |
| Goles del marcador | Archivo 900 | 40 px; 30 px a ≤ 520 px | `font-variant-numeric: tabular-nums` |
| Equipos del marcador | Archivo 700 | 15 px; 12 px a ≤ 520 px | mayúsculas por CSS, `letter-spacing: .04em` |
| Reloj | Archivo 700 | 15 px | cifras tabulares |
| h2 de panel | Archivo 700 | 20 px / 1.2 (18 px en el acompañante) | |
| Nombre en la Mesa (h3) | Archivo 700 | 15 px | |
| Rótulos (overline, rol, modo) | Source Sans 3, 700 | 11–12 px | mayúsculas, `letter-spacing: .08em` |
| Cuerpo | Source Sans 3, 400 | 15 px / 1.5 (14 px en el acompañante) | |

Las mayúsculas se aplican solo con `text-transform` sobre rótulos, nombres de equipo
y rol. **No se aplican a botones, enlaces ni encabezados con nombre accesible
probado.**

### Espacios, radios y elevación

- Espacios: `--ar-s1: 4px; --ar-s2: 8px; --ar-s3: 12px; --ar-s4: 16px; --ar-s5: 24px; --ar-s6: 32px; --ar-s7: 48px`.
  Ningún `padding`/`gap`/`margin` nuevo de la arena usa otro valor.
- Radios: `--ar-r-sm: 6px` (chips, caja de goles), `--ar-r: 12px` (tarjetas, transporte),
  `--ar-r-lg: 18px` (paneles, cabecera, cancha), `--ar-r-pill: 999px` (pestañas, estados).
- Elevación: un solo `--shadow` por tema (claro `0 10px 30px rgba(15,23,42,.10)`; oscuro
  `0 12px 36px rgba(0,0,0,.5)`), solo en la cabecera, el marcador y el tablero.
- Objetivos táctiles: los botones de la arena miden ≥ 44 px de alto a ≤ 520 px.

### Movimiento

- Lo único animado es el punto «en directo» (pulso de opacidad de 1,6 s) y las
  transiciones de color y fondo de 120 ms en botones y tarjetas. Con
  `prefers-reduced-motion: reduce` las dos quedan en `none`.
- **Prohibido** poner `transition`, `animation` o `transform` de CSS en
  `.arena-player`, `.arena-ball` o `.arena-referee`. Sus posiciones las fija
  `requestAnimationFrame` mediante el atributo `transform`, y las pruebas leen ese
  atributo.

## Cambios por zona

Prioridad: **P1** sale en el video y es obligatoria; **P2** es obligatoria si cabe en
el día; **P3** solo se hace si sobra tiempo. Con el retinte por tokens, lo que no se
toque de P3 hereda la paleta igualmente.

### Z1 · Barra superior (P1) — `header.arena-topbar`

- Fondo `--ar-bug` y borde inferior de 1 px `--ar-bug-2` en los dos temas. `.brand-mark`
  pasa a `--ar-score-bg` (lima) y `.brand-tag` a `--ar-bug-muted`.
- Dentro de `.arena-topbar`, el enlace de navegación usa `--ar-bug-ink`. El botón
  ES/EN es un `.btn` con fondo transparente, borde `--ar-bug-2`, texto `--ar-bug-ink` y
  foco de 2 px en `--ar-select`.
- No se añade ningún otro `<header>`: hay un e2e que localiza `header` sin
  calificar.

### Z2 · Cabecera de la arena (P1) — `.arena-intro`, `.arena-source-tabs`

- `.arena-intro` se convierte en una banda a todo el ancho de `.arena-shell`, con fondo
  `--ar-bug`, texto `--ar-bug-ink` (párrafo en `--ar-bug-muted`), radio `--ar-r-lg`,
  `padding: var(--ar-s5) var(--ar-s6)`, `max-width: none` y párrafo con `max-width: 70ch`.
- Decoración solo en `::before` y `::after` con `content: ""`:
  - dos focos (`radial-gradient` lima al 10 % y blanco al 6 % desde las esquinas superiores);
  - un motivo de cancha (línea media y círculo central con `radial-gradient`/`linear-gradient` en blanco al 6 %, a la derecha y recortado por `overflow: hidden`).
- `.overline` de la cabecera: chip con un punto lima de 6 px (pseudoelemento vacío).
- Objetivo de altura: ≤ 190 px a 1440 px.
- `.arena-source-tabs`: los dos botones forman un control segmentado (contenedor
  píldora `--ar-surface-2` con borde `--line`). El botón con `aria-pressed="true"` lleva
  `--ar-primary-bg`/`--ar-primary-ink`. El enlace «Go to the pitch…» se alinea a la
  derecha en `--accent`, sin cambiar su texto. A ≤ 520 px el control ocupa todo el ancho
  y cada botón la mitad.

### Z3 · Configuración y directo (P1) — `details.arena-setup`, `.arena-live`, `.arena-tools`

- `summary` de `.arena-setup`, `.arena-plans` y `.arena-limits`: marcador nativo oculto
  (`list-style: none` y `::-webkit-details-marker { display: none }`), chevron dibujado
  con bordes en `::before` (`content: ""`) que gira 90° con `[open]`, 16 px Archivo 700.
- `.arena-live` compacto. A ≥ 1100 px pasa a rejilla de dos columnas
  (`minmax(0,5fr) minmax(0,7fr)`, `column-gap: var(--ar-s5)`): `> div:first-child`
  (h2 y texto) a la izquierda en `grid-row: 1 / span 8` y el resto de hijos en la
  columna 2, en el orden del DOM. h2 de 20 px, `padding: var(--ar-s4) var(--ar-s5)`.
- `.arena-live [role="status"]`: píldora `--ar-r-pill` con fondo `--ar-surface-2` y punto
  `--accent` de 8 px (`::before` vacío). Ya no es una franja verde a todo el ancho.
- Los enlaces «Share this broadcast» y «Open or share this saved match» se ven como
  botones secundarios (borde `--line`, radio `--ar-r`). Siguen siendo `<a>` con el mismo
  texto.
- `.arena-tools`: botones en fila; el texto atenuado pasa a la línea siguiente a
  ≤ 900 px.
- **Objetivo medible:** con `?partido=` a 1440×900, el borde inferior de `.arena-score`
  queda en y ≤ 720 (hoy 900). Así el marcador y la parte superior de la cancha entran
  en el primer encuadre del video.

### Z4 · Marcador tipo transmisión (P1) — `.arena-score`, `.arena-match-clock`

- `.arena-score`: rejilla `minmax(0,1fr) auto minmax(0,1fr)` sobre `--ar-bug` con texto
  `--ar-bug-ink`, radio `--ar-r`, `padding: var(--ar-s2) var(--ar-s3)` y `--shadow`.
  - `> span` (nombres): Archivo 700, mayúsculas, `display: flex`, `gap: var(--ar-s2)`,
    `overflow-wrap: anywhere`. El de la visita se alinea a la derecha.
  - Barra de color de equipo: `> span:first-child::before` y `> span:last-child::after`,
    con `content: ""`, de 6×28 px (4×22 a ≤ 520 px) y radio 2 px. La local usa
    `--ar-home` con un anillo de 1 px `--ar-home-ui`; la visitante, `--ar-away` con un
    anillo de 1 px `--ar-away-ring`.
  - `strong` (goles): caja `--ar-score-bg`/`--ar-score-ink`, Archivo 900 de 40 px con
    cifras tabulares, `padding: 0 var(--ar-s3)` y radio `--ar-r-sm`. **El contenido del
    `strong` sigue siendo exactamente `{local}–{visita}`** (hay un e2e con `toHaveText("1–0")`).
- **Reloj:** se mueve el JSX de `<div className="arena-match-clock">` para que quede justo
  después de `.arena-score`, dentro de `.arena-board`. Se muestra como una pestaña
  centrada bajo el marcador: fondo `--ar-bug-2`, texto `--ar-bug-ink`, Archivo 700 de
  15 px con cifras tabulares, radio inferior `--ar-r-sm` y `padding: 2px var(--ar-s3)`.
  El `<output data-testid="arena-clock">` y su texto no cambian.
- **Estado en vivo:** el `div.arena-match-clock` recibe
  `data-en-vivo={enDirecto || bufferActivo || undefined}`. Con ese atributo,
  `.arena-match-clock[data-en-vivo]::before` dibuja un punto `--ar-live` de 8 px
  (vacío, decorativo) con el pulso descrito en «Movimiento». No se añade el texto «LIVE»
  (sin cambios de textos). El punto va en el `div`, **nunca dentro del `output`**,
  porque las pruebas leen su `textContent`.
- `.arena-direction`: el primer `span` usa `--ar-home-ui` y el segundo `--muted`. Cuerpo
  de 13 px.

### Z5 · Cancha (P1) — `svg[data-testid="arena-pitch"]` en `Arena.tsx`

Todo lo nuevo va en grupos `<g aria-hidden="true">`. No cambia el `viewBox`
(`-5 -5 115 78`), ni el `role`, ni el `aria-label`.

1. **Entorno:** primer hijo `<rect className="arena-runoff" x="-5" y="-5" width="115" height="78" rx="1.5" />`
   con fill `--ar-runoff`. `.arena-pitch-wrap` pasa a radio `--ar-r-lg`, `overflow: hidden`
   y `background: var(--ar-runoff)`.
2. **Franjas:** `.arena-grass` se pinta con `--ar-grass-a` y sin borde. Encima va
   `<g className="arena-stripes" aria-hidden="true">` con seis
   `<rect className="arena-stripe" y="0" width="8.75" height="68" x={i * 17.5 + 8.75} />`
   (i = 0…5), pintados con `--ar-grass-b`. Son doce franjas de 8,75 m en total. El
   script de contraste lee `.arena-grass` y `.arena-stripe`.
3. **Líneas:** `.arena-lines` usa stroke `--pitch-line` con `stroke-width: 0.35` y
   `stroke-linecap: round`. A las existentes se añaden, dentro del mismo `<g>`:
   - punto central `<circle cx="52.5" cy="34" r="0.35" className="arena-spot" />`;
   - puntos de penal en (11, 34) y (94, 34);
   - medialunas `M16.5 26.69 A9.15 9.15 0 0 1 16.5 41.31` y `M88.5 26.69 A9.15 9.15 0 0 0 88.5 41.31`;
   - cuatro arcos de esquina de radio 1.
   `.arena-spot` lleva fill `--pitch-line` y `stroke: none`. Opus comprueba a ojo el
   sentido de los arcos en la captura.
4. **Porterías:** el `path` actual de las porterías recibe la clase `arena-goal`, con
   fill blanco al 18 % (`color-mix(in srgb, var(--pitch-line) 18%, transparent)`).
5. **Fichas:** dentro de cada `g[data-testid="arena-player"]` se envuelven el `circle`,
   el `text`, la marca de capitán y la tarjeta amarilla en
   `<g className="arena-token">`. El `<title>` se queda como primer hijo directo, y el
   `g` exterior conserva `transform`, `data-*`, `role`, `tabIndex`, `aria-*` y los
   manejadores.
   - `.arena-token { transform: scale(var(--ar-token-escala, 1.1)); }`. El origen es el
     centro del jugador, porque el `g` exterior ya está trasladado. A ≤ 520 px,
     `--ar-token-escala: 1.35`.
   - Local: `circle` con fill `--ar-home`, stroke `--ar-home-ring` y `stroke-width: .45`;
     `text` con fill `--ar-home-ink`.
   - Visitante: fill `--ar-away`, stroke `--ar-away-ring` y `stroke-width: .45`; `text`
     con `--ar-away-ink`.
   - Dorsal: Archivo 900 (peso ya cargado; hoy pide 700/800), `font-size: 2.4px`, cifras
     tabulares.
   - Los selectores `.arena-player-selected > circle` y `.arena-player:focus-visible > circle`
     pasan a `… .arena-token > circle`: stroke `--ar-select`, `stroke-width: .7` y sin
     guiones. El foco (`:focus-visible`) usa el mismo anillo lima con
     `stroke-dasharray: 1 .5` para distinguirse de la selección; no se añaden elementos.
6. **Balón:** el atributo `r` pasa de 0.8 a 0.95, con fill `#fff` vía token
   (`--ar-ball: #ffffff`) y stroke `--ar-bug` de .3.
7. **Árbitro:** sin cambios de estructura. Hay un e2e que exige **exactamente un
   `rect`** en `arena-referee` cuando no se muestra una tarjeta.
8. `.arena-board`: `padding: var(--ar-s4)`, radio `--ar-r-lg` y `--shadow`. A ≤ 520 px el
   `padding` es `var(--ar-s2)`, para que la cancha mida ≥ 316 px de ancho a 360 px.

### Z6 · Transporte (P1) — `.arena-playback`, `.arena-seek`, `.arena-referee-info`

- `.arena-playback` y `.arena-seek` forman una sola barra visual. `.arena-playback` lleva
  fondo `--ar-surface-2`, radio `--ar-r --ar-r 0 0` y `padding: var(--ar-s2) var(--ar-s3)`.
  `.arena-seek` usa el mismo fondo, radio `0 0 var(--ar-r) var(--ar-r)`,
  `padding: 0 var(--ar-s3) var(--ar-s3)`, `margin: 0`, `accent-color: var(--accent)` y
  28 px de alto. Cuando el transporte no se muestra (búfer activo), no queda ningún
  hueco.
- «Play»/«Pause» es un `.btn-primary` en píldora de `min-width: 112px` y `min-height: 44px`.
  «Restart» es un botón fantasma. La velocidad se muestra en línea.
- Deshabilitado: `opacity: .55` y `cursor: not-allowed`, además del color.
- `.arena-referee-info`: fondo `--ar-surface-2`, 13 px y muestra `#ffce58`. Va después del
  transporte en el DOM actual y se mantiene ahí.

### Z7 · Mesa de transmisión (P1) — `ArenaMesa.tsx`, `.arena-mesa`, `.arena-mesa-card`

- [decisión] **Única reordenación del brief:** en `Arena.tsx`, `<ArenaMesa …/>` pasa a ir
  **justo después** del bloque de narración (`ArenaEmisionBuffer`/`ArenaNarracion`) y
  **antes** de `section.arena-live-feed` dentro de `.arena-companion`. Se mueve el DOM,
  no solo el orden visual, así que el orden de lectura y de foco coincide con lo que se
  ve. Motivo: la Mesa es lo que distingue al sistema multiagente y hoy queda fuera del
  primer encuadre del acompañante. Si algún e2e falla **solo** por este movimiento, se
  revierte el movimiento y se deja constancia en la bitácora. Las pruebas no se tocan.
- Avatar: en `tarjeta()` se añade como primer hijo del `article`
  `<span className="arena-mesa-avatar" aria-hidden="true">{iniciales}</span>`, con
  `iniciales = nombre.split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase()`
  calculadas de `MESA_ARENA.nombres[idioma][rol]`. Las iniciales se derivan del nombre
  ficticio existente y no son copy nuevo. El `article` no recibe otro `data-mesa-role`
  ni otro `data-testid`.
- `.arena-mesa-card`: rejilla `40px minmax(0,1fr)` con `column-gap: var(--ar-s3)`. El
  contenido va en la columna 2 (`> :not(.arena-mesa-avatar) { grid-column: 2 }`).
  Fondo `--ar-surface-2`, borde izquierdo de 3 px con el color del rol, radio `--ar-r`,
  `padding: var(--ar-s3)` y `margin-top: var(--ar-s2)`, sin el `border-top` actual.
  El color de rol se toma de `[data-mesa-role="narrador|comentarista|estadista"]` →
  `--rol: var(--ar-role-…)`.
- `.arena-mesa-avatar`: círculo de 40 px con fondo `var(--rol)`, texto `--ar-role-ink`,
  Archivo 900 de 14 px y `grid-row: 1 / span 3`.
- `h3`: Archivo 700 de 15 px. El `span.arena-muted` del rótulo («· play-by-play») se ve
  como chip en color `var(--rol)`, 11 px, Source Sans 3 700, mayúsculas y
  `letter-spacing: .08em`. Su texto no cambia.
- Línea de instante y modo: se añade `className="arena-mesa-meta"` (junto a
  `arena-muted`) a las tres líneas `«{instante} · {modo}…»`. Se ven como chip con fondo
  `--chip`, 12 px y cifras tabulares. `data-testid="arena-mesa-*-modo"` se conserva.
- Oraciones: 15 px / 1.5 en `--ink`. El `summary` «Inspect facts and checks» va en 13 px
  y `--accent`.
- Estado vacío: el `p.arena-muted` de una tarjeta sin intervención va en cursiva,
  enmarcado con borde discontinuo `--line` y radio `--ar-r-sm`. No se añade ningún
  esqueleto que finja carga.
- Nota final de la Mesa: 12 px en `--muted`.

### Z8 · Acompañante, narración, últimas acciones e inteligencia (P2)

- `.arena-companion`: radio `--ar-r-lg`, fondo `--surface` y `--shadow`. Se conservan
  `position: sticky` y el scroll interno (hay un e2e que alinea la parte superior del
  tablero y del acompañante con una diferencia < 2 px). Secciones con
  `padding: var(--ar-s4)` y separadas por `--line`.
- Paneles `.arena-intelligence` (narración, búfer, Mesa, inteligencia y asistente) con un
  mismo patrón: `.overline` como chip pequeño en `--muted`, h2 en Archivo 700 de 20 px
  (18 px en el acompañante) y controles en `.arena-live-controls` con `gap: var(--ar-s2)`.
- `.arena-live-feed li`: el `time` va como chip tabular con fondo `--chip` y radio
  `--ar-r-sm`. La acción más reciente (primer `li`) lleva borde izquierdo de 3 px
  `--accent`.
- `.arena-evidence-link`: chip con fondo `--chip`, texto `--accent`, radio `--ar-r-pill`
  y 12 px. El foco es visible (2 px `--accent`).
- Tabla de inteligencia: cifras tabulares. La primera celda `th` de cada fila de
  `tbody` lleva una muestra de 8 px del color del equipo (`::before` vacío; fila 1
  local y fila 2 visitante).
- `audio`: `width: 100%`. El estilo nativo sigue `color-scheme` del tema y no se
  sustituye.

### Z9 · Estados vacío, carga y error (P2)

- Se añade `className="arena-empty"` (solo la clase) a estos párrafos:
  - «Waiting for kick-off…» (`arena-live-feed`);
  - «Waiting for confirmed actions in this view.» (`ArenaInteligencia`);
  - «Play or move the timeline…» (`ArenaDescripcion`);
  - «Waiting for the first plans…» (`Arena.tsx`, conserva su `role="status"`);
  - «Saved preview. Start a live match…» (dentro de `.arena-board`).
- `.arena-empty`: fondo `--ar-surface-2`, borde discontinuo `--line`, radio `--ar-r`,
  `padding: var(--ar-s3)`, `--muted` y 14 px. La vista previa guardada se muestra como
  banda superior del tablero con un punto `--accent`.
- `.arena-notice[role="status"]` (carga): fondo `--ar-surface-2`, borde izquierdo de 3 px
  `--accent` y `IndicadorCarga` existente. `.arena-notice[role="alert"]` y los
  `[role="alert"]` de la arena: fondo `--danger-soft` y borde izquierdo de 3 px
  `--danger`, con el texto en `--ink`. No se añaden porcentajes ni temporizadores (brief 032).
- `.arena-fallback` se queda en `--danger`.

### Z10 · Debajo del pliegue (P3)

`.arena-context`, `.arena-coach`, `.arena-rosters`, `.arena-player-card`, `.arena-events`,
`.arena-decisions` y `.arena-limits` heredan la paleta por tokens. Si sobra tiempo:

- borde superior de 3 px en el color del equipo en `.arena-coach[data-testid="arena-coach-local"]`
  y `-visita` (`--ar-home-ui` / `--ar-away-ui`) y en `.arena-team-plan:nth-of-type(1|2)`;
- `.arena-shirt` local con `--ar-home`/`--ar-home-ink` y anillo `--ar-home-ui`;
  visitante con `--ar-away`/`--ar-away-ink`;
- `.arena-event-time` como chip tabular, igual que en Z8;
- h2 de sección en Archivo 700 de 24 px, con un subrayado lima corto en `::after` vacío.

## Cambios de marcado permitidos (lista cerrada)

Todo lo demás es CSS en `src/app/globals.css`.

1. `Arena.tsx`:
   - mover `div.arena-match-clock` tras `.arena-score` y darle el atributo `data-en-vivo`;
   - en el SVG, añadir `rect.arena-runoff`, `g.arena-stripes`, los puntos, las medialunas,
     los arcos de esquina y la clase `arena-goal` (todo con `aria-hidden` en el grupo),
     y el envoltorio `g.arena-token` de cada jugador;
   - cambiar `r` del balón;
   - mover `<ArenaMesa>` (Z7);
   - añadir la clase `arena-empty` a los dos párrafos de este archivo.
2. `ArenaMesa.tsx`: el `span.arena-mesa-avatar` (`aria-hidden`) y la clase `arena-mesa-meta`.
3. `ArenaInteligencia.tsx` y `ArenaDescripcion.tsx`: la clase `arena-empty`.
4. Ningún otro archivo TSX. No cambian `layout.tsx`, `page.tsx` ni nada de `src/arena/`,
   `src/sim/`, `src/app/api/`, `e2e/` o `src/**/__tests__/`.

## Restricciones

- **Sin cambios de funcionalidad ni de textos.** No cambian las cadenas `t(…)`, los
  `aria-label`, los `title`, las opciones ni el orden de los controles (salvo el
  movimiento de la Mesa en Z7), los estados, los manejadores ni los efectos.
- **Los pseudoelementos solo llevan `content: ""`.** El cálculo de nombre accesible de
  Playwright incluye el `content` de `::before`/`::after`, así que un pseudoelemento con
  texto en un botón, enlace o encabezado puede romper `getByRole(…, { name })`.
- No se añaden `<header>`, `<main>`, `role="region"` ni elementos con `aria-label` nuevos.
- No se aplica `transform` de CSS a `.arena-player`, `.arena-ball` ni `.arena-referee`;
  la escala va en `.arena-token`.
- `arena-referee` mantiene un solo `rect` mientras no muestra tarjeta.
- Los `[data-mesa-role]` dentro de `arena-mesa` siguen siendo exactamente 3.
- `.arena-score strong` contiene solo el marcador y `.arena-score` contiene el nombre del
  local.
- `.arena-board` y `[data-testid="arena-companion"]` siguen arrancando a la misma altura
  (diferencia < 2 px) a 1440×900, con el acompañante a la derecha del tablero.
- 360 px sin desborde: `document.documentElement.scrollWidth ≤ 360`, en claro y en
  oscuro, en inglés y en español, y con movimiento reducido.
- `prefers-reduced-motion: reduce` desactiva el pulso y las transiciones. Las fichas
  siguen en estados discretos como hoy.
- Sin imágenes, fuentes ni iconos externos. Todo es CSS o SVG en línea propio y
  `globals.css` no hace ningún `url(…)` a recursos remotos. Sin dependencias nuevas.
- Los nombres de equipos, jugadores, entrenadores, árbitros y voces siguen siendo los
  ficticios actuales. Sin escudos, logotipos ni colores de clubes reales.
- **Selectores que usan los e2e de la arena y deben seguir resolviendo igual**
  (salida de `grep -rhoE 'getByTestId\("[^"]+"\)|getByRole\("[^"]+", \{ name: [^}]+\}' e2e | sort -u`
  restringida a los archivos que visitan `/arena`: `arena*.spec.ts`):
  - `data-testid`: `arena`, `arena-assistant-answer`, `arena-ball`, `arena-bench-person`,
    `arena-buffer`, `arena-buffer-status`, `arena-clock`, `arena-coach-local`,
    `arena-companion`, `arena-context`, `arena-description`, `arena-description-count`,
    `arena-environment`, `arena-intelligence`, `arena-intelligence-evidence`,
    `arena-legacy-profile`, `arena-live`, `arena-live-status`, `arena-live-text`,
    `arena-mesa`, `arena-mesa-comentarista`, `arena-mesa-comentarista-modo`,
    `arena-mesa-estadista`, `arena-narration`, `arena-narration-transcript`, `arena-pitch`,
    `arena-pitch-live-status`, `arena-player`, `arena-player-card`, `arena-referee`,
    `arena-restart`, `arena-roster-person`, `arena-voice-status`, `arena-voice-transcript`,
    `match-loading`. Además, todos los demás `data-testid` presentes en los componentes
    (`arena-mesa-narrador`, `arena-mesa-estadista-modo`, `arena-coach-visita`,
    `arena-sub-pending`, `arena-live-assignment`, `arena-live-metrics`,
    `arena-profile-tags`, `arena-referee`…).
  - Atributos leídos: `data-player`, `data-captain`, `data-mesa-role`, `data-event-tick`,
    `data-event-id`, `data-intervencion`, `data-intervencion-tick`, `data-hecho-citado`,
    `data-oracion`, `data-narration-role|tick|kind`, `data-ready-seconds`,
    `data-progress-ready|total`, `data-person`.
  - Clases leídas: `.arena-board`, `.arena-controller`, `.arena-fallback`,
    `.arena-lineup-names button`, `.arena-plans > summary`, `.arena-score`,
    `.arena-score strong`, `.arena-settings`, `.arena-setup > summary`, `.arena-shape`,
    `#arena-watch`, `#arena-description`.
  - Roles y nombres: botones «Live», «Saved matches», «Play», «Pause», «Reproducir»,
    «Generate match», «Start live match», «Cancel live match», «Reconnect to this match»,
    «Create recording without AI», «Download run», «Retry», «Load recorded model duel»,
    «Cargar duelo de modelos grabado», «Load AI coaches example», «Load recorded AI run»,
    «Enable narration», «Activar narración», «Activar narración de esta grabación»,
    «Turn narration off», «Live narration», «Listen from the start», «Escuchar desde el
    inicio», «Stop narration», «Pause broadcast», «Resume broadcast», «Ask analyst»,
    «Earlier actions», «Switch to Spanish», `/^Evidence for/`, `/^Inspect event/`;
    comboboxes «Home formation», «Simulated duration», «Weather», «Surface», «Controller
    selection», «Home model», «Away model», «Audience» (y la ausencia de «Viewing mode»);
    slider «Match time»; regiones «Broadcast desk» y «Event narration»; enlaces «Share
    this broadcast» y «Open or share this saved match»; encabezado «Dos equipos. Una
    misma cancha.»; etiquetas «Home formation», «Match seed (optional)», «Open saved
    run», «Preferencia de pase».
  - Textos buscados con `getByText`: «Choose weather, pitch and crowd pressure»,
    «Reproduce a specific match (advanced)», «Coach traits», «Formation with player
    names», «What these conditions change», «Cómo influyen los rasgos», «Imported
    recording:», «Two independent controllers using the same model deployment.»,
    «Movimiento reducido: estados discretos.».

## Criterios de aceptación

Todos se verifican **vistos correr**, según la regla de la bitácora.

1. **Capturas después:** `node docs/evidencia/rediseno-047/capturas.mjs despues http://127.0.0.1:<puerto>/arena`
   contra la compilación de producción local (`npm run build && npm run package:standalone && node .next/standalone/server.js`).
   Genera `despues-*.png` en los mismos encuadres que el «antes» (1440×900 y 360×740,
   claro y oscuro; portada, partido, cancha y Mesa) y sale con código 0 (sin desborde ni
   errores JS). Después del despliegue se repite contra la URL pública.
2. **Cero desborde horizontal** en los cuatro encuadres, según el mismo script y los e2e
   existentes.
3. **Contraste:** `node docs/evidencia/rediseno-047/contraste.mjs http://127.0.0.1:<puerto>/arena?partido=<id>`
   (con un partido guardado en el servidor local, o la URL pública tras desplegar) sale
   con código 0. Todos los pares, en claro y en oscuro, cumplen su mínimo: 4,5 en texto,
   3 en marcador grande y elementos gráficos, y 3 en líneas de cancha. Los avatares
   existen. La salida se guarda en `docs/evidencia/rediseno-047/contraste-despues.txt`.
   Si Opus introduce un par de texto/fondo que el script no cubre, lo añade a `PARES`.
4. **Jerarquía medida:** en `capturas.mjs`, a 1440×900 con `?partido=`, `marcadorAbajo ≤ 720`
   (hoy 900). La Mesa empieza antes que las últimas acciones dentro del acompañante
   (`mesaEnAcompanante` < `accionesEnAcompanante`; hoy 714 > 276), salvo reversión
   documentada (Z7).
5. **Legibilidad móvil:** a 360×740, `dorsalPx` de `capturas.mjs` (tamaño de fuente
   renderizado del dorsal: `font-size` × escala de pantalla, incluida `.arena-token`) es
   ≥ 8 px. Hoy mide el valor de la tabla de estado.
6. **Playwright completo sin cambios en `e2e/`:** `npm run e2e` en verde; `git diff --stat e2e/`
   vacío.
7. `npm run typecheck` y `npm test` en verde. `git diff --stat src/arena src/sim src/app/api`
   vacío.
8. **Revisión visual:** Opus compara las capturas antes y después y anota en la bitácora
   tres o más mejoras visibles y cualquier regresión. Si queda tiempo, alguien distinto
   del implementador (Fable, Codex o `auditor-adversario`) mira las capturas antes de
   marcar ✅.

## Orden sugerido para un día

1. Tokens y mecanismo `:has` (claro y oscuro), y comprobación de que el resto del sitio
   no cambia (captura rápida de `/`).
2. Z5 cancha y fichas, más contraste: es el mayor salto visual y lo que más falla hoy.
3. Z4 marcador y reloj, Z1 barra y Z2 cabecera.
4. Z7 Mesa (con la reordenación) y Z6 transporte.
5. Z3 compactación hasta cumplir `marcadorAbajo ≤ 720`.
6. Z8 y Z9; Z10 si sobra tiempo.
7. Scripts, `npm test`, `typecheck`, `npm run e2e` y bitácora.

## Fuera de alcance

- Las páginas de crónicas, partido, liga y datos (siguen con el brief 010).
- Iconografía, ilustraciones, logotipos o un escudo por equipo, y colores de equipo
  generados por partido (el registro no tiene colores; serían datos nuevos).
- Rotar la cancha a vertical en móvil, un modo «solo transmisión» o «pantalla
  completa», y cualquier ocultación de paneles.
- Animación de gol, repeticiones visuales, estelas del balón o del movimiento.
- Un rótulo «EN VIVO»/«LIVE» con texto (sería copy nuevo).
- Cambiar textos, orden de secciones (salvo la Mesa), número de paneles o la altura
  total en móvil más allá de lo que den los espacios.
- Sustituir el reproductor nativo de `<audio>` o el `input range`.

## Límites honestos y riesgos

- **El directo no se capturó en el «antes».** Las capturas usan un partido terminado y
  la portada. La vista de búfer (`ArenaEmisionBuffer`) y el estado «jugando» con punto en
  vivo solo se pueden ver arrancando un partido, que consume llamadas a modelos. Opus
  debe comprobarlos en local con el controlador programado.
- **Color local frente al césped en el límite:** el relleno `--ar-home` mide 3,01 frente a
  la franja clara. El contorno lo garantiza el anillo blanco (≥ 5,1). Si una pantalla o
  una compresión de video lo empastan, se puede oscurecer más el local; no se puede
  aclarar el césped sin perder el visitante blanco.
- **Fichas más grandes = más solapes** en agrupamientos (saques y córneres). Es un
  compromiso consciente a 360 px. No hay agrupación ni separación automática.
- **`:has()`** necesita navegadores de 2023 o posteriores. En uno más antiguo la arena
  vuelve a la paleta global actual sin romperse.
- **La reordenación de la Mesa** es el único cambio de DOM con efecto sobre el orden de
  lectura. Si el lector de pantalla o algún e2e lo resiente, se revierte (Z7).
- **La identidad de la arena se separa de la del sitio.** Es intencional para el
  video, pero un juez que pase de `/` a `/arena` verá dos paletas. Se acepta por
  plazo; unificar sería otro brief.
- **El contraste se mide por pares elegidos, no por auditoría completa.** El script no
  sustituye una revisión con axe ni con un lector de pantalla, y no mide estados hover.
- **Medidas tomadas sobre la publicación pública del 21 de octubre** (revisión
  0000011). Si se despliega otra revisión antes, el «antes» deja de ser comparable al
  píxel.
