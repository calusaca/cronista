# 001 — Simulador de partidos sintéticos

**Fecha:** 2026-09-30 · **Diseña:** Fable · **Implementa:** Opus (desde el 30 sep;
las reglas permiten crear desde el 29 sep) · **Estado:** cerrado, en implementación

## Objetivo

Módulo TypeScript puro en `src/sim/` (sin UI, sin red, sin dependencias de Next) que
genera partidos completos de fútbol como stream de eventos JSON, determinista por
semilla y futbolísticamente creíble. Es la única fuente de datos de todo el proyecto.

## Contrato

```ts
// src/sim/tipos.ts
type Estilo = "posesion" | "contragolpe" | "presion";

interface Equipo {
  nombre: string;            // ficticio, nunca un club real
  ataque: number;            // 1–100
  defensa: number;           // 1–100
  estilo: Estilo;
  jugadores: Jugador[];      // 11 titulares + 5 suplentes, nombres ficticios
}

interface SimConfig { seed: number; local: Equipo; visita: Equipo; }

type TipoEvento =
  | "inicio_periodo" | "fin_periodo"
  | "pase_clave" | "tiro" | "gol" | "atajada"
  | "falta" | "tarjeta_amarilla" | "tarjeta_roja"
  | "corner" | "fuera_de_juego" | "cambio";

interface Evento {
  id: string;                // "e042", secuencial
  minuto: number;            // 0–90 + descuento
  tipo: TipoEvento;
  equipo: "local" | "visita";
  jugador?: string;
  zona?: "defensa" | "medio" | "ataque";
  xg?: number;               // solo en tipo "tiro" (el gol hereda el del tiro)
  penal?: boolean;           // solo en tipo "tiro"
  relacionadoCon?: string;   // gol/atajada → id del tiro; tarjeta → id de la falta
}

interface Partido { config: SimConfig; eventos: Evento[]; }

function simular(config: SimConfig): Partido;
```

## Motor

Cadena de posesiones: cada posesión se resuelve en una secuencia corta de eventos con
probabilidades moduladas por ataque/defensa/estilo de ambos equipos y por el estado del
partido (marcador, expulsados, minuto — cansancio sube el error al final). PRNG propio
con semilla (mulberry32 o equivalente); **`Math.random` prohibido en `src/sim/`**.

## Propiedades verificables

Los umbrales numéricos viven SOLO en `src/sim/limites.ts`, comentados uno a uno;
las pruebas los importan, nunca los repiten a mano.

**Invariantes (suite rápida, corre en cada `npm test`):**
1. Misma semilla ⇒ mismo `Partido`, byte a byte (comparar JSON de 3 semillas fijas).
2. Minutos monótonos no decrecientes; ningún evento fuera de [0, fin_periodo final].
3. Todo `gol` y toda `atajada` tienen `relacionadoCon` apuntando a un `tiro` anterior
   del mismo equipo; toda tarjeta apunta a una `falta` previa.
4. Un jugador con `tarjeta_roja` (o dos amarillas) no aparece en ningún evento posterior.
5. Todo `jugador` referenciado existe en la plantilla de su equipo; un suplente solo
   aparece después de su `cambio`.
6. Máximo 3 cambios por equipo; estructura de periodos correcta (2 inicios, 2 fines).

**Estadísticas (suite `npm run test:stats`, N = 1000 semillas 1..1000):**
7. Media de goles por partido dentro de `limites.GOLES_MEDIA` (~[2.2, 3.4]).
8. Cada franja de 15' recibe una fracción de goles dentro de `limites.GOLES_FRANJA`
   (sin huecos muertos; el descuento puede ir por encima).
9. Media de xG total por partido dentro de `limites.XG_MEDIA`; en el agregado, el
   equipo con más xG gana más veces de las que pierde.
10. Con ataque 80 vs defensa 60 (y viceversa en el rival), el fuerte gana un porcentaje
    dentro de `limites.VENTAJA_FUERTE` (~[55 %, 85 %]): ni moneda al aire ni partido
    arreglado.
11. Amarillas por partido dentro de `limites.AMARILLAS_MEDIA`; roja en menos de
    `limites.ROJA_MAX_FRACCION` de los partidos.
12. Los tres `Estilo` producen distribuciones distinguibles (posesión ⇒ más pases clave;
    contragolpe ⇒ mayor xG medio por tiro) según `limites.ESTILOS`.

## CLI de inspección

`npm run sim -- --seed 42` imprime un resumen legible (marcador, goleadores, línea de
tiempo compacta). El smoke de aceptación es correrlo con 3 semillas y **mirarlo a ojo**:
¿esto parece un partido de fútbol? Ese ojo humano queda anotado en la bitácora.

## Fuera de alcance del 001

Posiciones espaciales continuas (solo `zona`), atributos individuales profundos,
lesiones, VAR, clima, prórroga/penales de desempate. Nada de esto se agrega sin brief.

## Revisión 1.1 — correcciones de auditoría (2026-09-30, Fable)

La auditoría adversaria (1 hallazgo A, 7 B, todos aceptados) obliga estos cambios:

**Contrato:**
- `cambio` gana el campo **`sale: string`** (obligatorio): nombre del que deja el
  campo. `jugador` sigue siendo el que entra.
- `config.seed` se **normaliza** al rango entero [0, 2³²−1] y el `Partido` guarda la
  semilla normalizada (nunca una semilla que no generó esos eventos). `simular`
  **lanza** ante config inválida: fuerzas no enteras, fuera de 1–100 o no finitas,
  seed no entera.

**Propiedades nuevas o reforzadas:**
13. Determinismo fuerte: el corpus completo de la suite rápida se simula DOS veces
    y se compara por hash (además de las 3 semillas fijas). [A1]
14. Cada `tiro` tiene a lo sumo UN desenlace (gol o atajada); los `relacionadoCon`
    de goles y atajadas no se repiten. [B1]
15. Un jugador que `sale` en un cambio no aparece en ningún evento posterior. [B2]
16. En el corpus, una fracción de partidos termina después del 90 (el descuento del
    segundo tiempo existe). [B3]
17. `verificarContrato` rechaza un xg no finito o fuera de (0,1). [B7]

**Unit tests directos** (sin estadística, funciones puras): la fatiga reduce el
rendimiento con el minuto; un equipo con expulsado pierde peso ofensivo; el límite
de 3 cambios rechaza un plan de 4. [B4, B5]

**CLI estricto:** flag desconocido, `--seed` sin valor, vacío, hex, decimal o fuera
de rango ⇒ error con mensaje y exit 1. [B6, B8]

## Aceptación

- `npm test` (invariantes) y `npm run test:stats` **vistos correr en verde**, salida
  pegada en la bitácora. La suite estadística corre entera al menos una vez antes del ✅
  (una prueba que nunca corrió no es una prueba).
- Smoke del CLI con semillas 7, 42 y 1999 revisado a ojo por Fable.
- Mutación de control: romper a mano la herencia de `relacionadoCon` en gol debe poner
  roja la invariante 3 (si la suite sigue verde, la prueba no protege nada).
