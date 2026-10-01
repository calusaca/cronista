# 010 — Estética: el producto adopta el lenguaje de la maqueta

**Fecha:** 2026-10-01 · **Diseña:** Fable (feedback de Carlos: «es funcional pero
la estética está medio meh»; la maqueta sí le gustó) · **Implementa:** Opus
(tras el 009 — toca `globals.css`, que 008 y 009 también tocan) · **Estado:**
cerrado

## Diagnóstico (skill diseno-profesional, §7)

El producto no está mal construido: tiene tokens, un acento, cifras tabulares.
El problema es que **su identidad no es la que Carlos aprobó**. La maqueta
(scratchpad `maqueta-cronista.html`, artifact v2) es clara, editorial, verde,
con chips escaneables; el producto salió oscuro, dorado y austero — lenguaje de
terminal, no de prensa deportiva. No es «agregar cosas»: es cambiar la voz.

Esto es una **herramienta** (el juez viene a usar la interacción), no una página
de marketing: **no lleva fotografía**. La maqueta tampoco la tiene.

## Tokens (reemplazan los actuales en `globals.css`; colores SOLO aquí)

Tema claro por defecto + oscuro automático por `prefers-color-scheme` (con
`color-scheme` declarado en ambos). Valores exactos de la maqueta:

| Token | Claro | Oscuro |
|---|---|---|
| `--bg` | `#f6f5f1` | `#131715` |
| `--surface` | `#ffffff` | `#1b211d` |
| `--ink` (antes `--text`) | `#20281f` | `#e7ebe6` |
| `--muted` | `#647062` | `#97a397` |
| `--line` | `#e3e1d6` | `#2a332c` |
| `--accent` | `#1c7a48` | `#4cb178` |
| `--accent-ink` (texto sobre acento) | `#ffffff` | `#0e1410` |
| `--hl` (fondo resaltado) | `#dff0e5` | `#1e3a2a` |
| `--hl-line` | `#8cc9a6` | `#3f7c59` |
| `--danger` | `#b0392e` | `#d96b5f` |
| `--danger-soft` | `#f7e4e1` | `#3a231f` |
| `--chip` | `#eceae2` | `#242c26` |

- Un solo acento: el verde. El dorado desaparece. Rojo = señal de peligro
  (roja, rechazo del Verificador), no acento.
- La amarilla se señala con el icono/chip neutro + la palabra; si hace falta un
  amarillo de señal, un solo token `--card-yellow` apagado, nunca como acento.
- `--radius: 8px` (10–12 solo en el tablero exterior); sombra neutra sutil o
  borde 1 px.

## Tipografía

- **Dos familias via `next/font`:** Archivo (500/700/900) → `--font-display`;
  Source Sans 3 (400/600/700) → `--font-sans`. **Newsreader se elimina** y todo
  uso de `--font-serif` migra a `--font-sans` (la maqueta es sans y así le
  gustó).
- Cuerpo 16 px / 1.55 (hoy 14 — parte del «meh» es que todo se ve chico).
- Marcador: Archivo 900, `clamp(34px, 6vw, 46px)`, tabular.
- Equipos y título de crónica: Archivo 700. Tracking −0.01/−0.02 em en grandes.
- Antetítulos/eyebrows: 12.5 px, 700, `0.08em`, uppercase; en acento o muted
  según jerarquía (como la maqueta).
- `text-wrap: balance` en títulos, `pretty` en frases (ya existe: conservar).

## Componentes (sin tocar estructura de datos ni selectores de prueba)

- **Línea de tiempo:** cada evento gana un **chip** uppercase con su tipo
  (`gol`, `roja`, `córner`, `tiro`…): fondo `--chip` y texto muted; gol = fondo
  acento + `--accent-ink`; roja = fondo `--danger`. Es EL recurso escaneable de
  la maqueta. Único cambio de markup permitido: un `<span class="chip">` dentro
  del botón de evento (los `data-*` e ids quedan intactos).
- **Resaltado/selección** (frases y eventos): fondo `--hl` + borde `--hl-line`;
  selección = outline 2 px acento. Reemplaza el dorado suave actual.
- **Barra de verificación:** punto verde + «8/8 frases verificadas · N intentos»
  en 600; el detalle en muted. Botón primario: fondo acento, texto
  `--accent-ink`.
- **Toggle de idioma:** activo = fondo acento + `--accent-ink` (hoy: gris).
- **Caja de cristal / drawer / pizarra:** misma estructura; re-tokenizar.
  Rechazado = `--danger` (tag y tachado), aprobado = acento.
- **Ticker (008) y panel de ratings (009):** mismos tokens; la figura del
  partido destacada con `--hl`, no con otro color nuevo.

## Restricciones duras

1. **Cero cambios de comportamiento.** Mismos `data-testid`, `data-*`, ids,
   textos y rutas. `npm run e2e` pasa **sin editar** `e2e/juez.spec.ts`.
2. Colores únicamente como tokens en `globals.css`; ningún hex en componentes.
3. Contraste **medido, no estimado** — pares mínimos AA a verificar y anotar en
   la bitácora: `--ink`/`--bg`, `--muted`/`--bg`, `--muted`/`--surface`,
   `--accent-ink`/`--accent` (chips 10.5 px 700), `--danger`/`--danger-soft`,
   foco acento sobre `--bg` y `--surface` en ambos temas.
4. Se ve bien a 360 px (ya hay media query: migrarla, no perderla).
5. `prefers-reduced-motion` se conserva donde ya existe.

## Aceptación

- `npm test` y `npm run e2e` verdes, vistos por Fable.
- Smoke a ojo (Fable): 2 semillas, tema claro y oscuro, 1280 px y 360 px;
  cotejo lado a lado contra la maqueta («¿es la misma voz?»).
- Checklist §6 de la skill repasada línea por línea en la bitácora.
- Capturas antes/después para Carlos; él da el veredicto final (si manda
  referencias visuales, se itera sobre ellas).
