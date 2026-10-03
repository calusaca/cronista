# 027 — Sanciones de club (mecánicas, no «morales»)

**Fecha:** 2026-10-03 · **Diseña:** Fable (idea de Carlos; casos reales de
referencia: Everton −10/−6 PSR 2023, Juventus −15/−10 2023, Derby −21 2021,
Portsmouth −9 2010 — SOLO como inspiración de mecánica; cero nombres reales
en el producto) · **Implementa:** Opus (tras el 026) · **Estado:** cerrado

## Objetivo

La temporada gana drama institucional con efectos MECÁNICOS verificables —
nada de «bajó la moral» (psicología inventada). Gated por
`config.variantes`/temporada (solo liga); el sorteo de sanciones es
determinista por temporada (prngDerivado), causa de lista cerrada FICTICIA:
`irregularidad_financiera | alineacion_indebida | incidentes_de_publico`.

## 1 · Tipos (lista cerrada de TRES; parámetros en umbrales)

1. **Deducción de puntos** (3–9, sorteada): la tabla del 016 la aplica Y LA
   MUESTRA (fila con asterisco + nota «−6 pts · financial irregularity»);
   el oráculo de la tabla verifica puntos_brutos − deducción == puntos.
2. **Puerta cerrada** (1–3 partidos de local): sin público ⇒ en ESOS
   partidos la presión del 018 pasa a `baja` para AMBOS lados (el efecto 6
   desaparece — medible con A/B N=500: pérdidas tempranas del visitante
   vuelven a la base, banda aparte) y la grada del 026 no emite reacciones
   locales (la visitante sí — su sector viaja… no: puerta cerrada = SIN
   reacciones de nadie, es lo coherente; probado).
3. **Límite de banco** (2–4 jornadas): solo 3 suplentes disponibles en vez
   del banco completo ⇒ interactúa con lesiones del 019 (si no hay cambio
   disponible, la regla existente aplica). Invariante: en esos partidos no
   entran más de 3 suplentes.

## 2 · Frecuencia y registro

- Rareza por temporada: 0–2 clubes sancionados por liga (banda en limites,
  esperanza ~0,8); un club, máximo una sanción por temporada v1.
- El registro vive en la Temporada (como sanciones/lesiones del 019);
  determinista: temporada dos veces ⇒ idéntica.

## 3 · Narración y UI

- Hecho `sancion_de_club` (relevancia 48, la previa del partido afectado):
  «X juega a puerta cerrada (segundo de tres partidos)» / «X arrastra −6
  puntos por irregularidad financiera» — cita el registro. V8: «sancionado /
  castigado / puerta cerrada / behind closed doors / docked points» SOLO con
  el hecho (batería ES/EN).
- Tabla de /liga: la fila sancionada con su nota; pestaña Players no cambia.
- Cabecera del partido a puerta cerrada: chip «Behind closed doors».

## Propiedades verificables

1. Sin variante ⇒ byte-idéntico (fixture reina; patrón 019).
2. Oráculo de la tabla con deducciones (independiente).
3. A/B de puerta cerrada: el efecto 6 del 018 desaparece en esos partidos
   (cociente ~1.0, banda aparte) y las reacciones del 026 son cero ahí.
4. Invariante del banco limitado.
5. Determinismo de temporada con sanciones.

## Mutaciones mínimas

Deducción no restada ⇒ oráculo; deducción restada dos veces ⇒ oráculo;
puerta cerrada con presión alta ⇒ A/B; reacción de grada a puerta cerrada ⇒
prueba; cuarto suplente con banco limitado ⇒ invariante; «docked points» sin
hecho ⇒ batería.

## Aceptación

Suites + stats + e2e (tabla con asterisco → nota visible; cabecera a puerta
cerrada) vistos por Fable; smoke: una temporada con un sancionado de cada
tipo visto a ojo en tabla, cabecera y crónica.
