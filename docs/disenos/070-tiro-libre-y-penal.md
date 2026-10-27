# 070 — Tiro libre real y penal (`reinicios-v11`)

## Estado

Brief **cerrado v1.0**, 27 oct 2026, 06:10 UTC. Lo diseña Opus 5.5 (coordinador) y lo implementa
`opus-implementador`.

**Pedido de Carlos (27 oct):**
- «cuando hay una falta, el partido se detiene, y la bola debe iniciar desde donde se dio la falta a favor del
  equipo al que le hicieron la falta».
- «qué pasa si hay tarjeta roja, el jugador debe salir del partido».
- «Avanza todo lo posible».

**Plazo:**
- El juzgamiento empieza a las 16:00 UTC; el coordinador despliega antes.
- Commit y push con todo en verde **antes de las 13:30 UTC**.
- A las 12:30 UTC: si B (penal) no está en verde, se entrega **solo A** (v11 sin penal) y B queda declarado.

## 1. Diagnóstico del coordinador (v10, programados, 120 s, semillas 1–100)

**Falta.** `MotorArena.resolverFalta` (`src/arena/motor.ts` ≈ l. 711):
- registra la falta;
- deja el balón en los pies del jugador que la recibió, en su posición;
- pausa `TECNICA_ARENA.pausaS` (1,5 s) con todos quietos (`frenarJugadores`);
- sigue el juego normal.

**Lo que falla:**
- **No hay distancia de barrera.** El infractor sigue pegado al balón: en 55 de 219 faltas (25 %), el equipo
  infractor recupera el balón o vuelve a cometer falta en los 4,5 s siguientes a la reanudación.
- **No hay saque como tal.** No existe el tipo de reinicio, ni rótulo «Free kick», ni la acción del ejecutor de
  `prepararSaque`/`ejecutarSaque`.
- **No hay penal.** Un 8,2 % de las faltas ocurre en el área del infractor: 18 en 100 partidos, unas 0,18 por
  partido. Hoy se reanudan como cualquier otra falta.
- **56 faltas a ≤ 30 m del arco**, fuera del área, sin opción de tiro directo.

**Roja: ya implementada; no se cambia.**
- El expulsado sale de `estado.jugadores` y pasa a `estado.expulsados`.
- El equipo se reorganiza (`formar`) y se reasignan capitanes.
- No puede ser sustituido.
- El partido termina si quedan menos de `R.minJugadores`.
- La UI lo muestra («Sent off — cannot be replaced»), el narrador lo canta (`relato.ts`, `importantes`) y la
  observación del LLM ya no lo incluye.

## 2. Alcance (solo bajo `reglasDesde(config, "reinicios-v11")`; v1–v10 idénticas byte a byte)

### A. Tiro libre

- **Nuevo tipo de reinicio `"libre"`** en `TipoReinicioArena` (`src/arena/tipos.ts`).
  - Se resuelve con la maquinaria de `prepararSaque`/`ejecutarSaque`, sin un camino paralelo.
- **Colocación.**
  - **Punto:** donde se cometió la falta, la posición del portador en el contacto, ya registrada en el evento
    `falta`, ajustada con `enCancha`.
  - **Ejecutor:** el jugador que recibió la falta si sigue en la cancha. Si no (expulsado o sustituido en la
    misma pausa), el compañero de campo más cercano.
  - **Rivales a ≥ `ARENA.distanciaSaqueLibreM`.** Es una constante nueva y comentada; vale **9,15** porque las
    medidas son reales: la cancha mide 105 × 68 m.
  - Los rivales se apartan con el mismo empuje que usa hoy `prepararSaque` en los otros saques, sin dejarlos
    fuera de la cancha.
- **Pausa:** la de los demás saques (`TECNICA_ARENA.pausaS`), usando el mismo `estado.saque` y `estado.pausa`.
  - **Excepción:** la falta sobre el portero en su área se sigue reanudando con el balón en las manos, como hoy
    (brief 046 v1.1).
- **Ejecución.**
  - **Hoy:** el ejecutor pasa al compañero más cercano, como en los otros saques.
  - **Tiro directo:** si el punto está a ≤ `LIBRE_ARENA.directoMaxM` del centro del arco rival (constante nueva,
    propuesta 25 m) y en el pasillo central (`|y − 34| ≤ LIBRE_ARENA.pasilloM`, propuesta 12 m), el ejecutor
    **remata** con la probabilidad `LIBRE_ARENA.probDirecto` (propuesta 0,5). El remate usa el mismo modelo de
    tiro (error, potencia, portero), con `motivo: "libre"`.
  - **Fuera de juego:** se aplica como en el juego. En el tiro libre **no** se limpia `adelantados`, al revés que
    en banda, esquina y meta.
  - **Orden del LLM:** si hay una orden explícita vigente del ejecutor (`pasar` a un receptor válido o `tirar`),
    se respeta, con las mismas validaciones que en juego. Si no, decide la regla anterior.
- **Evento.** `reinicio` con `reinicio: "libre"` y `fuentes: [falta.id]`. Sustituye al `reinicio` con
  `motivo: "falta"` de hoy, solo en v11.

### B. Penal

**Cuándo y colocación.**
- Hay penal si la falta ocurre **dentro del área** del equipo infractor, con la misma geometría que
  `enAreaPropia` (`areaLargoM` × `areaAnchoM`).
- Nuevo tipo de reinicio `"penal"`. El balón va al punto penal: a **11 m** de la línea de fondo, en el centro.
  Constante `PENAL_ARENA.puntoM`.

**Ejecutor.** El jugador que recibió la falta si sigue en la cancha. Si no, el compañero de campo con el atributo
`potencia` más alto, y desempata el nivel.

**Colocación del resto.**
- Todos los demás jugadores quedan fuera del área y a ≥ 9,15 m del punto.
- El portero defensor queda en su línea, en el centro del arco.

**Resolución** (determinista con `prngDerivado(seed, "penal:…")`). Al terminar la pausa, el ejecutor remata y el
resultado se decide con una probabilidad propia de gol, sin usar el modelo de tiro en juego, cuya conversión de
cerca está calibrada para mano a mano:
- **Gol** con probabilidad `PENAL_ARENA.conversion`. Propuesta: 0,76, con ± `PENAL_ARENA.ajusteMax` = 0,08 según
  la diferencia de `potencia` del ejecutor y el nivel del portero, todo leído de `limites.ts`.
- **Si no es gol**, la mitad de los casos es **atajada** (balón en las manos del portero, `darManos`) y la otra
  mitad **fuera**, con saque de meta. Proporciones en `PENAL_ARENA`.

**Eventos.**
- `tiro` con `motivo: "penal"` y su desenlace por los eventos ya existentes: `gol`, `atajada`, o `tiro_fuera` y
  `reinicio` de meta.
- El `gol` lleva `fuentes` al tiro, que a su vez apunta a la falta, para que los hechos y el verificador puedan
  citarlo.

**Animación.** Un vuelo del balón del punto a la portería con la duración normal de un tiro. No hace falta
animar al portero más allá de lo que ya hace la atajada.

### C. Texto, voz y prompt

- **Relato** (`src/arena/relato.ts`, plantillas ES/EN, tamaño acotado como hoy):
  - tiro libre: «Tiro libre para X» / «Free kick to X»;
  - tiro libre directo;
  - penal señalado;
  - penal convertido, atajado y fallado.
- **Canto de gol:** un gol de penal usa el canto actual. Si hay una variante barata para «de penal», mejor; si no,
  queda declarado.
- **UI:** el rótulo de reinicio (`arena-restart`) muestra «Free kick» / «Tiro libre» y «Penalty» / «Penal».
  - Hay que comprobar los iconos: si `IconosArena` no tiene uno para el penal, se usa el de falta o el de tiro.
- **Hechos y verificación:** `estadista`, `cronica-hechos`, `inteligencia` y el verificador aceptan el
  `motivo: "penal"` y el `reinicio: "libre"`/`"penal"` en v11 sin romper V1–V8.
  - Si un hecho «penal» es natural (por ejemplo, «X marcó de penal»), se añade solo si cabe limpio; si no, queda
    declarado.
- **Prompt:** frase nueva, construida con constantes (patrón `frasesFueraDeJuego`). Dice:
  - que la falta da tiro libre con la barrera a 9,15 m;
  - que dentro del área es penal;
  - que en v11 la presión dentro del área propia tiene ese coste.
- **Coste:** se recalcula `factorObservacion063` y se regenera `torneo-sitio-entradas.json`, como en el 068.

### Versión de reglas

- `ARENA.reglas = "reinicios-v11"`, con el literal en `reglasArena` y en las listas de reglas admitidas.
- Fixture nueva `arena-reinicios-v11.json`: una semilla con un tiro libre y, si existe en 1–200, un penal.
- Los dorados y fixtures v1–v10 no cambian.

## 3. Bandas (programados, 120 s, semillas 1–100 y 101–200)

**Bandas nuevas** en `BANDAS_070` (`limites.ts`); ninguna prueba repite cifras.

| Métrica (v11, semillas 1–100) | Banda |
|---|---|
| Recuperación del infractor en ≤ 4,5 s tras la reanudación de una falta (métrica del § 1) | ≤ 10 % (v10: 25 %) |
| Rivales a < 9,15 m del balón en el tick de ejecución de un tiro libre o un penal (salvo el portero en el penal) | 0 |
| Penales por partido | 0,08 – 0,35 |
| Conversión de penales (1–200 juntos) | 0,6 – 0,9 |
| Faltas por partido | las bandas del 068 siguen |

**Bandas que ya existen:**
- todas las del 046, 051, 063, 065 y 068 siguen sobre v11; en especial, goles por partido ≤ 2,8 y conversión del
  mano a mano ≤ 0,42 (los penales **no** cuentan como mano a mano);
- si un penal o un tiro libre directo empuja una banda vieja fuera, se ajusta primero `LIBRE_ARENA.probDirecto`
  (0,5 → 0,3 → 0) y después `PENAL_ARENA.conversion` hacia 0,7, como máximo dos iteraciones cada uno;
- **no se mueven bandas.**

**Voz:** como en el 068, con Speech simulado (semillas 1–8, 120 s, ES y ES+EN), sin rechazos del narrador ni de
los invitados.

## 4. Pruebas

- **Unitarias:**
  - A (punto, ejecutor, distancia, offside no limpiado, directo dentro y fuera del pasillo, portero en su área sin
    cambios);
  - B (área sí/no, colocación, conversión leída de `limites.ts`, desenlaces, fuentes);
  - C (frases con constantes alteradas, plantillas ES/EN con tamaño acotado).
- **Fixture v11.** Bajo v10 todo queda igual.
- **Mutaciones en rojo:**
  - sin distancia de barrera;
  - penal tratado como libre;
  - conversión fija a 1.
- **Entrega:** tsc, `npm test`, `npm run test:stats` completo y e2e completa (puerto 3417).
  - Capturas de `docs/evidencia` restauradas con checkout.
  - **Inestables conocidas:** `arena-buffer:343` y `arena-gol-visual:126` (CI); repetirlas antes de declararlas.

## 5. Fuera de alcance

- Barreras como formación de jugadores, ventaja o tiros libres indirectos.
- Animación del lanzador.
- Desplegar: lo hace el coordinador.
- El bloque B4 del 064 sin commit, `CLAUDE.md`, `BITACORA.md`, el trabajo del brief 069 (`BarraSitio`,
  `src/vista/`, `infra/app.bicep`) y el del video (`scripts/grabar-video-final.mjs`, `docs/entrega/guion-video.md`,
  `docs/evidencia/video-067/`): ni se tocan ni se commitean.

## 6. Entrega

- Commits con rutas explícitas y gitleaks; push a main.
- HANDOFF.md: sección propia en cada hito.
- **Informe:**
  - tabla v10/v11: faltas, recuperación del infractor, tiros libres directos, penales, conversión, goles, tiros y
    fueras de juego;
  - constantes finales;
  - pruebas y mutaciones;
  - voz;
  - desviaciones;
  - fila de BITACORA propuesta.
