# 024 — Nivel por jugador (1–100, con tope de plantel)

**Fecha:** 2026-10-03 · **Diseña:** Fable (idea de Carlos) · **Implementa:**
Opus · **Estado:** cerrado

## Objetivo

Cada jugador gana un `nivel` 1–100. El crack completa más pases, gana más
regates y protagoniza más; el flojo, lo contrario. El partido pasa de depender
de 2 perillas por equipo a ONCE — y las valoraciones del 009 y la figura ganan
causa visible. Criterio de reglas: «player focused».

## 1 · Generación (derivada — el mundo del 016 no cambia ni una letra)

- `nivelesDe(equipo)`: función pura con prngDerivado por (nombre del equipo,
  índice del jugador) — patrón de las reservas del 019. Jamás toca el stream
  de generación existente.
- Distribución: Normal(media del equipo, σ en parametros ~8), recortada a
  [media−20, media+20] ∩ [1,100].
- **Tope de plantel (el «con topes» de Carlos):** tras el sorteo, corrección
  determinista para que el promedio de los 16 titulares+banco sea EXACTAMENTE
  la media (ataque+defensa)/2 del equipo, a un decimal — presupuesto
  auditable: ningún equipo compra cracks gratis. Oráculo lo recalcula.
- El portero usa su nivel para atajar; los de campo, para jugar.

## 2 · Efectos (gated por `config.variantes.niveles` — ausente ⇒ byte-idéntico)

CINCO, ni uno más; magnitudes en `parametros.NIVELES`, bandas A/B aparte en
`limites.AB_NIVELES` (técnica de la copia independiente). Todos modifican
probabilidades existentes; dentro del equipo, el delta es (nivel − media del
equipo)/100:

1. Protagonista: el peso de PESOS se multiplica por (1 + k·delta) — el crack
   remata y asiste más.
2. Micro pase: completación + k·delta del actor.
3. Micro regate/duelo: éxito + k·delta.
4. xG del tiro: desplazamiento de log-xG + k·delta del tirador (pequeño).
5. Atajada: probabilidad + k·delta del portero.

La liga enciende `niveles` en `configDePartidoLiga` (como las demás
variantes). Semillas sueltas: sin variante, intactas (fixture reina).

## 3 · A/B y propiedades

1. Fixture reina intacto; sin variante ⇒ byte-idéntico (1..200).
2. Tope: promedio de plantel == media del equipo, exacto, 80 equipos del
   mundo (oráculo).
3. A/B dentro del equipo (N=500 con variante): el tercil alto del plantel vs
   el bajo — completa más pases, gana más duelos, remata más veces, con
   bandas de signo y magnitud.
4. La distribución global de goles/tarjetas del corpus de liga queda dentro
   de las bandas de siempre (el nivel redistribuye DENTRO del equipo, no
   infla el total — propiedad clave; si un A/B global se mueve de banda, es
   hallazgo, no recalibración silenciosa).
5. Correlación: la figura del partido (009) cae en el tercil alto en ≥ 55 %
   de los partidos de liga (banda en limites; la figura por mérito de eventos
   se mantiene — el nivel causa eventos, no compra la nota).

## 4 · UI y narración

- Nivel visible en el panel de Ratings y en las alineaciones («Level 82»),
  con rotulado honesto («generated attribute»).
- Hecho nuevo NO hay: el nivel es atributo, no suceso. V4: «Level N» no es
  nombre. La crónica NO menciona niveles (fuera de alcance; los hechos ya
  citan eventos).

## Mutaciones mínimas

Tope ignorado ⇒ oráculo; variante ignorada ⇒ fixture reina; delta aplicado
con el signo invertido ⇒ A/B; peso del protagonista sin nivel ⇒ A/B 1;
portero usa nivel de campo ⇒ A/B 5.

## Aceptación

Suites + stats (con los A/B nuevos) vistos por Fable; smoke: panel con
niveles en 2 partidos de liga, y el crack de un equipo visiblemente más
protagonista en el jugada a jugada. E2e: alineación muestra niveles (1 test).
