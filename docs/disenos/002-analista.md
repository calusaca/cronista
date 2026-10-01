# 002 — El Analista

**Fecha:** 2026-09-30 · **Diseña:** Fable · **Implementa:** Opus (desde el 30 sep,
después del 001) · **Estado:** CERRADO (rev 2.3, auditado, 2026-09-30)

## Objetivo

Módulo TypeScript puro en `src/analista/` que lee un `Partido` (salida del simulador,
brief 001) y produce la lista de **hechos** del partido: afirmaciones estructuradas,
cada una respaldada por IDs de eventos concretos. Es la única fuente de verdad que el
Cronista (LLM) puede usar y contra la que el Verificador contrasta. **Sin LLM, sin
azar, sin red**: funciones puras y deterministas.

## Contrato

```ts
// src/analista/tipos.ts
type TipoHecho =
  | "resultado_final" | "marcador_por_periodo" | "gol_anotado"
  | "doblete_o_mas" | "remontada" | "gol_temprano" | "gol_tardio"
  | "dominio_periodo" | "presion_sostenida" | "justicia_xg"
  | "portero_destacado" | "expulsion_y_efecto" | "disciplina";

interface Hecho {
  id: string;                    // "h07", secuencial por relevancia descendente
  tipo: TipoHecho;
  texto_es: string;              // enunciado neutro por plantilla (no LLM)
  texto_en: string;
  eventos: string[];             // IDs de eventos que lo sustentan; NUNCA vacío
  relevancia: number;            // 0–100, para que el Cronista priorice
  datos: Record<string, string | number>; // cifras crudas (marcador, xG, minutos…)
}

function analizar(partido: Partido): Hecho[];
```

## Notas del contrato real del simulador (v1.1, tras auditoría)

- `atajada` lleva el **equipo del tirador** y no nombra al portero. Para
  `portero_destacado`, el nombre del arquero se resuelve por la plantilla del
  equipo rival (posición `POR`), teniendo en cuenta un eventual cambio del portero.
- La **doble amarilla se emite como una sola `tarjeta_roja`** (sin segunda
  amarilla); se distingue de la roja directa porque el jugador ya tenía una
  amarilla previa. `expulsion_y_efecto` debe decir cuál de las dos fue.
- `cambio` trae `jugador` (entra) y `sale` (deja el campo).
- El descuento del primer tiempo queda sellado al minuto 45; el del segundo corre
  en 91–96.
- `gol` hereda el `xg` de su tiro vía `relacionadoCon`; cada tiro tiene a lo sumo
  un desenlace.

## Definición de cada tipo de hecho

Solo se usa lo que el contrato del 001 garantiza (minuto, tipo, equipo, jugador,
zona, xg, relacionadoCon). Nada de inferencias sobre datos que el simulador no emite.

| Tipo | Se emite cuando | `eventos` cita |
|---|---|---|
| `resultado_final` | siempre (1 por partido) | todos los goles + fin del último periodo |
| `marcador_por_periodo` | siempre (1 por periodo) | goles del periodo + su fin_periodo |
| `gol_anotado` | por cada gol | el gol + su tiro (`relacionadoCon`) |
| `doblete_o_mas` | jugador con ≥2 goles | todos sus goles |
| `remontada` | equipo que estuvo abajo en el marcador y terminó ganando o empatando | los goles que definen la secuencia |
| `gol_temprano` / `gol_tardio` | gol con minuto < 10 / > 85 | ese gol |
| `dominio_periodo` | un equipo acumula ≥ 65 % de los eventos ofensivos (tiro, corner, pase_clave) de un periodo | esos eventos ofensivos |
| `presion_sostenida` | ≥ 3 tiros del mismo equipo en ventana de ≤ 10 minutos | esos tiros |
| `justicia_xg` | siempre: compara goles vs xG acumulado por equipo; marca si el ganador tuvo menos xG ("ganó contra la corriente") | todos los tiros con xg |
| `portero_destacado` | equipo rival acumula ≥ 4 atajadas, o xG atajado ≥ 1.5 | esas atajadas y sus tiros |
| `expulsion_y_efecto` | hubo roja: registra marcador al momento y goles posteriores | la roja, su falta, goles posteriores |
| `disciplina` | ≥ 4 amarillas de un equipo | esas tarjetas |

Umbrales (65 %, ventana de 10', ≥4 atajadas, etc.) viven en
`src/analista/umbrales.ts`, comentados; las pruebas los importan, nunca los repiten.

## Relevancia (orden estable)

`relevancia` se calcula con una tabla determinista en `umbrales.ts` (p. ej. remontada
90, expulsion_y_efecto 85, doblete 80, resultado_final 75, … disciplina 30) con
desempate por minuto del primer evento citado. Mismo partido ⇒ misma lista, mismo
orden, mismos IDs.

## Plantillas de texto

`texto_es`/`texto_en` salen de plantillas fijas por tipo con los `datos` interpolados
(p. ej. «{jugador} marcó un doblete ({minutos})» / “{jugador} scored a brace
({minutos})”). Neutras y sin adjetivos: el color literario lo pone el Cronista; aquí
solo verdad seca.

## Propiedades verificables

**Fixtures (suite rápida, `npm test`):** partidos pequeños construidos a mano en
`src/analista/__fixtures__/` — cada uno dispara un tipo de hecho y su caso borde
(remontada que termina en empate; partido sin roja ⇒ no hay `expulsion_y_efecto`;
doblete exacto de 2; dominio de 64.9 % ⇒ NO emite). Salida esperada cerrada por
propiedad (tipos presentes/ausentes y eventos citados), no por igualdad de texto.

**Propiedades sobre corpus (con el simulador, semillas 1..1000):**
1. `analizar` nunca lanza; siempre emite ≥ 1 `resultado_final` y exactamente uno.
2. Todo ID en `eventos` existe en el partido; ningún `eventos` vacío.
3. Los `datos` de `resultado_final` coinciden con contar los goles a mano.
4. Determinismo: misma entrada ⇒ misma salida byte a byte (3 semillas fijas).
5. Textos ES y EN no vacíos y sin placeholders sin resolver (`{` prohibida en salida).

**Mutación de control:** romper la detección de `remontada` (invertir la comparación)
debe poner rojo el fixture correspondiente.

## Fuera de alcance del 002

Hechos que requieran datos que el simulador no emite (posesión %, pases totales,
distancias). Análisis con LLM. Ranking "narrativo" de hechos (eso es del Cronista).

## Revisión 2.1 — calibración de rareza (2026-09-30, Fable)

Hallazgo del implementador midiendo el corpus 1..1000: con los umbrales iniciales,
`presion_sostenida` aparece en el 99.3 % de los partidos (4.4 por partido) y
`portero_destacado` en el 71.8 %. **Un hecho que sale en casi todos los partidos no
es noticia**: diluye la relevancia y empuja al Cronista a crónicas repetitivas.

La corrección fija la propiedad, no solo la cifra:

- **Nueva propiedad de corpus (1..1000), en la suite rápida:** la fracción de
  partidos con ≥1 `presion_sostenida` debe caer en `RAREZA_PRESION` ([0.10, 0.40])
  con media ≤ 1.0 por partido; la de `portero_destacado` en `RAREZA_PORTERO`
  ([0.08, 0.35]). Constantes comentadas en `umbrales.ts`. Así, si una calibración
  futura del simulador vuelve banales estos hechos, una prueba se pone roja.
- **El implementador calibra los umbrales** (tiros mínimos, ventana, xG mínimo
  acumulado del tramo; atajadas mínimas / xG atajado) hasta cumplir la propiedad,
  y reporta el histograma medido antes y después.
- `presion_sostenida` exige además un **xG acumulado mínimo** en la ventana
  (constante en `umbrales.ts`): tres tiritos de 0.08 xG no son presión.
- Las relevancias propuestas por el implementador (gol 70, portero 65, gol_tardio
  60, justicia_xg 55, marcador_por_periodo 50, dominio 45, gol_temprano 40,
  presión 35) quedan **aceptadas** como parte del brief.
- Las interpretaciones del implementador (ventanas que no cruzan el descanso,
  greedy sin solape; portero expulsado sin nombre; disciplina solo cuenta
  amarillas emitidas) quedan **aceptadas**.

## Revisión 2.2 — niveles de remontada (2026-09-30, Fable)

Medición del implementador: `remontada` aparece en el 32.4 % de los partidos, la
mayoría déficits de un gol que terminan en empate — y hoy toda remontada lleva
relevancia 90, la máxima. Una remontada que termina en empate no es titular.

- `remontada` gana `datos.desenlace: "victoria" | "empate"`.
- Relevancia condicional (tabla en `umbrales.ts`): **victoria 90, empate 60**.
- Banda de rareza para la de victoria: fracción de partidos con remontada-victoria
  dentro de `RAREZA_REMONTADA_VICTORIA` ([0.03, 0.20]), misma mecánica que la 2.1.
- Los textos ya distinguen «y ganó» / «y empató»; no cambian.
- `dominio_periodo` (59.4 %) queda como está: es contexto con relevancia media,
  no un hecho cuyo valor sea su excepcionalidad. Decisión documentada.

## Revisión 2.3 — el oráculo (2026-09-30, Fable, por auditoría adversaria)

La auditoría probó que la salida actual dice la verdad (verificación a mano de 5
semillas + oráculo independiente sobre 1..5000: 0 fallas), pero que la suite solo
vigila estructura: 14 de 22 mutaciones que hacen MENTIR al analista dejan
`npm test` en verde. Correcciones:

1. **Oráculo independiente como prueba** (`__tests__/oraculo.test.ts`): recalcula
   cada tipo de hecho directamente desde los eventos — marcador tras cada gol,
   penal, dominio solo con ofensivos, redondeo de xG, ventanas de presión,
   atajadas y xG del portero, minutos de disciplina, doble amarilla vs directa,
   desenlace de remontada — y compara contra la salida de `analizar` sobre el
   corpus 1..1000 (+ semilla 497 explícita). Punto de partida: el script ya
   validado del auditor en el scratchpad (`oraculo.ts`). **Regla de
   independencia:** el oráculo no importa `analista.ts` ni `textos.ts` (solo
   tipos y la función pública), y un comentario en su cabecera lo declara.
2. **Paridad ES/EN como prueba**: en todo hecho del corpus, los dígitos de
   `texto_es` y `texto_en` son idénticos, y los nombres propios pertenecen al
   equipo correcto (contrastar contra `datos` y la plantilla del equipo).
3. **Borde de justicia_xg**: fixture con xG exactamente igual entre equipos ⇒
   `contra_la_corriente: "no"` (mata la mutación `<` → `<=`; hoy solo la semilla
   497 la delataría).
4. **[B1] Desempate cronológico por el evento definitorio**: el desempate de
   relevancia usa el minuto del evento que define el hecho (tabla por tipo; para
   `expulsion_y_efecto` es LA ROJA, no la amarilla previa citada). Fixture con
   dos dobles amarillas cuyas amarillas previas invierten el orden: las rojas
   deben quedar cronológicas.
5. **[B2] Fixture de roja al portero** (válido según invariantes del 001): tras
   la expulsión del arquero, las atajadas posteriores usan «El portero de
   {equipo}» sin nombre. Mata la mutación superviviente de esa rama.

## Aceptación

- `npm test` con fixtures + propiedades de corpus **visto correr en verde**, salida en
  bitácora.
- Revisión a ojo de Fable: `npm run analizar -- --seed 42` imprime los hechos de un
  partido y se lee como un acta sensata.
- Mutación de control ejecutada y vista en rojo, luego restaurada.
