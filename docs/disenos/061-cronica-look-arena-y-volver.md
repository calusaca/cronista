# 061 — Crónica con el look de la arena y un «volver» que respeta el historial

## Estado

Brief **cerrado** el 24 de octubre de 2026 (sábado). Lo escribió Opus como diseñador porque Fable no tiene cupo;
Codex lo revisa. No hay código de producción en este brief.

**Versión 1.1 (24 de octubre, noche), tras la revisión de Codex (iteración 1 de 3: 4 hallazgos altos y 5 medios,
todos aceptados).** La [sección final](#versión-11-decisiones-tras-la-revisión-de-codex-prevalece) **prevalece**
sobre todo lo anterior. Lo más importante: el «volver» con la Navigation API se sustituye por un enlace simple,
«← Arena»; la guarda de «Simulate» compara partido **y** perspectiva; la barra tiene reglas de ajuste para la
navegación, las acciones y el formulario; y el P1 se recorta con una reserva explícita.

Pedido de Carlos (24 oct, mirando `/match/246` en la revisión pública 0000030): «esta pantalla pierde el look and
feel de las otras y además como que no me deja devolverme».

**Este brief sustituye, solo en la paleta y la barra superior**, tres decisiones anteriores: la paleta editorial verde
del [010](010-estetica.md), «las crónicas no cambian» del [047](047-rediseno-visual-arena.md) (que ya anticipaba
«unificar sería otro brief») y «su paleta editorial no cambia» del [055](055-identidad-futbolera.md) § 14. La
estructura, los textos y los selectores de la UI de explicabilidad ([004](004-ui.md), [006](006-caja-de-cristal.md))
no cambian.

**Convivencia con el 060.** Otro diseñador trabaja en paralelo el 060 (arena: sincronía, pausar/detener, modelos).
Este brief **no toca** `src/ui/Arena*.tsx`, `src/ui/ArenaTorneo.tsx`, `src/arena/**`, `src/app/arena/**`,
`src/app/api/**` ni las reglas de `globals.css` que van desde el bloque `:root:has(main.arena-shell)` hasta el final
actual del archivo. Lo nuevo de CSS va en dos sitios: el bloque de tokens del 010, al principio del archivo, y un
bloque `061` añadido **al final**. Al hacer commit, solo se añaden con `git add` los archivos de la lista del § 9,
nunca `git add -A`.

## 1. Hechos verificados (24 oct, navegador real contra el sitio público)

Se usó Playwright 1.63 (Chromium headless) desde el repo, con `PATH=/home/calusaca/.local/bin:$PATH` y Node 24,
contra `https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io`. Las solicitudes no-GET a
`/api/arena/**` se abortaron: no hubo inferencia ni voz.

### 1.1 Cómo se llega a `/match/246`

- **Desde la arena** no hay ningún enlace a `/match/…`. La barra de `/arena` tiene «Match reports»/«Crónicas» → `/`,
  «Tournament» → `/arena/torneo` y el botón ES/EN (`Arena.tsx:301–302`).
- **`/` es el mismo partido.** La portada renderiza `SEMILLA_DESTACADA = 246` (`src/vista/presets.ts:14`) y el campo
  de semilla de la barra sale relleno con `246` (`Simulador`, `semillaActual`). Si se pulsa «Simulate match» sin tocar
  el campo, `router.push("/match/246")` abre **la misma crónica** en otra URL. La cabecera y el `h1` son idénticos:
  «Full time: Juventud Islaverde Sur 4–1 Atlético Montefrío Bajo.». El texto de `main` difiere en 25 caracteres de
  8.889, por las rutas de los enlaces.
- Otras entradas: elegir la historia 246 en «Pick a story…», teclear 246, el enlace de ejemplo de `/datos`
  (`/match/{primera}`) o un enlace directo.

Recorrido reproducido: `/arena?lang=es` → «Crónicas» → `/` → «Simulate match» → `/match/246`. Un clic en una
perspectiva lleva a `/match/246?perspectiva=local`. `history.length` pasa de 2 a 3, 4 y 5.

### 1.2 Enlaces para volver desde `/match/246`

| Elemento | Destino | Observación |
| --- | --- | --- |
| `a.brand` (emblema + «CRONISTA») | `/` | Es la **misma crónica 246**: visualmente no pasa nada |
| «League mode» (`league-mode`) | `/liga` | — |
| «Data» (`data-link`) | `/datos` | — |
| «Team agents lab» (`arena-link`) | `/arena` | El único camino a la arena, con un nombre que Carlos no reconoce como «Arena». Es un `push` que **vuelve a simular** la arena (`force-dynamic`) y pierde el contexto previo |
| «Neutral» / local / visita | `/match/246[?perspectiva=…]` | Cada clic hace `push` de una entrada nueva |

No hay ningún «Volver» ni «← Arena» en la página.

### 1.3 Botón «Atrás» del navegador

- En `src/` **no hay** `history.replaceState`, `pushState`, `router.replace` ni `redirect(` (búsqueda en `.ts`/`.tsx`).
  La única entrada de historial programática es `router.push` del `Simulador`. El único `replaceState` es el interno
  de Next al hidratar, que no añade entradas (por eso Playwright ve dos `framenavigated` a `/arena` en la carga).
- `#arena-watch` y `#arena-description` son anclas de **la arena**, no de la crónica. Cada clic en ellas añade una
  entrada de documento, y al volver hacia la arena hacen falta Atrás extra. En `/match/246` no hay anclas `#`.
- Atrás **sí funciona** y es instantáneo, porque usa la caché del router: 3–7 ms por paso, medido. Desde
  `/match/246?perspectiva=local`, con tres Atrás se pasa por `/match/246`, `/` y `/arena?lang=es`. **Las tres
  primeras pantallas son la misma crónica.**

### 1.4 Causa exacta de «no me deja devolverme»

1. **Pantallas duplicadas en el historial.** El camino natural desde la arena (`/arena` → «Crónicas» → `/` →
   «Simulate match» con el 246 ya escrito → `/match/246`) apila dos URL distintas con la **misma crónica**. El primer
   Atrás (de `/match/246` a `/`) no cambia nada visible, así que parece que Atrás no funciona. Cada cambio de
   perspectiva suma otra entrada casi idéntica. Hacen falta 2 o 3 Atrás para ver la arena.
2. **No hay un «volver» en la página.** El logo lleva a `/`, que es otra vez el 246. El único enlace a la arena se
   llama «Team agents lab», va en verde pequeño, en la segunda fila a 360 px, y además hace `push` de una arena nueva
   en lugar de volver a la anterior.
3. **Agravante entre 901 y 1019 px de ancho.** La barra no cabe y la página **desborda en horizontal**:
   `scrollWidth` vale 978 a 901 px y 1016 a 1010 px, y «Random match» queda fuera de pantalla. Entre 320 y 393 px
   (Galaxy S9+, Pixel 5, iPhone 12 emulados y 360×780) **no se reprodujo el corte**: la barra apila en 225 px de alto
   y «Simulate match» termina en x = 344. El «Simulate» cortado de la captura de Carlos corresponde a ese tramo de
   escritorio estrecho o tableta, o a un escalado de texto del sistema que Chromium headless no emula.

No es un `replaceState` ni una redirección: el historial está bien formado, pero sus entradas son indistinguibles.

## 2. Diferencias de estilo medidas (crónica frente a arena)

| Aspecto | Crónica (`/`, `/match`, `/liga`, `/datos`) | Arena (`/arena`, `/arena/torneo`) |
| --- | --- | --- |
| Fondo de página, claro | `--bg #f6f5f1` (beige) | `#eef1f6` (gris frío) |
| Fondo de página, oscuro | `#131715` (verde negro) | `#0b1220` (azul noche) |
| Superficie, oscuro | `#1b211d` | `#131c2e` |
| Tinta / atenuado, claro | `#20281f` / `#647062` (verdosos) | `#0f172a` / `#4f5d78` (azulados) |
| Acento | verde `#1c7a48` (claro) / `#4cb178` (oscuro) | oliva `#3f6a00` (claro) / lima `#d4ff3a` (oscuro) |
| Resalte de selección | `--hl #dff0e5` / `#1e3a2a` | `#eef5dc` / `#1a2540` |
| Barra superior | `--bg` beige, borde `--line`, marca y enlaces verdes en negrita sin subrayado | `--ar-bug #0b1220` en los dos temas; marca y emblema lima `--ar-score-bg`, punto rojo `--ar-live`; enlaces blancos subrayados; foco lima |
| Lema de la marca | «Match reports where every sentence shows its evidence», visible en 360 px (2 líneas) | «Team agents lab», oculto a ≤ 480 px |
| Navegación | League mode · Data · Team agents lab + formulario de simulación | Match reports · Tournament · ES/EN |
| Botones de la barra | «Simulate match» con borde verde sobre superficie | `.btn` transparente con borde `--ar-bug-2` |
| Radios | `--radius 8px`, `--radius-board 12px` | `--ar-r 12px`, `--ar-r-lg 18px` |
| Tipografía | **igual**: Archivo (titulares, marcador, equipos) y Source Sans 3 (cuerpo), cargadas en `layout.tsx` | igual. Además, titulares de 900 con `-0.035em` y nombres de equipo en mayúsculas en el marcador |
| Tema | automático por `prefers-color-scheme` | automático, con el mismo patrón triple |
| Desborde horizontal | 901–1019 px | ninguno (medido a 360 y 1024) |

Conclusión: la tipografía ya es común. Lo que rompe la continuidad es la **paleta** (beige y verde frente a azul noche
y lima) y la **barra superior** (clara frente a rótulo oscuro, con otros nombres de sección).

## 3. Decisiones

[D1] **Una sola paleta en todo el sitio: la del 047.** Los catorce tokens globales del bloque `:root` del 010 y sus
dos bloques oscuros toman los valores del 047: `--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--accent`,
`--accent-ink`, `--hl`, `--hl-line`, `--danger`, `--danger-soft`, `--chip` y `--shadow`, más `color-scheme`. **Se
conservan** los valores del 010 de `--pitch-line` (`#b9b7aa` / `#4a554c`: la arena usa `#e8f2ea`, que sobre la
superficie clara de la crónica sería invisible), `--card-yellow`, `--scrim`, `--radius` y `--radius-board`. El bloque
de la arena **no se toca**; sus valores coinciden y siguen ganando por especificidad, (0,2,1) frente a (0,1,0) y
(0,2,0). Es un cambio solo de CSS, porque toda la crónica pinta con tokens: entre las líneas 70 y 2640 de
`globals.css` no hay ningún hex ni `rgba` fuera de los bloques de tokens.

[D2] **Constantes de rótulo en `:root`.** Se añaden al `:root` base, sin variante oscura porque son constantes como
en el 047, los tokens que necesita la barra oscura fuera de la arena: `--ar-bug`, `--ar-bug-2`, `--ar-bug-ink`,
`--ar-bug-muted`, `--ar-score-bg`, `--ar-score-ink`, `--ar-live`, `--ar-select` y `--ar-card-red-bug`, con los mismos
valores que el bloque de la arena.

[D3] **Barra superior compartida.** El `<header>` del `Simulador` pasa a
`className="topbar arena-topbar topbar-cronicas"`. Así reutiliza las reglas Z1 del 047 y del 055: fondo
`--ar-bug`, marca y emblema lima con punto `--ar-live`, `.btn` transparente, foco lima y lema oculto a ≤ 480 px.
Las reglas propias van bajo `.topbar-cronicas`, en el bloque 061 del final:
- enlaces de navegación en `--ar-bug-ink`, peso 600, subrayados con `text-underline-offset: 3px`, como en la arena;
- `[aria-current="page"]` en `--ar-score-bg`, sin subrayado;
- `.sim-form [role="alert"]` en `--ar-card-red-bug` (8,20). `--danger` claro sobre `--ar-bug` mide 2,85 y falla. Por
  eso **se quita el `style={{ color: "var(--danger)", fontSize: 14 }}` en línea** del `Simulador`, que ganaría a
  cualquier regla, y se sustituye por la clase `sim-error` con `font-size: 14px`;
- los `.field` (historia y semilla) conservan `--surface`/`--ink` y su borde `--line`. En la barra oscura se leen como
  campos de búsqueda de un rótulo.

[D4] **Navegación coherente.** En la barra de las crónicas, en este orden:
«Match reports» (`/`, `data-testid="reports-link"`, nuevo) · «League mode» · «Data» · «Arena» (`arena-link`, antes
«Team agents lab»). `aria-current="page"` según una prop nueva, `seccion?: "cronicas" | "liga" | "datos"`, que pasan
las páginas: `/` y `/match/[seed]` → `cronicas`; `/liga` y `/liga/[j]/[p]` → `liga`; `/datos` → `datos`. **La barra de
la arena y la del torneo no cambian** (son archivos del 060); su alineación es el P2-c.

[D5] **«← Back to the arena» con historial.** Es un enlace nuevo en `/` y en `/match/[seed]`, primer hijo de `<main>`,
**solo si** el historial de la pestaña confirma que se llegó desde la arena. Al pulsarlo **vuelve atrás** con
`history.go(-pasos)`, no añade ninguna entrada y salta las crónicas intermedias. Tiene lógica pura y está probado
(§ 4). Cuando no hay arena previa (enlace directo, buscador, navegador sin Navigation API), no se pinta y queda
«Arena» en la barra.

[D6] **Historial sin duplicados.**
- Los tres enlaces de perspectiva pasan a `replace`. La perspectiva es un conmutador de vista: Atrás vuelve a la
  página anterior, no a la perspectiva anterior.
- En `Simulador.abrirPartido(seed)`, si `seed === semillaActual` **no se navega**. Es la misma crónica ya en
  pantalla. Esto elimina el salto `/` → `/match/246` del § 1.4. Afecta a «Simulate match», a la historia 246 del
  selector y al azar en el caso de 1 entre 99.999 en que salga la semilla actual. En `/liga` y `/datos`,
  `semillaActual` es `undefined` y nada cambia.

[D7] **Sin desborde en ningún ancho.** Hay un tramo nuevo
`@media (min-width: 901px) and (max-width: 1279px) { .topbar-cronicas .brand-tag { display: none } .topbar-cronicas { flex-wrap: wrap; row-gap: 8px } }`.
El criterio vinculante es la e2e del § 6, que va de 320 a 1440 px en pasos de 10. El implementador puede ajustar el
mecanismo, pero no el criterio.

[D8] **Idioma.** El marco de las crónicas sigue en inglés, como hoy («League mode», «Data»…). El conmutador ES/EN de
la crónica gobierna el texto de la crónica (004/006) y no la barra. El enlace nuevo dice «Back to the arena».

## 4. Volver: lógica pura y componente

### 4.1 `src/vista/volver.ts` (nuevo, puro, sin DOM)

```ts
/** Máximo de entradas hacia atrás que se examinan (UI, no estadística: no va a limites.ts). */
export const MAX_PASOS_VOLVER = 10;

/** `/arena` exacto, con cualquier query (`?partido=…`, `?lang=es`). `/arena/torneo` y `/arena-x` no. */
export function esArena(ruta: string): boolean;
/** `/` o `/match/<dígitos>`, con cualquier query. Son las crónicas que se pueden saltar. */
export function esCronicaSaltable(ruta: string): boolean;
/**
 * `rutas[i]` = pathname + search de cada entrada del historial de la pestaña (null si no es del mismo origen
 * o no tiene URL). Recorre desde `actual - 1` hacia atrás, un máximo de MAX_PASOS_VOLVER entradas:
 * devuelve la primera arena si entre medias SOLO hay crónicas saltables; null si encuentra otra cosa,
 * un null, el principio o el tope.
 */
export function pasosHastaArena(rutas: readonly (string | null)[], actual: number): { pasos: number; ruta: string } | null;
```

### 4.2 `src/ui/VolverArena.tsx` (nuevo, cliente)

- Estado inicial `null`, sin render en el servidor, así que no hay diferencias de hidratación. En `useEffect`, si
  `window.navigation?.entries` existe, construye `rutas` con `new URL(e.url).pathname + search` (o `null` si el
  origen difiere o `e.url` es nulo) y llama a `pasosHastaArena(rutas, navigation.currentEntry.index)`. Recalcula en
  el evento `currententrychange`, que se elimina al desmontar.
- Si hay resultado, pinta
  `<a className="volver-arena" data-testid="back-to-arena" href={ruta}><span aria-hidden="true">← </span>Back to the arena</a>`.
  El nombre accesible es «Back to the arena». En `onClick`, sin teclas modificadoras ni botón central, hace
  `preventDefault()` y `history.go(-pasos)`. Con modificadores, el `href` real abre la arena en otra pestaña.
- Es un `<a>` simple, no `Enlace`, porque no navega con el router. No usa `useAvisoCarga`: volver usa la caché y es
  instantáneo (3–7 ms medidos).
- Lo insertan `src/app/page.tsx` y `src/app/match/[seed]/page.tsx` como primer hijo de `<main>`. `/liga` ya tiene sus
  migas (`league-back`) y queda fuera.
- CSS en el bloque 061: `.volver-arena { display: inline-flex; align-items: center; min-height: 44px; margin: 0 0 var(--ar-s2, 8px); color: var(--accent); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }`.
  Contraste: `--accent` sobre `--bg` mide 5,67 en claro y 16,20 en oscuro.

## 5. Constantes

| Nombre | Dónde | Valor | Motivo |
| --- | --- | --- | --- |
| `MAX_PASOS_VOLVER` | `src/vista/volver.ts` | 10 | No viajar por un historial largo; una sesión normal necesita 2 o 3 |
| Tramo de barra en dos filas | bloque 061 de `globals.css` | 901–1279 px | El desborde medido va de 901 a 1019 px; 1279 deja margen para el nuevo «Match reports» |
| Tokens del § 3 D1/D2 | `:root` del 010 | valores del bloque 047 | Una paleta. La prueba del § 6.1 impide que se separen |

No se añade nada a `src/sim/limites.ts`, porque no hay umbrales estadísticos.

## 6. Pruebas exigidas (vistas correr) y mutaciones

### 6.1 Unitarias (vitest, `npm test`)

1. `src/vista/__tests__/volver.test.ts`:
   - `["/arena", "/", "/match/246"]` con `actual = 2` → `{ pasos: 2, ruta: "/arena" }`;
   - `["/arena?partido=x", "/match/7?perspectiva=local"]` con `actual = 1` → `{ pasos: 1, ruta: "/arena?partido=x" }`;
   - `["/arena", "/liga", "/match/1"]` → `null`, porque `/liga` corta;
   - `["/arena/torneo", "/match/1"]` → `null`; `["/arena-x", "/"]` → `null`;
   - `[null, "/match/1"]` → `null`; `["/match/1"]` con `actual = 0` → `null`;
   - `"/match/abc"` no es saltable;
   - una arena a 11 pasos → `null`, porque está fuera del tope.
   - **Mutaciones que deben fallar:** (M1) tratar cualquier ruta no-arena como saltable; (M2)
     `startsWith("/arena")`; (M3) devolver `actual - i - 1`; (M4) quitar el tope.
2. `src/ui/__tests__/tokens-061.test.ts` (lee `globals.css` como `identidad-ui.test.tsx`):
   - para cada token de D1, el valor del `:root` base es igual al de `:root:has(main.arena-shell)`;
   - los dos bloques oscuros base (`@media … :root:not([data-theme="light"])` y `:root[data-theme="dark"]`) son
     iguales al bloque oscuro de la arena;
   - `--pitch-line` del base **no** es el de la arena;
   - los nueve tokens de D2 del base son iguales a los de la arena.
   - **Mutación:** cambiar un hex del base (p. ej. `--muted`) hace fallar la prueba.
3. `src/ui/__tests__/simulador-061.test.tsx` (`renderToStaticMarkup` con `vi.mock("next/navigation")`; si
   `useAvisoCarga` necesita proveedor, se envuelve en `ProveedorActividad`):
   - el `header` lleva `topbar arena-topbar topbar-cronicas`;
   - los enlaces de `nav` siguen el orden y los `href` de D4;
   - `aria-current="page"` aparece solo en el de la `seccion` dada;
   - `.brand` sigue con `href="/"`;
   - el texto fuente de `Simulador.tsx` no contiene `style={{`.
   - **Mutación:** volver a «Team agents lab» o perder `arena-topbar` hace fallar la prueba.

### 6.2 E2e nueva — `e2e/cronica-061.spec.ts`

1. **Volver salta las crónicas.** `/arena` → «Match reports» → `/`. `back-to-arena` es visible. Elegir una historia
   distinta del 246 lleva a `/match/N`. Se anota `history.length`, se pulsa `back-to-arena` y la URL es `/arena`,
   `main.arena-shell` está visible y `history.length` **no** cambió. **Mutación:** con `<Link href="/arena">` crece
   `history.length` y la prueba falla.
2. **Sin arena previa no hay volver.** Con `goto("/match/246")`, `back-to-arena` tiene 0 elementos; `arena-link`
   tiene `href="/arena"` y el texto «Arena»; en `header`, `[aria-current="page"]` es «Match reports».
3. **Misma semilla, sin entrada nueva.** En `/`, «Simulate match» con 246 deja la URL en `/`, sin cambio de
   `history.length` y sin `match-loading` visible. **Mutación:** quitar la guarda de D6 lleva a `/match/246` y la
   prueba falla.
4. **La perspectiva reemplaza.** En `/match/246` se pulsa `[data-perspective="visita"]`; la URL termina en
   `?perspectiva=visita` y `history.length` no cambia. **Mutación:** quitar `replace` hace fallar la prueba.
5. **Sin desborde.** En `/match/246`, para cada ancho de 320 a 1440 en pasos de 10:
   `documentElement.scrollWidth ≤ innerWidth`, y `simulate` y `random-match` tienen `right ≤ innerWidth`. A 360 px se
   repite en oscuro. **Mutación:** quitar el tramo de D7 hace fallar la prueba a 910 px.
6. **Misma identidad.** En `/` y en `/arena`, en claro y en oscuro (`emulateMedia`), coinciden `--bg` computado, el
   `background-color` del `header` y el `color` de `.brand-mark`.

### 6.3 Contraste (AA medido sobre el DOM)

Script nuevo `docs/evidencia/cronica-061/contraste.mjs`, adaptado de `docs/evidencia/rediseno-047/contraste.mjs`. Usa
la misma fórmula y la misma salida en tabla. Se ejecuta contra el build local y contra el público, sobre `/match/246`
con la primera frase seleccionada, en claro y en oscuro, a 1440 y a 360. Si un par obligatorio falla, sale con
código 1. Pares (texto 4,5; gráficos y foco 3):

| Par | Mínimo | Previsto claro / oscuro |
| --- | --- | --- |
| `.topbar-cronicas .brand-mark` / barra | 4,5 | 16,20 / 16,20 |
| enlace de la barra / barra | 4,5 | 18,72 |
| `[aria-current=page]` / barra | 4,5 | 16,20 |
| texto de «Simulate match» / barra | 4,5 | 18,72 |
| `.sim-error` / barra (forzar semilla «abc») | 4,5 | 8,20 |
| `.volver-arena` / `--bg` (entrar por la arena) | 4,5 | 5,67 / 16,20 |
| `[data-testid=sentence]` / superficie | 4,5 | 17,85 / 15,16 |
| frase seleccionada / `--hl` | 4,5 | 15,92 / 13,52 |
| texto atenuado (`.overline`) / superficie | 4,5 | 6,63 / 7,73 |
| chip neutro (`--ink` / `--chip`) | 4,5 | 14,81 / 12,69 |
| chip de gol (`--accent-ink` / `--accent`) | 4,5 | 6,42 / 16,20 |
| chip de roja (`--surface` / `--danger`) | 4,5 | 6,57 / 7,46 |
| perspectiva activa e idioma activo (`--accent-ink` / `--accent`) | 4,5 | 6,42 / 16,20 |
| «Watch live» (`.btn-primary`) | 4,5 | 6,42 / 16,20 |
| rechazo en la caja de cristal (`--danger` / `--danger-soft`) | 4,5 | 5,75 / 6,66 |
| foco (`--accent`) / superficie | 3 | 6,42 / 14,73 |
| icono de amarilla (`--card-yellow`) / superficie | 3 | 3,41 / 6,94 |

Las cifras previstas se calcularon el 24 de octubre con la fórmula WCAG a partir de los hex; el script las sustituye
por medidas. La salida se guarda en `docs/evidencia/cronica-061/contraste-{claro,oscuro}.txt`.

## 7. E2e existentes afectadas (deben pasar **sin editar**)

- `juez.spec.ts`: `featured-match`, `sentence`, `verify-bar`, `llm-label`, `seed-input`, `simulate` con 42.
- `vitrina.spec.ts`: `preset-select` con una historia distinta del 246, semilla vacía y semilla inválida desde
  `/match/246`, 360 px.
- `carga.spec.ts`: las cuatro acciones; «semilla inválida y misma ruta». Con D6 el 246 en `/match/246` no navega, y la
  prueba solo exige que no haya alerta, que la espera esté oculta, que el botón esté habilitado y que `data-seed` sea
  246. También el caso de móvil oscuro a 360 con movimiento reducido. Se conserva `.sim-form [role="alert"]`.
- `random.spec.ts`: azar y «a 360 px la barra superior con Random match no desborda».
- `actividad.spec.ts`: `league-mode`, `data-link`, `.brand` desde `/datos` y `[data-perspective="visita"]`. Con
  `replace` la URL sigue cambiando y el aviso sigue apareciendo.
- `liga.spec.ts`, `datos.spec.ts`: `league-mode`, `data-link`, `league-back`.
- `arena-identidad.spec.ts` (055): en `/`, `.brand-emblem` visible y único, `a.brand` con `href="/"` y emblema con
  `aria-hidden`.
- Regresión de la arena: `arena-identidad.spec.ts` y `arena-torneo.spec.ts` completas, porque cambia el `:root` base.
- El resto de las e2e de crónica (`reproduccion`, `partido-completo`, `pizarra*`, `relato-formaciones`, `grada`,
  `xg`, `definiciones`, `insolitos`, `sanciones`, `niveles`, `ratings`, `condiciones`, `consecuencias`, `vivo`) no
  leen colores ni la barra, y corren completas en `npm run e2e`.

**Cambios de texto y selector autorizados (lista cerrada):**
1. El texto de `[data-testid="arena-link"]` cambia de «Team agents lab» a «Arena».
2. Las clases del `header` del `Simulador` añaden `arena-topbar topbar-cronicas`.
3. El `span[role="alert"]` del `Simulador` cambia `style` por `className="sim-error"`. Se conservan el rol, la
   posición dentro de `.sim-form` y el texto.
4. Se añaden el enlace «Match reports» (`data-testid="reports-link"`) en el `nav`, y `aria-current` en los enlaces
   de sección.
5. Se añade `a.volver-arena[data-testid="back-to-arena"]` «Back to the arena» en `/` y `/match/[seed]`.
6. Se añade `replace` en los tres `.perspective-option`.
7. Se añade la prop `seccion` del `Simulador`, que pasan las cinco páginas que lo usan.

Ningún otro texto, `data-testid`, `aria-label`, id ni orden de controles cambia. No se añaden `<header>`, `<main>` ni
`role="region"`.

## 8. Prioridades, orden y estimación

**P1 (obligatorio)**, en este orden, para que lo funcional salga primero:

| Bloque | Contenido | Estimación |
| --- | --- | --- |
| P1-D | D6: `replace` en perspectivas y guarda de misma semilla, más las e2e 3 y 4 | 30 min |
| P1-C | D5: `volver.ts`, `VolverArena.tsx`, inserción en dos páginas, CSS, unitaria 1 y e2e 1–2 | 1 h 30 min |
| P1-B | D3, D4 y D7: barra compartida, navegación, `sim-error`, tramo 901–1279, unitaria 3 y e2e 5 | 1 h 15 min |
| P1-A | D1 y D2: tokens del `:root` del 010, unitaria 2, e2e 6 y contraste | 1 h |
| Cierre | `npm test`, `npm run typecheck`, `npm run e2e` completo, capturas antes/después (1440 y 360, claro y oscuro: `/match/246`, `/`, `/liga`, `/datos`) en `docs/evidencia/cronica-061/` | 45 min |

Total P1: **≈ 5 h de implementación**, más una ronda de Codex (≈ 45 min) y la publicación con smoke público
(≈ 30 min): **≈ 6 h 15 min**. Encaja el domingo 25 por la mañana.

**Corte duro.** Si a las **18:00 PT del domingo 25** P1-A o P1-B no están verdes, se publican solo P1-D y P1-C, que
arreglan el «no me deja devolverme», y A/B se anotan como deuda. El lunes 26 queda reservado para la entrega y no se
implementa nada.

**P2 (solo si P1 está publicado y sobran ≥ 2 h antes del corte)**:
- P2-a: `--radius-board: 18px` (el tablero de la crónica con el radio de panel de la arena). Va en el `:root` del
  010 y solo exige capturas. 15 min.
- P2-b: la pizarra 3D en oscuro. Hoy `Pizarra3D.tsx` pinta el suelo con `--hl`, que pasa a azul noche (`#1a2540`), y
  las líneas con `--pitch-line` (≈ 1,95). Se ajusta el token `--pitch-line` oscuro a un valor ≥ 3,0 frente a `--hl`,
  medido. 30 min.
- P2-c: «Data» y «League mode» en la barra de la arena y del torneo, para la navegación inversa completa. **Solo
  después del merge del 060** y con su diseñador avisado: toca `Arena.tsx:302` y `ArenaTorneo.tsx:54–58`, y hay que
  reverificar `arena-torneo.spec.ts` («Tournament», «Torneo» exactos). 30 min.

## 9. Archivos (lista cerrada)

Modificados: `src/app/globals.css` (bloque `:root` del 010 y bloque 061 al final), `src/ui/Simulador.tsx`,
`src/ui/VistaPartido.tsx` (solo `replace`), `src/app/page.tsx`, `src/app/match/[seed]/page.tsx`,
`src/app/liga/page.tsx`, `src/app/liga/[jornada]/[partido]/page.tsx` y `src/app/datos/page.tsx` (solo la prop
`seccion`).
Nuevos: `src/vista/volver.ts`, `src/ui/VolverArena.tsx`, `src/vista/__tests__/volver.test.ts`,
`src/ui/__tests__/tokens-061.test.ts`, `src/ui/__tests__/simulador-061.test.tsx`, `e2e/cronica-061.spec.ts` y
`docs/evidencia/cronica-061/` (script de contraste, salidas y capturas).
También se actualiza el comentario de cabecera de `globals.css`, que hoy dice «La voz de la maqueta aprobada: clara,
editorial, verde», para remitir al 061.

## 10. Criterios de aceptación (todos vistos correr)

1. `npm test`, `npm run typecheck` y `npm run e2e` en verde, incluida `cronica-061.spec.ts`.
2. Las mutaciones M1–M4 y las de § 6.1.2, § 6.1.3 y § 6.2 (1, 3, 4, 5) fallan, cada una vista una vez y revertida. Se
   anota en la bitácora.
3. El contraste del § 6.3 da OK en todos los pares obligatorios, en claro y en oscuro.
4. Smoke público tras desplegar: el recorrido de Carlos (`/arena` → «Match reports» → `/` → historia → `/match/N`)
   muestra «← Back to the arena», y un clic vuelve a la arena sin entrada nueva. Atrás del navegador desde
   `/match/N?perspectiva=local` llega a `/` en un paso. A 360 y a 960 px no hay desborde. Capturas en
   `docs/evidencia/cronica-061/publicacion/`.
5. Cotejo a ojo, lado a lado, de `/match/246` y `/arena` a 1440 y 360 en los dos temas: misma barra, misma marca y
   misma paleta.

## 11. Fuera de alcance

- Cualquier cambio en la arena o el torneo (TSX, CSS del bloque 047 y siguientes): son del 060. La excepción es
  P2-c, después de su merge.
- Convertir la cabecera del partido (`.match-head`, `.scoreline`) en un rótulo de TV con caja lima, poner los nombres
  de equipo en mayúsculas o cambiar la estructura de paneles, la línea de tiempo, la caja de cristal o el modo
  Analyst.
- Un marco ES en las crónicas, un conmutador manual de tema, `/liga` con «volver a la arena», páginas de error y
  `not-found`.
- Restaurar el estado en memoria de la arena (reproducción en curso, directo sin guardar) al volver: se vuelve a su
  **URL**.
- Polyfill de la Navigation API.

## 12. Límites honestos y riesgos

- **Navigation API.** «Back to the arena» solo aparece donde existe `window.navigation`: Chromium (Chrome y Edge ≥
  102) y versiones recientes de Safari y Firefox, cuyo soporte no se comprobó aquí. Sin ella el enlace no se pinta.
  Siguen «Arena» en la barra y el Atrás del navegador, que con D6 ya no repite pantallas en el camino habitual.
- **Volver restaura la URL, no el estado.** Con la caché del router la arena reaparece al instante con su carga
  previa. Un directo que se estaba viendo no se reconecta solo, y la posición de reproducción no se garantiza.
- **Misma semilla = sin respuesta visible.** Pulsar «Simulate match» con la semilla que ya se ve no hace nada, a
  propósito, y no hay mensaje (`.sim-form [role="alert"]` debe quedar vacío por la e2e de carga). Es un compromiso.
- **Atrás todavía pasa por `/`** si el usuario entró por la arena y luego eligió otra historia. Son dos crónicas
  distintas, así que es correcto, pero son dos pasos. El enlace «Back to the arena» los salta.
- **El verde editorial desaparece.** «Verificado» pasa de verde a oliva (claro) y lima (oscuro), y el beige se va. Es
  la decisión que pide Carlos. Revierte las del 010, 047 y 055 en ese punto; si el jurado o Carlos prefieren el
  verde, basta con devolver el `:root` del 010.
- **`--card-yellow` sobre el nuevo `--bg`** baja de ≈ 3,4 (sobre la superficie) a ≈ 3,0. Las tarjetas se dibujan
  sobre la superficie de los paneles, pero si alguna aparece sobre el fondo de página queda en el límite gráfico.
- **Pizarra 3D en oscuro**: suelo azul noche y líneas de ≈ 1,95 hasta que entre P2-b. Es decorativo; la información
  está en el texto y en la línea de tiempo.
- **El corte de 360 px de la captura no se reprodujo** en Chromium headless (320–393 px, tres dispositivos
  emulados). Se corrige el desborde medido (901–1019 px) y la e2e barre de 320 a 1440. Un escalado de texto del
  sistema operativo puede seguir rompiendo la barra; no se emula.
- **Tokens duplicados.** El 047 y el 010 contienen ahora los mismos valores en dos sitios. La prueba del § 6.1.2
  impide que se separen; eliminar el bloque de la arena queda para después de la entrega, porque es un archivo
  del 060.
- **El contraste se mide por pares elegidos**, no con una auditoría completa: no cubre los estados hover ni la
  pizarra 3D.
- **Medidas sobre la revisión pública 0000030** (24 oct). Los scripts de sondeo quedaron fuera del repositorio; el
  § 1 da los pasos para repetirlos.

## Versión 1.1: decisiones tras la revisión de Codex (prevalece)

Esta sección prevalece sobre los §§ 1–12. Cada hallazgo se comprobó contra el código el 24 de octubre por la noche.
Los nueve se aceptan. Donde el texto anterior contradiga esta sección, manda esta.

### V1. Desborde: ajuste de navegación, acciones y formulario (Codex #1, alto)

**Comprobado.** `.topbar-acciones` (`globals.css:1888`) y `.topbar-links` (`globals.css:2337`) son `display: flex`
sin `flex-wrap`. A ≤ 900 px, `.topbar-acciones` pasa a columna (`globals.css:2120`), pero `.topbar-links` sigue en una
sola fila. Con cuatro enlaces («Match reports», «League mode», «Data», «Arena»: unos 270 px de texto más 48 px de
huecos) no caben en los 288 px útiles de 320 px. El `flex-wrap` del § 3 D7 sobre `.topbar-cronicas` no reparte a los
nietos.

**Decisión.** Estas reglas sustituyen a D7 y van en el bloque 061, al final de `globals.css`, todas bajo
`.topbar-cronicas`:

```css
/* Siempre: la navegación puede partirse en filas. */
.topbar-cronicas .topbar-links { flex-wrap: wrap; column-gap: 16px; row-gap: 4px; }
/* 901–1279 px: dos filas. Fila 1 = marca + navegación; fila 2 = formulario completo, alineado a la derecha. */
@media (min-width: 901px) and (max-width: 1279px) {
  .topbar-cronicas { flex-wrap: wrap; row-gap: 8px; }
  .topbar-cronicas .brand-tag { display: none; }
  .topbar-cronicas .topbar-acciones { display: contents; }
  .topbar-cronicas .topbar-links { margin-left: auto; }
  .topbar-cronicas .sim-form { flex: 1 1 100%; flex-wrap: wrap; justify-content: flex-end; }
}
/* ≥ 1280 px: una fila, como hoy. El lema se encoge (min-width: 0) antes de desbordar. */
```

- `display: contents` solo actúa sobre un `div` sin rol ni nombre, así que no cambia el árbol accesible. Por debajo
  de 901 px no se usa: allí `.topbar-acciones` sigue en columna y `.sim-form` sigue siendo la rejilla del 011.
- El mensaje de error (`.sim-form [role="alert"]`) ocupa su propia línea: en la rejilla por `grid-column: 1 / -1`, ya
  existente, y en 901–1279 por el `flex-wrap` del formulario.
- **Constante:** el tramo 901–1279 px. El implementador **puede subir** el tope de 1279 si la e2e encuentra desborde
  a partir de 1280, y lo anota. No puede bajarlo ni cambiar el criterio.

**Pruebas, que sustituyen a la e2e 5 del § 6.2:**
- (5a) Barrido en `/match/246`, de 320 a 1440 px en pasos de 10, **con el error visible** (semilla «abc» →
  «Simulate match»): `documentElement.scrollWidth ≤ innerWidth`, y `simulate`, `random-match`, `reports-link`,
  `arena-link` y `.sim-form [role="alert"]` tienen `right ≤ innerWidth`.
- (5b) En los límites **480/481, 900/901 y 1279/1280 px**, en las **cinco páginas** que usan el `Simulador` (`/`,
  `/match/246`, `/liga`, `/liga/1/1`, `/datos`), en claro, se repiten las mismas condiciones con el error visible. A
  360 px se repite en oscuro.
- **Mutaciones:** quitar `flex-wrap` de `.topbar-links` hace fallar (5a) a 320 px; quitar `display: contents` hace
  fallar el tramo 901–1279.

### V2. «Simulate» con la misma semilla: partido **y** perspectiva (Codex #2, alto)

**Comprobado.** Desde `/match/246?perspectiva=local`, «Simulate match» con 246 hace hoy `router.push("/match/246")`,
que lleva a la crónica **neutral**: es otra vista. La guarda de D6, tal como estaba escrita, bloquearía ese cambio.
`abrirPartido` hace `if (pendiente) return; setError(null);` (`Simulador.tsx:27–29`). Si la guarda fuera antes de
`setError(null)`, el error anterior se quedaría en pantalla y fallaría `carga.spec.ts` («semilla inválida y misma
ruta», que exige 0 alertas).

**Decisión, que sustituye a la segunda viñeta de D6:**
- `Simulador` recibe una prop nueva, `perspectivaActual?: Perspectiva`, con valor por defecto `"neutral"`.
  `src/app/page.tsx` y `src/app/match/[seed]/page.tsx` le pasan la perspectiva que ya leen con `leerPerspectiva`.
  Las demás páginas no la pasan.
- En `abrirPartido(seed)`, el orden es: `if (pendiente) return;` → `setError(null);` →
  `if (seed === semillaActual && perspectivaActual === "neutral") return;` → `push`.
- Es decir, solo se ignora la acción si **ya** se está viendo la crónica neutral de esa semilla (`/` o
  `/match/<seed>`). Desde local o visita, «Simulate match» con la misma semilla **navega como hoy** a la crónica
  neutral (`push`, URL compartible). Atrás devuelve a la perspectiva de la que se venía.

**Pruebas e2e (sustituyen a la e2e 3 del § 6.2):**
- (3a) En `/`: «abc» → error visible; luego «246» → «Simulate match». No queda ninguna alerta, la URL sigue en `/`,
  `history.length` no cambia y `match-loading` no aparece.
- (3b) En `/match/246?perspectiva=local`: «Simulate match» con 246 lleva a `/match/246`; Atrás lleva a
  `/match/246?perspectiva=local`.
- (3c) Lo mismo desde `/?perspectiva=visita`: va a `/match/246` y Atrás vuelve a `/?perspectiva=visita`.
- **Mutaciones:** la guarda sin la condición de perspectiva hace fallar (3b) y (3c); la guarda antes de
  `setError(null)` hace fallar (3a).

### V3. «Volver»: enlace simple y honesto «← Arena» (Codex #3 y #4, alto y medio)

**Comprobado.** Codex tiene razón: con URL y `history.length` no se distingue un `history.go(-n)` de un `replace`
hacia `/arena`. `pathname + search` pierde los fragmentos (`#arena-watch`, `#arena-description`), y el diseño no
protegía contra un doble clic durante el recorrido. Para cerrarlo bien harían falta la `key` y el índice de cada
entrada, la URL completa, revalidar al pulsar, un solo recorrido pendiente y pruebas de recarga, Adelante y ausencia
de API. Son unas 2 h más y un riesgo alto para el domingo.

**Decisión: se elimina D5 entero** (el § 4, `src/vista/volver.ts`, `VolverArena.tsx`, `MAX_PASOS_VOLVER`, la
unitaria 1 y las e2e 1 y 2 del § 6.2). En su lugar:
- En `src/app/page.tsx` y `src/app/match/[seed]/page.tsx`, como primer hijo de `<main>`, va un enlace del servidor:
  `<Link href="/arena" prefetch={false} className="volver-arena" data-testid="to-arena"><span aria-hidden="true">← </span>Arena</Link>`.
  `Link` es `./Enlace` (`ui/Enlace`), con el aviso «Loading page…» del 032. El enlace está **siempre** presente. Su
  nombre accesible es «Arena», el mismo destino que el «Arena» de la barra.
- **Qué promete y qué no:** lleva a la arena con un `push`. No restaura el historial ni el estado de la arena, que
  vuelve a cargarse con su partido inicial programado y sin inferencia. Para volver exactamente a la entrada
  anterior sigue el Atrás del navegador, que con V2 y el `replace` de las perspectivas ya no repite pantallas en el
  camino habitual. El texto no dice «Back» para no prometer una vuelta.
- CSS: el de `.volver-arena` del § 4.2, sin cambios.

**Pruebas e2e (sustituyen a las e2e 1 y 2 del § 6.2):**
- (1) Precedente conocido: `goto("/datos")` → clic en `.brand` → `/` → clic en `to-arena`. La URL es `/arena`,
  `main.arena-shell` está visible y Atrás devuelve a `/`. Otro Atrás lleva a `/datos`.
- (2) En `/match/246`: `to-arena` está visible, su nombre accesible es exactamente «Arena» y tiene `href="/arena"`. A
  360 px está dentro de la pantalla.
- **Mutaciones:** con `replace` en `to-arena`, Atrás lleva a `/datos` y (1) falla; con otro `href`, (2) falla.

Lo que deja fuera queda como límite (§ 12): no hay vuelta a la entrada exacta de la arena con su `?partido=` o su
fragmento. Se recupera con Atrás.

### V4. Contraste de la caja de cristal sobre sus fondos reales (Codex #5, alto)

**Comprobado.** `.attempt` tiene `background: var(--bg)` (`globals.css:1378`). `.verdict.rejected` y `.rule-tag` usan
`--danger` sobre ese fondo (`1413`, `1441`, con el comentario de que el `--danger-soft` se abandonó por 4,32 en
oscuro). `.rule-note` y `.attempt-text.struck` usan `--muted`. **`--danger-soft` no se usa en ningún componente de la
crónica**: solo aparece en los bloques de tokens.

**Decisión:** en la tabla del § 6.3 se **quita** el par «`--danger` / `--danger-soft`». Se añaden estos pares,
medidos con la caja de cristal abierta en una frase **corregida** con el LLM de ensayo. El script la abre como
`juez.spec.ts`: `[data-testid="sentence"][data-state="corregida"]` → `sentence-state`.

| Par (fondo efectivo `.attempt` = `--bg`) | Mínimo | Previsto claro / oscuro |
| --- | --- | --- |
| `.verdict.rejected` / intento | 4,5 | 5,81 / 8,20 |
| `.rule-tag` / intento | 4,5 | 5,81 / 8,20 |
| `.rule-note` / intento | 4,5 | 5,85 / 8,49 |
| `.attempt-text.struck` / intento | 4,5 | 5,85 / 8,49 |
| `.verdict.ok` / intento | 4,5 | 5,67 / 16,20 |

El script mide estos pares **en local**, con el servidor del e2e (`CRONISTA_LLM=ensayo`). Contra el sitio público
son opcionales: el modelo real puede no tener ninguna frase corregida. El script resuelve el fondo efectivo subiendo
por los ancestros hasta el primer `background-color` opaco, como el del 047.

### V5. `--ar-live` cambia con el tema (Codex #6, medio)

**Comprobado.** `--ar-live` vale `#d1242f` en claro (`globals.css:2672`) y `#ff5a5f` en los dos bloques oscuros de la
arena (`2740`, `2769`). El § 3 D2 lo trataba como constante.

**Decisión:** `--ar-live` se declara en el `:root` base (`#d1242f`) **y** en los dos bloques oscuros base
(`#ff5a5f`). Los demás tokens de D2 sí son constantes y se quedan solo en el `:root` base. La unitaria del § 6.1.2
compara `--ar-live` en los tres bloques. La e2e 6 compara también el `fill` computado de `.brand-emblem circle` entre
`/` y `/arena`, en claro y en oscuro. El punto sobre la barra mide 3,57 en claro y 6,13 en oscuro (gráfico ≥ 3).

### V6. Mutaciones con aserto que las detecte (Codex #7, medio)

- La unitaria del § 6.1.3 comprueba los **nombres exactos** de los enlaces del `nav`, en orden: `["Match reports",
  "League mode", "Data", "Arena"]`. La mutación «Team agents lab» hace fallar la prueba.
- La e2e 4 (perspectiva con `replace`) parte de un **precedente conocido**: `goto("/datos")` → `.brand` → `/` →
  perspectiva visita. La URL es `/?perspectiva=visita`, `history.length` no cambió y Atrás lleva a `/datos`. Sin
  `replace`, Atrás lleva a `/` y la prueba falla.
- Los casos del límite de diez pasos y del historial futuro desaparecen con V3: ya no hay recorrido del historial.

### V7. La afirmación sobre colores literales, corregida (Codex #8, medio)

**Comprobado.** Los hex de `globals.css:2472`, `2477`, `2519` y `2582` existen y son reglas de la arena, que empiezan
en la línea 2446 (`.arena-shell`). El § 3 D1 decía «entre las líneas 70 y 2640 no hay ningún hex». **Lo correcto es:
entre la línea 71 y la 2445, el CSS de la crónica, la liga y los datos (antes de la primera regla `.arena-*`) no hay
ningún color hex ni `rgb(a)` fuera de los bloques de tokens** (recuento del 24 oct: 0). Los únicos colores fuera de
`globals.css` en componentes de la crónica son `var(--…)` en `Gol.tsx`, `Iconos.tsx` y `CanchaTactica.tsx`, más los
valores de reserva de `Pizarra3D.tsx` (líneas 48–53), que solo se usan si el token no existe. Excepciones
documentadas: ninguna en la crónica; las de la arena (amarillo de árbitro y capitán, `#ffce58`/`#171d24`, y otras)
no se ven afectadas, porque no leen los tokens que cambian.

### V8. Reestimación con reserva y P1 recortado (Codex #9, medio)

Datos medidos: e2e completo de 237 pruebas en 7,3 min (bitácora, brief 059), más el build del `webServer` en cada
ejecución. Cada mutación de e2e cuesta por eso unos 4–5 min (build + un archivo).

**P1-núcleo (se cierra el 25 sí o sí): arregla «no me deja devolverme», la barra y el desborde.**

| Bloque | Contenido | Estimación |
| --- | --- | --- |
| D | V2 (guarda con perspectiva y error limpio) + `replace` en las perspectivas + e2e 3a–3c y 4 | 45 min |
| C | V3 («← Arena» del servidor) + e2e 1–2 | 30 min |
| B | D2 (constantes de rótulo, con V5) + D3 + D4 + V1 + unitaria 3 + e2e 5a–5b | 1 h 45 min |
| Verificación del núcleo | `npm test` + `npm run typecheck` + e2e completo (≈ 12 min con build) + 6 mutaciones (≈ 30 min) + capturas a 360/960/1440 en claro y oscuro (4 páginas) | 1 h 15 min |
| Revisión Codex de la implementación y correcciones | una ronda | 1 h |
| Publicación + smoke público | despliegue, recorrido de Carlos, 360 y 960 px | 45 min |
| **Subtotal núcleo** | | **6 h** |

**P1-ampliado (solo si el núcleo está publicado a las 14:00 PT):** A = D1 (los catorce tokens del 010 → 047, con
`--ar-live` de V5), unitaria 2, e2e 6 y contraste completo del § 6.3 + V4. Son 1 h 45 min, más 30 min de
verificación y nueva publicación: **2 h 15 min**.

**Reserva explícita: 2 h**, para fallos de e2e, la integración con el 060 (conflictos en `globals.css` y
`BITACORA.md`, `git add` por archivo) y un segundo ciclo de Codex.

**Total con todo: ≈ 10 h 15 min.** Calendario del domingo 25 (PT): núcleo de 08:00 a 14:00; ampliado de 14:00 a
16:15; reserva hasta las 18:00 (**corte duro**). Si el núcleo no está publicado a las 14:00, A pasa a deuda y se usa
la reserva para cerrar el núcleo. Si a las 18:00 la barra (B) no está verde, se publican solo D + C. El lunes 26
sigue reservado para la entrega.

P2 (§ 8) sin cambios, y solo después del P1 completo.

### V9. Listas que cambian

- **Cambios autorizados (§ 7), punto 5:** en lugar de `a.volver-arena[data-testid="back-to-arena"]` «Back to the
  arena», se añade `a.volver-arena[data-testid="to-arena"]` «← Arena», siempre presente en `/` y `/match/[seed]`.
  **Nuevo punto 8:** la prop `perspectivaActual` del `Simulador`. **Nuevo punto 9:** las reglas de ajuste de V1 bajo
  `.topbar-cronicas`.
- **Archivos (§ 9):** desaparecen `src/vista/volver.ts`, `src/ui/VolverArena.tsx` y
  `src/vista/__tests__/volver.test.ts`. No se añaden archivos nuevos.
- **Constantes (§ 5):** desaparece `MAX_PASOS_VOLVER`. El tramo de V1 queda en 901–1279 px, con la regla de subida
  descrita en V1.
- **Aceptación (§ 10):** el punto 2 pasa a las mutaciones de V1, V2, V3, V5 y V6 y a las del § 6.1.2–6.1.3. En el
  punto 4, el recorrido de Carlos se comprueba así: «← Arena» lleva a `/arena`, y desde `/match/N?perspectiva=local`
  el Atrás del navegador llega a la página anterior en un paso.
- **Límites (§ 12):** se eliminan los de la Navigation API y «Atrás todavía pasa por `/`… el enlace los salta». Se
  añade: **«← Arena» no es un volver**. Abre la arena con su partido inicial y no recupera un `?partido=`, un
  fragmento ni un directo. Para eso está el Atrás del navegador. Se añade también: simular la misma semilla desde
  local o visita lleva a la crónica neutral (comportamiento actual, conservado a propósito).
