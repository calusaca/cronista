# Brief 065 § 2 · `reinicios-v9`: medición y calibración (26 oct 2026)

Partidos programados, sin LLM. Los scripts usan los helpers oficiales (`medirLote`, `bandasLote`, controlados de
`metricas-lote.ts`) y `docs/evidencia/motor-065/diagnostico/{medir,bandas}.mts`; los valores alternativos se aplican en
tiempo de ejecución sobre `REMATE_ARENA_V9` (`overrides`). Cada línea de `*.jsonl` es una corrida.

## Constantes finales

`REMATE_ARENA_V9 = { errorBaseM: 4.8, alcanceMaxM: 2.2 }` (v5–v8: 5,5 y 2,4, sin cambio).

El brief proponía 4,5 y 2,1. Con esos valores, el lote **rápido** de `npm test` (semillas 1–30) incumple
`golesTrasSaquePorPartido`: 2/30 = 0,067, por encima de 0,05. Los lotes completos sí cumplían.

Usé los ajustes que permite el brief, sin mover bandas (`bandas-iteraciones.jsonl`):

| Iteración | errorBaseM | alcanceMaxM | Rápido 1–30 | 1–100 | 101–200 |
|---|---|---|---|---|---|
| propuesta | 4,5 | 2,1 | golesTrasSaque 0,067 > 0,05 | sin incumplimientos | sin incumplimientos |
| 1 | 4,5 | 2,2 | golesTrasSaque 0,067 > 0,05 | sin incumplimientos | sin incumplimientos |
| (aislada) | 4,8 | 2,1 | sin incumplimientos | mano a mano 0,433 > 0,42 | sin incumplimientos |
| 2 (final) | 4,8 | 2,2 | sin incumplimientos | sin incumplimientos | sin incumplimientos |

Con los valores finales, los controlados también quedan en verde (`controlados.jsonl`):

- 051 porteros: 0,180;
- 051 campo: 0,213;
- 063 potencia: 0,89;
- identidad: lejanos 0,33, largos 1,04, bloque 5,31 m y persecución 1,88 s.

## Goles por partido y 0-0, semillas 1–400 (`goles-1-400.jsonl`)

| Duración | v8 goles | v9 goles | v8 0-0 | v9 0-0 | (propuesta 4,5/2,1: goles, 0-0) |
|---|---|---|---|---|---|
| 60 s | 0,940 | 1,015 | 36,3 % | 33,3 % | 1,055 · 32,0 % |
| 120 s | 1,955 | 2,107 | 13,5 % | 10,8 % | 2,190 · 9,3 % |
| 180 s | 2,960 | 3,260 | 8,3 % | 5,5 % | 3,447 · 4,3 % |

## Bandas a 120 s con los valores finales (`bandas-final.jsonl`)

| Lote | Goles | Conversión | Mano a mano | Incumplimientos |
|---|---|---|---|---|
| v9, 1–30 | 2,10 | 0,450 | 0,436 | ninguno |
| v9, 1–100 | 2,16 | 0,445 | 0,415 | ninguno |
| v9, 101–200 | 2,06 | 0,404 | 0,357 | ninguno |
| v8, 1–100 | 1,97 | 0,388 | 0,381 | ninguno |
| v8, 101–200 | 2,04 | 0,390 | 0,342 | ninguno |
