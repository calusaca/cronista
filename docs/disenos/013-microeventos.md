# 013 — Micro-eventos: el partido por dentro

**Fecha:** 2026-10-01 · **Diseña:** Fable (pedido de Carlos: «este jugador
dominó por la banda y dribleó a este 6 veces… el equipo perdió la bola 8 veces
saliendo por banda izquierda… más de 2.000 eventos… nuestra IA entiende el
partido y encuentra cosas interesantes») · **Implementa:** Opus · **Estado:**
cerrado

## Objetivo

Hoy un partido tiene ~100 eventos macro. Este brief agrega la capa que lo
convierte en un feed de nivel profesional: **2.000+ micro-eventos por partido**
(pases, conducciones, regates, duelos, recuperaciones, pérdidas — con canal y
zona), de los que el Analista deriva hechos nuevos que la crónica puede narrar
con prueba: quién dominó, quién le ganó el duelo a quién, por dónde se desangró
un equipo. Es exactamente lo que las reglas puntúan («synthetic data creation»
es criterio textual y primer desempate): creamos los datos, la IA los entiende,
encuentra lo interesante y lo explica — y todo se puede verificar con un clic.

**Decisión previa con datos (no tocar el generador macro):** medido sobre 1.000
partidos, la distribución ya es creíble — 2,85 goles/partido (PL ~2,8), 25,6 %
empates (~24 %), 6,8 % 0-0 (~8 %), 17,1 % 1-0 (~17 %), 12,9 % margen ≥3 (~9 %).
Recalibrar invalidaría el corpus entero por un ajuste marginal. La percepción
de «siempre goleadas» se arregla en la vitrina (brief 014: presets curados).

## 1 · La capa micro (`src/sim/micro.ts`) — derivada, pura, sin tocar nada

**Regla de oro: `Partido` NO cambia.** La capa es una función pura
`micro(partido): MicroPartido`, determinista desde
`prngDerivado(semilla, "micro", segmento)`. Nada se guarda en el partido, el
stream macro no consume ni un sorteo, y el fixture `hashes-legado.json` queda
intacto SIN cambiar su proyección (no hay campos nuevos que borrar).

- **Segmentos:** el partido se corta en posesiones entre anclas macro. La
  posesión que precede a un tiro pertenece al equipo del tirador y termina en
  ese tiro; el córner abre posesión del mismo equipo; la falta corta la
  posesión del que la sufre. Cada posesión: equipo, minutos, canal dominante
  (`banda_izquierda | centro | banda_derecha`), cómo termina (evento macro,
  pérdida, recuperación rival, fuera).
- **Dentro de cada posesión:** pases (completado/fallado, canal), conducciones,
  regates (`quien` dribla a `quien_rival`), duelos, recuperaciones y pérdidas
  (con canal y zona de salida). Jugadores: SOLO los que están en cancha en ese
  minuto (respeta expulsiones y cambios — estado de plantilla en el tiempo).
- **Clave anti-clarividencia:** el sorteo va POR SEGMENTO, keyed por
  (semilla, id del ancla macro que abre el segmento). Así
  `micro(prefijo(partido, m))` es EXACTAMENTE el prefijo de `micro(partido)` —
  propiedad verificable, necesaria para el modo en vivo y las stats «so far».
- **IDs:** `m0001…` en orden de minuto, deterministas.
- **Volumen y realismo (umbrales en `limites.ts`, atacables):** total micro por
  partido en [1.800, 2.600] con promedio ≥2.000; pases totales ~850–1.000 con
  ~78–85 % completados; el equipo con más ataque (ATT) completa más; regates
  exitosos ~45–65 %; suite estadística propia sobre 1.000 partidos (como la del
  001).

## 2 · Hechos nuevos del Analista (4, con cita o con desglose)

Dos clases, con el mismo estándar de honestidad que ya usa el producto:

**Acotados (citan SUS eventos exactos, como todo hecho):**
1. `duelo_ganado` — «{X} dribló {N} veces a {Y}» (N ≥ `DUELO_MIN`, inicial 4).
   Cita los N regates. Rel. 68.
2. `perdidas_en_salida` — «{equipo} perdió el balón {N} veces saliendo por
   {canal}» (N ≥ `PERDIDAS_MIN`, inicial 6). Cita las N pérdidas. Rel. 64.

**Agregados (desglose auditable, como las valoraciones — aritmética, no
opinión):**
3. `dominio_global` — «{equipo} dominó el partido ({NN} % de posesión)» solo si
   NN ≥ `DOMINIO_MIN` (inicial 58). `datos` llevan los conteos por periodo; la
   evidencia muestra el desglose recomputable. Rel. 70.
4. `dominio_por_canal` — «{equipo} atacó sobre todo por {canal} ({NN} % de sus
   avances)» si NN ≥ `CANAL_MIN` (inicial 45). Rel. 60.

- **Rareza calibrada** sobre el corpus (cada uno en ≤ ~35 % de los partidos;
  medirlo y anotarlo, como en el 002).
- **V8:** «dominó/dominated» se habilita también con `dominio_global` como
  principal; léxico nuevo para regates («dribló, se fue de, lo dejó atrás /
  beat his man, skipped past») ligado SOLO a `duelo_ganado`; «se desangró por /
  bled down» ligado a `perdidas_en_salida`. Mentiras de batería para cada uno.
- **Oráculo (límite honesto, documentado):** la capa micro sale de un sorteo,
  así que el oráculo no la «re-deriva»: verifica CONSISTENCIA — cada hecho
  coincide con el recuento real de la capa (conteos en `datos` == eventos
  citados == recuento independiente sobre `micro(partido)`), la capa pasa sus
  invariantes, y los números de cada texto están en `datos` (V3 como siempre).
  Mutaciones de control: conteo inflado ⇒ muere; cita de un micro-evento ajeno
  ⇒ muere; regate con un expulsado ⇒ muere el invariante.

## 3 · En vivo

Los 4 hechos entran al flujo normal: sobre el prefijo valen «hasta ahora»
(gracias a la propiedad de prefijo del §1). `dominio_global` y
`dominio_por_canal` se calculan sobre lo jugado y NO entran a
`HECHOS_DE_CIERRE` (un dominio parcial es cierto y útil); la regla de cierre
del 012 ya impide venderlos como veredicto final.

## Fuera de alcance (va al 014 o después)

Panel visual de stats, presets curados, UX del simulador, cambios al README.
Las valoraciones (009) NO incorporan micro-eventos todavía — recalibrar pesos
con pases/regates es otra decisión, otro día.

## Propiedades verificables

1. `Partido` intacto: el fixture de hashes pasa sin tocar test ni fixture.
2. Determinismo: `micro(p)` dos veces ⇒ byte-idéntico.
3. Prefijo: `micro(prefijo(p, m))` ≡ prefijo de `micro(p)` (corpus 1..200,
   todos los momentos).
4. Consistencia con macro: la posesión del tiro es del tirador; nadie juega
   expulsado o antes de entrar; minutos monótonos.
5. Volumen y realismo (suite estadística N=1000): total, pases, completación,
   regates, correlación con ATT.
6. Hechos: conteos == citas == recuento independiente; rareza en banda; V8
   solo con su hecho; batería de mentiras nueva.

## Aceptación

Suites + stats + e2e vistos por Fable; `npm run analizar` muestra los hechos
nuevos; smoke a ojo con 2 semillas («¿estos insights los firmaría un
analista táctico?»); cifras de rareza y volumen anotadas en bitácora.
