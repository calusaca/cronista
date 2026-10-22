# Evidencia del brief 051 · realismo del remate (22 de octubre de 2026)

Mediciones hechas por Fable para cerrar el [brief 051](../../disenos/051-realismo-del-remate.md), sobre el
commit `2f5d98a` con árbol de trabajo sucio (cambios ajenos al motor), controladores programados, partidos
de 120 s y `crearConfigArena({ seed, duracionS })`. Nada de esto es código de producción.

## `prototipo/`

- `parchar.py`: genera `motor.ts` (copia parcheada) a partir de `motor.orig.ts` (copia de `src/arena/motor.ts`
  con imports absolutos). Banderas por entorno: `V5=1` (modelo de remate), `POS=1` (portero en la bisectriz),
  `TRI=1` (error triangular), `RECH_PROB` (rechace al campo; descartado), constantes por variable. Con `V5=0`
  la copia reproduce byte a byte las métricas del motor del repositorio (comprobado en 1–30 y 1–10).
- `prototipo-051.diff`: el parche aplicado, para lectura. **No se aplica al repositorio**: la implementación
  sigue el brief (gating por `reglasDesde`, módulo puro, constantes en `limites.ts`).
- `remates.mts`: captura el contexto de cada remate envolviendo `MotorArena.prototype.sacarBalon` y clasifica
  el desenlace con los eventos (misma regla «a puerta» que `rematesPorLado`: gol del rematador o atajada
  cuyo receptor es el rematador).
- `base.mts` (motor del repositorio) y `proto.mts` (motor parcheado): lote de N semillas desde S0.
  `NIV_POR=40|90` / `NIV_CAMPO=40|90` fuerzan niveles por jugador con `variantes.niveles` (experimento
  controlado). `bandas046.mts` aplica las bandas de `LOTE_ARENA_046` al prototipo con el helper del repo.
- `buscar-intercepcion.mts`, `buscar-fixture.mts`, `niveles-check.mts`, `grid*.sh`, `niveles.sh`.

**Reproducción (v1.1 #8):** `bash prototipo/reconstruir.sh <raíz del repo> <directorio vacío>` crea
`<dir>/proto/{motor.orig.ts, motor.ts, parchar.py}` y `<dir>/med/*.mts` con las rutas reescritas, aplica el
parche e imprime el commit base y la huella md5 del motor parcheado (`593b4214…` sobre `2f5d98a`). Después,
p. ej. `cd <dir>/med && V5=1 POS=1 TRI=1 ERR_BASE=5.5 FDMAX=1.2 ALTO_BASE=0.02 ALTO_POT=0.06 ALTO_NIVEL=0.04
ALC_MIN=0.9 ALC_MAX=2.4 POSIC=3 N=100 S0=0 node --import tsx proto.mts out/candidato-1-100.json`
(el candidato del brief); `rerun.sh` regenera todos los lotes del candidato. Probado el 22 oct en un
directorio limpio: reproduce las métricas del prototipo semilla a semilla. Cada JSON lleva `commit` y una
etiqueta `motor` inequívoca (`experimental-v5 (prototipo; …)` o `base-v4 …`); los lotes 046 del candidato
llevan `reglas: "prototipo-v5"`. `python3 -I prototipo/tablas.py` genera `lotes/tablas.md` desde los JSON.

## `lotes/`

- `base-v4-*.json`, `base-v3-1-100.json`: línea base del motor actual (`reinicios-v4`; v3 de referencia).
- `candidato-p3-*.json`: el candidato elegido (constantes del brief) en 1–30, 1–100 y 101–200, regenerado
  con las decisiones de la v1.1 (velocidad efectiva con entorno, distancia perpendicular, «a puerta» por
  `rematesPorLado` con el contador `discrepancia045`); `candidato-p3-bandas046-*.json`: las bandas 044/046
  sobre el candidato con los dos contadores de intercepción inmediata (temporal y con radio de 15 m);
  `candidato-p3-intercepcion-semilla23.txt`: el caso de la semilla 23 medido con la v1 (saque aéreo de
  25,1 m disputado en la caída, a 21,3 m del portero). `tablas.md`: tablas generadas.
- `codex-brief-v1.md` (en la raíz de la carpeta): revisión de Codex de la versión 1 del brief.
- `niveles-*.json`: experimento controlado (porteros a 40 frente a 90; jugadores de campo a 40 frente a 90)
  con v5 y con v4, 100 y 30 semillas.
- `calibracion/`: las 27 variantes probadas (`g1`–`g4`, `p1`), con sus constantes dentro de cada JSON.
- `fixture-v5-60.txt`, `fixture-v5-90.txt`: búsqueda de semilla para el fixture v5 (ninguna a 60 s; la 81 a 90 s).
