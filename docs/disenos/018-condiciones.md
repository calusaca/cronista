# 018 — Condiciones: clima, cancha y presión que afectan de verdad

**Fecha:** 2026-10-02 · **Diseña:** Fable (pedido de Carlos: «que a veces el
clima aparezca y afecte… estaba muy caliente y para el primer tiempo ya
estaban cansados… el local tiene menos presión… si la cancha es sintética la
bola va más rápido… césped alto para incomodar») · **Implementa:** Opus (tras
el 016) · **Estado:** cerrado

## Objetivo

Los partidos de liga ganan **condiciones** que (1) se registran como dato,
(2) **afectan de verdad la simulación** con efectos medibles, y (3) solo se
pueden narrar cuando el efecto se midió en ESE partido. La honestidad es el
producto: si la crónica dice «el calor pasó factura», los datos tienen que
mostrar la caída.

## 1 · La config (aditiva — regla de oro intacta)

`SimConfig` gana `condiciones?: Condiciones` — **ausente ⇒ comportamiento
byte-idéntico al de hoy** (la prueba del fixture `hashes-legado.json` pasa sin
tocarla; los partidos sueltos por semilla siguen sin condiciones). Solo la
temporada del 016 las fabrica:

- **Clima** (del perfil del país del 016, sorteo determinista por partido;
  «a veces»: cada perfil define probabilidades): `despejado | calor (°C 29–41)
  | lluvia | frio (°C −8–5)`. Despejado = sin efecto.
- **Cancha** (identidad del equipo local, ya en el 016): superficie
  `natural | sintetica`; césped `corto | alto` (solo natural).
- **Presión**: `local: baja/media`, `visita: media/alta` — v1 simple y
  documentada: visitante siempre un nivel arriba; magnitud por liga en
  umbrales. (Presión por puesto en la tabla: queda para después.)

## 2 · Efectos (modificadores nombrados en `parametros.ts`, acotados)

Seis, ni uno más; cada uno con su test A/B estadístico (N = 500 con la
condición vs 500 control: efecto presente, con signo correcto y dentro de
banda — la técnica de la copia independiente para que generador y prueba no
se muevan juntos):

1. **Calor ⇒ cansancio**: el ritmo del 2.º tiempo cae (menos pases y tiros
   que el equivalente sin calor); más pronunciado con °C más alto.
2. **Calor ⇒ más faltas tardías** (piernas pesadas).
3. **Lluvia ⇒ pases más imprecisos** (completación ↓) y **más atajadas
   sueltas** (rebotes: atajada sin retención ⇒ córner más probable).
4. **Sintética ⇒ bola más rápida**: velocidad de tiro media ↑ (bandas del 015
   respetadas) y más tiros de media distancia.
5. **Césped alto ⇒ juego trabado**: completación de pases cortos ↓ para el
   VISITANTE (el local lo eligió para incomodar — y entrena en él).
6. **Presión alta ⇒ salida nerviosa**: más pérdidas en salida (micro) del
   equipo presionado en los primeros 25'.

## 3 · Hechos narrables (computables, no decorativos)

- `condiciones_del_partido` (siempre que existan): «Con 34 °C y césped alto en
  el Estadio X» — datos puros, cita la config registrada. Relevancia baja.
- `efecto_calor`: SOLO si la caída medida en ESE partido supera umbral
  (pases del 2.º tiempo ≤ K % de los del 1.º). V8: «pasó factura / el calor
  los fundió / wilted in the heat» solo con este hecho.
- `cancha_incomoda`: SOLO si la completación del visitante quedó bajo umbral
  Y el césped es alto. V8: «se le hizo de barro / never settled».
- `presion_que_ahoga`: SOLO si las pérdidas en salida tempranas del
  presionado superan umbral. V8: «la presión lo ahogó / buckled under the
  pressure».
- Los tres efectos citan sus micro-eventos o llevan desglose (precedente 013).
  Mentiras de batería: cada frase V8 con la condición registrada pero SIN el
  efecto medido ⇒ rechazada (la config sola no paga la frase).

## 4 · UI

Chip de condiciones en la cabecera del partido de liga («34 °C · césped alto ·
sintética») con el explicador de una línea; en el panel de stats, los efectos
medidos aparecen como destacado con su evidencia. Live: condiciones visibles
desde el 0'; hechos de efecto solo cuando el prefijo ya los mide.

## Propiedades verificables

1. Fixture reina intacto; `condiciones` ausente ⇒ byte-idéntico (prueba
   explícita: misma semilla con y sin `condiciones: undefined`).
2. Determinismo con condiciones; clima reproducible por partido de liga.
3. Los 6 efectos: A/B con signo y banda (copia independiente).
4. Hechos de efecto: jamás presentes sin su medición (corpus de liga);
   batería V8.
5. E2e: partido de liga con condiciones → chip visible → stat destacada →
   evidencia.

## Aceptación

Suites + stats (con los A/B nuevos) + e2e vistos por Fable; smoke a ojo de 2
partidos con condiciones distintas; rarezas de los hechos de efecto anotadas.
