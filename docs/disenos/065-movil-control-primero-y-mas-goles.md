# 065 — Móvil: control primero · Más goles (reglas `reinicios-v9`) · 120 s por defecto en la web

## Estado

Brief **cerrado v1.0**, lunes 26 de octubre de 2026. Lo diseña Opus 5.5 (coordinador), porque Fable no tiene
cupo. Lo implementa `opus-implementador`. Carlos eligió las opciones A + B el 26 oct.

**Pedido literal de Carlos (26 oct):**

> «cuando se ve en mobile, los controles para start live match quedan muy abajo y la simulacion arriba entonces
> cuesta mucho entender, el start live match deberia aparecer mas cerca de primero cuando se ve mobile.»
> «Despues de los ultimos cambios se hacen muchos menos goles, podemos mejorar esto para que hayan mas goles?»
> — «si vamos con A + B».

## 1. Móvil: la sala de control antes de la cancha (ya implementado por el coordinador)

Corrige, **solo en una columna (≤ 850 px)**, el «partido primero» del brief 055. En escritorio, el DOM y el orden
no cambian.

- CSS (`globals.css`, bloque «Móvil (una columna)» tras `.arena-control-room .arena-live-controls .btn-primary`):
  - `.arena-companion` pasa a `display: contents`;
  - cada hijo se convierte en tarjeta;
  - `.arena-control-room` va con `order: -1`;
  - dentro de la sala, el orden visual es: pestañas, `.arena-live` (con «Start live match») y `.arena-setup`.
- `Arena.tsx`:
  - el tablero lleva `id="arena-cancha"` y «Go to the pitch and narration» apunta allí;
  - al activarse el directo en una columna, `scrollIntoView` lleva a la cancha (`auto` con movimiento reducido).
- Medido a 390×844 contra el dev server: «Start live match» en y≈700, antes en y≈1185 (tras la cancha). Tras
  empezar, el marcador y la cancha quedan a la vista.
- Descartado: plegar la configuración por JS al montar. Desplaza el botón después de la hidratación y se pierde el
  clic, como se vio en `arena-antesala.spec.ts:860`.

**Al implementador le toca:**

- añadir una e2e `e2e/arena-movil-065.spec.ts` (390×844 y 360×740, EN/ES) que compruebe:
  1. que `#arena-control` está por encima de `.arena-board`;
  2. que «Start live match» está dentro del primer encuadre sin desplazar;
  3. que no hay desborde horizontal;
  4. que tras «Start live match», con el programado, `.arena-board` entra en la vista;
  5. una mutación vista: quitando el `order: -1` falla el punto 1;
- revisar las e2e que miden posiciones móviles del 055 y del 060 y anotar en BITACORA la deuda del 055 («marcador a
  538–611 px en móvil»), que ahora queda **más abajo a propósito**.

## 2. Opción A: remate más preciso y portero con menos alcance (`reinicios-v9`)

**Diagnóstico** (seeds 1–600, programados, sin LLM; scripts y datos en
`docs/evidencia/motor-065/diagnostico/`, que el implementador copia del scratchpad del coordinador, ver § 5):

| | v4 | v5 | v6 | v7 | v8 |
|---|---|---|---|---|---|
| Goles por partido a 60 s | 1,215 | 0,997 | 1,003 | 0,985 | 0,948 |
| Partidos 0-0 a 60 s | 23,5 % | 32,8 % | 32,5 % | 33 % | 35,2 % |
| Goles por partido a 180 s | 3,795 | 3,147 | 3,272 | 3,052 | 2,963 |

La caída mayor viene del 051 (v5: remate ancho o alto y portero con nivel). El 063 resta un 9 % más a 180 s,
casi todo por el remate lejano de v7. La persecución y la identidad no influyen.

**Cambio.** Solo bajo `reglasDesde(config, "reinicios-v9")`. Hasta v8 todo queda **idéntico**: las versiones
publicadas están congeladas.

- **Constantes nuevas en `src/sim/limites.ts`, comentadas:** un bloque `REMATE_ARENA_V9` (o el patrón `desde:` ya
  usado en `recalibracion046`) con `errorBaseM: 4.5` (v5–v8: 5,5) y `alcanceMaxM: 2.1` (v5–v8: 2,4). El resto de
  `REMATE_ARENA` no cambia.
- **Remate y portero:**
  - `errorRemate` (`src/arena/remate.ts:44`) y `alcancePortero` (`remate.ts:55`) reciben las constantes según las
    reglas;
  - el motor las elige en `src/arena/motor.ts:353` y `:801`, o donde estén al implementar;
  - ninguna prueba repite las cifras a mano: se leen de `limites.ts`.
- **Versión de reglas:**
  - `ARENA.reglas = "reinicios-v9"`, con su línea en el comentario de versiones;
  - el literal `"reinicios-v9"` en `src/arena/tipos.ts`, donde se enumeran las reglas;
  - cualquier lista o validación de reglas admitidas del torneo, la crónica, el importador o el dataset acepta v9.
- **Fixture y dorados:**
  - fixture nueva `src/arena/__fixtures__/arena-reinicios-v9.json`, siguiendo el patrón de la de v8;
  - los dorados y fixtures de v5–v8 no cambian ni un byte; si alguno cambia, es un fallo.
- **Bandas:**
  - `bandasLote` completo en los lotes 1–100 y 101–200 a 120 s, más el lote rápido de `npm test`;
  - los experimentos controlados del 063 (lejanos por identidad ≥ 0,2 y potencia) sobre v9, y `npm run test:stats`
    completo;
  - el coordinador midió, con el valor cambiado en tiempo de ejecución, que todas las bandas del 046, el 051 y el
    063 se cumplen;
  - la conversión del mano a mano queda en 0,407, con techo 0,42.
- **Ajuste permitido si una banda falla:** `alcanceMaxM` 2,1 → 2,2, o `errorBaseM` 4,5 → 4,8, como máximo dos
  iteraciones. **No se mueven bandas.** Si sigue fallando, se para y se informa.
- **Costes:**
  - si `factorObservacion063` u otra estimación de coste por versión depende de las reglas, se recalcula para v9 como
    se hizo en v8, con el número nuevo comentado;
  - liga ≤ 8 USD y grupos ≤ 7 USD siguen.
- **Medición para el informe:** goles por partido y % de 0-0 a 60, 120 y 180 s, en v8 frente a v9, con las semillas
  1–400. Se guarda en `docs/evidencia/motor-065/v9/`.
- **Expectativa:** unos 1,06 goles a 60 s, 2,3 a 120 s y 3,45 a 180 s.

## 3. Opción B: duración por defecto de la web, 120 s

- **Selector de duración en `Arena.tsx`:**
  - opciones 30 / 60 / **120** / 180 s;
  - valor inicial **120** (`useState(60)` → 120);
  - el API ya admite hasta `ARENA.duracionMaxS` (180); se comprueba que 120 pasa por todas las validaciones (directo,
    búfer, grabación sin IA, `?vista=buffer`);
  - con `intervaloS` 15 salen 8 rondas.
- **El torneo sigue en 60 s.** `TORNEO_ARENA.duracionS` y `SMOKE_MODELOS_ARENA` no se tocan. Los ejemplos y las
  grabaciones guardadas conservan su duración.
- **Voz y LLM:**
  - medir con el stub o el ENSAYO si un directo de 120 s con narración agota `bolsaSpeech` (12 solicitudes, 9.000
    caracteres) o `bolsaSpeechInvitados` (16 solicitudes, 4.800 caracteres);
  - BITACORA dice que en 180 s se agotan;
  - **no se suben las bolsas en este brief**: si a 120 s se agotan, se declara como deuda con la cifra medida, y
    Carlos decide.
- **Textos:** cualquier texto que recomiende 60 s o diga «60 s por defecto» se ajusta (buscar en `src/ui` y `docs/`).
- **Pruebas:** las unitarias y e2e que asumen 60 s por defecto se actualizan leyendo el valor de un solo sitio. Si
  hace falta, se exporta una constante `ARENA_WEB.duracionDefectoS` en `limites.ts`, y ni el UI ni las pruebas
  repiten «120».

## 4. Fuera de alcance

- Subir bolsas de voz o cupos.
- Cambiar el torneo.
- Retocar persecución, repliegue, `entradaDuelo` o identidad.
- Desplegar a Azure: lo decide Carlos aparte.
- El bloque B4 del 064 que está sin commit en el árbol (`BotonCronica.tsx`, `CronicaArena.tsx`,
  `textos-cronica-arena.ts`, `src/app/arena/cronica/`, cambios en `CajaDeCristal.tsx`, `textos.ts`, su bloque de
  `globals.css` y sus 3 líneas de `Arena.tsx`) **no se toca ni se commitea**.

## 5. Entrega

- `tsc` limpio, `npm test`, `npm run test:stats` y la e2e completa (puerto 3417).
  - Las capturas de `docs/evidencia` reescritas por la e2e se restauran con checkout, salvo las nuevas del 065.
  - Fallos ya conocidos en HEAD con el dev server (no con la e2e oficial): `arena-buffer:136`, `arena-cifras:119`,
    `arena-repeticion-060:318` y `arena-play-narrado:116`. Si fallan en la e2e oficial, hay que compararlos con HEAD
    y declararlos.
- **Commits con rutas explícitas**, nunca `git add -A`, y gitleaks antes de cada commit.
  - Commits separados para v9 y para los 120 s.
  - Push a main al terminar con todo en verde.
  - **No desplegar.**
- HANDOFF.md se actualiza en cada hito.
