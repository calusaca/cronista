# 002 — El Analista

**Fecha:** 2026-09-30 · **Diseña:** Fable · **Implementa:** Opus (a partir del 6 oct,
después del 001) · **Estado:** cerrado, pendiente de implementación

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

## Aceptación

- `npm test` con fixtures + propiedades de corpus **visto correr en verde**, salida en
  bitácora.
- Revisión a ojo de Fable: `npm run analizar -- --seed 42` imprime los hechos de un
  partido y se lee como un acta sensata.
- Mutación de control ejecutada y vista en rojo, luego restaurada.
