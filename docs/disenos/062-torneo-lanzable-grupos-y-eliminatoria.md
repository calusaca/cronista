# 062 — Torneo lanzable desde el sitio: liga o grupos con eliminatoria

## Estado

Brief **v1.2**, sábado 24 de octubre de 2026. **La sección 18 prevalece sobre la 17, y la 17 sobre todo lo
anterior.** La segunda revisión de Codex cerró 8 de 13 hallazgos (iteración 2 de 3); la § 18 cierra los cinco
que quedaban y el hallazgo nuevo. Antes, Codex revisó la v1.0 y la dejó en NO CERRADO (2 críticos, 8 altos y
3 medios; iteración 1 de 3). La § 17 simplifica la
arquitectura según las decisiones del coordinador, en quien Carlos delegó. Lo que la § 17 no menciona sigue
vigente si no la contradice. Lo escribió Opus como diseñador porque Fable no tiene cupo. No incluye código
de producción. Lo implementa Opus siguiendo este brief.

**Pedido de Carlos (24 oct):** «proveer la oportunidad de iniciar un nuevo torneo con los mismos modelos».

**Decisiones de Carlos que este brief no reabre:**

- **Quién lanza.** Cualquier visitante, jueces incluidos. Como máximo **1 torneo por día UTC en todo el
  sitio** y con un tope de gasto.
- **Dos formatos a elegir al lanzar.**
  - **Liga:** el del 059. Todos contra todos a ida y vuelta: 30 partidos y unos 7 USD típicos.
  - **Grupos + eliminatoria:** 2 grupos de 3 a ida y vuelta (12 partidos), semifinales 1A–2B y 1B–2A, y
    final. Son 15 partidos y unos 3,5 USD.
- **Cupo y topes.** El cupo es el mismo sea cual sea el formato. Cada formato tiene su propio tope. Antes
  de confirmar se muestran la estimación de coste y la de duración.

**Depende de:**

- **059 v1.2:** calendario Berger, clasificación, reservas en micro-USD, `jugarEncuentro`, `transporteTorneo`
  y `validarEncuentro`.
- **057:** «Reproducir con narración».
- **052:** catálogo y precios.

**Ramas en paralelo.** El 060 (arena: sincronía, pausar/detener, modelos) y el 061 (aspecto de la crónica)
se diseñan a la vez que este brief. § 16 cierra la lista de archivos que este brief **no** toca.

**Reglas que no se negocian:**

- **Lo que no cambia:** el motor, `RegistroArena`, el validador, el protocolo de órdenes, `SISTEMA_ARENA`, el
  límite diario público, los presupuestos de voz, `sesiones.ts` y `almacen.ts`.
- **De dónde sale cada número visible:** se recalcula con funciones puras desde los registros, o se rotula
  como **declarado** (†) por quien ejecutó el torneo.
- **Lo que no se afirma:** ningún texto dice que un modelo «es mejor entrenador» (034, 052, 059 § 15.7).
- **Penaltis y prórroga:** no se inventan; el motor no los tiene (§ 1).

## 0. El diseño en doce líneas

1. En `/arena/torneo` hay un selector de formato, **Liga** o **Grupos + eliminatoria**, con las cifras de
   cada uno, y el botón «Iniciar nuevo torneo», que lleva a un paso de confirmación.
2. **Participantes:** los **6 modelos del torneo archivado del 24 oct**, todos publicados. Si alguno falta
   del catálogo, el botón se desactiva y explica por qué.
3. **Semilla y sorteo:** la semilla es la fecha UTC (`20261025`). El sorteo de grupos es **puro por
   semilla, sin cabezas de serie** (§ 2 D1).
4. **Eliminatoria:** a partido único, con el 1.º de grupo de local. Un empate se resuelve con **un partido
   de desempate** con la misma semilla y los lados invertidos. Si ese también empata, deciden los
   **criterios del registro** (remates directos, remates), luego el coeficiente de grupo y, por último, un
   **sorteo por semilla rotulado** como tal. No hay penaltis porque el motor no los tiene.
5. **Ejecución:** el torneo corre **en el contenedor**, en segundo plano, **al ritmo del reloj**: cada ronda
   dura al menos su intervalo. Grupos tarda ≈ 16–20 min y la liga ≈ 33 min, sin incidencias.
6. **Persistencia:** el progreso se guarda en el almacén existente (Blob en producción), con prefijo propio:
   libro de gasto de solo anexión, un par `.ejecutor.json`/`.json.gz` por partido y `torneo.json` actualizado
   tras cada partido. Tras un reinicio se **reanuda**, con un *lease* propio.
7. **Admisión** antes de ejecutar nada:
   - origen y tipo de contenido, y un limitador por IP en memoria;
   - el cupo del día y el torneo activo se toman con **creaciones atómicas** (`ifNoneMatch: "*"` / `wx`):
     dos clics simultáneos no pueden lanzar dos torneos.
8. **Gasto:** tope por estimación de **16 USD en la liga y 14 en grupos**, con las reservas del 059. Una
   **bolsa del periodo de 50 USD** para todos los torneos del sitio impide que el cupo diario se coma el
   crédito (§ 5).
9. **Separado del público:** el torneo **no cuenta** en el límite diario de 10 partidos con modelos ni ocupa
   el único encuentro con modelos simultáneo de las sesiones públicas (§ 6.7).
10. **Validación y rótulo:** cada partido se valida **en el servidor al terminar** con `validarEncuentro` y
    la huella SHA-256. Esos torneos llevan el rótulo «Lanzado en el sitio · validado en el servidor», que
    los distingue de los «Archivados · validados en CI». Se pueden **promover** al repositorio después
    (P2).
11. **Página:** grupos, tablas, cuadro de eliminatoria y partido en curso, con un sondeo cada 15 s. Cada
    partido terminado abre `/arena?torneo=…&encuentro=…` con «Reproducir con narración» (057). La lista
    separa los torneos archivados en CI de los lanzados en el sitio.
12. **Cancelación administrativa:** un archivo `cancelar-<id>.json` en el almacén, escrito por un CLI del
    operador, o el interruptor `ARENA_TORNEO_SITIO=0`.

## 1. Hechos verificados en el código (24 oct)

- **El motor no tiene penaltis ni prórroga.**
  - `TipoReinicioArena = "centro" | "banda" | "esquina" | "meta"` (`tipos.ts:70`).
  - La duración la fija `config.duracionS` (como mucho `ARENA.duracionMaxS = 180`) y el partido termina en
    ese tick (`motor.ts:69`, `:703`).
  - Una «prórroga» sería otro `crearConfigArena` con un saque nuevo: un partido nuevo, no una continuación.
  - **Conclusión:** una tanda o una prórroga serían inventadas. Se descartan.
- **Calendario de 3 ya existe.** `TABLAS_BERGER[3]` (`torneo.ts:125`) da 1–2, 3–1 y 2–3, con un descanso por
  jornada. `calendarioTorneo(ids, semilla)` acepta 3 participantes y genera la vuelta invertida con la misma
  semilla por cruce.
- **`semillasCruce(ids, semilla)`** (`torneo.ts:149`) deriva una semilla por clave de pareja, sin colisiones
  dentro del conjunto que recibe.
  - Llamada **por grupo**, no garantiza que las semillas no se repitan entre grupos.
  - Llamada **sobre los 6**, sí (§ 3.2).
- **Clasificación.** `clasificar` (`torneo.ts:228`) aplica 3/1/0, puntos, DG, GF, la liguilla reaplicada y la
  posición compartida (1, 2, 2, 4). En un grupo de 3 donde empatan los tres, la liguilla usa los mismos
  partidos que el grupo y **no separa a nadie**: la posición compartida es frecuente y hay que resolver el
  corte (§ 3.3).
- **Empates en el torneo del 24 oct:** 10 de 30 partidos (P1, P12, P14, P17, P18, P19, P25, P27, P28 y P30).
  Con un 33 % de empates, la regla de desempate se aplicará casi siempre en alguna llave.
- **Tiempo real del torneo del 24 oct.** Duró 15,5 min (01:31:50 → 01:47:19 UTC, 30 partidos): ≈ 31 s por
  partido **sin ritmo de reloj**. El gasto conocido fue 6,9665 USD, frente a 7,0768 de típico estimado. La
  reserva del partido más caro (Astra–Sol) es 7,3696 USD.
- **Típico por decisión** (`docs/evidencia/torneo-059/2026-10-24/estimacion.json`), en µUSD:

  | Modelo | µUSD por decisión |
  |---|---|
  | Astra | 114.462 |
  | 6 Sol | 23.885 |
  | 6.1 Sol | 23.364 |
  | mini | 9.892 |
  | 5.6 Luna | 4.090 |
  | 6 Luna | 1.228 |
  | **Σ (una decisión de cada uno)** | **176.921** |

- **Precio de gpt-6.1-sol.** `precios.json` ya tiene su precio de lista (2 / 10 / 0,1; commit `916ff40`).
  Un torneo nuevo **no** lleva `estimadoDe`.
- **Almacén.**
  - `almacenBlob(endpoint, contenedor, prefijo)` (`almacen.ts:28`) admite un prefijo propio y
    `escribir(…, nuevo = true)`, que hace `ifNoneMatch: "*"`.
  - `bloquear()` toma un *lease* de 60 s sobre `<prefijo>coordinador.lock` y lo renueva cada 20 s.
  - `almacenLocal` usa `flag: "wx"` y su `bloquear()` no bloquea nada (`almacen.ts:25`).
  - **Solo texto:** no hay lectura ni escritura de bytes.
- **Sesiones públicas.**
  - El límite diario cuenta `*.meta.json` del prefijo `sesiones/` (`sesiones.ts:137–143`).
  - La exclusión de un solo encuentro con modelos es memoria del `GestorSesiones` (`:134–135`).
  - Ninguna de las dos ve otro prefijo ni otro gestor.
- **Contenedor** (`infra/arena-preview.bicep`):
  - `minReplicas 1` y `maxReplicas 1`, 0,5 vCPU y 1 GiB;
  - `activeRevisionsMode: 'Single'`: un despliegue **reinicia** la réplica, y la vieja y la nueva conviven
    unos segundos;
  - las variables `AZURE_OPENAI_API_KEY` y `AZURE_OPENAI_ENDPOINT` ya están;
  - **no hay ninguna variable con el commit**, y el contexto del contenedor no incluye `docs/` (Dockerfile:
    solo `src`, `public` y `docs/dataset/…`). La estimación del 059 lee `docs/evidencia/modelos-052/` y
    **no está** dentro de la imagen.
- **Ritmo.** `ejecutarArena` espera a `alPublicar` en `esperando`, `ordenes`, `avance` y `ronda`
  (`coordinador.ts:66–91`); `decidir` arranca después de `esperando`. Esperar en `ronda` hasta
  `inicioRonda + intervaloS` da rondas de reloj **sin tocar `tiempoMs`**.
- **Carga de repeticiones.**
  - `torneo-carga.ts` lee `/torneos/<id>/torneo.json` y `eNN.json.gz` como archivos estáticos.
  - Comprueba esquema, coherencia, SHA-256, semilla, clubes y controladores.
  - `Arena.tsx` solo usa `peticionDeUrl` y `cargarEncuentroTorneo`, y su «Volver al torneo» enlaza
    `/arena/torneo/<id>`: **no hace falta tocar `Arena.tsx`**.
- **IP del cliente.** `grabaciones/route.ts:44` toma el **primer** salto de `x-forwarded-for`, que controla
  el cliente. El ingreso de Container Apps (Envoy) **añade** la IP real al final.
- **Instrumentación.** `src/instrumentation.ts` ya tiene `register()` con la rama `nodejs`.
- **No verificado (sin `az` en esta máquina):** el límite real de TPM de los deployments `GlobalStandard`
  de capacidad 100. Se asume la convención de Azure, 1 unidad = 1.000 TPM en los GPT, es decir ≈ 100.000
  TPM. Opus lo comprueba con
  `az cognitiveservices account deployment show … --query properties.rateLimits` y lo anota en la
  evidencia (§ 11).

## 2. Decisiones cerradas

### D1 · Sorteo de grupos: puro por semilla, sin cabezas de serie

**Regla.** `sorteoGrupos(ids, semilla)`:

1. Fisher–Yates sobre `ids` ordenados, con `prngDerivado(semilla, "torneo-062:grupos")`.
2. A = posiciones 1–3, B = 4–6.
3. El orden dentro de cada grupo son los índices 1–3 de la tabla Berger de 3.

Es independiente del orden de entrada.

**Por qué no hay cabezas de serie:**

1. **Lo que dice el propio torneo.** La tabla del 24 oct no ordena los modelos por calidad, y la página lo
   dice con una cifra calculada (p mínima 0,0625, § 15.7 del 059). Usarla como bombo contradiría ese aviso.
2. **Validación autocontenida.** El plan depende solo de `(participantes, semilla, formato)` y de los
   resultados del propio torneo. Con cabezas de serie dependería de «el último torneo», un dato que cambia
   cada día en el almacén y que CI no ve.
3. **Simplicidad verificable.** Una prueba enumera las 10 particiones posibles y exige que todas aparezcan
   con las semillas 0–999 (§ 9 G1).

**Coste de esta decisión.** Los dos mejores del 24 oct pueden caer en el mismo grupo. Es aceptable y se
declara.

### D2 · Semilla y participantes del torneo del sitio

- **Semilla:** el entero `AAAAMMDD` del día UTC en que se admite el lanzamiento (por ejemplo, 20261025).
  - El visitante no la elige, así que no puede buscar una semilla favorable.
  - Es transparente: la página la muestra.
- **Id:** `sitio-AAAA-MM-DD` (16 caracteres; cabe en `ID_TORNEO` y en la referencia de grabación de 50).
  - `torneo-cli.ts` **rechaza** cualquier `--id` que empiece por `sitio-`: es el espacio de nombres del
    sitio.
- **Participantes:** los 6 ids del torneo `2026-10-24`, que es literalmente «los mismos modelos».
  - Se generan en `torneo-sitio-entradas.json` (§ 6.2).
  - Si alguno no está en el catálogo publicado (`ARENA_MODELOS`), o el catálogo cambia sus deployments
    (por ejemplo, por el 060), el botón se desactiva con el motivo `catalogo`.
  - Así un cambio de catálogo no altera el formato en silencio.
- **Precio:** el de lista vigente en `precios.json` (6.1 Sol ya lo tiene).

### D3 · Formato Liga

- Es el 059 sin cambios: calendario Berger de 6, ida 1–15 y vuelta 16–30, y `clasificar` con la posición
  compartida.
- Puede haber un primer puesto compartido («1=»): la liga no necesita un campeón único y no se inventa
  ningún desempate.
- 30 partidos y 40 decisiones por modelo.

### D4 · Formato Grupos + eliminatoria

**Grupos.** Cada grupo juega un doble round-robin de 3: 6 partidos por grupo y 12 en total.

**Numeración de la fase de grupos.** Las jornadas se intercalan: en la jornada j se juega primero el partido
del grupo A y después el del grupo B.

| Jornada | Partido A | Partido B |
|---|---|---|
| 1 | P1: A1–A2 | P2: B1–B2 |
| 2 | P3: A3–A1 | P4: B3–B1 |
| 3 | P5: A2–A3 | P6: B2–B3 |
| 4 (vuelta) | P7: A2–A1 | P8: B2–B1 |
| 5 (vuelta) | P9: A1–A3 | P10: B1–B3 |
| 6 (vuelta) | P11: A3–A2 | P12: B3–B2 |

**Eliminatoria** (§ 3.4–3.5):

- semifinal 1: 1.º A contra 2.º B;
- semifinal 2: 1.º B contra 2.º A;
- final.

Cada llave es a partido único, más como mucho un desempate. Se juegan **entre 15 y 18 partidos**.

### D5 · Desempate de una llave: un partido de desempate y, después, criterios del registro

**Orden:**

1. **Partido de la llave.** Si alguien gana, pasa.
2. **Partido de desempate**, uno como máximo, con la **misma semilla y los lados invertidos**: es el pareo
   del 059, que reparte club, grada y saque. Si alguien lo gana, pasa.
3. Si el desempate también empata, deciden en este orden, **sobre los dos partidos de la llave**:
   1. más **remates directos** (cifra 049 recalculada por el motor);
   2. más **remates**;
   3. mejor **coeficiente de grupo**: puntos, DG y GF en la fase de grupos (los dos jugaron 4 partidos);
   4. **sorteo por semilla**, `prngDerivado(semilla, "torneo-062:sorteo:" + fase)`, rotulado «sorteo».

**Por qué así:**

- **Hacer jugar al modelo.** El desempate es fútbol simulado de verdad: el modelo decide.
- **Coste acotado.** Hay como mucho 3 desempates en el torneo (§ 5).
- **Criterios verificables.** Los del punto 3 salen del registro, se recalculan en la validación y se rotulan
  como **criterio del torneo, no reglamentario**.
- **Sorteo honesto.** Solo existe para que siempre haya un ganador; es reproducible y se rotula.

**Lo que no se hace:**

- No hay tanda de penaltis ni prórroga simuladas a medias.
- No hay desempates ilimitados: el coste no tendría cota.

### D6 · Clasificación de grupo: los desempates del 059 y luego el corte

**Tabla.** `clasificar` sobre los partidos **del grupo**, con los desempates del 059. La tabla muestra la
posición compartida («2=»).

**Corte.** Para decidir quién pasa (1.º y 2.º) y quién es 1.º (porque juega de local la semifinal),
`ordenGrupo` resuelve **solo** las clases empatadas que cruzan el corte, en este orden:

1. remates directos en el grupo;
2. remates;
3. sorteo por semilla, `prngDerivado(semilla, "torneo-062:sorteo:grupo-" + G)`.

**Cómo se ve.** La página escribe el criterio en texto: «Pasa como 2.º por remates directos (6 a 4)» o
«Pasa como 1.º por sorteo (semilla)». Nunca se expresa solo con color.

### D7 · Localía en la eliminatoria

- **Semifinales.** El 1.º de grupo juega de local. La presión de la grada es asimétrica (`entorno.ts:16`) y
  esa es la ventaja de haber ganado el grupo.
- **Final.** El ganador de la semifinal 1 es local.
- **Desempates.** Invierten los lados.

Las tres reglas son deterministas y se declaran.

### D8 · Semillas de la eliminatoria

- **Grupos:** la semilla de `semillasCruce(los 6 ids, semilla)` para su clave. Es única en el torneo.
- **Llaves:** `prngDerivado(semilla, "torneo-062:ko:" + fase + ":" + claveCruce(a, b))`.
  - Si choca con una semilla ya usada, se reintenta con el sufijo `":1"`, `":2"`…
  - El desempate **comparte** la semilla de su llave.

### D9 · Un torneo activo, un cupo diario y una bolsa

**Cupo.** Un lanzamiento por día UTC en todo el sitio, en cualquier formato.

- Lo consume el lanzamiento **admitido**, aunque el torneo termine incompleto o cancelado.
- No se devuelve automáticamente. P2: `--liberar-cupo` del operador.

**Un solo torneo activo a la vez.**

- Un torneo lanzado a las 23:50 UTC sigue al día siguiente.
- Mientras tanto, el cupo del día nuevo existe, pero no se puede usar hasta que termine.

**Bolsa del periodo** (`TORNEO_SITIO.bolsaUsd = 50`). Un lanzamiento solo se admite si

`gasto conocido acumulado de los torneos reales del sitio + tope del formato ≤ bolsa`.

- Es una salvaguarda nueva, justificada en § 5. Carlos puede cambiarla en una sola constante.
- Los ensayos cuestan 0 y no cuentan.

### D10 · Separado de las sesiones públicas

El torneo:

- **no cuenta** en `maxLlmDiarias` (10);
- **no ocupa** la exclusión de un solo encuentro con modelos;
- **no escribe** en el prefijo `sesiones/`.

Las cifras están en § 6.7.

### D11 · Validación y rótulos

Cada partido se valida **en el servidor al terminar**: `validarEncuentro` sobre el `.gz` íntegro, la huella
SHA-256, la configuración completa prescrita por el plan, los clubes, los goles, los controladores, las
cifras 049 y lo que consta del ejecutor (059 § 15.5 y § 16.1). Solo después se confirma el partido.

| Origen | Rótulo ES | Rótulo EN |
|---|---|---|
| CLI, en `public/torneos` | Archivado en el repositorio · validado en CI | Archived in the repository · validated in CI |
| Sitio, en el almacén | Lanzado en el sitio · validado en el servidor al terminar cada partido | Launched on the site · validated on the server after each match |
| Sitio, promovido (P2) | Lanzado en el sitio · comprobado después en CI | Launched on the site · later checked in CI |

**Promoción (P2).** `npm run arena:torneo-promover -- --id sitio-…`:

- descarga `torneo.json` y los `.gz` por las rutas públicas (§ 6.8), sin credenciales;
- ejecuta `validarTorneo` completo;
- escribe en `public/torneos/<id>/` y en `indice.json`;
- CI vuelve a validarlo, y su `origen` sigue siendo `"sitio"`.

**Límite declarado.** El servidor declara lo que validó. Quien quiera comprobarlo descarga el registro y lo
reproduce («Abrir registro guardado» o `npm run arena -- --reproducir`). La identidad del modelo, los
tokens y el coste siguen siendo **declarados**.

### D12 · Ritmo de reloj

El torneo del sitio juega cada ronda en, como mínimo, `intervaloS` de reloj de pared: espera en
`alPublicar("ronda")` hasta `inicioRonda + intervaloS`, con `inicioRonda` fijado en `alPublicar("esperando")`.

**Por qué:**

- **TPM.** Acota cada deployment a 4 decisiones por minuto, ≈ 40.000 TPM con 9.700 tokens por decisión,
  más los reintentos (§ 6.7).
- **CPU.** Reparte la carga en la réplica de 0,5 vCPU.
- **Seguimiento en vivo.** El partido en curso se puede seguir al ritmo del reloj.

**Lo que no cambia:** `tiempoMs` de cada decisión, el registro y la validación.

**Coste en tiempo:** un partido de 60 s dura ≈ 65 s, frente a ≈ 31 s sin ritmo.

## 3. Formatos — `src/arena/torneo-formatos.ts` (puro, sin Node; lo importa también el cliente)

### 3.1 Tipos

```ts
export type FormatoTorneo = "liga" | "grupos";
export type FaseEncuentro = "liga" | "grupo-A" | "grupo-B" | "semifinal-1" | "semifinal-2" | "final";
export interface EncuentroPlan062 extends EncuentroPlan { fase: FaseEncuentro; desempate: boolean }
export type CriterioPase = "resultado" | "desempate" | "remates_directos" | "remates" | "coeficiente" | "sorteo";
export interface Llave { fase: "semifinal-1" | "semifinal-2" | "final"; local: string; visita: string;
  partidos: number[]; ganador: string | null; criterio: CriterioPase | null; detalle: { a: number; b: number } | null }
```

### 3.2 Plan — `planTorneo(formato, ids, semilla, resultados)`

`resultados` es `{ encuentros, pendientes }`. La función devuelve **todos** los partidos que los resultados
ya determinan, en orden de ejecución, numerados 1…k.

- **Liga:** `calendarioTorneo(ids, semilla)` con `fase: "liga"` y `desempate: false`.
- **Grupos, partidos 1–12:**
  - siempre se planifican, con la tabla intercalada de D4;
  - `jornada` 1–6 y `vuelta` en las jornadas 4–6;
  - `cruce`: 1–3 para A y 4–6 para B;
  - la semilla de D8.
- **Fase de grupos con algún pendiente:** **no hay más plan**. El torneo termina incompleto al acabar los
  12, porque no se arma un cuadro con un grupo sin terminar.
- **Grupos completos:**
  - 13 = semifinal 1, `jornada` 7, `cruce` 7;
  - si la semifinal 1 empata, la siguiente es su desempate (`desempate: true`, lados invertidos y la misma
    semilla);
  - después la semifinal 2 (`cruce` 8) y su desempate si hace falta;
  - después la final (`jornada` 8, `cruce` 9) y su desempate si hace falta.
- **Partido de una llave pendiente:** se detiene el plan. Lo que viene después depende de su resultado.

**Funciones derivadas:**

- `siguientePartido(…) = planTorneo(…)` menos los ya jugados o pendientes, o `null`;
- `partidosFormato(formato) = { min, max }`: 30/30 para la liga y 15/18 para grupos, **calculado** desde
  `TORNEO_SITIO` (no es una constante).

### 3.3 Grupo — `clasificarGrupo(t, "A" | "B")` y `ordenGrupo(t, G)`

- **`clasificarGrupo`:** `clasificar({ participantes del grupo, encuentros con fase grupo-G })`.
- **`ordenGrupo`:** devuelve `[1.º, 2.º, 3.º]` y un `criterio` por posición (D6).
  - Solo desempata las clases con `empatada` que **cruzan** una frontera relevante (1|2 o 2|3).
  - Una clase compartida que no cruza ninguna frontera no existe en un grupo de 3: cualquier empate cruza
    al menos una.
  - Si una cifra de remates es `null` (no simulada), ese criterio **no aplica** y se pasa al siguiente.

### 3.4 Cuadro — `cuadro(t): Llave[]`

1. Con los dos grupos completos, semifinal 1 = `ordenGrupo(A)[0]` contra `ordenGrupo(B)[1]`, y semifinal
   2 = `ordenGrupo(B)[0]` contra `ordenGrupo(A)[1]`.
2. Ganador de la llave:
   - por el partido de la llave;
   - si empata, por su desempate;
   - si este también empata, por los criterios de D5 sobre los dos partidos de la llave, con `detalle`
     (por ejemplo, 3–2 en remates directos).
3. Final: el ganador de la semifinal 1 contra el de la semifinal 2, con la localía de D7.
4. `campeon(t)` = ganador de la final, o `null`.

### 3.5 Significación — `textoSignificacionFormato(t, idioma)`

**Liga.** La frase del 059 con c = 5 cruces y p = 0,0625.

**Grupos.** La misma construcción con c = 4 llaves como máximo por modelo (2 cruces de grupo, la semifinal
y la final), es decir, p = `pSignosBilateral(4, 0)` = **0,125**:

- **ES:** «En una prueba de signos ilustrativa —que supone cruces independientes y una probabilidad de ½ de
  ganar cada uno—, ni ganar sus {c} cruces y llaves alcanzaría p < {alfa} (p = {p}). Este cuadro describe
  este torneo; no ordena los modelos por calidad.»
- **EN:** «In an illustrative sign test — assuming independent ties, each with a ½ chance of winning —
  even winning all {c} pairings and ties would not reach p < {alpha} (p = {p}). This bracket describes
  this tournament; it does not rank the models by quality.»

**Campeón.** Se muestra como «Gana este torneo: {nombre}» / «Wins this tournament: {name}», siempre junto
a esa frase.

## 4. Esquema 062 y validación (`torneo.ts`, `torneo-validacion.ts`)

**Uniones discriminadas por `version`.** `esquemaTorneo` pasa a ser
`z.discriminatedUnion("version", [esquema059, esquema062])`. El archivo del 24 oct (`059-v1.1`) sigue
siendo válido byte a byte. `esquema062`, todo `strictObject`, es el 059 más estos cambios:

```ts
version: "062-v1"; formato: FormatoTorneo; origen: "repositorio" | "sitio";
estado: "completo" | "incompleto" | "en_curso" | "cancelado";
motivoFin: null | "tope" | "infraestructura" | "plazo" | "cancelado" | "desactivado";
enCurso: null | { n: number; local: string; visita: string; inicioUtc: string };    // solo con estado "en_curso"
encuentros: (EncuentroTorneo & { fase: FaseEncuentro; desempate: boolean })[];
```

No se guardan grupos, tablas, cuadro ni campeón: siempre se recalculan (D8 del 059).

**`validarCoherencia`, rama 062.**

*Contra el plan:*

- `encuentros` ∪ `pendientes` son un **prefijo** (por `n`) de `planTorneo(…)` reconstruido con esos mismos
  resultados, y coinciden en `fase`, `desempate`, `jornada`, `cruce`, `vuelta`, `seed`, `local` y `visita`.
- Con `completo`, `siguientePartido` es `null`.
- Con `incompleto` o `cancelado`, `siguientePartido` puede existir (el torneo se detuvo antes de
  terminar) y `enCurso` es `null`.
- Con `en_curso`, el siguiente partido existe y coincide con `enCurso`, o `enCurso` es `null` entre dos
  partidos.

*Estado:*

- `completo` exige `pendientes = []` y `siguientePartido = null`.
- `motivoFin` es `null` en `completo`. Los demás estados, salvo `en_curso`, lo exigen.
- `origen: "sitio"` exige que el id empiece por `sitio-`, y al revés.

*Tipo, participantes y partidos:*

- `tipo: "real"` exige 6 participantes, `duracionS = TORNEO_ARENA.duracionS`, el intervalo del 059 y, si
  `estado = "completo"`, entre `partidosFormato.min` y `partidosFormato.max` encuentros.

*Gasto:*

- La regla del gasto conocido del 059.

**`validarTorneo`, rama 062.** Es la misma iteración del 059, pero `plan[e.n − 1]` sale de `planTorneo`
reconstruido.

**Mutaciones asociadas:** G8 y G11 en § 9.

## 5. Coste, topes y bolsa (cifras)

### 5.1 Típico por formato (µUSD de § 1)

| Formato | Cálculo | Típico |
|---|---|---|
| Liga | 40 decisiones × 176.921 | **7,08 USD** (real del 24 oct: 6,97) |
| Grupos · fase de grupos | 16 decisiones por modelo × 176.921 | 2,83 USD |
| Grupos · eliminatoria, cuatro baratos pasan | semifinales 154.296 + final 21.272 | 0,18 USD |
| Grupos · eliminatoria, cuatro caros pasan (Astra, 6 Sol, 6.1 Sol, mini) | semifinales 686.412 + final Astra–6 Sol 553.388 | 1,24 USD |
| Grupos · tres desempates en el peor caso (se repiten las tres llaves con los mismos pares) | 686.412 + 553.388 | + 1,24 USD |
| **Grupos** | | **≈ 3,0–4,1 USD sin desempates; hasta ≈ 5,3 USD** |

La cifra que Carlos daba («unos 3,5 USD») cae en ese intervalo.

**Lo que muestra la interfaz** es exactamente ese intervalo, calculado por
`estimarFormato(formato, entradas)` a partir de `torneo-sitio-entradas.json`, nunca escrito a mano. Para la
liga: «≈ 7,1 USD». Para grupos: «≈ 3,0–4,1 USD (hasta 5,3 con desempates)».

### 5.2 Tope por estimación por formato

Lógica del 059 § 15.1: antes de cada intento, `conocido + reservaPartido ≤ tope`. La reserva del partido más
caro (Astra contra uno de los Sol) es 7,37 USD.

| Formato | Tope | Comprobación con el típico un 25 % por encima |
|---|---|---|
| Liga | **16 USD** (el del 24 oct) | Antes del último partido de Astra: 6,53 × 1,25 = 8,16, más 7,37 = 15,5 ≤ 16 |
| Grupos | **14 USD** | Antes del desempate de la final en el peor caso: 4,76 × 1,25 = 5,95, más 7,37 = 13,3 ≤ 14 |

- **Los dos cumplen** `≤ TORNEO_ARENA.topeMaxUsd` (20).
- **Una prueba** (§ 9 G9) calcula el máximo típico y la reserva desde las entradas, y exige que
  `tope ≥ típicoMáx − últimoPartido + reservaMáx`.
- **Si la guarda detiene el torneo:** en el sitio no hay nadie que suba el tope, así que el torneo
  **termina** con `estado: "incompleto"` y `motivoFin: "tope"`. Es seguro y se muestra.

### 5.3 Impacto hasta el 10 de noviembre, con el crédito restante (≈ 125 USD)

Si el botón se publica el domingo 25 por la noche (America/Guatemala), el primer día UTC disponible es el
lunes 26. Del 26 oct al 10 nov hay **16 días UTC**.

| Escenario (un torneo cada día) | Típico | Peor caso por estimación (tope × días) |
|---|---|---|
| Liga diaria | 16 × 7,1 ≈ **114 USD** (91 % del crédito restante) | 16 × 16 = **256 USD** (el doble del crédito) |
| Grupos diario | 16 × 3,5 ≈ 56 USD (hasta 16 × 5,3 = 85) | 16 × 14 = 224 USD |

**El peor caso diario lo marca la liga:** ≈ 7,1 USD típicos y 16 USD por estimación. **Sin una bolsa, una
liga diaria se come casi todo el crédito antes del 10 de noviembre**, y eso sin contar:

- el hosting de la réplica siempre encendida;
- los 10 partidos públicos con modelos por día;
- Speech;
- la app de crónicas.

**Decisión: bolsa de 50 USD por estimación** para todos los torneos del sitio. Como el lanzamiento exige
`conocido + tope ≤ 50`, la bolsa admite:

| Formato | Cálculo | Torneos admitidos |
|---|---|---|
| Liga | k × 7,1 + 16 ≤ 50 → k ≤ 4,8 | 5 |
| Grupos | k × 3,5 + 14 ≤ 50 → k ≤ 10,3 | 11 |
| Mezcla | | proporcional |

Con un lanzamiento diario, **la bolsa se agota entre el día 5 y el 11**. Desde entonces el botón dice
«Se agotó el presupuesto de torneos del sitio para este periodo». Así quedan ≈ 75 USD para todo lo demás.

**Dos aclaraciones:**

- **Una sola constante.** Si Carlos prefiere otra cifra, solo cambia `TORNEO_SITIO.bolsaUsd`.
  «Sin bolsa» equivale a ponerla en 256.
- **Lo que mide la bolsa.** Es una **estimación con precio de lista**, no la factura. El control real es la
  facturación de Azure, como en el 059.

### 5.4 Duración mostrada

`duracionMin(formato)` = partidos × (`duracionS` + `pausaEntrePartidosMs`/1000 + `margenValidacionS`), con 60
+ 3 + 2 = 65 s por partido:

| Formato | Sin incidencias | Con 429, enfriamientos y repeticiones | Cómo se muestra |
|---|---|---|---|
| Grupos | 15–18 partidos → **≈ 16–20 min** | hasta ≈ 30 min | rango calculado |
| Liga | 30 partidos → **≈ 33 min** | hasta ≈ 50 min | «≈ 33 min» |

Con incidencias se añade la nota «más si hay reintentos».

## 6. Ejecución en el servidor — `src/arena/torneo-sitio.ts` (solo servidor)

### 6.1 Almacén — `src/arena/almacen-torneos.ts` (nuevo; `almacen.ts` no se toca)

```ts
interface AlmacenTorneos {
  iniciar; leer(nombre): Promise<string>; escribir(nombre, texto, nuevo?: boolean);
  anexar(nombre, texto); listar(): Promise<string[]>; borrar(nombre);
  leerBytes(nombre): Promise<Uint8Array>; escribirBytes(nombre, datos: Uint8Array): Promise<void>;
  bloquear(): Promise<BloqueoAlmacen>;
}
```

**Producción (Blob).**

- Lo de texto, el anexo y el *lease* delegan en `almacenBlob(endpoint, contenedor, "torneos-sitio/")`; el
  *lease* queda en `torneos-sitio/coordinador.lock`, **distinto** del de las sesiones.
- Los bytes usan un `BlockBlobClient` propio con `blobContentType: "application/gzip"`.

**Local.** El directorio `.cache/arena-torneos-sitio/`, con `wx` en `nuevo` y un cerrojo **en memoria por
proceso**: es un solo proceso en local.

**Disposición** (los nombres cumplen `^[a-zA-Z0-9_.-]{1,160}$`):

| Nombre | Contenido | Escritura |
|---|---|---|
| `activo.json` | `{ id, creadoUtc }` | `nuevo: true` (mutex del torneo activo) |
| `dia-AAAA-MM-DD.json` | `{ id, formato, creadoUtc }` (sin IP) | `nuevo: true` (cupo) |
| `<id>.config.json` | id, formato, participantes, semilla, duración, intervalo, motor, commit, tope, típico y `promptMax` | `nuevo: true` |
| `<id>.gasto.ndjson` | libro del 059 § 15.4 (reserva y cierre) | anexo |
| `<id>.eNN.ejecutor.json` y `<id>.eNN.json.gz` | par del 059; el `.gz` es el punto de confirmación | primero el ejecutor y después los bytes |
| `<id>.torneo.json` | instantánea 062 validada, reescrita después de cada partido confirmado, al empezar uno (`enCurso`) y al terminar | sobrescritura (atómica en Blob) |
| `cancelar-<id>.json` | `{ solicitadoUtc }` | la escribe el CLI del operador |

**Retención:** sin borrado. ≈ 3,5 MB por liga; con 16 días, < 60 MB.

### 6.2 Entradas generadas — `src/arena/torneo-sitio-entradas.json`

La imagen no lleva `docs/`, así que el servidor no puede leer la evidencia del 052. El script
`npm run arena:torneo-entradas` (`src/arena/torneo-entradas-cli.ts`) genera un JSON con:

- los 6 `ParticipanteTorneo` del torneo `2026-10-24`, con el precio vigente de `precios.json` (`estimadoDe`
  queda en `null` si existe precio propio);
- `promptMax` y su origen;
- las medias de entrada y salida, y la mediana de latencia por controlador, con la misma lógica que
  `estimarTorneo`.

La función se **extrae** de `estimarTorneo` sin cambiar su salida.

**Comprobación en CI.** `torneo-entradas.test.ts` lo regenera y exige igualdad **byte a byte**. Si cambian
los precios o la evidencia, CI se pone en rojo hasta que se regenera.

**En tiempo de ejecución** se comprueba que cada participante esté en `ARENA_MODELOS`, con su deployment
`${prefijo}AZURE_OPENAI_DEPLOYMENT` igual a `participante.deployment`. Si no, motivo `catalogo`.

### 6.3 Admisión — `POST /api/arena/torneos/sitio`

Las comprobaciones van **en este orden**. Ninguna lee el almacén ni ejecuta nada hasta el paso 4.

1. **Interruptor.** Sin `ARENA_TORNEO_SITIO === "1"`, o sin `CRONISTA_COMMIT` con 7–40 hex: **503**.
2. **Origen.** `Origin` presente e igual al host de la petición, y `content-type: application/json`: si no,
   **403 / 415**. Así un enlace o un formulario ajeno no lanza nada.
3. **Limitador en memoria.** `new Admision(TORNEO_SITIO.admision)`, la clase del 057 sin cambios, con:
   - clave = **último** salto de `x-forwarded-for` (el que añade el ingreso), o `"desconocida"`;
   - 3 intentos por IP y hora, 20 globales por hora y 1 en curso;
   - **429** con `retry-after` si no pasa.
4. **Cuerpo.** Como mucho 1 KB, `{ "formato": "liga" | "grupos" }` estricto: si no, **400**.
5. **Comprobaciones previas, sin efectos:**
   - catálogo y entradas (§ 6.2): **422 `catalogo`**;
   - la bolsa (§ 5.3), con el gasto conocido por `gastoConocido` sobre los libros de los torneos reales:
     **422 `bolsa`**;
   - que el típico del formato quepa en su tope.
6. **`activo.json`** con `nuevo: true`. Si existe: **409 `activo`**.
7. **`dia-<hoy UTC>.json`** con `nuevo: true`. Si existe: se borra el `activo.json` recién creado (es
   nuestro) y se responde **409 `cupo`**.
8. **`<id>.config.json`**, después la primera instantánea `torneo.json` (`en_curso`), arranque del bucle en
   segundo plano (sin `await`) y **202 `{ id }`**.

**Carreras.**

- **Dos clics en la misma réplica:** el limitador tiene `enCurso: 1`.
- **Dos réplicas durante un cambio de revisión:** las creaciones atómicas de los pasos 6 y 7, en ese orden,
  garantizan como mucho un torneo activo y uno por día.
- **Caída entre 6 y 8:** queda un `activo.json` sin `config`. El reconciliador (§ 6.5) lo borra si su
  `creadoUtc` tiene más de 2 min y su `config.json` no existe.

### 6.4 Bucle — `ejecutarTorneoSitio(id)`

Es el bucle del 059 § 15.4 sobre `AlmacenTorneos`, con las piezas del 059 **reutilizadas sin cambiar su
comportamiento en el CLI**: `jugarEncuentro`, `transporteTorneo`, `reservaPartido`, `gastoConocido` y
`validarEncuentro`.

- **Lease.** Al empezar se toma el *lease* de `torneos-sitio/`. Si no se consigue, se reintenta cada 30 s
  durante 5 min (una réplica vieja puede estar terminando) y luego se abandona (queda para el
  reconciliador). Si `vigente()` pasa a `false`, se aborta el partido en curso.
- **Siguiente partido.** `siguientePartido(formato, ids, semilla, resultados)` (§ 3.2). Con `null`, se
  termina.
- **Guarda por partido** (§ 5.2): `conocido + reservaPartido ≤ tope`. Si no se cumple, se termina con
  `incompleto` y `motivoFin: "tope"`.
- **Plazo total.** Pasadas `TORNEO_SITIO.plazoTotalMs` (3 h) desde `inicioUtc`, se termina con `incompleto`
  y `motivoFin: "plazo"`.
- **Intentos por partido.** Como mucho `TORNEO_SITIO.intentosMaxPorPartido` (4) en total, **sumando todas
  las ejecuciones** e incluidos los interrumpidos, contados en el libro. Agotados, el partido queda en
  `pendientes`.
  - En grupos, un pendiente en la fase de grupos termina el torneo al acabar los 12 (§ 3.2).
  - En una llave, un pendiente termina el torneo.
- **Anulaciones seguidas.** Con `anuladosSeguidosMax` (3), se espera `enfriamientoLargoMs` (10 min) **una
  vez**. Si vuelve a pasar, se termina con `incompleto` y `motivoFin: "infraestructura"`.
- **Un partido:**
  - `jugarEncuentro` gana una opción `alPublicar`, aditiva; el CLI no la pasa.
  - Con esa opción se aplica el ritmo de D12.
  - Antes de jugar se escribe la instantánea con `enCurso`.
  - Validado y confirmado el par, se escribe la instantánea sin `enCurso` y con el partido.
  - **Sin revalidación duplicada:** tras escribir, se relee el `.gz` y se compara su SHA-256 con
    `archivoSha256`. La validación completa ya se hizo en `jugarEncuentro`.
- **Final:**
  - instantánea con `completo`, `incompleto` o `cancelado`;
  - `validarTorneo` completo sobre lo escrito, que pasa por todos los registros con un `setImmediate`
    entre partidos;
  - borrado de `activo.json` y liberación del *lease*.
- **Anexo ambiguo.** Si `appendBlock` del libro falla (el ACK puede haberse perdido y el 057 no reintenta),
  esa ejecución se detiene sin cerrar. La reserva abierta cuenta entera al reanudar.
- **Secretos.** Lista del CLI: la clave más los hosts de `AZURE_OPENAI_ENDPOINT`. Un registro con un secreto
  aborta; `ejecutor.json` y `torneo.json` se redactan y se vuelven a detectar.

### 6.5 Reanudación, reinicio y SIGTERM

- **Reconciliador.** `register()` en `src/instrumentation.ts` (solo `nodejs`) programa
  `gestorTorneoSitio().reconciliar()` a los `reconciliacionRetrasoMs` (20 s) con `unref()`. `GET` del
  estado también lo invoca, idempotente y protegido por un indicador en memoria.
- **Con el interruptor encendido y un `activo.json` cuyo torneo no está terminado:** se reanuda con el
  bucle de § 6.4. Los partidos con un par válido no se repiten. Una reserva sin cierre cuenta entera; ese
  partido se juega de nuevo con un intento más.
- **Con el interruptor apagado y un torneo activo:** se toma el *lease* y se termina con `cancelado` y
  `motivoFin: "desactivado"`. No se reanuda.
- **SIGTERM** (cambio de revisión o reinicio). Un manejador `process.once("SIGTERM")` registrado por el
  gestor:
  1. aborta el partido;
  2. cierra el intento como `interrumpido` con el uso conocido;
  3. escribe la instantánea;
  4. libera el *lease*.

  Container Apps da 30 s de gracia. Si no le da tiempo, la reserva abierta cuenta entera y el *lease*
  caduca a los 60 s.
- **Despliegue con un torneo activo.** `scripts/deploy-azure-arena.mjs` consulta
  `GET /api/arena/torneos/sitio` y **se niega** a desplegar si hay un torneo activo, salvo con `--forzar`.
  Ese caso se documenta: se reanuda y cuesta un partido.

### 6.6 Cancelación y apagado (administración)

- **CLI del operador:** `npm run arena:torneo-sitio -- --cancelar <id> | --estado`
  (`src/arena/torneo-sitio-cli.ts`).
  - Usa `almacenTorneos` con `ARENA_BLOB_ENDPOINT` de `.cache/azure-servicios.env` y la credencial
    `credencialAzure()` del operador.
  - `--cancelar` escribe `cancelar-<id>.json`.
- **El bucle** comprueba ese archivo cada `sondeoCancelacionMs` (5 s) durante el partido y antes de cada
  partido. Con cancelación:
  - aborta;
  - cierra el intento como `interrumpido`;
  - termina con `cancelado` y `motivoFin: "cancelado"`;
  - borra `activo.json`.

  **El cupo del día queda consumido.**
- **Alternativa sin RBAC de datos.** Si el operador no tiene «Storage Blob Data Contributor» (se comprueba
  en el smoke, § 11), se usa `az containerapp update -n cronista-arena -g rg-cronista-demo --set-env-vars
  ARENA_TORNEO_SITIO=0`. Crea una revisión nueva y el reconciliador la cancela (§ 6.5).
- **P2:** `--liberar-cupo AAAA-MM-DD` borra `dia-…` solo si no hay ningún torneo activo y el de ese día
  terminó `cancelado` con 0 partidos.

### 6.7 Relación con las sesiones públicas y el límite diario (D10, con cifras)

**Por qué cuenta aparte:**

- **Límite diario.** Contar el torneo dentro de `maxLlmDiarias` (10) agotaría 3 días de partidos públicos
  con una liga (30) y día y medio con grupos (15).
- **Exclusión de un encuentro.** Si el torneo ocupara el único encuentro con modelos simultáneo, ningún
  juez podría jugar un partido en vivo durante 16–33 min.

**Lo que se comparte de verdad son los TPM de los deployments.**

| Uso de un mismo deployment | Cálculo | TPM |
|---|---|---|
| Torneo con ritmo de reloj | 4 decisiones/min × ≈ 9.700 | ≈ 39.000 (×2 en el peor minuto de segundos intentos) |
| Partido público (intervalo de 30 s) | 2 decisiones/min × ≈ 9.700 | ≈ 19.000 |
| Simultáneos con el mismo modelo | | ≈ 58.000 |

Con la capacidad supuesta de ≈ 100.000 TPM (§ 1, a verificar), queda un margen de ≈ 40 %.

**Si aun así llega un 429:**

- en el torneo, el transporte reintenta y, si hace falta, **anula** el partido (059);
- en el partido público, la decisión cae al respaldo programado, como ya ocurre.

**Lo demás:**

- **Voz:** el torneo no usa Speech. Las repeticiones con narración gastan de `SPEECH_DIARIO`, como cualquier
  grabación.
- **CPU:** la réplica tiene 0,5 vCPU. La simulación y una validación por partido (≈ 0,3–1 s de bucle de
  eventos bloqueado) se reparten con el ritmo. El smoke mide el retardo del bucle (§ 11). Pasarlo a un
  `worker_threads` queda en P2.

### 6.8 Rutas (`runtime = "nodejs"`, `dynamic = "force-dynamic"`)

Antes de escribirlas, Opus lee en `node_modules/next/dist/docs/` la guía de *route handlers* y de `params`
como Promesa (CLAUDE.md).

| Ruta | Respuesta |
|---|---|
| `GET /api/arena/torneos/sitio` | `{ habilitado, motivo, diaUtc, proximoCupoUtc, activo: { id } \| null, hoy: { id, formato } \| null, bolsa: { conocidoMicroUsd, bolsaMicroUsd }, formatos: { liga: Ficha, grupos: Ficha } }`, con `Ficha = { partidos: {min,max}, tipicoMicroUsd: {min,max}, topeMicroUsd, duracionMin: {min,max} }`. `motivo ∈ null \| "desactivado" \| "commit" \| "catalogo" \| "activo" \| "cupo" \| "bolsa"`. `no-store` |
| `POST /api/arena/torneos/sitio` | § 6.3 |
| `GET /api/arena/torneos/sitio/[id]` | La instantánea `torneo.json` (esquema y coherencia; si falla, 409 sin cifras). `no-store` con `en_curso` y `max-age=300` en los demás estados. 404 si el id es inválido o no existe. Si no está en el almacén pero sí en `public/torneos` (promovido), sirve ese |
| `GET /api/arena/torneos/sitio/[id]/[archivo]` | `archivo` debe cumplir `^e\d{2}\.json\.gz$` **y** estar en `encuentros` (el nombre sale del manifiesto, nunca de la URL). Bytes con `application/gzip` y `cache-control: public, max-age=86400, immutable`. 404 en otro caso |

**Caché del servidor.**

- La instantánea del torneo activo vive en la memoria del gestor que lo ejecuta.
- Las demás se cachean 60 s.
- `listarTorneosSitio()` hace un `listar()` de `*.torneo.json`, como mucho 1 por día, con caché de 60 s.

## 7. Interfaz (ES/EN, 360 px, accesibilidad y estilo 047/055)

Solo tokens 047/055, clases con el prefijo `arena-torneo-`, ninguna regla existente cambia de selector y
nada de hex en TSX ni en SVG.

### 7.1 `/arena/torneo` (`page.tsx`) y `/arena/torneo/[id]`

**Orden de `<main>`:**

1. barra superior (sin cambios);
2. **panel «Lanzar un torneo»** (§ 7.2);
3. el torneo **activo** si lo hay y, si no, el más reciente de cualquier origen (por `inicioUtc`);
4. la lista «Torneos» (§ 7.5).

**Ids.** `[id]` acepta los ids del repositorio y los `sitio-…`; los segundos se leen con
`gestorTorneoSitio().leer(id)`. Un id desconocido da `notFound()`.

**Rótulo de origen** (D11), visible bajo el h1. La leyenda «†» del ejecutor cambia según el origen: «†
declarado por el CLI» para los del repositorio y «† declarado por el servidor» para los del sitio.

**Estado vacío.** El texto «none can be launched from here» **se sustituye** por «Aún no hay torneos. Puedes
lanzar el primero.» / «No tournaments yet. You can launch the first one.»

### 7.2 Panel de lanzamiento — `src/ui/ArenaTorneoLanzar.tsx` (cliente)

```
<section aria-labelledby="arena-torneo-h-lanzar">
  <h2>Lanzar un torneo</h2>
  <fieldset><legend>Formato</legend>
    (•) Liga · todos contra todos, ida y vuelta — 30 partidos · ≈ 7,1 USD típicos · tope 16 USD · ≈ 33 min
    ( ) Grupos + eliminatoria — 15–18 partidos · ≈ 3,0–4,1 USD (hasta 5,3 con desempates) · tope 14 USD · ≈ 16–20 min
  </fieldset>
  [Iniciar nuevo torneo]   <p id="arena-torneo-motivo">…motivo si está deshabilitado…</p>
  <p class="arena-muted">Un torneo al día (UTC) para todo el sitio. Presupuesto del periodo: {usado} de {bolsa} USD†.</p>
</section>
```

**Cifras.** Todas salen de `GET /api/arena/torneos/sitio` (`Ficha`), **nunca escritas a mano**. Cada radio
tiene su `<label>` y las cifras van en una `<span>` de su descripción.

**Botón deshabilitado.** Es un `disabled` real, con `aria-describedby="arena-torneo-motivo"` y el motivo
**visible**:

| Motivo | ES | EN |
|---|---|---|
| desactivado / commit | Lanzar torneos no está disponible en este momento. | Launching tournaments is not available right now. |
| activo | Hay un torneo en curso; espera a que termine. (enlace «Ver el torneo en curso») | A tournament is in progress; wait for it to finish. (link «Watch the tournament in progress») |
| cupo | Ya se lanzó el torneo de hoy (UTC). El próximo cupo se abre a las 00:00 UTC ({hora local}). | Today's tournament (UTC) has already been launched. The next slot opens at 00:00 UTC ({local time}). |
| bolsa | Se agotó el presupuesto de torneos del sitio para este periodo. | The site's tournament budget for this period is used up. |
| catalogo | Faltan en el catálogo modelos del torneo; no se puede lanzar con los mismos modelos. | Some tournament models are missing from the catalogue; it cannot be launched with the same models. |
| error | No se pudo consultar el estado. [Reintentar] | Could not check the status. [Retry] |

**Confirmación** (en la misma página, sin modal). Al pulsar, el foco va al h3 «Confirmar el torneo de
hoy»:

> «Vas a lanzar el torneo de hoy para todo el sitio: {formato}, {partidos} partidos, ≈ {típico} USD típicos
> (tope por estimación {tope} USD), ≈ {duración} min. Solo hay uno al día (UTC).»

Debajo, [Confirmar e iniciar] y [Cancelar].

- **Con 202:** el foco va al estado del torneo, que se muestra en vivo.
- **Con 409 o 422:** el motivo de la tabla, en `role="alert"`.
- **Con 429:** «Demasiados intentos; espera un momento.»

Mientras la petición está en vuelo, el botón se deshabilita: no hay doble envío.

### 7.3 Progreso en vivo

**P1, por partido:**

- Mientras `estado = "en_curso"`, `GET /api/arena/torneos/sitio/[id]` cada `sondeoUiMs` (15 s), **solo con
  `document.visibilityState === "visible"`**, y sin sondeo cuando termina.
- La interfaz recalcula con funciones puras: tablas, cuadro y lista.
- Bloque «En juego»: «P{n} · {fase} · {club local} ({corto}) – {club visita} ({corto}) · empezó a las {hora}».
- Una región `aria-live="polite"` anuncia **solo** los cambios: «Partido {n} terminado: {local} {gl}–{gv}
  {visita}» y «Torneo terminado».
- Sin animaciones nuevas.

**P2, fino:** marcador por ronda del partido en curso (instantánea por `alPublicar("ronda")`), tiempo
restante estimado y un enlace para ver el partido en curso.

### 7.4 Formato Grupos — `src/ui/ArenaTorneoGrupos.tsx`

**Dos tablas** («Grupo A», «Grupo B»), con las columnas y la accesibilidad de la tabla del 059.

- Una columna final «Pasa» / «Advances» con «Sí (1.º)», «Sí (2.º)» o «No» **en texto**.
- Si hizo falta, debajo va la línea del criterio de D6.

**Dos matrices de 3 × 3.** Las del 059, limitadas al grupo; caben a 360 px.

**Cuadro de eliminatoria** como `<ol className="arena-torneo-cuadro">`:

- **Semifinales**, dos tarjetas `<li>`, y **Final**, una tarjeta.
- Cada tarjeta:
  - «{1.º A} ({corto}) {gl}–{gv} {2.º B} ({corto})», con enlace «Ver repetición»;
  - si hubo desempate, «Desempate, lados invertidos: …» con su enlace;
  - si decidió un criterio: «Pasa {nombre} por remates directos (3–2) · criterio del torneo, no
    reglamentario», o «… por sorteo (semilla)»;
  - las pendientes, «Por jugar»; la que está en curso, «En juego».
- A ≤ 520 px las tarjetas se apilan en vertical. Por encima, semifinales en dos columnas y la final debajo,
  con CSS grid y sin líneas SVG decorativas.

**Debajo del cuadro:**

- «Gana este torneo: {nombre}», junto a la frase de § 3.5;
- partidos por fase (lista accesible principal), con «Ver repetición» y «Descargar registro».

### 7.5 Lista «Torneos»

`<section>`, con un h2 «Torneos» y dos h3:

- «Archivados en el repositorio · validados en CI»;
- «Lanzados en el sitio · validados en el servidor».

**Cada elemento:** fecha, formato, estado y el primero o el campeón. Ejemplo: «24 oct · Liga · completo ·
1.º GPT-6 Astra». Enlaza `/arena/torneo/<id>` (con `?lang=es`).

**Promovido:** aparece una sola vez, en «Archivados», con su rótulo.

### 7.6 Repeticiones

**`torneo-carga.ts`:**

- Si `torneo` empieza por `TORNEO_SITIO.prefijoId`, la base es `/api/arena/torneos/sitio/<id>`
  (`torneo.json` → la ruta `[id]` y `eNN.json.gz` → la ruta `[archivo]`). Si no, la base sigue siendo
  `/torneos/<id>`.
- Las comprobaciones existentes no cambian: esquema (ahora con la unión), coherencia, SHA-256, semilla,
  clubes y controladores.

**`Arena.tsx`:** no se toca. «Reproducir con narración» usa la rama `{ registro }` del 057 (procedencia
«declarada»), como en el 059.

### 7.7 Textos ES/EN (lista cerrada; junto a `TEXTOS_TORNEO`)

| Clave | ES | EN |
|---|---|---|
| lanzar | Lanzar un torneo | Launch a tournament |
| formato | Formato | Format |
| liga | Liga · todos contra todos, ida y vuelta | League · double round robin |
| grupos | Grupos + eliminatoria | Groups + knockout |
| iniciar | Iniciar nuevo torneo | Start new tournament |
| confirmarH | Confirmar el torneo de hoy | Confirm today's tournament |
| confirmar | Confirmar e iniciar | Confirm and start |
| cancelar | Cancelar | Cancel |
| cupoNota | Un torneo al día (UTC) para todo el sitio. | One tournament per day (UTC) for the whole site. |
| bolsaNota | Presupuesto del periodo: {u} de {b} USD † | Period budget: {u} of {b} USD † |
| enJuego | En juego | In play |
| porJugar | Por jugar | To be played |
| grupo | Grupo {G} | Group {G} |
| pasa | Pasa | Advances |
| semifinales / final | Semifinales / Final | Semi-finals / Final |
| desempate | Desempate, lados invertidos | Play-off, sides swapped |
| criterio | criterio del torneo, no reglamentario | tournament criterion, not a football rule |
| sorteo | sorteo (semilla) | draw (seed) |
| gana | Gana este torneo: {nombre} | Wins this tournament: {name} |
| origenRepo / origenSitio / origenPromovido | los rótulos de D11 | the D11 labels |
| motivos | los de § 7.2 | the § 7.2 ones |
| torneos / archivados / lanzados | Torneos / Archivados en el repositorio · validados en CI / Lanzados en el sitio · validados en el servidor | Tournaments / Archived in the repository · validated in CI / Launched on the site · validated on the server |
| incompletoMotivo | Torneo incompleto ({motivo}): {k} partidos sin disputar | Incomplete tournament ({reason}): {k} matches not played |
| cancelado | Torneo cancelado por el operador | Tournament cancelled by the operator |

**Motivos de `incompletoMotivo`:**

- tope → «se alcanzó el tope por estimación» / «estimated cap reached»;
- infraestructura → «fallos repetidos de la infraestructura» / «repeated infrastructure failures»;
- plazo → «se agotó el plazo de 3 h» / «3 h time limit reached».

### 7.8 360 px, contraste y teclado

**360 px:**

- `scrollWidth ≤ 360` en claro, oscuro, ES y EN, en ambos formatos y en el panel de lanzamiento.
- Las tablas de grupo, las matrices 3 × 3 y el cuadro, **sin contenedor desplazable**.
- Solo la tabla de métricas se desplaza, como en el 059.

**Contraste:** ≥ 4,5 en texto y ≥ 3 en el foco, medidos por estilos calculados, con la fórmula de
`docs/evidencia/rediseno-047/contraste.mjs`.

**Teclado:** Tab recorre los radios, el botón, la confirmación, los enlaces del cuadro y la lista, con el foco
visible.

## 8. Constantes — `src/sim/limites.ts`, comentadas, **al final del archivo** tras `TORNEO_ARENA`

Van al final para no chocar con el 060.

```ts
/** Brief 062 · Torneo lanzable desde el sitio (cualquier visitante): un cupo global por día UTC, un torneo
 * activo, tope por estimación por formato y una bolsa del periodo. Reutiliza las reservas del 059. */
export const TORNEO_SITIO = {
  version: "062-v1",
  /** Espacio de nombres de los ids del sitio (`sitio-AAAA-MM-DD`); el CLI lo rechaza. */
  prefijoId: "sitio-",
  /** Un lanzamiento por día UTC en todo el sitio, sea cual sea el formato. */
  cupoDiario: 1,
  formatos: {
    /** Liga = 059 (Berger de 6, ida y vuelta). Tope del 24 oct: típico + reserva del partido más caro. */
    liga: { topeUsd: 16 },
    /** 2 grupos de 3 a ida y vuelta, pasan 2, llaves a partido único y como mucho 1 desempate por llave. */
    grupos: { grupos: 2, porGrupo: 3, pasanPorGrupo: 2, desempatesPorLlave: 1, topeUsd: 14 },
  },
  /** Salvaguarda del crédito (§ 5.3): conocido acumulado + tope del formato ≤ bolsa. Estimación, no factura. */
  bolsaUsd: 50,
  /** Admisión en memoria (clase del 057): por IP (último salto de x-forwarded-for) y global. */
  admision: { porIpPorHora: 3, globalPorHora: 20, enCurso: 1, ventanaMs: 3_600_000, cuerpoMaxBytes: 1_024 },
  /** Cada ronda dura al menos su intervalo de reloj: ≈ 4 decisiones por minuto y deployment. */
  ritmoReal: true,
  /** Intentos de un partido sumando todas las ejecuciones (incluidos interrumpidos). */
  intentosMaxPorPartido: 4,
  plazoTotalMs: 10_800_000, enfriamientoLargoMs: 600_000,
  sondeoCancelacionMs: 5_000, sondeoUiMs: 15_000, reconciliacionRetrasoMs: 20_000,
  /** Solo para la duración mostrada: segundos por partido además de duración y pausa. */
  margenValidacionS: 2,
} as const;
```

**Reglas:**

- Ninguna prueba repite estas cifras a mano: importan `TORNEO_SITIO`, `TORNEO_ARENA` y `ARENA`.
- Las pruebas con **valores literales calculados a mano** (fixtures de clasificación y de cuadro, µUSD de
  § 5.1) se permiten, como en el 059 § 15.9, porque comprueban el cálculo, no repiten un umbral.

**Variables de entorno nuevas:**

| Variable | Valores | Dónde |
|---|---|---|
| `ARENA_TORNEO_SITIO` | `"1"` para habilitar | bicep: `1` |
| `CRONISTA_COMMIT` | sha del despliegue | bicep, parámetro `commit`, desde `git rev-parse HEAD` en el script, que **se niega** con el árbol sucio |
| `ARENA_TORNEO_SITIO_ENSAYO` | `"1"`: participantes de ensayo `a`–`f`, tipo `ensayo` | **nunca** en bicep (lo prueba un test); el servidor lo rechaza si `ARENA_BLOB_ENDPOINT` está definido |
| `ARENA_TORNEO_SITIO_SEGUNDOS` | duración del ensayo, 10–60 | solo en e2e |
| `ARENA_TORNEO_SITIO_SIN_RITMO` | `"1"` | solo en e2e |
| `ARENA_TORNEOS_SITIO_DIR` | almacén local | e2e |

## 9. Pruebas (vitest) con mutaciones que deben fallar

Cada mutación se aplica, se ve en rojo y se revierte, y se anota con el md5 del archivo mutado en
`docs/evidencia/torneo-062/mutaciones.md`.

**Archivos:**

- `torneo-formatos.test.ts` (puras);
- `torneo-sitio.test.ts` (gestor con un almacén falso en memoria y atómico, `fetch` falso y LLM falso o
  programado, reloj controlado);
- `torneo-sitio-rutas.test.ts`;
- `torneo-entradas.test.ts`;
- `ArenaTorneoLanzar.test.tsx` y `ArenaTorneoGrupos.test.tsx`;
- y añadidos a `torneos-archivados.test.ts` (fixture del sitio).

**Fixtures:**

- tres torneos de grupos construidos a mano, en TS: sin empates; con un grupo de tres 0–0 resuelto por
  remates directos y luego por sorteo; y con las tres llaves en desempate, una resuelta por remates, otra
  por coeficiente y otra por sorteo;
- el fixture del sitio, `src/arena/__fixtures__/torneos-sitio/`: una liga y unos grupos de **ensayo**
  generados por el gestor en modo ensayo con `npm run arena:torneo-sitio -- --fixture`, documentado en el
  generador.

| # | Prueba | Mutación que la pone en rojo |
|---|---|---|
| G1 | `sorteoGrupos`: 3 + 3, los 6 usados, determinista, independiente del orden de entrada; las 10 particiones aparecen con las semillas 0–999 | sin barajar; barajar el orden de entrada |
| G2 | Plan de grupos: tabla intercalada literal de D4 (fase, local y visita por índice); cada pareja juega dos veces, con los lados invertidos y la misma semilla; semillas únicas en el torneo | `semillasCruce` por grupo con colisión inyectada; vuelta sin invertir |
| G3 | `clasificarGrupo` usa solo los partidos de su grupo | clasificar con los 12 |
| G4 | `ordenGrupo`: los desempates del 059 primero; después remates directos, remates y sorteo, solo en las clases que cruzan el corte; criterio devuelto; `null` ⇒ criterio siguiente | alfabético para pasar; posesión como criterio; sorteo antes que remates |
| G5 | Cuadro: semifinal 1 = 1A–2B, semifinal 2 = 1B–2A, el 1.º de local; final con el ganador de la semifinal 1 de local | 1A–2A; 2.º de local |
| G6 | Llave empatada ⇒ desempate con la misma semilla y los lados invertidos; desempate ganado ⇒ pasa; desempate empatado ⇒ remates directos, remates, coeficiente y sorteo **sobre los dos partidos**; nunca un segundo desempate | semilla nueva; sin invertir; criterios solo del desempate; desempates sin límite; sorteo antes que coeficiente |
| G7 | `planTorneo`/`siguientePartido`: liga = `calendarioTorneo`; grupos 12 → 13 = semifinal 1…; un pendiente en grupos ⇒ sin cuadro; numeración 15–18 | cuadro con un grupo incompleto |
| G8 | `validarCoherencia` 062: cuadro que contradice los grupos (2A en vez de 2B), desempate ausente tras un empate, `fase` o `desempate` cambiados, `enCurso` con un estado final, `sitio-` con `origen: "repositorio"` ⇒ incoherente; el archivo `059-v1.1` del 24 oct sigue válido | omitir la reconstrucción del plan; aceptar `formato` en un 059 |
| G9 | `estimarFormato` con las entradas reales: liga 7.076.840 µUSD; grupos con mínimo, máximo sin desempates y máximo con desempates iguales a § 5.1 (valores literales a mano); `tope ≥ típicoMáx − último + reservaMáx` en los dos formatos | estimar grupos sin desempates; tope de grupos por debajo de la reserva |
| G10 | `textoSignificacionFormato`: liga p = 0,0625 y grupos p = 0,125, calculadas | c = n − 1 en grupos |
| G11 | `validarTorneo` 062 sobre el fixture del sitio: cada `.gz` pasa `validarEncuentro` | alterar un gol de una llave; intercambiar los lados de un desempate |
| S1 | **Admisión concurrente:** `Promise.all` de dos `lanzar` en el mismo gestor ⇒ 1 × 202 y 1 × 429/409; **dos gestores** (dos réplicas) sobre el mismo almacén ⇒ exactamente un torneo y un `dia-` | `escribir` sin `nuevo`; crear `dia-` antes que `activo` sin deshacer |
| S2 | Día UTC: lanzar a las 23:59:59Z, terminar y lanzar a las 00:00:01Z del día siguiente ⇒ admitido; un segundo lanzamiento el mismo día, aunque el primero haya terminado ⇒ 409 `cupo` | día en America/Guatemala; ventana de 24 h deslizante |
| S3 | Con un torneo activo y el día cambiado ⇒ 409 `activo` | sin mutex de activo |
| S4 | Limitador: clave = último salto de XFF; un primer salto falsificado no cambia la clave; 4.º intento por hora ⇒ 429 | primer salto |
| S5 | Origen ajeno ⇒ 403; sin JSON ⇒ 415; cuerpo > 1 KB ⇒ 400; interruptor apagado ⇒ 503; sin `CRONISTA_COMMIT` ⇒ 503; y **ninguno** de esos casos lee el almacén (contador del almacén falso = 0) | leer el almacén antes del interruptor |
| S6 | **Reanudación tras un reinicio:** se «mata» el gestor durante P7 (sin cerrar), un gestor nuevo sobre el mismo almacén reanuda; P1–P6 no se repiten (contador del `fetch` falso), P7 se juega como intento 2, la reserva abierta cuenta entera y el `torneo.json` final pasa `validarTorneo` | rejugar los completos; ignorar la reserva abierta |
| S7 | *Lease*: un segundo gestor no ejecuta mientras el primero lo tiene; al caducar, reanuda; `vigente() = false` aborta el partido | sin comprobar el *lease* |
| S8 | **Tope:** con uso falso inflado, el partido cuya reserva no cabe **no empieza** (`fetch` = 0 en ese partido), con `incompleto` y `motivoFin: "tope"`, en los dos formatos | guarda con el típico |
| S9 | **Bolsa:** conocido acumulado + tope > bolsa ⇒ 422 `bolsa`; los ensayos no cuentan | bolsa con el típico; contar los ensayos |
| S10 | **Cancelación:** `cancelar-<id>.json` ⇒ aborta en ≤ `sondeoCancelacionMs` (reloj falso), cierre `interrumpido`, `cancelado`, `activo.json` borrado y cupo consumido | comprobar solo entre partidos |
| S11 | Un `.gz` corrupto en el almacén al reanudar ⇒ se borra el par y se rejuega (059 N9) | darlo por hecho sin validar |
| S12 | Interruptor apagado con un torneo activo ⇒ el reconciliador lo termina `cancelado` / `desactivado` y no llama a `fetch` | reanudar con el interruptor apagado |
| S13 | `intentosMaxPorPartido` sumado entre ejecuciones ⇒ pendiente; `plazoTotalMs` ⇒ `motivoFin: "plazo"` | contar los intentos por ejecución |
| S14 | **Ritmo:** cada ronda dura ≥ `intervaloS` de reloj falso y `tiempoMs` de cada decisión es la latencia del controlador falso (sin la espera) | sin ritmo; esperar dentro de `decidir` |
| S15 | **Independencia de las sesiones:** después de un torneo, `GestorSesiones.crear` con modelos sigue admitido con `usados = 0` y el prefijo `sesiones/` no tiene archivos nuevos | escribir `meta.json` en `sesiones/` |
| S16 | **SIGTERM** (emitido en la prueba): cierre `interrumpido`, instantánea escrita y *lease* liberado | sin manejador |
| S17 | Los dos formatos **completos** con el gestor en ensayo: liga (30 partidos) y grupos con un desempate forzado (controlador programado que no remata en esa llave), con el `torneo.json` final válido | — (caso de control) |
| R1 | Rutas: `[archivo]` fuera del manifiesto (`..`, `e7`, `e99.json.gz`, `torneo.json`) ⇒ 404; bytes con SHA-256 igual a `archivoSha256`; `[id]` inválido o inexistente ⇒ 404; `en_curso` con `no-store` | archivo desde la URL |
| R2 | `torneo-entradas.json` regenerado igual byte a byte; `estimarTorneo` del 059 con la misma salida (el ensayo en seco del 24 oct reproduce `estimacion.json`) | redondeo distinto |
| R3 | `infra/arena-preview.bicep` no define `ARENA_TORNEO_SITIO_ENSAYO` ni `ARENA_TORNEO_SITIO_SIN_RITMO`; el gestor rechaza el ensayo con `ARENA_BLOB_ENDPOINT` | ensayo admitido con Blob |
| R4 | `torneo-cli.ts --id sitio-x` ⇒ rechazo | aceptar el prefijo |
| U1 | Render: panel con las cifras de `Ficha` (no literales), botón `disabled` con su motivo visible en los 6 casos, rótulos de origen, «Pasa» en texto, criterio y «sorteo» visibles, «Gana este torneo» junto a la frase de significación, `aria-live` solo con cambios | cifras fijas; quitar el rótulo de origen; «Pasa» solo con color |

## 10. E2E — `e2e/arena-torneo-sitio.spec.ts` (sin IA)

**Configuración del servidor de e2e** (`playwright.config.ts`, en `env`):

- `ARENA_TORNEO_SITIO=1`, `CRONISTA_COMMIT=<sha del HEAD>`, `ARENA_TORNEO_SITIO_ENSAYO=1`;
- `ARENA_TORNEO_SITIO_SEGUNDOS=10`, `ARENA_TORNEO_SITIO_SIN_RITMO=1`;
- `ARENA_TORNEOS_SITIO_DIR=.cache/e2e/torneos-sitio`.

`scripts/e2e-torneos.mjs` **vacía** ese directorio y lo siembra con el fixture del sitio, fechado en días
pasados, sin `dia-` de hoy.

**Lo que no cambia:** ningún e2e existente. Las únicas excepciones son los textos que § 7.1 sustituye
(estado vacío) en `arena-torneo.spec.ts`, y la lista cerrada de esos cambios va en el commit.

1. **Lista y formatos.** `/arena/torneo` muestra «Torneos» con las dos secciones, y el fixture de liga y el
   de grupos con el rótulo «Launched on the site · validated on the server». El panel muestra las cifras de
   los dos formatos, iguales a `GET /api/arena/torneos/sitio` (comparadas en la prueba).
2. **Lanzar grupos.** Se elige «Groups + knockout», se pulsa, se confirma, el `POST` es 202 y aparece «In
   play».
   - Termina en ≤ 90 s: con 15–18 partidos de 10 s, sin ritmo, deben bastar.
   - Al terminar: dos tablas con «Advances», un cuadro con 2 semifinales y la final, y «Wins this
     tournament».
   - Como la semilla cambia con el día, las filas no pueden ser literales. La prueba las compara con
     `clasificarGrupo` y `ordenGrupo`, importados y aplicados al `torneo.json` servido. Es una excepción
     declarada: la comparación con valores literales calculados a mano está en G4 y G5.
3. **Repetición.** «Watch replay» de una semifinal abre `/arena?torneo=sitio-…&encuentro=13`. El marcador
   coincide y aparece la línea de procedencia con «Back to the tournament». Reproducir mueve el balón.
4. **Cupo.** Se recarga: el botón está `disabled` con el motivo «Today's tournament (UTC) has already been
   launched…». Un `POST` directo da 409 `cupo`.
5. **Origen.** Un `POST` con `Origin: https://evil.example` da 403.
6. **Idioma.** El botón de idioma cambia los textos de § 7.7, y `?lang=es` arranca en español.
7. **360 px.** En claro y oscuro, ES y EN: `scrollWidth ≤ 360` en el panel, en el torneo de grupos y en la
   liga del fixture. Las tablas de grupo, las matrices y el cuadro no están dentro de un contenedor
   desplazable.
8. **Contraste y teclado** (§ 7.8).
9. **Regresión.** El resto de la suite de arena y `arena-torneo.spec.ts` siguen en verde.

## 11. Despliegue y smoke público

**Despliegue.**

- `infra/arena-preview.bicep` recibe el parámetro `commit`, que se pasa como `CRONISTA_COMMIT`, y
  `ARENA_TORNEO_SITIO=1`.
- `scripts/deploy-azure-arena.mjs` pasa `git rev-parse HEAD`, se niega con el árbol sucio y se niega con un
  torneo activo (§ 6.5).
- Solo se despliega desde un commit con CI en verde.

**Smoke** (con la evidencia en `docs/evidencia/torneo-062/publicacion/`):

1. **TPM.** `az … deployment show … rateLimits` de los 6 deployments, anotado. Si la capacidad real es
   menor que la supuesta, se recalcula § 6.7 y se avisa a Carlos antes de seguir.
2. **Grupos real** lanzado desde el sitio, con el visto bueno de Carlos a las cifras del panel. Se anotan:
   - la duración;
   - el gasto conocido (≈ 3–5 USD), que tiene que ser menor o igual que el tope;
   - los anulados;
   - el retardo del bucle de eventos durante el torneo: `monitorEventLoopDelay` p50, p99 y máximo, expuesto
     **solo** en el registro del servidor;
   - y que un partido público en vivo, jugado a la vez, sigue funcionando.
3. **Otro lanzamiento el mismo día:** 409 `cupo`.
4. **XFF falsificado:** el limitador usa el último salto.
5. **Cancelación:** antes del lanzamiento real, `--smoke-cancelacion` comprueba el permiso de escritura
   del operador. Escribe, relee y borra `cancelar-sitio-sin-torneo.json`, un id que no existe y que el
   bucle ignora. No toca `activo`, `config` ni `dia-`, no gasta el cupo y no ejecuta ningún ensayo con
   Blob (R3). Si el RBAC falla, se documenta y queda como único camino el interruptor (§ 6.6).
6. **Repetición** de un partido del torneo con «Reproducir con narración» y Speech real, con captura.

## 12. Prioridades, calendario y estimación

**P1** (lo que Carlos llamó «lanzar, ejecutar, persistir y mostrar la clasificación y el cuadro»):

- § 3 completo (los dos formatos);
- § 4;
- § 5 (estimación, topes y bolsa);
- § 6.1–6.8 menos el P2 de § 6.6;
- § 7.1, § 7.2, § 7.3 P1 (sondeo por partido), § 7.4, § 7.5–7.8;
- § 8;
- las pruebas de § 9;
- el e2e 1–5 y 7;
- el despliegue y el smoke 1–5.

**P2, en este orden:**

1. progreso fino (§ 7.3 P2);
2. promoción al repositorio (D11);
3. `--liberar-cupo`;
4. métricas por modelo y procedencia completa en el formato grupos (la liga reutiliza las del 059);
5. e2e 6 y 8 completos (en P1 solo el botón de idioma y el contraste de la banda nueva);
6. `worker_threads` para la validación;
7. smoke 6 con captura.

**Estimación** (horas de agente):

| Tarea | Horas |
|---|---|
| Revisión de Codex del brief y v1.1 | 1 |
| Puras: formatos, esquema 062, coherencia, estimación y fixtures a mano, con pruebas y mutaciones | 4 |
| Entradas generadas y su prueba de CI | 0,5 |
| `almacen-torneos.ts` (texto, bytes y *lease*) | 1 |
| Gestor: admisión, bucle, ritmo, tope, bolsa, reanudación, SIGTERM, cancelación y reconciliador, con S1–S17 | 6 |
| Rutas, `torneo-carga.ts`, `torneo-archivo.ts` y páginas | 2 |
| Interfaz: panel, grupos y cuadro, lista, rótulos, sondeo y CSS | 4,5 |
| Fixture del sitio y e2e | 2,5 |
| Infra: bicep, commit y script de despliegue | 0,5 |
| Revisión de Codex de la implementación y correcciones | 3 |
| Despliegue, smoke y torneo real (≈ 20 min de reloj) | 1,5 |
| **Total P1** | **≈ 26,5 h** |
| P2 | ≈ 5 h |

**Calendario** (America/Guatemala; hoy es sábado 24 a las 00:20; el 060 y el 061 compiten por el mismo
tiempo):

| Día | Trabajo |
|---|---|
| **Sáb 24** | Por la mañana, Codex revisa el brief → v1.1. A partir de ahí, Opus: puras, entradas, almacén y gestor con S1–S17. **Corte a las 20:00:** el gestor con los dos formatos en ensayo en verde (S17); si no, se escala a Carlos. |
| **Dom 25** | Por la mañana, rutas, carga, páginas e interfaz. **13:00:** e2e. **15:00:** Codex revisa la implementación y se corrige. **19:00, corte duro:** si P1 no está en verde, se despliega con `ARENA_TORNEO_SITIO=0` (el código queda apagado y la página muestra «no disponible») y se documenta. Si está en verde, despliegue y smoke con el torneo real de grupos antes de las 23:00. Nota: a partir de las 18:00 de Guatemala ya es el 26 en UTC, así que el torneo real consume el cupo de ese día. |
| **Lun 26** | Entrega. Del 062 solo se toca el interruptor si algo falla en producción. |

**¿Cabe?**

- **Con un implementador dedicado desde el sábado por la mañana**, P1 (≈ 26,5 h) cabe **justo** en sábado
  y domingo, con una sola ronda de revisión. **No queda margen para P2.**
- **Con el 060 y el 061 compitiendo por el mismo implementador, no cabe.** Si ese es el caso, propongo
  este recorte, ya decidido (≈ 20 h):
  1. **sin sondeo:** la página tiene un botón «Actualizar» y el bloque «En juego» (−1 h);
  2. **sin matrices de grupo:** las tablas y la lista de partidos dan todo el acceso (−1 h);
  3. **lista «Torneos» simple:** una sola lista con el rótulo de origen en cada elemento (−0,5 h);
  4. **e2e reducido a 2, 3, 4 y 7** (−1,5 h);
  5. **smoke solo 2, 3 y 5;** el retardo del bucle de eventos se mide en local (−0,5 h);
  6. **sin `--smoke-cancelacion`:** la cancelación en producción queda solo con el interruptor (−0,5 h);
  7. **ensayo con 6 participantes en el fixture del sitio solo para grupos;** la liga del sitio se cubre con
     S17 (−0,5 h).

  **Lo que nunca se recorta:** la admisión atómica, la bolsa, el tope, la validación por partido, los
  rótulos de origen, la frase de significación ni el interruptor.

## 13. Criterios de aceptación (todos vistos correr)

1. `npm test` en verde, con G1–G11, S1–S17, R1–R4 y U1 vistas en rojo al mutar.
2. `npm run typecheck` en verde.
3. `npm run e2e` completo en verde.
4. El archivo `public/torneos/2026-10-24/torneo.json` no cambia y sigue pasando CI.
5. `npm run arena:torneo-entradas` regenera el JSON idéntico.
6. **En público:**
   - el panel muestra las cifras de los dos formatos;
   - un torneo de grupos real lanzado desde el sitio termina con su clasificación y su cuadro;
   - el gasto conocido es menor o igual que 14 USD y queda anotado;
   - un segundo lanzamiento el mismo día da 409;
   - un partido del torneo se abre en `/arena` y se reproduce;
   - `GET /api/arena/torneos/sitio/<id>/e99.json.gz` da 404.
7. Filas en BITACORA por la implementación y por el despliegue, con:
   - el gasto real;
   - la capacidad TPM medida;
   - el retardo del bucle de eventos;
   - las deudas nuevas, entre ellas la bolsa y la proyección de crédito actualizada.

## 14. Fuera de alcance

- Elegir los participantes, la semilla, la duración o el intervalo desde el sitio.
- Más de 6 participantes, otros formatos o grupos de 4.
- Penaltis, prórroga y gol de visitante.
- Narrador o mesa LLM durante el torneo.
- Precalcular voz.
- ELO, rankings o «mejor modelo».
- Cuentas de usuario, captcha o pagos.
- Fabric, AKS u otros idiomas.
- Cambios en el motor, el prompt, el esfuerzo, el límite diario público, los presupuestos de voz,
  `sesiones.ts`, `almacen.ts` o `Arena.tsx`.

## 15. Límites honestos y riesgos

**Límites que la página declara:**

- **Pocos partidos.** Grupos da 4 llaves por modelo como máximo (p mínima 0,125) y la liga 5 cruces (p
  mínima 0,0625). El cuadro y la tabla describen este torneo.
- **Criterios de desempate.** Remates directos, remates, coeficiente y sorteo son **criterios del torneo,
  no reglamento**. El sorteo existe para que siempre haya un ganador.
- **Validado en el servidor, no en CI.** La identidad del modelo, los tokens y el coste los declara el
  servidor, y el registro se puede descargar y reproducir.
- **Tope y bolsa.** Son **estimaciones** con precio de lista. El consumo de una petición cortada es
  invisible: se cuenta su máximo. El control real es la facturación de Azure.
- **Cupo global.** Lo consume quien llegue primero en el día UTC. Una persona puede lanzar todos los días a
  las 00:00 UTC, y eso es justo lo que Carlos decidió: cualquiera puede lanzar.
- **Un reinicio cuesta un partido.** El partido interrumpido cuenta su reserva entera y se repite.
- **Lo que hereda del 059:** motor sintético, el mismo prompt y esfuerzo para todos, latencias dependientes
  de la carga y versiones fijadas.

**Riesgos:**

- **Crédito.** Sin la bolsa, una liga diaria se lleva ≈ 114 USD de los ≈ 125 hasta el 10 nov. Con la
  bolsa, ≤ 50 USD por estimación. **Recomiendo que Carlos confirme el valor de la bolsa antes del
  despliegue.**
- **TPM compartidos.** Si la capacidad real es menor que 100.000 TPM, habrá más 429: partidos anulados en el
  torneo y respaldos en los partidos públicos. El ritmo de reloj lo mitiga y el smoke 1 lo mide.
- **CPU en 0,5 vCPU.** La validación bloquea el bucle de eventos ≈ 0,3–1 s por partido, y puede notarse en
  el SSE y en la voz de un espectador. Se mide; el *worker* queda en P2.
- **Despliegues durante un torneo.** `Single revision` reinicia la réplica. El script se niega salvo con
  `--forzar`; si se fuerza, se reanuda.
- **Ramas en paralelo.** El 060 puede tocar `limites.ts`, el bicep o el catálogo:
  - las constantes van al final del archivo;
  - el catálogo se comprueba en tiempo de ejecución, con el motivo `catalogo`;
  - el bicep solo gana el parámetro `commit` y una variable.
- **RBAC del operador** para cancelar por Blob, sin verificar. Hay alternativa: el interruptor.
- **Después de la entrega.** No está claro si se puede desplegar después del 26. El 062 tiene que estar
  publicado el domingo 25 por la noche o quedar apagado.
- **Resultado incómodo.** Un modelo barato puede ganar el torneo. Se publica igual.

## 16. Archivos

**Nuevos:**

- `src/arena/torneo-formatos.ts`
- `src/arena/torneo-sitio.ts`
- `src/arena/almacen-torneos.ts`
- `src/arena/torneo-sitio-entradas.json`
- `src/arena/torneo-entradas-cli.ts`
- `src/arena/torneo-sitio-cli.ts`
- `src/app/api/arena/torneos/sitio/route.ts`
- `src/app/api/arena/torneos/sitio/[id]/route.ts`
- `src/app/api/arena/torneos/sitio/[id]/[archivo]/route.ts`
- `src/ui/ArenaTorneoLanzar.tsx`
- `src/ui/ArenaTorneoGrupos.tsx`
- `src/arena/__fixtures__/torneos-sitio/`
- las pruebas de § 9
- `e2e/arena-torneo-sitio.spec.ts`
- `docs/evidencia/torneo-062/`

**Modificados:**

| Archivo | Cambio |
|---|---|
| `src/arena/torneo.ts` | unión de esquemas y rama de coherencia 062 |
| `src/arena/torneo-validacion.ts` | `validarTorneo` 062 |
| `src/arena/torneo-ejecucion.ts` | `alPublicar` opcional en `jugarEncuentro` y extracción de la estimación, sin cambiar el CLI |
| `src/arena/torneo-cli.ts` | rechazo del prefijo `sitio-` |
| `src/arena/torneo-archivo.ts` | lista de los dos orígenes |
| `src/ui/torneo-carga.ts` | base de la URL según el prefijo del id |
| `src/ui/ArenaTorneo.tsx` | rótulo de origen, estado vacío, formato y lista |
| `src/app/arena/torneo/page.tsx` y `[id]/page.tsx` | |
| `src/sim/limites.ts` | `TORNEO_SITIO`, al final |
| `src/instrumentation.ts` | reconciliador |
| `src/app/globals.css` | solo reglas `arena-torneo-*` nuevas |
| `infra/arena-preview.bicep` | |
| `scripts/deploy-azure-arena.mjs` | |
| `playwright.config.ts` y `scripts/e2e-torneos.mjs` | |
| `package.json` | scripts `arena:torneo-entradas`, `arena:torneo-sitio` y `arena:torneo-promover` (P2) |

**No se tocan** (060 y 061, y reglas del 059):

- `src/ui/Arena.tsx`, `ArenaEnDirecto.tsx`, `ArenaEmisionBuffer.tsx` y `ArenaNarracion.tsx`;
- `src/arena/sesiones.ts`, `almacen.ts`, `admision.ts` (se reutiliza la clase), `motor.ts`,
  `coordinador.ts`, `controladores.ts` y `protocolo.ts`;
- los textos y los `data-testid` existentes de la arena, salvo los de § 7.1.

**Commits:** nunca con `git add -A` mientras haya implementadores trabajando en paralelo. Se añade cada
archivo de la lista por su nombre.

## 17. Versión 1.1 (24 oct): simplificación tras la revisión de Codex — PREVALECE

Codex dio la v1.0 por **NO CERRADO** (informe en el scratchpad de la sesión, `codex-062-brief.md`). He
comprobado los 13 hallazgos contra el código y los acepto todos. El coordinador decidió en nombre de Carlos
**simplificar** la arquitectura para que quepa. Esta sección **sustituye**:

- § 6.1 (*lease* y `activo.json`), § 6.3 (orden de admisión), § 6.5 (reanudación) y § 6.6 (cancelación por
  archivo y CLI);
- las cifras de § 6.7;
- el intervalo de § 2 D12 y § 5 (§ 17.5);
- las pruebas S1, S6, S7, S10, S12, S13, S15, S17 y G11;
- § 12 y § 13, que se sustituyen por una **única** lista vigente (§ 17.9).

### 17.1 Una sola réplica, declarada y comprobada (hallazgos 1 y 2)

**Hecho.** La arena corre con `minReplicas = maxReplicas = 1`. Se verificó el 23 oct en el portal:
«RunningAtMaxScale, 1 réplica, min 1, max 1».

**Exclusión en proceso.** Un **mutex en proceso** (una cola de promesas en `GestorTorneoSitio`) ejecuta en
serie, de principio a fin:

- la admisión: leer, decidir y escribir;
- el cierre de un torneo: el último cierre del libro, la instantánea final y la liberación del activo en
  memoria;
- el cierre de arranque (§ 17.2).

**Lo que desaparece:** no hay *lease*, ni `activo.json`, ni reconciliador periódico. **Blob solo da
persistencia.**

**Torneo activo.** Es un estado **en memoria** de la única réplica. Si la memoria está vacía, la admisión lee
además las instantáneas del almacén y rechaza cualquiera que esté `en_curso`; eso cubre el arranque y el
solapamiento de un despliegue.

**Comprobación de la réplica única.** En el bicep, `var maxReplicas = 1` alimenta a la vez
`scale.maxReplicas` y la variable `ARENA_MAX_REPLICAS`, así que no pueden divergir. Una prueba lo comprueba
leyendo el bicep (R5).

- Si `ARENA_MAX_REPLICAS !== "1"` y el almacén es Blob, los lanzamientos se **deshabilitan** con el motivo
  visible `replicas`: «Lanzar torneos exige una sola réplica del servidor.» / «Launching tournaments
  requires a single server replica.»
- Con el almacén local, el proceso es único por construcción.

**Solapamiento en un despliegue.** Con `activeRevisionsMode: 'Single'`, durante un cambio de revisión
conviven la réplica vieja y la nueva hasta que la vieja recibe SIGTERM.

- **La vieja**, al recibir SIGTERM, aborta el partido y se **silencia**: un indicador `detenido` convierte en
  error cualquier escritura posterior. No escribe ningún cierre.
- **El latido.** Mientras hay un torneo activo, la réplica que lo ejecuta reescribe `latido-<id>.json` (`{
  proceso: uuid, utc }`) cada `latidoMs` (10 s).
- **La nueva** solo cierra un torneo `en_curso` de otro `proceso` cuando su latido tiene más de
  `latidoCaducoMs` (45 s). Mientras tanto, rechaza los lanzamientos con el motivo `arrancando`.
- **Gracia del contenedor.** El bicep fija `terminationGracePeriodSeconds: 30` de forma explícita.
- **Cupo.** `dia-AAAA-MM-DD.json` se sigue creando con `nuevo: true` (`ifNoneMatch`). Aun en el
  solapamiento, no puede haber dos lanzamientos el mismo día.

**Límites declarados:**

- El diseño se apoya en la réplica única y en el SIGTERM de Container Apps.
- Un proceso congelado que despierte después de que la otra réplica cerrara su torneo podría escribir una
  vez antes de comprobar `detenido`. Solo puede pasar si conviven dos réplicas fuera de un despliegue, y
  `maxReplicas = 1` lo impide.
- La bolsa no está protegida entre dos procesos durante los segundos de solapamiento. Para que eso
  importara, haría falta un lanzamiento en cada réplica en días UTC distintos dentro de esos mismos
  segundos.

### 17.2 Sin reanudación (hallazgos 3, 4 y 5)

**Qué pasa tras un reinicio.** Si la réplica se reinicia a mitad de torneo (despliegue, caída o cambio del
interruptor), el torneo **no se reanuda**. El cierre de arranque, dentro del mutex, lo deja así:

- `estado: "interrumpido"`, valor nuevo del esquema 062, con `motivoFin: "reinicio"`;
- `encuentros` = los de la **última instantánea** escrita (cada uno se validó al terminar);
- `pendientes = []`;
- `enCurso: null`;
- gasto = `gastoConocido(libro)`, con la **reserva abierta contada entera**.

**Cuándo se cierra.** Al arrancar, después de `arranqueEsperaMs` (60 s) y, para los torneos de otro proceso,
solo con el latido caducado (§ 17.1).

**Casos sin instantánea:**

- `dia-…` sin instantánea: el torneo se cierra con 0 partidos.
- Pares `.gz` sin instantánea (la caída fue entre escribir el `.gz` y la instantánea): no se muestran. Su
  coste está en el libro y se declara.

**Lo que no cambia:**

- **El cupo del día queda consumido.**
- **El despliegue avisa.** `deploy-azure-arena.mjs` consulta `GET /api/arena/torneos/sitio` y, si hay un
  torneo activo, muestra «El torneo <id> quedará interrumpido; el cupo de hoy queda consumido» y no
  continúa sin `--forzar`.

**Lo que desaparece:**

- la reanudación y la comprobación de compatibilidad entre versiones (hallazgo 5);
- el reconciliador periódico y el huérfano de 2 min (hallazgo 4);
- `activo.json` y sus estados parciales (hallazgo 3);
- el enfriamiento y las anulaciones persistidos, porque ya no hay segunda ejecución.

**Admisión con estados parciales** (hallazgo 3). Todo ocurre dentro del mutex, con una sola captura del
reloj: `ahora` fija el día UTC, el id `sitio-AAAA-MM-DD` y la semilla `AAAAMMDD`.

1. **El punto de confirmación** es `dia-AAAA-MM-DD.json`, creado con `nuevo: true`. Contiene la
   configuración completa: id, formato, participantes, semilla, duración, intervalo, motor, reglas, commit,
   tope, típico, `promptMax` y `operacion` (uuid de esta admisión).
2. **Respuesta perdida.** Si la creación lanza un error, se relee `dia-…`:
   - si existe con la misma `operacion`, es propia y se sigue;
   - si existe con otra, se responde 409 `cupo`;
   - si no se puede leer, se responde 503 «No se pudo confirmar el lanzamiento; el cupo de hoy puede haberse
     consumido».
3. **La primera instantánea** (`en_curso`, 0 partidos). Si falla, el torneo se cierra en memoria como
   `interrumpido` con 0 partidos y se intenta escribirlo; si eso también falla, lo cerrará el arranque. El
   cupo queda consumido.

`<id>.config.json` desaparece: la configuración vive en `dia-…`.

**Escrituras de cada partido**, en este orden:

1. reserva en el libro (anexo);
2. el partido;
3. `ejecutor.json` y `.gz`;
4. cierre en el libro;
5. instantánea.

Si falla cualquier escritura (y se trata igual un anexo ambiguo), el torneo **se detiene** y se cierra en
memoria como `interrumpido`, con `motivoFin: "almacen"`, valor nuevo, y se intenta una escritura final. El
arranque siguiente lo cierra si no se pudo. La reserva abierta cuenta entera.

### 17.3 Validación por versión (hallazgo 6)

**Al terminar cada partido** (`jugarEncuentro`):

1. `validarEncuentro`, **sin cambios**, sobre el `EncuentroTorneo` 059 que devuelve `jugarEncuentro`; el
   esquema estricto 059 sigue rechazando cualquier campo extra.
2. `encuentro062 = { ...e059, fase, desempate }`, con los valores del plan.
3. `validarMetadatos062(encuentro062, plan062)` (puro): esquema estricto del encuentro 062 (059 más `fase`
   y `desempate`); `fase`, `desempate`, `jornada`, `cruce`, `vuelta`, `seed`, `local` y `visita` iguales a
   `plan062`; y `validarEncuentro` aplicado a la **base** (`omit` de los dos campos).

**En el servidor no hay `validarTorneo`.** La instantánea pasa el esquema y `validarCoherencia` (rama 062:
el plan reconstruido es un prefijo, § 4) cada vez que se escribe y cada vez que se sirve. Los registros solo
se validan al terminar cada partido.

**`validarTorneo` 062** (CI, fixture y promoción en P2) es síncrono, con el lector de `fs`. Por cada
encuentro: base → `validarEncuentro`, y metadatos → `validarMetadatos062`. No se usa con Blob.

### 17.4 Contratos del sorteo y los desempates (hallazgos 7 y 8)

**Extracción uint32.** `u32(clave) = prngDerivado(semilla, clave).int(0, 0xffffffff)`, igual que
`semillasCruce`.

**Barajado canónico.** `barajar(xs, clave)`:

1. ordena `xs` por id con `localeCompare` de código (`a < b`), no por el orden de entrada;
2. hace un Fisher–Yates descendente con `rng.int(0, i)` sobre un único `prngDerivado(semilla, clave)`;
3. el primero del resultado es el mejor.

**Grupos.** `barajar(ids, "torneo-062:grupos")`: A = posiciones 0–2 y B = posiciones 3–5, en ese orden, que
son los índices Berger 1–3.

**Sorteo de un subconjunto.** `barajar(sub, "torneo-062:sorteo:" + ambito + ":" + sub.sort().join("|"))`,
con `ambito ∈ { "grupo-A", "grupo-B", "semifinal-1", "semifinal-2", "final" }`.

- La clave contiene el subconjunto, así que el resultado **no depende** del orden de las llamadas ni del de
  los participantes.
- Ningún comparador consume azar.

**Semillas de las llaves.** `u32("torneo-062:ko:" + fase + ":" + claveCruce(a, b))`.

- Ante una colisión con cualquier semilla ya usada, sufijo `":1"`, `":2"`…
- Las colisiones se resuelven en el orden de las fases: semifinal 1, semifinal 2, final.

**Orden estricto de un grupo** (`ordenGrupo`), por refinamiento de particiones y sin azar en las
comparaciones:

1. clases de `clasificarGrupo` (059);
2. cada clase con más de un miembro se parte por **remates directos** a favor en el grupo, de mayor a menor;
3. cada subclase que sigue empatada se parte por **remates**;
4. cada subclase que sigue empatada se ordena con el **sorteo del subconjunto**.

Se resuelven **todas** las clases, de modo que el orden 1–3 siempre es estricto.

- **Cifras nulas.** Si algún miembro de una subclase tiene `null` en alguno de sus partidos para ese
  criterio, el criterio **no aplica** a esa subclase y se pasa al siguiente.
- **Criterio registrado** por posición: el **último** que la separó (`resultado`, `remates_directos`,
  `remates` o `sorteo`).

**Suma de una llave con los lados invertidos.** Para cada participante p de la llave y cada partido m de
ella, se toma `m[lado].cifras.X` del lado donde jugó p (`m[lado].participante === p`) y se suman los dos
partidos. Si cualquiera de los cuatro valores es `null`, el criterio no aplica.

**Coeficiente de grupo.** Es la tupla `(pts, dg, gf)` de cada participante en **su** fila de
`clasificarGrupo`, comparada lexicográficamente.

**Detalle mostrado:** `detalle = { criterio, a: number[], b: number[] }`. Ejemplos:
`{ criterio: "remates_directos", a: [3], b: [2] }` y `{ criterio: "coeficiente", a: [7, 2, 4], b: [7, 1, 3] }`.

**Vectores literales**, calculados el 24 oct con `src/sim/prng.ts`; las pruebas los fijan.

| Entrada | Salida |
|---|---|
| Grupos con semilla 20261025 | A = [sol61, sol6, equilibrado], B = [rapido, luna6, astra6] |
| Grupos con semilla 20261026 | A = [sol6, astra6, rapido], B = [sol61, equilibrado, luna6] |
| Grupos con semilla 0 | A = [astra6, rapido, sol61], B = [equilibrado, luna6, sol6] |
| Las 10 particiones | aparecen con las semillas 0–999 |
| Sorteo de grupo-A sobre {sol61, sol6, equilibrado} con semilla 20261025 | [equilibrado, sol61, sol6], **igual** si la entrada se permuta |
| Sorteo de grupo-A sobre {sol6, sol61} | [sol6, sol61] |
| Sorteo de la final sobre {astra6, sol61} | [astra6, sol61] |
| `semillasCruce` de astra6\|sol6 con semilla 20261025 | 897463770 |
| Semilla de semifinal-1 para luna6\|sol61 | 661284285 |
| Semilla de semifinal-1 para astra6\|sol6 | 2833494293 |

**Casos de llave obligatorios** (fixtures a mano, G6):

| Partido de la llave | Desempate | Decide |
|---|---|---|
| empate | lo gana el **visitante del primero** (local en el desempate) | ese visitante |
| 0–0 | 1–1 | remates directos (suma con los lados invertidos) |
| empate | empate, con remates directos iguales | remates |
| empate | empate, con remates directos y remates iguales | coeficiente |
| empate | empate, con todo lo anterior igual | sorteo |
| empate | empate, con una cifra `null` en un partido | ese criterio se salta |

### 17.5 Capacidad: peor caso recalculado y torneo a 30 s (hallazgo 9)

**Por minuto y deployment**, con ≈ 10.300 tokens por solicitud típica (9.700 de entrada y 600 de salida) y
hasta ≈ 17.400 en un segundo intento (`entradaMaxIntento` más 2.048 de salida):

| Fuente sobre el mismo deployment | Típico | Peor caso (2 intentos de órdenes por decisión) |
|---|---|---|
| Torneo a 15 s (un lado) | 4 × 10,3 K = 41 K | 4 × 2 × 17,4 K = 139 K |
| Torneo a 30 s (un lado) | 2 × 10,3 K = 21 K | 70 K |
| Partido público con el **mismo modelo en ambos lados** (30 s) | 4 × 10,3 K = 41 K | 139 K |
| Narrador, comentarista y mesa (`rapido`), estimado | ≈ 5 K | ≈ 10 K |

**Sobre los reintentos HTTP.** Responden a 429, que no consumen TPM; aumentan las solicitudes, no los
tokens.

**Coincidencia típica:**

- con el torneo a 15 s: 41 + 41 + 5 = **87 K** sobre los ≈ 100 K supuestos. **Riesgo alto.**
- con el torneo a 30 s: 21 + 41 + 5 = **67 K**.

**Decisión: el torneo del sitio juega a intervalo de 30 s** (`TORNEO_SITIO.intervaloS = 30`, que ya admite
`TORNEO_ARENA.intervalosS`). Son 2 decisiones por lado y partido y **la mitad de la influencia del
modelo**; se declara en la página: «2 decisiones por entrenador y partido».

- La duración no cambia, porque el ritmo de reloj sigue: ≈ 65 s por partido.
- El coste se reduce a la mitad.
- Volver a 15 s es P2 y exige superar el smoke simultáneo a 15 s.

**Cifras nuevas a 30 s** (sustituyen § 5):

| Formato | Típico | Reserva del partido más caro | Tope por estimación | Comprobación (típico +25 %) |
|---|---|---|---|---|
| Liga | 3,54 USD | 3,68 USD | **8 USD** | 3,26 × 1,25 + 3,68 = 7,76 ≤ 8 |
| Grupos | ≈ 1,5–2,0 USD, hasta 2,65 con desempates | 3,68 USD | **7 USD** | 2,38 × 1,25 + 3,68 = 6,65 ≤ 7 |

**Bolsa: 50 USD** (decisión del coordinador, ajustable por Carlos).

- Admite ≈ 12 ligas o ≈ 24 torneos de grupos.
- Liga diaria del 26 oct al 10 nov: 16 × 3,54 ≈ 57 USD típicos y 128 USD por estimación. **La bolsa la
  corta en 50**, así que quedan ≈ 75 USD de los ≈ 125 para todo lo demás.

**El peor caso diario** lo sigue marcando la liga: ≈ 3,5 USD típicos y 8 por estimación.

**Smoke simultáneo con umbrales** (sustituye el smoke 2 de § 11). Mientras corre un torneo real del sitio,
se lanza **a la vez** un partido público con modelos de 180 s, con el **mismo deployment que un lado del
torneo en ambos lados**, y dos espectadores SSE. Se mide:

| Medida | Umbral |
|---|---|
| Hueco máximo entre mensajes o *keepalive* del SSE | ≤ 20 s (el *keepalive* es de 15 s) |
| `monitorEventLoopDelay` | p99 ≤ 500 ms y máximo ≤ 2 s |
| Respuestas 5xx de las rutas públicas | 0 |
| Respaldos `error_controlador` o `plazo_agotado` del partido público | 0 |
| Partidos anulados del torneo | ≤ 1 |
| 429 de cada lado | se anotan |

**Si algún umbral falla, los lanzamientos quedan deshabilitados** (`ARENA_TORNEO_SITIO=0` en el despliegue
final) y se documenta. Antes del smoke se obtiene la capacidad real de TPM con `az`; si es menor que 100 K,
se recalcula esta tabla.

### 17.6 Cancelación administrativa sin despliegue (hallazgo 10)

**Ruta.** `POST /api/arena/torneos/sitio/cancelar`, con `authorization: Bearer <token>`.

**Secreto.**

- Es un secreto nuevo de Key Vault, `cronista-arena-admin` (32 bytes aleatorios en base64url).
- Lo crea `deploy-azure-arena.mjs` si no existe (`az keyvault secret set`), sin imprimirlo; el operador
  lo lee con `az keyvault secret show`.
- El bicep lo referencia como secreto `arena-admin` (`keyVaultUrl`, el mismo patrón que `inferencia`) y lo
  pasa como `ARENA_ADMIN_TOKEN` (`secretRef`).
- Se fija en el despliegue del domingo; después, **cancelar no requiere ningún despliegue**.

**Comprobación del token.**

- `timingSafeEqual` sobre los `sha256` del token recibido y del configurado.
- Los fallos tienen un limitador global de 10 por hora.
- Sin `ARENA_ADMIN_TOKEN`, o con menos de 32 caracteres, **los lanzamientos se deshabilitan** con el motivo
  `cancelacion`: «La cancelación administrativa no está configurada.»

**Efecto.** Dentro del mutex, aborta el `AbortController` del torneo. Todas las esperas escuchan esa señal:

- el ritmo de reloj;
- la pausa entre partidos;
- el enfriamiento de 2 min y el largo de 10 min;
- las esperas del transporte;
- la decisión en curso.

Resultado: `estado: "cancelado"`, `motivoFin: "cancelado"`, el intento en curso como `interrumpido` y la
instantánea escrita. El cupo queda consumido. Respuesta: `200 { id, estado }`. Sin torneo activo: 404.

**El CLI de administración** se reduce a `npm run arena:torneo-sitio -- --cancelar` y `--estado`, que llaman
a esa ruta con el token. **No hace falta RBAC de datos sobre Blob.**

**Apagado de emergencia.** `ARENA_TORNEO_SITIO=0` con `az containerapp update` crea una revisión nueva.
**Impacto:** reinicia el contenedor, así que el torneo queda `interrumpido` (§ 17.2) y los directos
públicos en curso pasan a «interrumpida» (`sesiones.ts:236`). Solo para emergencias.

### 17.7 HTTP (hallazgo 11)

**Origen.**

- `ARENA_ORIGEN_PUBLICO` es el origen completo (`https://<fqdn de cronista-arena>`); lo pasa el script de
  despliegue con `az containerapp show --query properties.configuration.ingress.fqdn`.
- En local y en e2e es `http://localhost:3000`.
- La comprobación es `new URL(req.headers.get("origin")).origin === ARENA_ORIGEN_PUBLICO`: esquema, host y
  puerto.
- Sin la variable, los lanzamientos se deshabilitan con el motivo `origen`.

**Cuerpo.**

- Lectura incremental, con un tope de `cuerpoMaxBytes` (1 KB) y un plazo de `cuerpoPlazoMs` (2 s,
  `AbortSignal.timeout`).
- Si se pasa: 413 o 408.
- `admitida.liberar()` va **en `finally`** en todos los caminos.

**XFF.** No se confía en él para nada económico. La clave del limitador sigue siendo el último salto, pero
el limitador **solo protege la carga** de la ruta. **Lo económico lo protegen el cupo y la bolsa
persistidos**, decididos dentro del mutex.

**Lo que no autentica.** El `Origin` no autentica personas: un cliente automatizado puede enviarlo. Se
declara.

**Libros ilegibles.** Si algún libro no se puede leer al calcular la bolsa, **se rechaza la admisión**
(503 «No se pudo comprobar el presupuesto»). Nunca equivale a gasto cero.

### 17.8 Pruebas corregidas (hallazgo 12)

Sustituyen las filas homónimas de § 9. Las nuevas se añaden. Toda mutación semántica deja válidas las capas
anteriores (hash, registro y esquema), para que **alcance** su aserto.

| # | Prueba | Mutación que la pone en rojo |
|---|---|---|
| S1 | (a) Dos `lanzar` simultáneos con todo libre ⇒ 1 × 202 y 1 × 409. (b) Un torneo activo de **ayer** (reloj falso pasada la medianoche) ⇒ `lanzar` hoy da 409 `activo` **y no existe** `dia-<hoy>` en el almacén | comprobar el activo después de crear `dia-` (falla b) |
| S7 | **Mutex:** almacén falso con lecturas diferidas que la prueba resuelve en orden inverso; dos admisiones con la bolsa al límite ⇒ la segunda espera y lee la decisión de la primera | quitar el mutex: las dos se admiten |
| S9b | **Carrera de la bolsa:** la admisión B empieza mientras el cierre de A está en curso (escritura del libro diferida) ⇒ B lee el gasto final de A y da 422 `bolsa`. Fixture: con el gasto viejo cabría y con el nuevo no | cierre fuera del mutex |
| S9c | Un libro ilegible ⇒ 503, sin lanzamiento | tratarlo como 0 |
| S6 | **Arranque tras una caída:** se descarta el gestor en P7 sin cerrar; uno nuevo, tras `arranqueEsperaMs` y con el latido caducado ⇒ `interrumpido`, `encuentros` = P1–P6, reserva de P7 contada entera, **0 llamadas a `fetch`**, y lanzamientos rechazados con `arrancando` durante la espera | reanudar P7; reserva abierta contada como 0; cerrar con el latido fresco |
| S6b | **Cortes entre escrituras**, con un almacén falso que falla en la operación k: tras crear `dia-` y antes de la instantánea ⇒ el arranque cierra con 0 partidos y el cupo consumido; creación de `dia-` que persiste pero lanza ⇒ relectura con la misma `operacion` ⇒ sigue; con otra `operacion` ⇒ 409; anexo del libro que lanza ⇒ se detiene y queda `motivoFin: "almacen"` | ignorar el error del anexo; dar por ajena una creación propia |
| S6c | **SIGTERM en el solapamiento:** el gestor viejo recibe SIGTERM y escribe 0 veces después (contador del almacén); el nuevo cierra cuando el latido caduca | escribir el cierre en el viejo; sin `detenido` |
| S10 | Cancelación por la ruta con token: aborta en ≤ 1 s de reloj falso **en cada espera**: ritmo, pausa, enfriamiento de 10 min, espera de transporte y decisión ⇒ `cancelado`; token incorrecto ⇒ 401; sin token configurado ⇒ lanzamientos deshabilitados (`cancelacion`) | una espera sin señal (por ejemplo, el enfriamiento) |
| S12 | `ARENA_MAX_REPLICAS ≠ "1"` con Blob ⇒ motivo `replicas`; interruptor apagado ⇒ 503 | ignorar la variable |
| S13 | Intentos por partido (`1 + repeticionesMax`) y `plazoTotalMs` ⇒ `incompleto` / `plazo` | sin plazo |
| S15 | **Convivencia durante el torneo:** con un LLM falso lento en el torneo, `GestorSesiones.crear` con modelos se admite **mientras** el torneo juega, y los dos terminan; el prefijo `sesiones/` no recibe nada del torneo | el torneo usa la exclusión de `GestorSesiones`; escribe un `meta.json` |
| S17 | Liga completa en ensayo: 30 encuentros y la instantánea final válida. Grupos con un empate forzado en la semifinal 1: aparece el desempate con los lados invertidos | `siguientePartido` devuelve `null` tras 29; desempate desactivado en el plan (la coherencia falla) |
| G11 | `validarTorneo` 062 sobre el fixture **intacto** con mutaciones **en el código**, no en los datos: semifinal 2 como 1B–2B en `planTorneo`, o un desempate sin invertir lados en `planTorneo` ⇒ falla la comprobación de plan y metadatos, mientras SHA-256 y reproducción siguen válidos (se comprueba aparte) | — (estas son las mutaciones) |
| G12 | `validarMetadatos062`: un encuentro 059 con `fase` añadida ⇒ `validarEncuentro` lo sigue rechazando; un 062 con `fase` distinta del plan ⇒ rechazo | aceptar campos extra en 059 |
| R5 | El bicep usa una sola `var maxReplicas` en `scale` y en `ARENA_MAX_REPLICAS`; `terminationGracePeriodSeconds: 30`; ninguna variable de ensayo | literales distintos |
| H1 | HTTP: un `Origin` con otro esquema o puerto ⇒ 403; un cuerpo lento ⇒ 408 a los 2 s y la petición siguiente se admite (el limitador quedó libre) | `liberar` fuera de `finally` |

**Se eliminan:** S7 del *lease*, S11 (reanudación con un `.gz` corrupto) y R2 (la parte de reanudación).

### 17.9 Alcance, aceptación y calendario: lista única vigente (hallazgo 13)

**Formatos.** Se mantienen los dos, porque Carlos los pidió, en dos entregas con un corte explícito:

- **P1-a · Liga lanzable:**
  - § 3 en lo que toca a la liga y el esquema 062;
  - § 17.1–17.7;
  - las entradas generadas y el almacén con bytes;
  - las rutas de estado, lanzamiento, instantánea, archivo y cancelación;
  - `torneo-carga.ts`;
  - la página: panel con el selector (con la opción Grupos **visible y deshabilitada**: «Disponible
    pronto»), confirmación, rótulo de origen, estado por partido con sondeo, clasificación, matriz y
    repeticiones, y la lista de los dos orígenes;
  - las pruebas S1, S6, S6b, S6c, S7, S9, S9b, S9c, S10, S12, S13, S15, S17 (liga), G8–G10 (liga), G12,
    R1, R3, R4, R5, H1 y U1;
  - el e2e 1, 3, 4, 5 y 7 con la liga de ensayo;
  - el despliegue y el smoke simultáneo de § 17.5.
- **P1-b · Grupos + eliminatoria:**
  - § 3 completo y § 17.4;
  - `ArenaTorneoGrupos`;
  - G1–G7, G11, S17 (grupos) y el e2e 2.
  - Se publica activando la opción del selector.
- **P2:** progreso fino, promoción, métricas de grupos, `--liberar-cupo`, *worker* para validar, intervalo
  de 15 s y smoke 6 con captura.

**Aceptación de P1-a:**

1. `npm test` y `npm run typecheck` en verde, con cada mutación de P1-a vista en rojo.
2. `npm run e2e` completo en verde.
3. El archivo del 24 oct no cambia.
4. En público:
   - una liga lanzada desde el sitio termina con su tabla y sus repeticiones;
   - un segundo lanzamiento da 409;
   - la cancelación por la ruta funciona (probada en un torneo de prueba, § 17.10);
   - el smoke simultáneo supera todos los umbrales;
   - el gasto conocido es menor o igual que 8 USD.
5. Fila en BITACORA.

**Aceptación de P1-b:** la de P1-a, más G1–G7, G11, el e2e 2 y un torneo de grupos real completado.

**Reestimación** (horas de agente; un solo implementador, en serie):

| Bloque | P1-a | P1-b |
|---|---|---|
| Puras (esquema 062, coherencia, liga; formatos de grupos y llaves) | 2 | 3 |
| Gestor (mutex, admisión, bucle, ritmo, tope, bolsa, latido, cierre de arranque, SIGTERM y cancelación) | 4,5 | — |
| Almacén con bytes y entradas generadas | 1,25 | — |
| Rutas, carga y páginas | 1,5 | — |
| Interfaz (panel, estado, lista y rótulos; grupos y cuadro) | 2,5 | 2 |
| e2e | 1,5 | 0,5 |
| Infra (bicep, secreto, origen, réplicas, gracia y commit) | 1 | — |
| Revisión de Codex de la implementación y correcciones | 2 | 1 |
| Despliegue y smoke simultáneo (≈ 35 min de reloj) | 1,5 | 0,5 |
| **Total** | **≈ 17,75 h** | **≈ 7 h** |

**Qué entra el domingo 25, con honestidad.** El orden de la cola es 060, después 061 y después 062.

- **El 061** reserva unas 6 h para su núcleo, más ampliación e integración (línea 583 del brief 061). **El 060** no
  está en este checkout y estimo 6–8 h.
- Con un solo implementador desde la mañana del sábado, el 062 empieza **el sábado por la noche, como
  pronto, o el domingo por la mañana**.
- El domingo hay ≈ 11 h útiles hasta el corte de las 19:00 (el torneo de prueba y el smoke duran 35 min de
  reloj).
- **P1-a (≈ 17,75 h) no cabe completo el 25 si el 060 y el 061 van delante. P1-b, tampoco.**

| Escenario | Qué entra el 25 |
|---|---|
| El 060 y el 061 terminan el sábado antes de las 18:00 | P1-a con justeza (≈ 6 h el sábado por la noche y ≈ 11 h el domingo), **sin margen para una segunda ronda de Codex**. P1-b no. |
| El 060 y el 061 terminan el sábado por la noche o más tarde (lo probable) | **Nada del 062 publicado.** Se integra el código apagado si las pruebas están en verde, el torneo archivado del 24 oct sigue siendo la vista del sitio, y P1-a queda para después de la entrega, si se permite desplegar. |

**Cortes duros:**

- **Domingo a las 13:00:** gestor y admisión en verde (S1, S6, S6b, S7, S9b y S10). Si no, el 062 se
  detiene y no se despliega.
- **Domingo a las 19:00:** P1-a en verde con la revisión. Si no, se despliega con `ARENA_TORNEO_SITIO=0` o no
  se despliega.

**Lo que nunca se recorta:** el mutex, el cupo atómico, la bolsa, el tope, la validación por partido, los
rótulos, la cancelación con token y el smoke simultáneo.

### 17.10 Constantes v1.1 (cambian respecto de § 8)

**En `TORNEO_SITIO`:**

- `intervaloS: 30`;
- `formatos.liga.topeUsd: 8` y `formatos.grupos.topeUsd: 7`;
- `latidoMs: 10_000`, `latidoCaducoMs: 45_000` y `arranqueEsperaMs: 60_000`;
- `cuerpoPlazoMs: 2_000`;
- `admin: { fallosPorHora: 10, tokenMinCaracteres: 32 }`.

**Se eliminan:** `sondeoCancelacionMs`, `reconciliacionRetrasoMs` e `intentosMaxPorPartido` (sin reanudación
bastan `1 + repeticionesMax` intentos).

**Esquema 062:**

- `estado` gana `"interrumpido"`;
- `motivoFin` gana `"reinicio"` y `"almacen"`, y pierde `"desactivado"`: un reinicio por el interruptor es
  `"reinicio"`.

**Torneo de prueba de la cancelación.** Antes del smoke real, el operador lanza en producción una liga con
`?prueba=1`, solo con el token: `POST` con `authorization`. Lleva `tipo: "real"`, no consume el cupo diario
y la cancela por la ruta a los ≈ 2 partidos (≈ 0,25 USD, que cuentan en la bolsa). Así se prueba la
cancelación sin gastar el cupo. Ese lanzamiento existe **solo** con el token de administración, y lo cubre
la prueba S10b: sin token, `?prueba=1` se ignora.

## 18. Versión 1.2 (24 oct): segunda revisión de Codex — PREVALECE SOBRE LA § 17

Codex cerró los hallazgos #3, #5, #6, #7, #8, #10, #11 y #13. Esta sección cierra #1, #2, #4, #9 y #12 y el
hallazgo nuevo de la liga de prueba, con las decisiones del coordinador. Lo demás de la § 17 sigue vigente.

### 18.1 Barrera de relevo (#1 y #2)

**Latido de presencia.** Lo escribe **cada** proceso, tenga o no un torneo activo:

- `latido-<proceso>.json` (`{ proceso: uuid, utc }`), reescrito cada `latidoMs` (10 s);
- al recibir SIGTERM, el proceso **deja de renovarlo** y se silencia con `detenido`;
- se escribe aparte, fuera del mutex, y no es un *lease*.

**Barrera al arrancar.** El gestor arranca con `barrera = "relevo"`. Mientras exista **algún**
`latido-<otro>.json` con menos de `latidoCaducoMs` (45 s):

- **no admite** ningún lanzamiento, ni público ni de prueba;
- **no cierra** torneos;
- `GET /api/arena/torneos/sitio` devuelve el motivo `relevo`: «Despliegue en curso; vuelve a intentarlo en
  un minuto.» / «Deployment in progress; try again in a minute.»

La comprobación se repite cada `relevoSondeoMs` (5 s).

**Al liberar la barrera** (cuando todos los latidos ajenos han caducado o no existe ninguno), dentro del
mutex:

1. **se releen todos los libros** (bolsa) y todos los manifiestos (§ 18.4);
2. se ejecuta el cierre de arranque (§ 18.2);
3. `barrera = null`.

Los latidos ajenos de más de una hora se borran.

**Por qué basta.** El proceso viejo renueva su latido cada 10 s y deja de hacerlo con SIGTERM. Ya no
emite operaciones nuevas, y cada operación de `almacen-torneos.ts` lleva
`abortSignal: AbortSignal.timeout(opPlazoMs)` (10 s) en el SDK. Así, cualquier operación del proceso viejo
terminó, del lado del cliente, como mucho 20 s después de su último latido (10 + 10), por debajo de los 45 s
de la barrera. Además, Container Apps lo mata con SIGKILL a los 30 s de gracia.

**Exclusión durante el relevo.** Mientras dura, solo el proceso viejo puede admitir o escribir. Así que no
hay dos escritores ni dos admisiones (#1), ni una bolsa decidida con libros viejos (#2): la nueva revisión
los relee **después** del relevo.

**El mutex** se conserva para la ejecución ordinaria (§ 17.1).

**Límites declarados:**

- Una petición que el SDK abortó en el cliente pero que Blob aplica más de 25 s después sigue siendo
  teóricamente posible. Lo mitiga el plazo del servidor de Blob, cuando el SDK lo admite (`timeout`), y queda
  declarado.
- La barrera depende de que el reloj de los dos procesos no difiera más de unos segundos. Ambos usan la hora
  del host de Azure, y el `utc` del latido es el del escritor.

### 18.2 Cierre de arranque con reintentos (#4)

**Cuándo se intenta.** Tras liberar la barrera, y después cada `cierreReintentoMs` (30 s) mientras quede algún
**pendiente de cierre**. Pendiente de cierre es un manifiesto (`dia-…` o `prueba-…`) cuya instantánea falta o
está `en_curso` y que **no** pertenece a un torneo activo en la memoria de este proceso.

**Cada intento:**

- va dentro del mutex;
- sigue la regla de § 17.2: `interrumpido`, `motivoFin: "reinicio"`, la última instantánea y la reserva
  abierta contada entera;
- no reanuda nada ni llama a ningún modelo;
- registra cada error con `console.error` y un atributo de telemetría
  (`arena.torneo.cierre_error`), sin secretos.

**Plazo.** Si pasados `cierrePlazoMs` (10 min) sigue habiendo pendientes:

- los reintentos automáticos se detienen;
- los lanzamientos quedan deshabilitados con el motivo `cierre`: «Hay un torneo anterior sin cerrar; el
  operador tiene que revisarlo.»;
- la ruta `POST /api/arena/torneos/sitio/cerrar`, con el token de administración, vuelve a ejecutar un
  intento.

**Mientras haya pendientes, ninguna admisión los ignora:** una instantánea `en_curso` sigue bloqueando como
torneo activo (§ 17.1).

### 18.3 Capacidad: típico frente a máximo conservador (#9)

Sustituye la tabla de § 17.5. Tokens por solicitud: ≈ 10,3 K típicos y ≈ 17,4 K como máximo
(`entradaMaxIntento` + 2.048).

**Solicitudes potencialmente facturables.** Los reintentos de transporte ante **red, 408 y 5xx** pueden haber
ejecutado inferencia sin devolver `usage` (`torneo-ejecucion.ts:107`; `TORNEO_ARENA.http`). Solo un 429 no
consume. Con la reserva del 059, cada decisión del torneo admite `intentosOrdenes × (1 + reintentos)` = 2 × 3
= **6 solicitudes**. El partido público no reintenta en el transporte (`maxRetries: 0`), así que admite 2 por
decisión.

**Por minuto y deployment, en la peor coincidencia:**

| Fuente | Típico | Máximo conservador |
|---|---|---|
| Torneo a 30 s, un lado | 2 decisiones × 1 solicitud × 10,3 K ≈ 21 K | 2 × 6 × 17,4 K ≈ 209 K |
| Partido público, el mismo modelo en ambos lados (30 s) | 4 × 1 × 10,3 K ≈ 41 K | 4 × 2 × 17,4 K ≈ 139 K |
| Narrador, comentarista y mesa (`rapido`) | ≈ 5 K | ≈ 10 K |
| **Total** | **≈ 67 K** | **≈ 358 K** |

**Cómo leer las dos columnas:**

- **El máximo conservador no es una previsión.** Supone que todas las decisiones agotan todos los intentos
  con prompts máximos.
- **Superar la capacidad** (≈ 100 K supuestos, a verificar con `az`) produce 429:
  - el torneo **anula** el partido y lo cuenta por su reserva (059);
  - el partido público cae al respaldo programado.
- **El gasto** lo sigue acotando la reserva por partido y el tope, no la capacidad.

**El smoke simultáneo de § 17.5 sigue siendo condición para habilitar**, con los mismos umbrales. Si falla,
los lanzamientos quedan apagados.

### 18.4 Liga de prueba con identidad propia (hallazgo nuevo)

**Id único.** `sitio-prueba-<hex12>`, donde `hex12` son los 12 primeros caracteres hexadecimales de un
`randomUUID()`.

- Se usan 12 en vez del uuid completo porque `ID_TORNEO` admite como mucho 30 caracteres y la referencia de
  grabación `torneo-<id>-<nn>`, 50; así quedan 25 y 35.
- Si el nombre ya existe, se genera otro.

**Manifiesto propio.** `prueba-<hex12>.json`, con el mismo `esquemaManifiesto` que `dia-…` más
`lanzamiento: "prueba"` (en el de un torneo público, `lanzamiento: "publico"`).

- Se crea con `nuevo: true` **antes de cualquier inferencia**, como punto de confirmación, con la
  configuración completa y la `operacion`.
- Todos los archivos del torneo llevan el prefijo de su id, así que **ningún archivo se comparte** con el
  torneo público del día.

**Lo único que omite es el cupo diario:** no crea ni lee `dia-…`. Todo lo demás sigue igual:

- exclusión del torneo activo, en memoria y por instantáneas `en_curso`;
- barrera de relevo;
- tope del formato;
- bolsa, porque su gasto real cuenta;
- mutex;
- cierre de arranque;
- validación por partido.

**Solo con el token.** La admisión de la prueba solo existe con `authorization` válido.

- Sin token, `?prueba=1` se ignora y la petición es un lanzamiento público normal, que consume el cupo.
- El esquema 062 añade `lanzamiento: "publico" | "prueba"`.
- La página rotula las pruebas como «Torneo de prueba del operador» y las lista aparte de los torneos del
  día.

### 18.5 S7 separada del cupo (#12) y S10b ampliada

| # | Prueba | Mutación que la pone en rojo |
|---|---|---|
| S7 | **Exclusión directa del mutex**, sin pasar por el cupo. La sección 1 (admisión del día D) queda suspendida en una lectura diferida del almacén falso. Se pide la sección 2 (cierre de arranque de un manifiesto de otro día, o admisión del día D+1). Aserto: **ninguna operación de almacén de la sección 2 se ejecuta** (contador de un espía) mientras la 1 no se resuelve; al resolverla, la 2 corre | quitar el mutex: el espía registra operaciones de la sección 2 durante la suspensión |
| S7b | **Barrera:** con un latido ajeno fresco, la admisión devuelve `relevo`, el cierre no corre y el almacén no recibe escrituras del gestor nuevo, salvo su propio latido. Al caducar el latido (reloj falso, > 45 s), se releen los libros: una bolsa que solo excede con el gasto escrito durante el relevo se rechaza | liberar la barrera sin releer; ignorar los latidos ajenos |
| S7c | **Cierre con reintentos:** el primer intento de cierre falla (almacén falso que lanza); se reintenta a los 30 s y cierra; con fallos durante más de 10 min ⇒ motivo `cierre`, sin más reintentos; `POST …/cerrar` con token reintenta | sin reintento; reintentar sin plazo |
| S10b | (a) Sin token, `?prueba=1` ⇒ lanzamiento público con el cupo consumido. (b) **Prueba cancelada y después liga pública el mismo día:** los ids son distintos; la intersección de los nombres del almacén de los dos torneos es ∅; la liga pública se admite (el cupo seguía libre); la bolsa es la suma de los dos gastos conocidos. (c) **Caída durante la prueba:** se descarta el gestor a mitad de un partido; el gestor nuevo, tras la barrera, cierra la prueba como `interrumpido` con la reserva abierta contada entera; después se admite una liga pública; no comparten archivos y los dos gastos cuentan en la bolsa. (d) Una prueba con un torneo público activo ⇒ 409 `activo` | id de la prueba = id del día; la prueba crea o consume `dia-`; el gasto de la prueba fuera de la bolsa |

### 18.6 Constantes v1.2 (se añaden a `TORNEO_SITIO`)

`relevoSondeoMs: 5_000`, `opPlazoMs: 10_000`, `cierreReintentoMs: 30_000` y `cierrePlazoMs: 600_000`.

`latidoMs` (10 s) y `latidoCaducoMs` (45 s) siguen como en la v1.1, y ahora los usan todos los procesos.

**Motivos nuevos del estado:** `relevo` y `cierre`.

### 18.7 Estimación

**+1 h** en P1-a por la barrera, los reintentos del cierre y la prueba con identidad propia:
**≈ 18,75 h**. El análisis de lo que entra el 25 (§ 17.9) no cambia.

## 19. Versión 1.3 (24 de octubre): autosilencio del gestor que pierde el latido. Prevalece.

Decisión de Opus tras la tercera revisión de Codex, que dejó un solo bloqueante. Con esto el brief queda **cerrado**.

1. **Primer latido confirmado.** El gestor no admite, no ejecuta y no escribe nada protegido hasta que la escritura
   de su primer latido termina con éxito.
2. **Vigencia antes de cada operación protegida.** Hay una función pura `latidoVigente(ahora)`: es verdadera solo si la
   última renovación correcta tiene menos de `TORNEO_SITIO.latidoSilencioS` = 30 s. Ese margen es menor que los 45 s
   que espera la revisión nueva, y la constante se lee de `limites.ts`. Se comprueba antes de cada escritura protegida:
   instantánea, anexo al libro, manifiesto, cierre y admisión. También antes de cada inferencia.
3. **Autosilencio permanente.** Si una renovación falla o vence, el gestor aborta el partido en curso y pasa a
   `silenciado`, que no tiene vuelta atrás en ese proceso.
   - No vuelve a escribir.
   - Deja de admitir torneos.
   - Libera su mutex para que las lecturas sigan funcionando.
   - Registra el motivo.
   El torneo lo cierra después la revisión nueva, o este mismo proceso tras reiniciarse, como «interrumpido» con la
   regla del § 17.
4. **Margen frente a una escritura en vuelo.** Como el plazo de cada operación es de 10 s, una escritura iniciada
   justo antes de silenciarse termina como muy tarde a los 40 s. La barrera de la revisión nueva se libera a los 45 s,
   con 5 s de margen. Ese margen es una declaración por reloj, no una exclusión distribuida, y queda como límite.
5. **Pruebas.**
   - **S7b ampliada:** un escritor vivo cuya renovación falla, con reloj controlado. Deja de escribir antes de los
     30 s y no escribe nada a partir de ese momento. La revisión nueva solo libera la barrera a los 45 s.
   - **Mutación:** quitar la comprobación de vigencia antes de escribir debe dar rojo.
   - **S7d:** sin el primer latido confirmado, el botón queda deshabilitado con el motivo «iniciando».
