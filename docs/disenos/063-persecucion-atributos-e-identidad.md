# 063 — Persecución, atributos de jugador, balones largos y remates lejanos, identidad de juego (reglas `reinicios-v6` a `reinicios-v8`)

## Estado

Brief **cerrado v1.2**, sábado 24 de octubre de 2026 (v1.1 y v1.2 incorporan las dos revisiones de Codex, § 17 y § 18; la § 18 prevalece sobre la 17). Lo escribió Opus como diseñador porque Fable no tiene
cupo (Carlos autorizó que Opus diseñe y Codex revise). No incluye código de producción. Lo implementa Opus
(`opus-implementador`) bloque por bloque. La revisión adversaria de Codex se anota al final (§ 17); lo que
allí se decida **prevalece** sobre el texto anterior.

Las cifras salen de dos fuentes:

- el helper del repositorio (`src/arena/metricas-lote-cli.ts`) sobre `a5a7fb8`;
- un prototipo sobre una **copia** del motor en el scratchpad.

El parche está en [`prototipo/prototipo-063.diff`](../evidencia/motor-063/prototipo/prototipo-063.diff), los
scripts de medición en [`medicion/`](../evidencia/motor-063/medicion/) y los JSON en
[`lotes/`](../evidencia/motor-063/lotes/). El prototipo no es la implementación: el detalle cambiará las
cifras por semilla. Por eso las bandas tienen margen y hay ajustes permitidos (§ 12).

**Pedido literal de Carlos (24 oct):**

> «quiero que cuando un delantero pasa a los defensas los defensas no se queden quietos y vayan por la bola
> aunque sea obvio que no van a llegar pero esto es solo si el delantero pasó al último hombre; también quiero
> que eso pase con todos los jugadores, pero digamos si se la quitaron a un delantero el delantero solo la va a
> perseguir como hasta la media cancha y así; y también que los jugadores hagan tiros largos; por ejemplo este
> jugador puede resistir mucho con la bola, este otro es muy rápido, otro que puede ver y leer muy bien el
> campo; agregar muchas estadísticas y que reflejen bastante en el campo; y que el equipo influya: si el equipo
> es conocido por ser defensivo, cosas así.»

**Interpretación fijada por el orquestador y comunicada a Carlos.** Se respeta, con las tres desviaciones
técnicas declaradas en § 3.4:

1. repliegue de emergencia;
2. persecución tras pérdida acotada por línea;
3. remates lejanos y balones largos;
4. atributos que pesan;
5. identidad de equipo.

**Precedentes.**

- [044](044-correcciones-motor-arena.md): versión de reglas y fixtures de reproducción exacta.
- [046](046-portero-centros-y-robo.md): `reglasDesde`, `metricas-lote.ts`, `LOTE_ARENA_046` y la fase aérea
  de `centro`/`aereo`.
- [051](051-realismo-del-remate.md): `REMATE_ARENA`, `LOTE_ARENA_051`, experimento controlado, matriz de
  versiones y mutaciones.
- [055](055-identidad-futbolera.md): identidad visual derivada del nombre.
- [056](056-previa-del-partido.md)/[058](058-narracion-por-defecto-y-antesala.md): tarjeta de alineaciones
  y tira «En voz».

## 0. El diseño en doce líneas

1. **Bloque A** (`reinicios-v6`): si el poseedor rival de campo queda por detrás del último defensor de campo,
   hasta 4 defensas y medios a ≤ 30 m corren a un punto entre el balón y su arco, aunque no lleguen.
2. **Bloque A**: quien pierde el balón (robo, intercepción o balón suelto) lo persigue un tramo.
   - Duración base: 3 s un delantero, 4 s un medio y 6 s un defensa. La modulan su agresividad, su energía
     y el bloque del entrenador.
   - Límite espacial: el delantero no pasa de la mitad de la cancha propia y el medio no entra en su tercio
     defensivo. El defensa no tiene límite espacial.
3. **Bloque A**: los jugadores en repliegue o persecución frenan a 5 m/s² (giran antes); el resto conserva la
   física actual.
4. **Bloque B** (`reinicios-v7`): seis atributos 0–100 por jugador en `config.atributos`. Se derivan de
   equipo + jugador, coherentes con puesto y perfil y centrados en 50: velocidad, resistencia, aguante,
   entrada, visión y potencia.
5. **Bloque B**: cada atributo multiplica una cifra ya existente con un efecto acotado y centrado: 50 = sin
   cambio.
6. **Bloque C** (`reinicios-v7`): remate lejano (25–33 m) para quien tiene potencia ≥ 60, espacio y línea
   limpia, con más error, más probabilidad de ir alto y un portero que va a la trayectoria.
7. **Bloque C**: balón largo aéreo (32–55 m) para quien tiene visión ≥ 50. Se elige si puntúa más que el mejor
   pase corto. Un `pasar` del LLM dentro de ese alcance sale como balón largo.
8. **Bloque D** (`reinicios-v8`): identidad de juego del club en `config.estilosJuego`, derivada del nombre:
   defensivo, ofensivo, posesión, contragolpe, directo o presión. Mueve el bloque, la persecución, el
   repliegue, la frecuencia de balones largos y los remates lejanos.
9. **UI**: la ficha muestra los seis atributos y cómo se notan; la tira «En voz» muestra el rasgo distintivo;
   la tarjeta de alineaciones muestra la identidad.
10. **LLM**: ven `equipos[lado].atributos`, `estiloJuego` y `estado.persecucion`. `SISTEMA_ARENA` gana una
    frase por bloque, construida con constantes. El esquema de órdenes no cambia.
11. **Determinismo**: PRNG nuevos con claves propias. Nada de esto existe en `reinicios-v1..v5`: los archivos
    y torneos archivados se reproducen byte a byte.
12. **Prototipo**: todas las bandas del 046 y del 051 se cumplen en los tres lotes con A, A+B+C y A+B+C+D.
    Desde B+C los goles bajan unos 0,3 por partido: dos bandas del 046 se recalibran explícitamente (§ 12.3).

## 1. Hechos verificados en el código (24 oct, `a5a7fb8`)

### Movimiento (`moverJugadores`, `motor.ts:392-467`)

- El destino sale de la orden, o del ancla de fase si cambió la posesión en la ronda. Luego se ajustan
  amplitud y bloque (`alturaBloqueM`, solo sin balón), la llegada al área, el receptor del vuelo y el
  **perseguidor** (el jugador de campo más cercano al balón cuando lo tiene el rival: `motor.ts:398`, `:417`),
  y después `presionar`, el poseedor, la salida, el posicionamiento del portero y `respetarManos`.
- La velocidad máxima es `velocidadMps · (0,9 + 0,2·nivel/100) · energía · ritmo · entorno`. La aceleración
  y el frenado son los mismos 3 m/s² para todos (`motor.ts:450-455`).
- Ningún defensor reacciona a quedar superado. El único que va al balón es el perseguidor.

### Línea de fuera de juego (`lineaFueraDeJuego`, `ataque.ts:101-104`)

Usa el penúltimo rival **con** el portero. «Último defensor de campo» no existe hoy como función.

### Duelo (`moverBalon`, `motor.ts:618-626`)

- Cada `recuperacionCadaS` (0,8 s), el rival más cercano a ≤ `controlM` disputa.
- p = acotar(0,35 + Δnivel·0,004 + (defensa − ataque)·0,002; 0,1; 0,75), con el PRNG `arena:duelo`.
- Si gana, `recibir(defensor)` emite `recuperacion` sin `receptor`. Quién perdió el balón no queda registrado.

### Decisión del poseedor (`accionBalon`, `motor.ts:306-345`)

- Orden explícita o decisión local:
  1. `prefiereTirar`, con radio ≤ `radioTiroM` = 25 m;
  2. centro;
  3. `opcionPase` (`controladores.ts:67-85`), con candidatos a ≤ `paseMaxM` = 32 m;
  4. conducción.
- Un `tirar` del LLM se ejecuta desde cualquier distancia. Un `pasar` a más de 32 m es «imposible» (v4) y
  decide en local.

### Remate (v5, `sacarBalon` y `moverBalon`)

- `errorRemate` satura su factor de distancia en `factorDistanciaMax` (a 19,2 m).
- Un remate de 30 m tiene el mismo error relativo que uno de 20 m.
- El portero solo se coloca (posicionamiento a ≤ `manoAManoRadioM` = 28 m); no va a la trayectoria del remate.

### Vuelo aéreo (v4)

`centro`/`aereo` solo admiten contactos a ≤ `caidaM` = 5 m del destino (`motor.ts:655`). Medido en el
prototipo: de 479 vuelos aéreos con contacto en 100 partidos, **470** los toca solo el atacante. La arena no
tiene duelos aéreos. Por eso **no** se añade un atributo de juego aéreo (§ 3.4).

### Identidad y personalidad

- `personalidadDe` (`personalidades.ts:23-34`) es determinista por equipo + jugador. El PRNG
  `personalidad:arena-v2` no consume el azar histórico. La personalidad vive en `JugadorArena` y viaja en
  **cada fotograma**.
- `Equipo.estilo` (`posesion | contragolpe | presion`) viene del simulador histórico. Lo usan `entrenadorDe`
  y `opcionPase` (contragolpe ×1,5 al avance).
- Medido en las semillas 1–400: 121 de 127 clubes aparecen con **más de un** estilo y 67 con más de un perfil
  de entrenador, porque el estilo se sortea por semilla. No sirve como «equipo conocido por ser defensivo».

### Reproducción (`coordinador.ts:118-146`)

- `reproducirArena` exige `inicial` idéntico a `crearEstadoArena(config)`.
- Exige el id de observación igual al hash de `estado + equipos + …`.
- Exige respaldos idénticos a `planProgramado(obs)` y eventos, fotogramas y final idénticos
  (`isDeepStrictEqual`, que distingue una clave con `undefined` de una clave ausente).

### Tamaños

- Un registro programado de 180 s pesa 5,87 MB (`archivoMaxBytes` = 8 MB).
- Con los atributos dentro de `JugadorArena` (primer prototipo) subía a **7,13 MB**. Decisión en § 4.2: los
  atributos van en la configuración, una sola vez.
- La observación del LLM en el tick 0 pasa de 16,8 KB a ≈ 19,5 KB.

### Torneos

`torneo-validacion.ts:37` y `torneo-pagina.ts:22` recrean la configuración con `t.motor.reglas`. Los torneos
archivados (`reinicios-v5`) siguen validando si v5 no cambia.

## 2. Línea base medida hoy (`reinicios-v5`, programados, 120 s)

Scripts:

- [`medicion/medir.mts`](../evidencia/motor-063/medicion/medir.mts) y
  [`medir2.mts`](../evidencia/motor-063/medicion/medir2.mts), con las definiciones de § 11.1;
- helper del repositorio para las bandas.

| Métrica | 1–100 | 101–200 |
| --- | --- | --- |
| Goles / remates por partido | 2,17 / 5,06 | 2,24 / 5,08 |
| Episodios «superado» (poseedor por detrás del último defensor de campo) por partido; segundos | 7,3; 12,1 s | 7,5; 11,6 s |
| Goles nacidos en un episodio «superado» / goles | **0,89** | **0,94** |
| Velocidad media de los DEF rivales durante el episodio; fracción < 2 m/s | 2,2 m/s; **0,55** | 2,3 m/s; 0,55 |
| `repliegueCorren` (§ 11.1) | **0,36** | **0,37** |
| `persecucionPerdedor` (§ 11.1) | **0,30** | **0,32** |
| Pases: mediana; p90; fracción ≥ 25 m | 23,4 m; 35,1 m; 0,44 | 23,4 m; 35,2 m; 0,44 |
| Remates: distancia mediana; p90; máxima | 19,0 m; 24,7 m; **25,0 m** | 19,1 m; 24,7 m; 25,0 m |

**Lectura.**

- Nueve de cada diez goles nacen de un atacante que ya superó al último defensor.
- Durante esos episodios, más de la mitad de las muestras de defensas va a menos de 2 m/s: «se quedan quietos»
  es literal.
- Quien pierde el balón solo va hacia él en el 30 % de las muestras de 1 a 4 s después del robo.
- Nadie remata desde más de 25 m.
- El pase ya es largo (mediana 23 m), pero no existe el balón largo por arriba.

## 3. Decisiones de versión y de publicación

### 3.1 Una versión de reglas por publicación

Una versión publicada queda **congelada**: los visitantes graban partidos y torneos con ella. Si el bloque A se
publica en `reinicios-v6` y después el bloque B cambia lo que hace `v6`, los archivos v6 dejan de
reproducirse. Por eso cada grupo que cambia el motor tiene versión propia:

| Publicación | Bloques | Reglas | Getter en `MotorArena` |
| --- | --- | --- | --- |
| 1 | 0 (compatibilidad) + **A** (persecución) | `reinicios-v6` | `v6` |
| 2 | **B** (atributos) + **C** (remate lejano y balón largo) | `reinicios-v7` | `v7` |
| 3 | **D** (identidad de juego) | `reinicios-v8` | `v8` |

- Cada getter es `reglasDesde(this.config, "reinicios-vN")`.
- B y C van juntos porque C usa la visión y la potencia de B, y porque B sin C deja dos atributos sin efecto
  visible.
- Si el orquestador publica dos grupos a la vez, las versiones intermedias **siguen existiendo**, con su
  getter, su fixture y su fila en la matriz (§ 13). Nunca se fusionan dos versiones.
- `ARENA.reglas` apunta a la versión del último grupo publicado. En cada paso, la versión anterior entra
  **literal** en `reglasArena`, como hizo el 051 con v4. Estado final:
  `["reinicios-v1", …, "reinicios-v5", "reinicios-v6", "reinicios-v7", ARENA.reglas]` con `ARENA.reglas` =
  `"reinicios-v8"`.
- `ARENA.version` sigue en `arena-v3`. `RegistroArena` no cambia de forma: solo gana claves opcionales,
  validadas por reglas.

### 3.2 Qué queda fuera del gating por versión, y por qué es seguro

- **`planProgramado`, `validarOrdenes`, `esquemaOrdenes` y `prefiereTirar` no cambian.**
- **`opcionPase` se refactoriza sin cambiar su resultado.**
  - Nueva función exportada `evaluarPases(j, obs)`: devuelve los candidatos filtrados y ordenados con su
    `puntuacion`, exactamente como hoy.
  - `opcionPase(j, obs)` pasa a ser `evaluarPases(j, obs)[0]?.p`.
  - Los fixtures v1–v5 y la prueba 0.4 lo garantizan.
- **Todo** lo nuevo vive en `MotorArena` tras `v6`/`v7`/`v8`, en `crearConfigArena`/`crearEstadoArena`/
  `datosEquipos`/`validarConfigArena` tras `reglasDesde`, y en la UI tras la **presencia** de los datos
  (`config.atributos`, `config.estilosJuego`).
- La UI no mira la versión.

### 3.3 Sitios que hoy fijan «v5» con `ARENA.reglas` o con la predeterminada

Pasan al literal en la publicación 1 (y luego al de la versión anterior que corresponda):

- `reinicios.test.ts:131`;
- `motor046.test.ts:791-799`;
- `motor051.test.ts:591-595`;
- `generar-reinicios-v5.ts` (ya usa el literal: sin cambio).

Las pruebas de torneo que construyen el marco con `ARENA.reglas` (`torneo-ejecucion.test.ts:27`,
`torneo-sitio.test.ts:55`, `torneo-grupos.test.ts:234`) se quedan como están: describen torneos nuevos. Los
fixtures de torneo con `"reinicios-v5"` deben seguir validando: es una prueba existente que no se toca.

### 3.4 Desviaciones técnicas respecto de la interpretación comunicada (declaradas)

1. **Sin atributo de juego aéreo.** En la arena los centros y los saques aéreos solo se tocan cerca de su caída
   y casi nunca hay dos rivales allí (470 de 479 sin disputa, § 1). Un atributo aéreo sería decorativo y Carlos
   pidió estadísticas que «reflejen bastante en el campo».
   - Se probó en el prototipo: radio aéreo ×(1 ± 0,3) y luego un duelo aéreo explícito. La diferencia de éxito
     entre 30 y 80 fue nula o del signo contrario.
   - Queda para un brief que haga que los defensores ataquen la caída (§ 15).
2. **Identidad por nombre, no por el `estilo` del simulador.** El estilo histórico cambia por semilla para el
   mismo club (§ 1). «Conocido por ser defensivo» exige estabilidad.
   - La identidad se deriva del **nombre normalizado**, como la equipación del 055: el mismo club tiene la
     misma identidad en todos sus partidos y en favoritos.
   - El entrenador y el `estilo` histórico siguen como hoy. Pueden contradecir la identidad: se suman, y la UI
     lo dice.
3. **Repliegue solo con poseedor.** Un pase en vuelo que deja a un atacante solo no dispara el repliegue hasta
   que el atacante controla el balón. No se midió el disparo durante el vuelo; queda como límite (§ 15).

## 4. Datos nuevos y su validación

### 4.1 Tipos (`tipos.ts`)

```ts
export const atributosJugador = ["velocidad", "resistencia", "aguante", "entrada", "vision", "potencia"] as const;
export type AtributoJugador = (typeof atributosJugador)[number];
export type AtributosJugador = Record<AtributoJugador, number>;            // enteros [ATRIBUTOS_ARENA.min, .max]
export const estilosJuego = ["defensivo", "ofensivo", "posesion", "contragolpe", "directo", "presion"] as const;
export type EstiloJuego = (typeof estilosJuego)[number];
export type LineaArena = "POR" | "DEF" | "MED" | "DEL";
// ConfigArena gana (opcionales; § 4.3):
//   atributos?: Record<string, AtributosJugador>;     // desde reinicios-v7: los 2 × min(16, plantilla) IDs
//   estilosJuego?: Record<Lado, EstiloJuego>;          // desde reinicios-v8
// EstadoArena gana (desde reinicios-v6, SIEMPRE presente, nunca undefined):
//   persecucion?: { jugador: string; lado: Lado; desdeTick: number; hastaTick: number } | null;
// Vuelo gana (desde reinicios-v7, solo en remates): lejano?: true;
// ObservacionArena.equipos[lado] gana: atributos?: Record<string, AtributosJugador> (solo los IDs de ese
//   lado: titulares y banco), estiloJuego?: EstiloJuego.
```

### 4.2 Dónde viven y por qué

- **Atributos en la configuración**, como `entrenadores`, no en `JugadorArena`. Son constantes en el partido.
  Ponerlos en cada fotograma costaba +1,26 MB por registro de 180 s (§ 1).
- La configuración guarda los valores y **el motor usa los guardados**, no los recalcula. Así los experimentos
  controlados fuerzan atributos editando la configuración, sin ganchos (§ 11.3).
- Un archivo editado a mano se reproduce de forma coherente consigo mismo, como pasa hoy con `entrenadores`.
- **`estado.persecucion`** sí es estado: cambia en el partido, la ven los LLM y la UI puede rotularla.
  - Pesa ≈ 20 bytes por fotograma cuando es `null`.
  - Desde v6, `crearEstadoArena` lo inicializa a `null`, y el motor **asigna `null`, nunca `undefined` ni
    `delete`**.
  - En v1–v5 la clave no existe.

### 4.3 Creación y validación

`crearConfigArena`:

- con `reglasDesde(config, "reinicios-v7")`: `atributos` = `{ [id]: atributosDe(nombreEquipo, nombreJugador,
  posicion, perfil) }` para cada jugador de `plantillaArena(partido, lado, true)` de los dos lados;
- con `reglasDesde(config, "reinicios-v8")`: `estilosJuego` = `{ local: estiloJuegoDe(partido.local.nombre),
  visita: estiloJuegoDe(partido.visita.nombre) }`.

`validarConfigArena`:

- `atributos` está presente **si y solo si** las reglas son ≥ v7.
  - Es un `z.strictObject` cuyas claves son exactamente los IDs de `plantillaArena` de ambos lados.
  - Cada valor es un `z.strictObject` con las seis claves, enteros en [`min`, `max`].
- `estilosJuego` está presente **si y solo si** las reglas son ≥ v8: `z.strictObject({ local, visita })` con
  `z.enum(estilosJuego)`.
- Una configuración v5 con `atributos` se rechaza («Atributos fuera de su versión»).

`datosEquipos(config, estado)`:

- añade `atributos` (los IDs de ese lado) si `config.atributos` existe;
- añade `estiloJuego` si `config.estilosJuego` existe;
- nunca con valor `undefined`.

### 4.4 `atributosDe(equipo, jugador, posicion, perfil)` (módulo puro nuevo `src/arena/atributos.ts`)

Pasos:

1. PRNG `prngDerivado(ATRIBUTOS_ARENA.semilla, \`atributos:arena-v7:${equipo}:${jugador}\`)`.
2. Seis extracciones `int(−variacion, variacion)`, en el orden de `atributosJugador`.
3. Una extracción `pick` del atributo distintivo, entre los seis (entre `velocidad` y `vision` si
   `posicion === "POR"`), que suma `distintivo`.
4. Resultado: `acotar(round(base[posicion][a] + perfil[perfil][a] + variación + distintivo), min, max)`.

No depende de la semilla del partido, del lado, de la formación ni de la duración. No consume el azar del
generador histórico. El perfil sale de `personalidadDe`, que no cambia.

### 4.5 `estiloJuegoDe(nombre)` (mismo módulo)

- `prngDerivado(ATRIBUTOS_ARENA.semilla, \`estilo-juego:arena-v8:${claveClub(nombre)}\`).pick(estilosJuego)`,
  con `claveClub` de `identidad.ts`.
- En las semillas 1–200 salen los seis: directo 62, ofensivo 82, presión 74, posesión 80, contragolpe 42 y
  defensivo 60 (de 400 equipos).

### 4.6 Línea de un puesto (`lineaDePuesto(puesto)`, mismo módulo)

| Puesto | Línea |
| --- | --- |
| `POR` | POR |
| `DFC*`, `LI`, `LD`, `CAR*` | DEF |
| `DC*`, `EI`, `ED` | DEL |
| El resto (`PIV*`, `INT*`, `MC*`, `VOL*`, `MP*`) | MED |

Se usa el puesto **actual**: un medio natural que juega de extremo persigue como delantero.

## 5. Constantes nuevas en `src/sim/limites.ts` (comentadas, tras `LOTE_ARENA_051`)

Ninguna prueba las repite. Son las del prototipo final.

```ts
/** Brief 063 · Bloque A (reinicios-v6): repliegue de emergencia y persecución tras pérdida. */
export const PERSECUCION_ARENA = {
  /** Repliegue: defensores de las líneas `lineasRepliegue` a ≤ radioM del balón, como máximo `max`, sin el
   * perseguidor; destino a `adelantoM` del balón sobre la recta balón–centro del arco propio. */
  repliegue: { lineas: ["DEF", "MED"], radioM: 30, max: 4, adelantoM: 4 },
  /** Persecución: segundos base por línea, factores de agresividad, energía y bloque del entrenador, y cotas. */
  segundos: { DEF: 6, MED: 4, DEL: 3 },
  agresividadMin: 0.75, agresividadRango: 0.5, energiaMin: 0.5,
  bloque: { bajo: 0.85, medio: 1, alto: 1.15 }, minS: 1.5, maxS: 8,
  /** Límite espacial: x orientada propia mínima del destino = fracción × largoM (DEF sin límite). */
  limiteFraccion: { DEF: 0, MED: 1 / 3, DEL: 0.5 },
  /** Frenado (m/s²) de quien está en repliegue o persecución cuando la velocidad deseada reduce la actual. */
  frenadoMps2: 5,
} as const;

/** Brief 063 · Bloque B (reinicios-v7): atributos de jugador. Efecto de un valor a: (a − neutro)/neutro. */
export const ATRIBUTOS_ARENA = {
  semilla: 0x61747231, min: 20, max: 95, variacion: 12, distintivo: 12, neutro: 50,
  base: {
    POR: { velocidad: 40, resistencia: 46, aguante: 38, entrada: 28, vision: 48, potencia: 50 },
    DEF: { velocidad: 43, resistencia: 48, aguante: 44, entrada: 60, vision: 40, potencia: 38 },
    MED: { velocidad: 46, resistencia: 56, aguante: 48, entrada: 48, vision: 56, potencia: 46 },
    DEL: { velocidad: 56, resistencia: 42, aguante: 52, entrada: 30, vision: 44, potencia: 59 },
  },
  perfil: {
    defensivo: { entrada: 8, potencia: -5, vision: -3 }, ofensivo: { velocidad: 7, potencia: 5, entrada: -7 },
    pasador: { vision: 12, aguante: 3, velocidad: -4, potencia: -4 }, conductor: { aguante: 9, velocidad: 7, vision: -4 },
    rematador: { potencia: 11, resistencia: -5, vision: -6 }, equilibrado: { resistencia: 5 },
  },
  /** Efectos (factor = 1 + k · efecto, o suma k · efecto en el duelo). */
  velocidadMax: 0.10, aceleracion: 0.15, resistenciaDesgaste: 0.35,
  aguanteDuelo: 0.15, entradaDuelo: 0.15, visionError: 0.2, potenciaVelocidad: 0.08,
  /** Rasgo distintivo mostrado en la UI: el atributo mayor si alcanza este valor. */
  distintivoMin: 70,
  etiquetas: { /* § 9.1, ES/EN */ }, rasgos: { /* § 9.1 */ }, efectos: { /* § 9.1 */ },
} as const;

/** Brief 063 · Bloque C (reinicios-v7): remate lejano y balón largo. */
export const LARGO_ARENA = {
  remate: { potenciaMin: 60, maxM: 33, espacioM: 5, lineaM: 2, probabilidad: 0.35, remateBase: 0.5, potenciaBase: 0.5,
    /** El error del remate se multiplica por (1 + errorPorM·(d − radioTiroM)); el alto suma altoPorM·(d − radioTiroM). */
    errorPorM: 0.3, altoPorM: 0.03, altoMax: 0.6 },
  pase: { visionMin: 50, maxM: 55, penalizacion: 0.7, avanceMinM: 10, cambioFraccion: 0.4,
    /** Error extra = errorM · (d − paseMaxM)/(maxM − paseMaxM) · (errorVisionBase − visión/100). */
    errorM: 3, errorVisionBase: 1.5 },
} as const;

/** Brief 063 · Bloque D (reinicios-v8): identidad de juego. umbral* se suman a los mínimos de LARGO_ARENA. */
export const ESTILO_JUEGO_ARENA = {
  efectos: {
    defensivo:   { bloqueM: -5, persecucion: 0.8,  extra: 0, repliegue: 1,  largo: 1.2, lejano: 0.8,  umbralLargo: -5,  umbralLejano: 5 },
    ofensivo:    { bloqueM: 3,  persecucion: 1.15, extra: 0, repliegue: -1, largo: 1,   lejano: 1.25, umbralLargo: 0,   umbralLejano: -10 },
    posesion:    { bloqueM: 0,  persecucion: 1.15, extra: 1, repliegue: 0,  largo: 0.6, lejano: 0.8,  umbralLargo: 20,  umbralLejano: 10 },
    contragolpe: { bloqueM: -3, persecucion: 0.9,  extra: 0, repliegue: 1,  largo: 1.5, lejano: 1,    umbralLargo: -10, umbralLejano: 0 },
    directo:     { bloqueM: 0,  persecucion: 1,    extra: 0, repliegue: 0,  largo: 1.5, lejano: 1.2,  umbralLargo: -15, umbralLejano: -10 },
    presion:     { bloqueM: 5,  persecucion: 1.3,  extra: 1, repliegue: 0,  largo: 1,   lejano: 1,    umbralLargo: 0,   umbralLejano: 0 },
  },
  etiquetas: { /* § 9.3, ES/EN */ }, descripciones: { /* § 9.3 */ },
} as const;
// LOTE_ARENA_063 (bandas, experimentos y recalibración): § 11–12.
```

`ARENA`, `REMATE_ARENA`, `PORTERO_ARENA`, `ATAQUE_ARENA`, `TECNICA_ARENA` y `PERSONALIDAD_ARENA` **no cambian**.

## 6. Bloque A · Persecución (`reinicios-v6`)

Funciones puras nuevas en `src/arena/persecucion.ts`. El motor las llama solo bajo `v6`.

### 6.1 Superado

`superadoPor(estado): JugadorArena | null`: devuelve el poseedor si se cumplen todas las condiciones:

- el poseedor existe, es de campo y no tiene `balon.manos`;
- la `x` orientada del poseedor (`transformar(posicion, lado).x`) es **estrictamente mayor** que la máxima `x`
  orientada (en el marco del poseedor) de los rivales de campo, es decir, **sin el portero**;
- quedan rivales de campo (si no queda ninguno, `null`).

Se evalúa una vez por tick sobre el estado anterior al paso, como `perseguidores` (`motor.ts:398`), y solo
fuera de pausa y saque.

### 6.2 Repliegue de emergencia

Con `s = superadoPor(estado)` y `D = rival(s.lado)`:

- **Conjunto `repliegue`**: jugadores de D de campo cuya `lineaDePuesto` ∈ `repliegue.lineas`, distintos del
  perseguidor de D y a ≤ `repliegue.radioM` del balón.
  - Se ordenan por distancia al balón y luego por id.
  - Se toman los primeros `repliegue.max` (+ `efectos[estilo D].repliegue` bajo v8).
- **Destino**: `destinoRepliegue(balon, D)` = `balon + (G − balon)·min(adelantoM, |G − balon|)/|G − balon|`,
  con `G` el centro del arco de D y `enCancha`. Si `|G − balon| = 0`, `G`.
- **Precedencia en `moverJugadores`**:
  1. la regla va justo después de `presionar` (`motor.ts:418`): `else if (repliegue.has(j.id))`;
  2. una orden `presionar` gana, porque va al balón;
  3. el repliegue gana a cualquier otra orden (`mover`, `cubrir`, `apoyar`, `profundidad`): es objetivo, como
     la salida del portero del 046.

### 6.3 Persecución tras pérdida

**Creación (`recibir(j, perdedorDuelo?)`, bajo v6, después de la comprobación de fuera de juego —que retorna antes— y antes de reasignar el balón).** Se determina el perdedor:

1. si es un robo en duelo: `perdedorDuelo`, el portador (`moverBalon` pasa a llamar `this.recibir(defensor,
   portador)`);
2. si no, y hay vuelo con `tipo` ∈ {`pase`, `tiro`} y `vuelo.lado ≠ j.lado`: `vuelo.autor`;
3. si no: `balon.ultimoToque.jugador` si `ultimoToque.lado ≠ j.lado`. Un `rechace` conserva el lado del
   remate y el último toque es del portero: no hay perdedor.

No se crea persecución si el perdedor no existe o es `POR`, o si `j` es `POR` dentro de su área (balón en las
manos, atajada).

Si `estado.persecucion?.lado === j.lado` (el lado que perseguía recupera), se borra (`null`) antes de crear la
nueva.

**Duración.**

`s = segundos[línea] · (agresividadMin + agresividadRango·agresividad/100) · (v8 ? efectos[estilo].persecucion : 1)
· bloque[plan.bloque] · (energiaMin + (1 − energiaMin)·energía)`, acotada a [`minS`, `maxS`].

- `agresividad` es la de la personalidad, y vale 50 si falta.
- `plan.bloque` es el de `estado.entrenadores[lado].plan`, y vale `medio` si falta.
- `hastaTick = tick + round(s / pasoS)`.

**Fin.** `estado.persecucion = null` (lista cerrada, v1.1 § 17.3):

- cuando `tick ≥ hastaTick`, al empezar `moverJugadores`;
- en `prepararSaque`, `reiniciar` y `resolverFalta`;
- cuando el lado perseguidor recupera;
- cuando `recibir` da el balón a un portero dentro de su área (atajada o manos), sea del lado que sea.

Si el perdedor ya no está en cancha (sustituido o expulsado), el conjunto queda vacío y el estado se borra al
vencer.

**Conjunto `persiguen`** (solo con `ladoBalon ≠ lado` de la persecución):

- el perdedor;
- bajo v8 y si `efectos[estilo].extra = 1`, además el jugador de campo de ese lado más cercano al balón, sin
  contar al perdedor ni al perseguidor (orden por distancia y luego por id).

**Destino.** `destinoPersecucion(balon, j)`: el balón, con la `x` orientada propia de `j` acotada a ≥
`limiteFraccion[línea]·largoM`. Ejemplo: un delantero con el balón en su campo se queda en la mitad de la
cancha, a la altura `y` del balón.

**Precedencia (v1.1 § 17.1).**

1. va después del repliegue: `else if (persiguen.has(j.id))`, con destino `destinoPersecucion`;
2. **límite universal**: después de elegir el destino por cualquier rama (`presionar`, perseguidor, repliegue
   o persecución), si `j ∈ persiguen` y el rival tiene el balón, su `x` orientada propia se acota a ≥
   `limiteFraccion[línea]·largoM`. El límite manda también sobre `presionar` (que el programado ordena al más
   cercano, `controladores.ts:120`) y sobre el repliegue de un medio perdedor;
3. a los perseguidores y presionadores que no están en `persiguen` no se les aplica límite. Es el
   comportamiento v5.

### 6.4 Frenado de quien reacciona

Para `j ∈ repliegue ∪ persiguen`: si `rapidez actual > 0` y `deseada·v/|v| < |v|` (la velocidad deseada reduce
la componente actual), el límite del cambio de velocidad de ese paso es `frenadoMps2` en vez de la
aceleración.

- El resto de jugadores conserva exactamente la física v5.
- El primer prototipo con frenado para todos rompió `conducirFrenado` (0,24–0,27 > 0,25) en los tres lotes.

### 6.5 Observación y prompt

- La observación lleva `estado.persecucion` sin trabajo extra.
- `frasesPersecucion()` en `controladores.ts`, construida con constantes y añadida a `SISTEMA_ARENA`:

> «Si un rival con el balón supera a tu último defensor de campo, hasta {max} de tus defensas y medios a ≤ {radioM}
> m corren hacia tu arco aunque no lleguen; quien pierde el balón lo persigue entre {minS} y {maxS} s (un
> delantero no pasa de la mitad de tu campo, un medio no entra en tu tercio defensivo, un defensa no tiene
> límite). Ninguna orden lo activa; presionar sigue yendo al balón.»

## 7. Bloque B · Atributos (`reinicios-v7`)

### 7.1 Efectos

`ef(a) = (a − neutro)/neutro` ∈ [−0,6; 0,9]. Todo bajo `v7`, con los atributos de `config.atributos[j.id]`.

| Atributo | Dónde (motor) | Efecto |
| --- | --- | --- |
| velocidad | `moverJugadores` | `max ×= 1 + velocidadMax·ef`; aceleración del jugador = `aceleracionMps2·(1 + aceleracion·ef)`, usada en `rapidez` y en el factor del paso (el frenado de § 6.4 no cambia) |
| resistencia | `moverJugadores` | el desgaste por metro × (1 − resistenciaDesgaste·ef) |
| aguante | duelo (`moverBalon`) | p −= aguanteDuelo·ef(portador) |
| entrada | duelo | p += entradaDuelo·ef(defensor), antes del `limitar` existente |
| visión | `sacarBalon`, pase | error × (1 − visionError·ef), en todos los pases (también centros y saques). Además, el alcance del balón largo (§ 8.2) |
| potencia | `moverBalon`, vuelo `tiro` | velocidad del remate × (1 + potenciaVelocidad·ef(autor)); la misma velocidad efectiva fija el tiempo de reacción del portero (051 v1.1 #3). Además, el umbral del remate lejano (§ 8.1) |

- Cada multiplicador vale exactamente 1 (o suma 0) con su atributo a 50. Lo comprueba la prueba B3 (v1.2 § 18.6); v7 con atributos a 50 **no** equivale a v6 cuando interviene el bloque C.
- Los porteros tienen atributos y se les aplican igual. Las bases bajas del portero en `entrada` hacen que dispute
  peor fuera de las manos. Medido: sin efecto material en la conversión del mano a mano.

### 7.2 Coherencia (medido en el prototipo final, 5 600 jugadores de campo, semillas 1–200)

- Medias globales: velocidad 50,7, resistencia 51,0, aguante 51,5, entrada 49,5, visión 50,4 y potencia 49,0.
- Rango: 20–94.
- Por línea:
  - DEL: velocidad 59,9 y potencia 66,0.
  - DEF: entrada 63,9.
  - MED: visión 61,0 y resistencia 58,5.
- El 41 % de los jugadores tiene un rasgo distintivo ≥ 70 (`distintivoMin`) y el 22 %, uno ≥ 75.

## 8. Bloque C · Remate lejano y balón largo (`reinicios-v7`)

### 8.1 Remate lejano

**Candidato (`puedeRematarLejos(j, estado, estilo?)`, puro).** Deben cumplirse todas:

- `j` es de campo y tiene atributos;
- `potencia ≥ remate.potenciaMin` (+ `umbralLejano` de su estilo bajo v8);
- la distancia orientada al centro del arco rival está en (`radioTiroM`, `remate.maxM`];
- |y orientada − 34| ≤ `areaAnchoM`/2;
- ningún rival a < `espacioM`;
- ningún rival de campo a < `lineaM` del segmento `j`–centro del arco.

**Decisión local (`accionBalon`, v7).**

- Va tras `tiroLocal` falso y sin acción explícita, antes del centro.
- Requiere `puedeRematarLejos` y que el PRNG `arena:lejano:${tick}:${id}` dé `chance(min(1, p))`, con
  `p = probabilidad · (v8 ? efectos[estilo].lejano : 1) · (remateBase + remate/100) · (potenciaBase + ef(potencia))`.
- Entonces `sacarBalon(j, "tiro", arco, null)`.

**Orden `tirar` del LLM fuera de alcance (v7, v1.1 § 17.2).** Si `d > remate.maxM`, la orden es «imposible»,
igual que el `pasar` fuera de alcance del 046: ese tick decide en local. Consumo (v1.2 § 18.5): si la decisión
local suelta el balón (pase, centro, remate, balón largo), `ejecutadas` consume la orden como hoy; si solo
conduce, la orden sigue pendiente y se reevalúa en la siguiente decisión. Entre
`radioTiroM` y `maxM` se ejecuta sin exigir potencia, espacio ni línea limpia (es decisión del modelo). Así el
dominio de la ejecución queda acotado: `lejos ≤ maxM − radioTiroM` y el multiplicador de error ≤
`1 + errorPorM·(maxM − radioTiroM)` (3,4).

**Ejecución (`sacarBalon`, v7, cualquier `tiro` a d ≤ `maxM`, también el `tirar` del LLM).** Con `lejos =
max(0, d − radioTiroM)` y `d` la distancia al centro del arco:

- si `lejos > 0`:
  - el error de v5 se multiplica por `1 + errorPorM·lejos`;
  - la probabilidad de `alto` es `min(altoMax, probabilidadAlto(...) + altoPorM·lejos)`;
  - el vuelo lleva `lejano: true` y el evento `tiro` lleva `motivo: "lejano"`;
- con `lejos = 0` nada cambia respecto de v6.

**Portero ante un remate lejano (`moverJugadores`, v7).**

- Condición: el portero no es el poseedor y hay un vuelo `tiro` rival con `lejano`.
- Destino: el punto de la trayectoria `origen → destino` en la `x` orientada actual del portero, con `t`
  acotado a [0; 1]. Sigue el límite de área existente.
- Va después de la salida y del posicionamiento del 051, a los que sustituye en ese caso, y antes de
  `respetarManos`.
- Aplicarlo a **todos** los remates bajaba los goles de 2,11 a 1,93 en el lote 1–100. Por eso solo se aplica a
  los lejanos, cuyo vuelo dura ≥ 0,9 s.

### 8.2 Balón largo

**Alcance.** `alcanceLargo(j, estilo?)` = `paseMaxM + (pase.maxM − paseMaxM)·min(1, (visión − u)/(100 − visionMin))`,
con `u = visionMin + (v8 ? umbralLargo : 0)`. Si `visión < u`, no hay balón largo.

**Candidato (`opcionPaseLargo(j, estado, estilo?)`, puro).** Para cada compañero de campo `r` (nunca desde ni
hacia el portero):

- `d = distancia(j, r)` ∈ (`paseMaxM`, `alcanceLargo`];
- avance orientado ≥ `avanceMinM` **o** |Δy| ≥ `cambioFraccion·anchoM` (cambio de orientación);
- `destino` = `r` extrapolado con su velocidad durante `d/velocidadBalonMps` (`enCancha`);
- `ventaja` = (distancia mínima de un rival de campo al destino) − (distancia de `r` al destino) > 0;
- `puntuacion = avance + min(ventaja, margenUtilM) − d·pesoDistanciaPase·penalizacion / (v8 ? efectos[estilo].largo : 1)`.

Gana la mayor puntuación; en empate, el id menor.

**Decisión local (`accionBalon`, v7).**

- Va tras el `conducir` explícito y antes del pase corto.
- Se aplica si no hay `pasar` explícito válido, `!prefiereConducir(j)` y `j` no es el portero.
- Se ejecuta si `largo.puntuacion > (evaluarPases(j, obs)[0]?.puntuacion ?? −∞)`.
- Entonces `sacarBalon(j, "pase", largo.destino, largo.receptor.id, { motivo: "largo", aereo: true })`. Reutiliza
  la fase aérea del 046: solo se toca a ≤ `caidaM` de su destino.

**`pasar` del LLM (v7).**

- Si el receptor es propio, de campo y está a una distancia en (`paseMaxM`, `alcanceLargo(j)`], sale como
  balón largo hacia `destinoPase(j, receptor)`, con `aereo` y `motivo: "largo"`, sin exigir ventaja.
- En otro caso, la rama `pasarImposible` del 046 no cambia.
- El portero no lanza balones largos por esta vía. Sus saques desde las manos no cambian.

**Error.**

- A la del pase v7 (con visión) se suma `errorM·(d − paseMaxM)/(maxM − paseMaxM)·(errorVisionBase − visión/100)`.
- Sigue siendo lateral, con la misma extracción `arena:golpe`, como el pase de hoy.

### 8.3 Eventos, texto y prompt

**`EventoArena.motivo`** gana `"largo"` (pase) y `"lejano"` (tiro). `estadisticas.ts` (049) y `estadista.ts`
(045) **no cambian**: el `git diff` debe quedar vacío. Un balón largo cuenta como pase y un remate lejano como
remate.

**`vista.narrarEventoArena`:**

- ES «{nombre} lanza un balón largo hacia {receptor} ({m} m).»
- EN «{nombre} plays a long ball towards {receptor} ({m} m).»
- ES «{nombre} prueba desde lejos ({m} m).»
- EN «{nombre} tries a long-range shot ({m} m).»

**`relato.ts` breve**, cuatro variantes por idioma para el `tiro` lejano:

- ES «¡Prueba desde lejos {j}!», «¡Disparo lejano de {j}!», «¡{j} se anima desde fuera!», «¡Le pega de lejos
  {j}!».
- EN «{j} tries it from distance!», «A long-range effort from {j}!», «{j} lets fly from range!», «{j} has a go
  from deep!».

Para el pase largo, una por idioma: ES «¡Balón largo de {j}!», EN «Long ball from {j}!».

`PRIORIDAD_EVENTO_ARENA` no cambia: el pase sigue sin voz y el remate tiene la suya.

**`frasesAtributos()` y `frasesLargo()`**, añadidas a `SISTEMA_ARENA` y construidas con constantes:

> «equipos[lado].atributos da, por ID, seis capacidades 0–100: velocidad (punta y aceleración), resistencia
> (desgaste), aguante (conservar el balón en el duelo), entrada (robarlo), vision (precisión y balón largo) y
> potencia (fuerza y remate lejano); el nivel sigue siendo la capacidad general.»

> «Un pasar a un compañero de campo entre {paseMaxM} m y el alcance de visión del pasador (hasta {maxM} m)
> sale como balón largo por arriba; un tirar desde más de {radioTiroM} m es un remate lejano, con más error,
> más probabilidad de irse alto y un portero que va a la trayectoria; un tirar desde más de {remate.maxM} m no se
> ejecuta: el jugador decide por su cuenta.» (`{maxM}` del pase es `LARGO_ARENA.pase.maxM`.)

## 9. Bloque D · Identidad de juego (`reinicios-v8`) e interfaz de B y D

### 9.1 UI de los atributos (bloque B; los datos vienen de `registro.config.atributos`)

**Textos ES/EN en `ATRIBUTOS_ARENA`.**

| Clave | Etiqueta ES / EN | Rasgo distintivo ES / EN | Cómo se nota ES / EN |
| --- | --- | --- | --- |
| velocidad | Velocidad / Pace | Muy rápido / Very quick | Más velocidad punta y aceleración. / Higher top speed and acceleration. |
| resistencia | Resistencia / Stamina | Incansable / Tireless | Se desgasta menos al correr. / Tires less when running. |
| aguante | Aguante con balón / Ball retention | Protege el balón / Shields the ball | Pierde menos duelos con el balón. / Loses fewer duels on the ball. |
| entrada | Entrada / Tackling | Gran quite / Strong tackler | Gana más duelos para robar. / Wins more tackles. |
| vision | Visión / Vision | Lee el juego / Reads the game | Pasa con más precisión y ve balones largos. / Passes more accurately and spots long balls. |
| potencia | Potencia de disparo / Shot power | Disparo potente / Powerful shot | Dispara más fuerte y se anima desde lejos. / Shoots harder and tries from distance. |

**Rasgo distintivo.** `rasgoDistintivo(a)` (puro, en `atributos.ts`) es el atributo mayor (en empate, el
primero de `atributosJugador`) si alcanza `distintivoMin`; si no, `null`.

**Ficha del jugador (`ArenaPlantilla.tsx`).**

- Tras `arena-player-metrics`, una sección `data-testid="arena-player-attributes"` con seis
  `<label>/<meter min=0 max=100>`. Reutiliza `.arena-traits`.
- Debajo, `<details>` «Cómo se notan en la cancha / How they show on the pitch» con la columna de efectos.
- Sin atributos (archivos anteriores): `data-testid="arena-legacy-attributes"`, con «Esta grabación es anterior
  a los atributos de jugador. / This recording predates player attributes.».

**Tira «En voz» (`ArenaPrevia.tsx`, `TiraEnVoz`).**

- Tras el nivel: `<span data-campo="rasgo">{rasgo} {valor}</span>`, si hay rasgo distintivo.
- La nota «Perfil previo…» no cambia.

**`PreviaVisual` (`previa.ts`)** gana `atributos: Record<string, AtributosJugador> | null` y `estiloJuego` por
equipo (o `null`). **La previa hablada no cambia**: `hechosEquipo`, `piezaEquipo` y la antesala quedan
intactas, sin texto nuevo en la voz.

### 9.2 Efectos de la identidad (motor, `v8`; tabla `ESTILO_JUEGO_ARENA.efectos`)

| Efecto | Dónde |
| --- | --- |
| `bloqueM` | `moverJugadores`: se suma a `alturaBloqueM[bloque]` sin balón (`motor.ts:411`) |
| `persecucion`, `extra` | duración y apoyo de la persecución (§ 6.3) |
| `repliegue` | suma al máximo de repliegue del lado que defiende (§ 6.2) |
| `largo`, `umbralLargo` | divisor de la penalización y umbral de visión del balón largo (§ 8.2) |
| `lejano`, `umbralLejano` | factor de probabilidad y umbral de potencia del remate lejano (§ 8.1) |

La identidad se suma al plan del entrenador (que sigue eligiendo el bloque con el LLM) y al `estilo` histórico
(que sigue pesando en `opcionPase`).

**Prompt.** `frasesIdentidad()`:

> «equipos[lado].estiloJuego es la identidad del club (defensivo, ofensivo, posesion, contragolpe, directo,
> presion); mueve el bloque y la persecución y cambia cuántos balones largos y remates lejanos intentan tus
> jugadores por su cuenta; tus órdenes pueden ir contra ella.»

### 9.3 UI de la identidad

**Textos.**

| Clave | ES | EN | Descripción ES / EN |
| --- | --- | --- | --- |
| defensivo | Defensivo | Defensive | Bloque más bajo y repliegue con más jugadores. / Deeper block and more players tracking back. |
| ofensivo | Ofensivo | Attacking | Bloque más alto, más remates lejanos y menos repliegue. / Higher block, more long-range shots, fewer players tracking back. |
| posesion | Posesión | Possession | Pocos balones largos; tras perderlo presiona un jugador más. / Few long balls; one extra player presses after losing it. |
| contragolpe | Contragolpe | Counter-attacking | Bloque bajo y más balones largos al espacio. / Deep block and more long balls into space. |
| directo | Juego directo | Direct play | Muchos balones largos y remates lejanos. / Many long balls and long-range shots. |
| presion | Presión alta | High press | Bloque alto y persecución más larga tras perderlo; un jugador más presiona. / High block and longer chase after losing it; one extra presser. |

**Dónde se muestra.**

- **Tarjeta de alineaciones** (`ArenaPrevia`): bajo la cabecera de cada equipo, la píldora
  `data-testid="arena-lineup-identity"` con «Identidad: {ES}» / «Identity: {EN}». Debajo, un `<details>` con
  la descripción como texto legible (no solo en `title`).
- **Tarjeta del entrenador** (`ArenaContexto`): una línea «Identidad del club: {etiqueta}».
- **Texto de límites** (`Arena.tsx`), una frase por bloque publicado:
  - A: «Los defensores superados corren hacia su arco y quien pierde el balón lo persigue un tramo según su
    línea; es una regla sintética simplificada.»
  - B+C: «Seis atributos sintéticos por jugador modulan velocidad, desgaste, duelos, precisión y potencia; hay
    balones largos por arriba y remates lejanos, sin altura simulada.»
  - D: «La identidad de juego del club se deriva de su nombre y modula bloque, persecución y frecuencia de
    balones largos y remates lejanos.»

**Regla 047**: nada de esto lleva `transform`, `transition` ni `animation` CSS en `.arena-player`,
`.arena-ball` ni `.arena-referee`. Todo cabe a 360 px sin desplazamiento horizontal.

## 10. Prototipo final: cifras medidas (programados, 120 s)

Fuentes:

- `lotes/*-lote-*.json`: helper del repositorio con `--controlado`, bandas 046 y 051;
- `lotes/medir*-*.json`: métricas de § 11.1.

Versiones:

- v6 = A;
- v7 = A + B + C;
- v8 = A + B + C + D con la identidad por nombre.

| Métrica | v5 1–100 | v5 101–200 | v6 1–100 | v6 101–200 | v7 1–100 | v7 101–200 | v8 1–100 | v8 101–200 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Goles por partido (1–30: v5 2,27 · v6 2,20 · v7 1,77 · v8 1,60) | 2,17 | 2,24 | 2,23 | 2,26 | 2,14 | 1,90 | 1,82 | 1,85 |
| Remates por partido | 5,06 | 5,08 | 5,11 | 5,00 | 4,83 | 4,84 | 4,72 | 4,69 |
| Incumplimientos 046 + 051 + controlado 051 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| A puerta / conversión | 0,723 / 0,429 | 0,736 / 0,441 | 0,691 / 0,434 | 0,710 / 0,450 | 0,718 / 0,443 | 0,705 / 0,390 | 0,663 / 0,383 | 0,682 / 0,392 |
| Centros por partido (1–30: 0,70 · 0,63 · 0,47 · 0,43) | 0,56 | 0,68 | 0,69 | 0,76 | 0,49 | 0,74 | 0,49 | 0,88 |
| `repliegueCorren` | 0,36 | 0,37 | 0,68 | — | — | — | 0,69 | 0,69 |
| `persecucionPerdedor` | 0,30 | 0,32 | 0,47 | — | — | — | 0,49 | 0,45 |
| Balones largos por partido; éxito | 0; — | 0; — | 0; — | — | — | — | 0,98; 0,48 | 1,04; 0,51 |
| Remates lejanos por partido; conversión; a puerta | 0 | 0 | 0 | — | — | — | 0,67; 0,13; 0,45 | 0,64; 0,19; 0,47 |
| Remate: distancia p90; máxima | 24,7; 25,0 | 24,7; 25,0 | — | — | — | — | 28,1; 33,0 | 29,1; 33,0 |

**Experimento controlado de atributos** (v8 con la identidad del primer prototipo, semillas 1–100, solo el
`local`, jugadores de campo, 30 frente a 80; `lotes/controlado-atributos-1-100.jsonl`):

- velocidad máxima media 6,73 → 7,39 m/s;
- robos sufridos por minuto de posesión (aguante) 2,64 → 2,02;
- robos hechos por partido (entrada) 1,05 → 1,64;
- balones largos por partido (visión) 0 → 1,66;
- remates lejanos por partido (potencia) 0 → 0,86;
- energía final media (resistencia) 0,816 → 0,875.

**Experimento controlado de identidad** (semillas 1–200, `local` forzado; `lotes/estilos-1-200.jsonl`):

| Identidad | x media de los de campo sin balón | Balones largos | Remates lejanos | Persecución |
| --- | --- | --- | --- | --- |
| defensivo | 43,3 m | 0,56 | 0,21 | 6,0 s |
| contragolpe | 43,5 m | 0,83 | 0,23 | 6,4 s |
| directo | 45,7 m | **1,26** | 0,47 | 6,9 s |
| posesión | 46,5 m | **0,06** | **0,10** | 8,1 s |
| ofensivo | 47,8 m | 0,47 | **0,47** | 7,9 s |
| presión | **48,8 m** | 0,44 | 0,22 | **8,3 s** |

Balones largos, remates lejanos y persecución son por partido; la persecución, en segundos con persecución
activa.

**Ablaciones** (v8, 1–100 / 101–200, solo goles por partido; `lotes/` y § 12.2):

- con todo: 2,04 / 1,98 (primer candidato);
- sin repliegue: 1,89 / 1,87;
- sin persecución: 1,99 / 1,96;
- sin remate lejano: 2,06 / 2,26;
- sin balón largo: 2,06 / 2,04.

El sistema es caótico: ninguna regla mueve los goles de forma monótona por encima del ruido (error típico de un
lote de 100 ≈ 0,14).

## 11. Métricas de lote, experimentos y bandas

### 11.1 Definiciones

Las calcula `metricas-lote.ts` en la misma pasada que las del 046 y el 051. `JugadorMuestra` gana `vx` y `vy`, y
`MuestraTick` gana `vuelo: boolean`. Un denominador cero es «sin muestra» e incumple.

**`repliegueCorren`.** Se cuentan las muestras de los ticks fuera de pausa y saque con poseedor de campo
**superado** (§ 6.1) y un episodio continuo de ≥ `LOTE_ARENA_063.repliegue.edadMinS` (1 s). Entran los
jugadores rivales con `lineaDePuesto` ∈ {DEF, MED} a ≤ `PERSECUCION_ARENA.repliegue.radioM` del poseedor.

- Resultado: fracción de esas muestras con velocidad hacia el propio arco (−vx para el local, +vx para la
  visita) ≥ `velocidadMinMps` (3).
- Es geométrica: se mide igual en v5, lo que permite el contraste.

**`persecucionPerdedor`.** Un robo en duelo ocurre cuando, entre dos muestras consecutivas, el poseedor de
campo de un lado pasa a ser un rival y la primera muestra no tiene vuelo.

- Se miran las muestras de `desdeS` (1 s) a `hastaS` (4 s) después del robo.
- Se cortan en la primera pausa, cuando el perdedor sale o cuando su lado recupera.
- Resultado: fracción en que el perdedor corre a ≥ 3 m/s con cos(velocidad, balón − perdedor) ≥
  `cosenoMin` (0,7).
- También es geométrica.

**Balones largos y remates lejanos.**

- Balones largos: eventos `pase` con `motivo: "largo"`. Éxito = el primer toque posterior (`recepcion`,
  `intercepcion`, `recuperacion`, `atajada`, `reinicio` o `fuera_juego`) es una `recepcion` del mismo lado.
- Remates lejanos: eventos `tiro` con `motivo: "lejano"`, con su desenlace por `desenlaceFisico` (051).
  - Conversión: gol / lejanos.
  - A puerta: gol, atrapada o desvío / lejanos.

### 11.2 Bandas (`LOTE_ARENA_063` en `limites.ts`)

**Para cada versión desde la indicada.** `rapido` (1–30) corre en `npm test`; `completo` (1–100 y 101–200)
corre en `npm run test:stats`.

| Métrica | Desde | `rapido` | `completo` | Medido |
| --- | --- | --- | --- | --- |
| `repliegueCorren` | v6 | ≥ 0,55 | ≥ 0,55 | 0,68–0,69 |
| `persecucionPerdedor` | v6 | ≥ 0,38 | ≥ 0,40 | 0,45–0,49 |
| `repliegueSeleccion` (v1.1 § 17.7) | v6 | — | ≥ 0,55 | no medido |
| Balones largos | v7 | ≥ 8 en el lote | ∈ [0,4; 1,6] por partido | 0,98–1,04 |
| Éxito de los largos | v7 | — | ∈ [0,30; 0,70] | 0,48–0,51 |
| Remates lejanos | v7 | ≥ 5 en el lote | ∈ [0,3; 1,2] por partido | 0,64–0,67 |
| Conversión de lejanos | v7 | — | ≤ 0,30 | 0,13–0,19 |
| A puerta de lejanos | v7 | — | ≤ 0,70 | 0,45–0,47 |

**Contraste** (`test:stats`, 1–100): el mismo lote en `reinicios-v5` **incumple** `repliegueCorren` (0,36) y
`persecucionPerdedor` (0,30), y tiene 0 largos y 0 lejanos. En `reinicios-v6` tiene 0 largos y 0 lejanos.

**Experimento controlado de atributos** (`test:stats`, v7, 1–100).

- Helper `configConAtributos(seed, reglas, atributo, valor)`: `crearConfigArena` y, después, sobrescribe ese
  atributo en `config.atributos` para los jugadores de campo del `local` (`posicionNatural ≠ POR`, titulares y
  banco). Pasa `validarConfigArena`.
- Bandas de la diferencia `alto` (80) − `bajo` (30):

| Atributo | Métrica (solo `local`) | Mínimo | Medido |
| --- | --- | --- | --- |
| velocidad | velocidad máxima media de campo | ≥ 0,4 m/s | 0,66 |
| aguante | robos sufridos por minuto de posesión (bajo − alto) | ≥ 0,3 | 0,62 |
| entrada | robos hechos por partido | ≥ 0,3 | 0,59 |
| visión | balones largos por partido | ≥ 0,8 | 1,66 |
| potencia | remates lejanos por partido | ≥ 0,4 | 0,86 |
| resistencia | energía final media de campo | ≥ 0,03 | 0,059 |

**Experimento controlado de identidad** (`test:stats`, v8, 1–100; el prototipo usó 1–200).

- Helper `configConEstilo(seed, estilo)`: fuerza `config.estilosJuego.local`.
- Bandas:

| Diferencia | Mínimo | Medido |
| --- | --- | --- |
| x media sin balón (presión − defensivo) | ≥ 3 m | 5,5 |
| Balones largos (directo − posesión) | ≥ 0,6 | 1,2 |
| Remates lejanos (ofensivo − posesión) | ≥ 0,2 | 0,36 |
| Segundos de persecución (presión − defensivo) | ≥ 1,0 | 2,3 |

La persecución sale de `estado.persecucion` del `local`.

### 11.3 Coste

- `npm test` suma tres lotes rápidos de 30 partidos (v6, v7 y v8; ≈ 5 s cada uno).
- `test:stats` suma:
  - seis lotes completos (v6, v7 y v8 × 2), ≈ 15 s cada uno;
  - doce lotes controlados de atributos y seis de identidad, de 100 partidos cada uno, ≈ 15 s cada uno;
  - el contraste.

  En total ≈ 7 min más. Si molesta, la identidad se mide sobre 1–50: las diferencias tienen margen de ×1,8 o más.

## 12. Bandas existentes, recalibración y ajustes

### 12.1 Bandas del 046 y del 051

- **v6:** todas, íntegras. Medido v6: 0 incumplimientos y goles 2,20–2,26.
- **v7 y v8:** todas, salvo las dos de § 12.3.

### 12.2 Ajustes permitidos

Si la implementación sale de una banda, se ajustan **como máximo dos veces** las constantes de 063, nunca las
bandas, en este orden, y se documenta cada ajuste junto a la constante:

- **v6:** `repliegue.max` 4 → 3; después, `frenadoMps2` 5 → 4.
- **v7:** `LARGO_ARENA.remate.probabilidad` 0,35 → 0,25 y `pase.penalizacion` 0,7 → 0,9 (si los lejanos o
  largos se pasan); `aguanteDuelo`/`entradaDuelo` 0,15 → 0,12.
- **v8:** el mayor |`bloqueM`| (±5 → ±4).

Las ablaciones de § 10 muestran que los goles no responden de forma monótona: el ajuste se juzga por el lote,
no por la dirección esperada. A la tercera vez se escala a Carlos.

### 12.3 Recalibración explícita desde v7 (decisión)

Dos bandas del 046 se recalibran **solo para reglas ≥ v7**, en `LOTE_ARENA_063.recalibracion046`. v6 y
anteriores conservan las originales.

- **Goles por partido.** `completo` [1,8; 2,8] → **[1,5; 2,8]**; `rapido` [1,5; 3,0] → **[1,3; 3,0]**.
  - Medido: v7 2,14 / 1,90 y v8 1,82 / 1,85 (1–30: 1,77 y 1,60), frente a 2,17–2,24 en v5.
  - El suelo del 046 quedaba unas dos veces el error típico del lote por debajo de la media de su época.
    Se mantiene esa distancia con la media nueva: 1,84 − 2·0,14 ≈ 1,56 → 1,5, y 1,84 − 2·0,25 ≈ 1,34 → 1,3.
  - La bajada es esperable: más duelos ganados por quien tiene entrada, remates lejanos de conversión baja que
    sustituyen a otros, y defensas que corren.
  - Sigue siendo una cifra comprimida (120 s), no un partido real.
- **Centros por partido.** `rapido` 0,3 → **0,2**; `completo` 0,4 → **0,35**.
  - Medido: 0,43–0,47 en 1–30 y 0,49–0,88 en 100.
  - El balón largo y el remate lejano sustituyen parte del juego por banda. La proporción de centros
    (`proporcionCentrosMin`) **no** cambia.

El helper expone `bandasLote(reglas, tamaño)`, que aplica la recalibración según `reglasDesde`. Las pruebas del
046 y del 051 sobre v4 y v5 siguen leyendo las bandas originales.

## 13. Pruebas exigidas

Unitarias en `src/arena/__tests__/motor063.test.ts`; lotes en `motor063.stats.test.ts`. Cada prueba nombra la
mutación que la pone en rojo y la auditoría las aplica todas. Los escenarios se construyen con
`crearEstadoArena` + `MotorArena`, como en `motor046.test.ts` y `motor051.test.ts`. Las semillas las busca la
propia prueba; las cifras salen de `limites.ts`.

### Bloque 0 · Compatibilidad (publicación 1)

| # | Prueba | Mutación |
| --- | --- | --- |
| 0.1 | `reglasArena` y la predeterminada, publicación a publicación; `validarConfigArena` acepta v1–v8 y rechaza `reinicios-v9` | Olvidar el literal de la versión anterior |
| 0.2 | Los fixtures v1–v5 se reproducen `toEqual`; los torneos archivados (`__fixtures__/torneos*`) validan | Activar algo con `v5` o `conReinicios` |
| 0.3 | Matriz: cada regla nueva (repliegue, persecución, frenado, cada atributo, remate lejano, portero a la trayectoria, balón largo, `pasar` largo, cada efecto de identidad) tiene un escenario mínimo con `reglas` v5, ausente, v6, v7 y v8; solo cambia desde su versión | Gating con la versión equivocada |
| 0.4 | Oráculo independiente (v1.1 § 17.5): **antes** del refactor, un generador guarda en `__fixtures__/opcion-pase-063.json` el id que devuelve `opcionPase` (o `null`) para cada jugador de campo de 200 estados muestreados de los fixtures v3–v5; después del refactor, `opcionPase` y `evaluarPases(...)[0]?.p` deben dar exactamente esos ids | Cambiar el orden, el filtro o la puntuación |
| 0.5 | Configuración v5: sin `atributos` ni `estilosJuego`; estado v5 sin la clave `persecucion`. v6 (v1.1 § 17.3): `inicial.persecucion === null`; en cada fotograma la clave **existe** y vale `null` o un objeto válido (jugador en cancha o recién retirado, lado, `desdeTick ≤ tick < hastaTick` o vencido en ese mismo tick); nunca `undefined`. `atributos` bajo v6 → rechazo | `undefined` en vez de `null`; claves fuera de versión |

### Bloque A · Persecución (`reinicios-v6`)

| # | Prueba | Mutación |
| --- | --- | --- |
| A1 | `superadoPor`: poseedor más allá de todos los rivales de campo, en ambos sentidos; el portero no cuenta; empate en x → `null`; con manos → `null`; poseedor portero → `null` | Contar al portero; `>=` |
| A2 | Repliegue: atacante superado con 4 DEF y 2 MED a ≤ radio y 1 DEF a 35 m → los `max` más cercanos sin el perseguidor; destino a `adelantoM` sobre la recta; en 1 s se mueven hacia su arco; el DEF a 35 m queda igual que bajo v5 | Sin radio; sin máximo; destino al balón |
| A3 | `presionar` gana al repliegue; `mover`/`cubrir` no lo impiden | Orden que anula la regla |
| A4 | Creación de la persecución: robo en duelo (portador), intercepción (autor), balón suelto (último toque). Ninguna creación con perdedor portero o receptor portero en su área. Cancelación, cada caso de la lista cerrada de § 6.3 con una persecución **previa activa**: atajada o manos de cualquier portero, recuperación propia, reinicio, falta y vencimiento → `null` | Perdedor equivocado; no borrar |
| A5 | Duración: monótona en agresividad, energía y bloque; acotada; `hastaTick` según la fórmula con constantes | Ignorar un factor |
| A6 | Límite: delantero que pierde el balón y rival que conduce hacia su campo → destino con x orientada = `limiteFraccion.DEL·largoM`; en ningún tick su x baja de ese límite menos `v²/(2·frenadoMps2) + toleranciaM`; medio con su límite; defensa sin límite. Intersecciones (v1.1 § 17.1): delantero perdedor con orden `presionar` y siendo el más cercano → también acotado; medio perdedor que entra en el repliegue → acotado; un presionador que no perdió el balón → sin límite | Sin límite; límite solo en la rama de persecución; límite a quien no perdió el balón |
| A7 | Frenado: un perseguidor que corre en sentido contrario se detiene en ≤ ⌈v/frenadoMps2/pasoS⌉ + 1 ticks; un jugador fuera de los conjuntos usa 3 m/s² como en v5 | Frenado para todos (rompe `conducirFrenado`) |
| A8 | `frasesPersecucion()` construida con constantes alteradas | Cifras a mano |
| A9 | Lote rápido v6: bandas 046, 051 y A de `rapido` | — |
| A10 | Fixture `arena-reinicios-v6.json` (45 s; generador `generar-reinicios-v6.ts`): al menos un tick con `persecucion` no nula y un episodio superado de ≥ 1 s con ≥ 2 jugadores en repliegue; `reproducirArena(r)` `toEqual(r)`. Tamaño (v1.1 § 17.8): cota pura del crecimiento máximo ≤ `LOTE_ARENA_063.crecimientoMaxBytes` y, en cada publicación, cinco registros programados de 180 s (semillas 1–5, intervalos 15 y `intervaloMinS`) pesan menos que el mismo registro v5 más esa cota | — |

### Bloque B · Atributos (`reinicios-v7`)

| # | Prueba | Mutación |
| --- | --- | --- |
| B1 | `atributosDe`: determinista; no depende de la semilla, del lado ni de la formación; enteros en [min, max]; `personalidadDe` y `configDeSemilla` siguen dando lo mismo. Coherencia en 1–200: medias globales ∈ [45; 55]; DEL velocidad > DEF velocidad, DEF entrada > DEL entrada, MED visión > DEF visión, DEL potencia > DEF potencia | Usar la semilla del partido; quitar el perfil |
| B2 | Configuración v7 con exactamente los IDs de la plantilla; rechazo de clave faltante o sobrante, fuera de rango y no entero | Validación laxa |
| B3 | Neutralidad por multiplicador (v1.2 § 18.6): cada función de efecto con su atributo a 50 devuelve 1 (o 0 en el duelo); en escenarios controlados de 5 s **sin remates a más de `radioTiroM` ni pases a más de `paseMaxM`** (la prueba lo comprueba en los eventos), v7 con todo a 50 da los mismos eventos y fotogramas que v6 | Efecto no centrado |
| B4 | Integración, por atributo: dos configuraciones que solo difieren en un atributo de un jugador cambian exactamente su velocidad máxima y aceleración, su desgaste, el p del duelo (una semilla buscada donde el PRNG cae entre los dos p cambia el desenlace), el error de su pase y la velocidad de su remate | Ignorar un atributo |
| B5 | Observación v7: `equipos[lado].atributos` solo con los IDs de ese lado; el esquema de respuesta y `validarOrdenes` no cambian | Mezclar lados |
| B6 | UI: ficha con seis medidores ES/EN desde `config.atributos`; nota de grabación anterior con el fixture v5; tira «En voz» con `data-campo="rasgo"` cuando corresponde (e2e en `arena-previa.spec.ts` o `arena-antesala.spec.ts`, 360 px sin desbordes) | Leer de `inicial` |

### Bloque C · Remate lejano y balón largo (`reinicios-v7`)

| # | Prueba | Mutación |
| --- | --- | --- |
| C1 | `puedeRematarLejos`: cada condición alterna el resultado (potencia, distancia, banda, espacio, línea) | Quitar una condición |
| C2 | Decisión: PRNG `arena:lejano`, probabilidad por la fórmula; una orden explícita no se sustituye | Disparar sin PRNG |
| C3 | Ejecución de un `tiro` a d > `radioTiroM` (local y `tirar` del LLM): `motivo: "lejano"`, `vuelo.lejano`, error × (1 + errorPorM·lejos), alto acotado a `altoMax`; a d ≤ `radioTiroM`, idéntico a v6. Extremos (v1.1 § 17.2): `tirar` del LLM a exactamente `maxM` se ejecuta con el multiplicador máximo; a `maxM` + 0,1 m y a 100 m no hay `tiro` ese tick y el jugador decide en local. Varios ticks (v1.2 § 18.5): sin opción de pase, conduce, entra en `maxM` y remata en una decisión posterior por la orden pendiente; con opción de pase, el pase local consume la orden y no hay remate posterior en la ronda | Aplicarlo también a d ≤ 25 m; ejecutar el `tirar` a cualquier distancia |
| C4 | Portero: ante un vuelo `lejano` va al punto de la trayectoria en su x; ante un remate no lejano, igual que v6 | Aplicarlo a todos los remates |
| C5 | `opcionPaseLargo`: ventana de distancia, avance o cambio de orientación, ventaja, puntuación y desempate; sin visión suficiente, conductor o portero → nada; gana al corto solo si puntúa más | Elegir siempre el largo |
| C6 | Vuelo del balón largo: `aereo`, `motivo: "largo"`, error extra por la fórmula y contacto solo a ≤ `caidaM` | Sin fase aérea |
| C7 | `pasar` del LLM a 40 m de un pasador con alcance ≥ 40 → balón largo; con alcance < 40 → rama `pasarImposible` del 046 intacta | Permitir cualquier distancia |
| C8 | Textos ES/EN de `vista` y `relato`; el narrador de plantilla sobre el fixture v7 con un lejano como hecho principal pasa V1–V8; el `git diff` de `estadista.ts` y de `estadisticas.ts` queda vacío | Texto genérico |
| C9 | `frasesAtributos()` y `frasesLargo()` con constantes alteradas | Cifras a mano |
| C10 | Lote rápido v7: bandas `rapido` (046 recalibradas, 051, A, B/C) | — |
| C11 | Fixture `arena-reinicios-v7.json` (45 s, búsqueda 1–400): un balón largo, un remate lejano y `config.atributos` | — |

### Bloque D · Identidad (`reinicios-v8`)

| # | Prueba | Mutación |
| --- | --- | --- |
| D1 | `estiloJuegoDe`: determinista por `claveClub` (mayúsculas y espacios no cambian el resultado); aparecen los seis en los clubes de 1–200; configuración v8 válida; rechazo fuera de versión | Derivarla de la semilla |
| D2 | Efectos, uno por escenario: `bloqueM` en el destino sin balón; factor de persecución en `hastaTick`; `extra` añade exactamente un perseguidor; `repliegue` cambia el máximo; umbrales y factores de largo y lejano | Ignorar un efecto |
| D3 | Observación v8 con `equipos[lado].estiloJuego` | — |
| D4 | UI: píldora `arena-lineup-identity` ES/EN y línea en la tarjeta del entrenador; ausente con el fixture v7 (e2e, 360 px) | — |
| D5 | Lote rápido v8 y fixture `arena-reinicios-v8.json` (45 s; identidades distintas en los dos lados) | — |

### Lotes completos (`motor063.stats.test.ts`)

- v6, v7 y v8 en 1–100 y 101–200 con las bandas que les tocan (§ 11.2 y § 12);
- contraste v5 y v6;
- experimentos controlados de atributos (v7) y de identidad (v8).

### Pruebas existentes

- Las que dependen de semillas y del comportamiento v5 fijan `reglas: "reinicios-v5"`.
- Las de UI o e2e que calculan semillas con `ejecutarArena` (`arena-buffer.spec.ts:25`,
  `arena-formaciones.spec.ts:84` y similares) se recalculan **dentro** del spec.
- Las que enumeran los `data-campo` de la tira «En voz» o los nodos de la ficha añaden el campo nuevo solo para
  registros con atributos.
- **Nunca** se reescriben expectativas a mano.

### Comandos

`npm run typecheck`, `npm test`, `npm run test:stats` (al menos 046, 051 y 063) y `npx playwright test`, todos
en verde por bloque.

## 14. Orden, publicación, qué debe notar Carlos y smoke visual

**Herramienta para el smoke**, en el bloque A: `metricas-lote-cli.ts --escenas --desde N --semillas M` lista,
por semilla, los ticks de cada episodio superado con repliegue y de cada persecución. Desde v7 lista también
los balones largos y los remates lejanos. En v8 añade las identidades. Así Carlos sabe en qué segundo mirar.

### Publicación 1 · Bloques 0 + A (`reinicios-v6`)

Alrededor de 5 h: compatibilidad 1 h, persecución 2,5 h y lotes, fixture y `--escenas` 1,5 h.

**Qué debe notar Carlos.** Cuando un atacante se va solo:

- dos a cuatro defensas y medios se dan la vuelta y corren hacia su arco aunque no lleguen;
- antes se quedaban casi quietos.

Cuando a alguien le quitan el balón, sale detrás del rival:

- un delantero se para en la mitad de la cancha;
- un medio, antes de su tercio defensivo;
- un defensa sigue.

**Smoke visto correr** (arena desplegada o local con programados), con capturas en
`docs/evidencia/motor-063/smoke-a/`:

- tres fotogramas consecutivos de un episodio superado, con las fichas de los defensas desplazándose hacia el
  arco;
- un delantero que persigue y se detiene en la línea media;
- texto de límites ES/EN.

### Publicación 2 · Bloques B + C (`reinicios-v7`)

Alrededor de 8 h: atributos 2 h, UI de atributos 1,5 h, remate lejano y portero 1,5 h, balón largo 1,5 h, y
textos, prompt, lotes y fixture 1,5 h.

**Qué debe notar Carlos.**

- La ficha de cada jugador tiene seis barras nuevas.
- Durante la antesala, «En voz» dice «Muy rápido 84» o «Protege el balón 81».
- Los rápidos se escapan.
- Hay balones largos por arriba de 35–55 m, narrados como «balón largo».
- Hay remates desde 26–33 m, narrados «prueba desde lejos»: muchos se van fuera o arriba y el portero se
  mueve hacia el balón.

**Smoke:**

- ficha ES/EN a 360 px;
- un balón largo y un remate lejano con su narración en los dos idiomas;
- una grabación v5 que muestra la nota «anterior a los atributos».

### Publicación 3 · Bloque D (`reinicios-v8`)

Alrededor de 4 h.

**Qué debe notar Carlos.**

- Cada club tiene una identidad en la tarjeta de alineaciones: «Identidad: Presión alta».
- La identidad es la misma en todos sus partidos.
- Un equipo de presión defiende varios metros más arriba y persigue más tras perder el balón.
- Uno directo juega muchos balones largos; uno de posesión casi ninguno.

**Smoke:** dos partidos con identidades contrastadas (presión frente a defensivo, directo frente a posesión),
capturas de la píldora y de una posición media del bloque, y las identidades en `--escenas`.

### Reglas de cierre

- Ningún bloque se marca ✅ en `BITACORA.md` sin `npm test` y el smoke **vistos correr**.
- Las deudas van a «Deudas conocidas (honestas)».

### Calendario

| Día | Trabajo |
| --- | --- |
| 25 oct | Publicación 1 y comienzo de B |
| 26 oct | Publicación 2 |
| 26–27 oct | Publicación 3 (si P1 y P2 están en verde a las 12:00 PT del 26) |

El cierre de entrega es el 27 oct, 11:59 PM PT.

### Cortes, en este orden, si no da tiempo

1. bloque D completo (queda la identidad para después de la entrega);
2. el `pasar` largo del LLM (C7: el LLM aún puede pedir un `pasar` corto);
3. el experimento controlado de identidad.

Nunca se cortan los fixtures, la matriz de versiones ni las bandas del 046 y del 051.

## 15. Fuera de alcance y límites honestos

- **Juego aéreo y duelos aéreos** (§ 3.4): la arena no los tiene. Un atributo aéreo sería decorativo.
- **Repliegue durante el vuelo** de un pase al espacio (§ 3.4).
- **Alcance de los atributos.** Son índices sintéticos, no medidas. Los efectos son multiplicadores pequeños y
  centrados, elegidos para ser visibles en lotes y en el experimento controlado, no ajustados a datos reales.
- **Datos fuera de la arena.** El simulador histórico, la crónica y `docs/DatosPrueba` no usan atributos ni
  identidad. No se copió texto de transcripts.
- **El portero ante el remate lejano** va a la trayectoria, pero no se estira ni anticipa. Ante los demás
  remates, sigue el modelo del 051.
- **Conversión del remate lejano** (0,13–0,19). Es alta frente a la real (≈ 0,04), en una arena donde la
  conversión global es 0,38.
- **Goles.** Bajan respecto de v5 (≈ 1,84 frente a 2,2 por partido de 120 s). Las dos bandas recalibradas se
  declaran en § 12.3.
- **Identidad, entrenador y estilo histórico.** La identidad por nombre puede contradecir al entrenador y al
  `estilo` histórico de esa semilla. Se suman y la UI lo explica.
- **La antesala hablada** no menciona atributos ni identidad. Solo lo hace la UI.
- **Medición.** Las cifras se midieron con controladores programados. Con LLM no hay lote: solo las pruebas
  C7 y B5 y el smoke.
- **Coste de los LLM.** La observación crece ≈ 2,7 KB (≈ 700 tokens de entrada por llamada). La v1.1 lo
  incorpora a las reservas del torneo antes de publicar B+C (§ 17.4); el coste típico de 062 se mide de nuevo
  con el primer torneo real v7.

## 16. Riesgos

- **Caos numérico.** Cualquier diferencia de detalle mueve los goles ±0,15. Por eso hay ajustes permitidos
  (§ 12.2) y recalibración explícita (§ 12.3). Con la v8 del prototipo, el suelo recalibrado de 1,5 queda a
  2,3 errores típicos.
- **Reproducción.** El fallo más probable es una clave con `undefined` en `estado`, `config` u observación, o
  una rama sin el getter adecuado. Lo detectan la prueba 0.5, la matriz 0.3 y los fixtures. Corren antes que
  nada.
- **Publicar por partes congela versiones.** Si un bloque publicado necesita corrección, la corrección va en la
  **siguiente** versión, nunca en la publicada.
- **Tamaño del registro.** Los atributos van en la configuración (+3 KB). `persecucion` añade ≈ 7 KB por
  registro programado de 180 s; la cota pura de § 17.8 acota el peor caso (≈ 140 KB). Lo comprueba A10.
- **e2e con semillas fijas.** Cambian en cada publicación y se recalculan dentro del spec.
- **Interfaz.** La tira «En voz» ya es densa a 360 px. Si el rasgo no cabe, se oculta antes que el nivel; el
  e2e lo comprueba.

## 17. Versión 1.1 (24 oct): decisiones tras la revisión de Codex — PREVALECE

Codex revisó la v1.0 ([informe](../evidencia/motor-063/codex-brief-v1.md)): **sin P0, 4 P1 y 4 P2**. Opus verificó
cada hallazgo contra el código; los ocho se aceptan. Las secciones afectadas ya están corregidas en el texto;
esta sección deja la decisión y la razón. Iteración 1 de 3. La § 18 corrige los cierres parciales.

### 17.1 (P1) `presionar` y el repliegue anulaban el límite del perdedor — aceptado

Verificado: `planProgramado` ordena `presionar` al más cercano (`controladores.ts:120`) y la v1.0 ponía la
persecución en una rama posterior. Un delantero que pierde el balón y es el más cercano habría seguido al balón
sin límite; un medio perdedor dentro del repliegue, también. Decisión: el límite por línea es un **paso final**
sobre el destino de todo `j ∈ persiguen` mientras el rival tiene el balón, venga de la rama que venga (§ 6.3).
Prueba A6 ampliada con las tres intersecciones. Cambia el prototipo solo en esas intersecciones (no medido);
las bandas lo cubren y hay ajustes permitidos.

### 17.2 (P1) `tirar` del LLM a cualquier distancia fuera del dominio medido — aceptado

Verificado: `motor.ts:328` ejecuta `tirar` desde cualquier sitio y la v1.0 aplicaba el multiplicador de error sin
cota (×23,5 a 100 m). Decisión: bajo v7 un `tirar` a más de `remate.maxM` (33 m) es imposible y decide en local,
con la misma mecánica que el `pasar` fuera de alcance del 046; dentro de `maxM`, el modelo conserva la libertad
(sin exigir potencia, espacio ni línea). El multiplicador queda ≤ 3,4 y el alto ≤ `altoMax`. `frasesLargo()`
añade: «un tirar desde más de {maxM} m no se ejecuta: el jugador decide por su cuenta». Prueba C3 con los
extremos. Las bandas siguen midiendo programados; el dominio del LLM queda acotado por construcción.

### 17.3 (P1) Pruebas de estado incompatibles y cancelación incompleta — aceptado

Verificado: 0.5 exigía `null` en cada fotograma y A10 exigía una persecución activa; la atajada no borraba una
persecución previa. Decisión: 0.5 separa presencia de la clave (siempre desde v6), valor inicial (`null`) y
validez del objeto; § 6.3 tiene una lista cerrada de cancelaciones, con la atajada o las manos de **cualquier**
portero; A4 prueba cada cancelación sobre una persecución previa activa.

### 17.4 (P1) Reservas del torneo con la observación vieja — aceptado

Verificado: `torneo-sitio.ts:509` reserva con `entradas.promptMax.tokens` (10 231, medido el 22 oct sin
atributos) y `torneo.ts:370` lo multiplica solo por el factor de reintento. Decisión, parte de la publicación 2:

- constante `TORNEO_SITIO.factorObservacion063` (1,2 en la v1.1; **1,3** desde la v1.2, § 18.2; comentada con esta medición: la observación más grande
  medida, tick 0 con banco, pasa de 16,8 a ≈ 19,5 KB, ×1,16);
- `generarEntradasSitio` escribe `promptMax.tokens = ceil(medido × factorObservacion063)` y declara el factor en
  el JSON; se regenera `torneo-sitio-entradas.json`;
- prueba: para las semillas 1–50, en el tick 0 y a mitad de partido, la longitud JSON de la observación v7
  (con `competencia` y `ultimaPropuestaValidaPropia`, como en `crearControladorLlm`) entre la v5 de la misma
  semilla ≤ `factorObservacion063`;
- prueba: con el `promptMax` nuevo, la reserva máxima por partido de cada formato sigue cabiendo en su
  `topeMicroUsd`. Si no cabe, **no se sube el tope**: se escala a Carlos antes de publicar B+C.

### 17.5 (P2) 0.4 era una tautología — aceptado

Verificado: comparar `opcionPase` con `evaluarPases` después de que una envuelva a la otra no detecta un cambio
común. Decisión: oráculo guardado **antes** del refactor (`opcion-pase-063.json`), § 13 prueba 0.4. Importa
porque la reproducción compara los respaldos con `planProgramado` (`coordinador.ts:137`).

### 17.6 (P2) Visión y potencia solo probaban el umbral de acceso — aceptado

Verificado: con 30 ambas acciones están prohibidas, así que 30 frente a 80 mide el umbral. Decisión: B4 ya
prueba la magnitud exacta en integración (el semiancho del error del pase y la velocidad del remate cambian
exactamente por el factor de § 7.1); se añade al experimento controlado una segunda pareja **por encima del
umbral** (visión 60 frente a 90, potencia 65 frente a 90) con dos métricas nuevas del helper: fracción de pases
cortos del `local` completados y ticks medios de vuelo de los remates del `local` por metro. No se midieron en
el prototipo: se **informan** en el JSON del lote, sin banda, en la publicación 2; la banda (diferencia ≥ la
mitad de la medida, con el signo esperado) se fija en la publicación 3 con esa medición. Límite declarado.

### 17.7 (P2) `repliegueCorren` no miraba el conjunto seleccionado — aceptado

Verificado: la métrica incluye a todos los DEF/MED cercanos. Decisión: se conserva como indicador geométrico
general (es la única que permite el contraste con v5) y se añade `repliegueSeleccion`: el helper reconstruye el
conjunto con la misma función pura exportada (`seleccionRepliegue(estado, perseguidores)`) y mide, con el
episodio de ≥ 1,5 s, la fracción de seleccionados que corren a ≥ 3 m/s con cos(velocidad, destino − jugador) ≥
0,7. Banda v6+: ≥ 0,55 en `completo` (no medida en el prototipo; si falla, cuenta como uno de los dos ajustes
de § 12.2, nunca se baja la banda).

### 17.8 (P2) Una sola prueba de tamaño — aceptado

Decisión: cota pura y conservadora (cifra corregida a 200 000 en § 18.4). `LOTE_ARENA_063.crecimientoMaxBytes` = 150 000, justificado así:
`persecucion` con los ids y ticks más largos posibles (≈ 80 bytes) × el máximo de fotogramas de un partido
(un fotograma por tick como cota, `duracionMaxS/pasoS` + 1 = 1 801) ≈ 144 KB, más `config.atributos` con 32
jugadores (≈ 3,3 KB) y el `motivo` de los eventos nuevos (≈ 17 bytes cada uno, despreciable). La prueba calcula
la cota con esas fórmulas y constantes, no con la cifra escrita, y A10 la contrasta con cinco registros reales.
Las intenciones y órdenes de los LLM no cambian en este brief y no entran en la cota.

### Qué cambia para Opus

- § 6.3: límite universal del perdedor y lista cerrada de cancelaciones (17.1, 17.3).
- § 8.1: `tirar` a más de `maxM` es imposible (17.2).
- Publicación 2: `factorObservacion063`, regenerar entradas del torneo y las dos pruebas de reserva (17.4).
- 0.4 con oráculo previo al refactor; 0.5, A4, A6, A10 y C3 ampliadas (17.3, 17.5, 17.8).
- Helper: `repliegueSeleccion` con banda, y las métricas informativas de visión y potencia sobre el umbral (17.6, 17.7).

## 18. Versión 1.2 (24 oct): segunda revisión de Codex — PREVALECE

Codex revisó la v1.1 ([informe](../evidencia/motor-063/codex-brief-v1.1.md)). Resultado:

- sin P0;
- cerrados: 17.1, 17.2, 17.5 y 17.7;
- parciales: 17.3, 17.4 y 17.8;
- abierto: 17.6;
- nuevos: un P1 y un P2.

Opus los verificó y los acepta todos. Iteración 2 de 3. Es la última ronda prevista por el orquestador: lo que
quede se escala a Carlos.

### 18.1 (17.3 parcial) A4: distinguir cancelación y estado final

Si el lado A perseguía y A recupera el balón:

- la persecución de A se borra **siempre**;
- si A lo roba a un jugador de campo de B (duelo o intercepción), el estado final es la **nueva** persecución de
  B;
- si A recoge un balón suelto sin perdedor de B, el estado final es `null`.

A4 prueba los tres finales por separado.

### 18.2 (17.4 parcial) Presupuesto sobre la petición completa

**Qué se mide.** La prueba compara la **petición completa** que arma `crearControladorLlm`
(`controladores.ts:211`): `SISTEMA_ARENA` con las frases de 063 más el mensaje de usuario con `competencia` y
`ultimaPropuestaValidaPropia`. La comparación es v7 frente a v5, en las semillas 1–50, en el tick 0 y a mitad de
partido.

**Criterio conservador.**

- `factorObservacion063` ≥ 1,1 × (máximo del cociente de caracteres).
- El 10 % cubre que los tokens no crezcan igual que los bytes: el JSON numérico nuevo tokeniza peor que la
  prosa del prompt.
- `factorObservacion063` pasa a **1,3**. El cociente medido solo para la observación fue 1,16, y el prompt
  crece menos en proporción.
- Si la prueba exige más de 1,3, se sube la constante y se rehace la comprobación de topes del 17.4. Si el tope
  no alcanza, se escala a Carlos.

### 18.3 (17.6 abierto) Bandas obligatorias de visión y potencia por encima del umbral, ya en la publicación 2

Las dos bandas se derivan de las fórmulas, no de una medición futura. Las dos bloquean la publicación 2. Si
fallan, cuentan como ajuste de § 12.2, nunca como cambio de banda.

**Potencia, 65 frente a 90 (solo `local`).**

- Métrica: media de (ticks de vuelo / metros recorridos) de los remates del `local` que terminan sin contacto o
  en el portero.
- Es casi determinista. El factor de velocidad pasa de 1,024 a 1,064 (−3,8 % de ticks por metro).
- Banda: `alto/bajo` ≤ 0,985.

**Visión, 60 frente a 90.**

- Métrica: media de |`hasta` − destino previsto| de los pases cortos con receptor del `local`.
- El destino previsto es `destinoPase` recalculado por el helper con la posición y la velocidad del receptor en
  la muestra del tick del pase.
- El semiancho base baja de 0,96 a 0,84 (−12,5 %). Los términos aditivos del entorno lo diluyen.
- Banda: `alto/bajo` ≤ 0,95.

### 18.4 (17.8 parcial) Cota de tamaño corregida y comprobación absoluta

`crecimientoMaxBytes` = **200 000**, y la prueba lo **calcula**. Se suman:

- la longitud del objeto `persecucion` serializado con el id más largo de la plantilla y ticks de
  `duracionMaxS/pasoS` + `maxS/pasoS`, más la coma, por (`duracionMaxS/pasoS` + 1) fotogramas, más `inicial` y
  `final`. Son 88 bytes × 1 801 + 176 = 158 664 bytes;
- `config.atributos`: 32 objetos con valores de dos cifras, unos 3,5 KB;
- los `motivo` nuevos: 17 bytes por evento, por ⌈`duracionMaxS`·`T.ritmo.alto`/`accionCadaS`⌉ acciones como
  cota.

La suma debe quedar ≤ 200 000.

Además, cada uno de los cinco registros reales de A10 debe pesar menos que `ARENA.archivoMaxBytes`, en
**absoluto**. El JSON del lote informa del mayor.

### 18.5 (nuevo P1) El `tirar` imposible y el consumo de la orden

Verificado: `ejecutadas` marca al jugador, no la acción (`motor.ts:313`, `:334`, `:343`). Copiar el 046 consume
la orden con cualquier balón soltado en local. Se mantiene esa semántica, que es la del `pasar` imposible
vigente, y se declara con precisión en § 8.1:

- una acción local que suelta el balón consume la orden;
- conducir no la consume.

No se separa todavía el consumo por acción: cambiaría también la semántica del 046 bajo v4–v6. C3 lo prueba en
varios ticks.

### 18.6 (nuevo P2) B3 no podía probar la equivalencia v6/v7

Se retira la afirmación de equivalencia general (§ 7.1). B3 prueba:

- la neutralidad de cada multiplicador por separado;
- la igualdad con v6 solo en escenarios donde el bloque C no interviene, comprobado en los propios eventos.

### Qué cambia para Opus (v1.2)

- A4 con tres finales (18.1).
- `factorObservacion063` = 1,3, comprobado sobre la petición completa con margen de tokens (18.2).
- Dos bandas nuevas obligatorias en la publicación 2, con sus métricas en el helper (18.3).
- Cota de tamaño calculada ≤ 200 000 y peso absoluto menor que `archivoMaxBytes` (18.4).
- Semántica de consumo del `tirar` imposible y prueba de varios ticks (18.5).
- B3 por multiplicador (18.6).

