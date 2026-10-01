# 007 — Personalización

**Fecha:** 2026-09-30 · **Diseña:** Fable · **Implementa:** Opus (semana 2–3, tras
003–004) · **Estado:** cerrado · **Origen:** lectura completa de las OFFICIAL RULES

## Por qué existe este brief

La tubería oficial del reto tiene cinco etapas y la quinta es **Personalize**:
«a Project that only generates metrics has no audience». El Grand Prize menciona
«accessible and personalized experiences for fans, analysts, and broadcasters».
Nuestro 000 había descartado la personalización; esta es la corrección, acotada
para no comerse a las prioridades 1–3.

## Principio rector

**Se personaliza la selección, el orden y el tono — jamás la verdad.** Toda variante
pasa por el mismo Verificador con las mismas reglas. La personalización ocurre
ANTES del Cronista (re-priorización determinista de hechos + instrucción de
perspectiva) y DESPUÉS (modo de render); nunca en el medio.

## Qué se construye (comprometido)

1. **Modo Aficionado / Analista** (toggle en la UI, cero llamadas LLM extra):
   - *Aficionado* (default): la crónica narrativa tal cual.
   - *Analista*: la misma crónica con los datos duros expuestos — xG por frase,
     citas de eventos expandidas inline, y la lista de hechos no usados. Es también
     el escaparate natural de la Caja de cristal (006).
2. **Modo «mi equipo»** (selector de equipo): los hechos del equipo elegido suben
   de relevancia (+delta determinista en `umbrales.ts`) y el Cronista recibe una
   instrucción de perspectiva («contá el partido para la afición de X, sin faltar
   a la verdad»). Misma verificación; caché por `(seed, deployment, modo)`.
3. **Idioma ES/EN**: ya existe desde el 003/004; aquí se documenta como parte de la
   etapa Personalize al presentar.

## Stretch (go/no-go 19 oct, junto con el replay 2D)

4. **Jugador favorito**: selector de jugador; los hechos que lo citan suben y la UI
   agrega una sección con sus eventos. Si el jugador no aparece en ningún hecho, la
   UI lo dice con un texto fijo de plantilla (sin pasar por el Cronista: la ausencia
   no puede citar eventos y por tanto no puede ser frase verificada).

## Propiedades verificables

- Re-priorización determinista: mismo partido y modo ⇒ mismos hechos en el mismo
  orden; el delta vive en `umbrales.ts` y las pruebas lo importan.
- La crónica de «mi equipo» pasa el Verificador idéntico (fixture con el cronista
  malicioso en modo perspectiva).
- Aficionado↔Analista no dispara llamadas LLM (se prueba con la costura espiada).
- E2e: cambiar modo cambia el render; los números no cambian entre modos.

## Fuera de alcance

Perfiles persistentes de usuario, cuentas, recomendaciones, más de un jugador
favorito, personalización del simulador.

## Aceptación

- Suites vistas correr en verde; e2e del toggle visto.
- Smoke a ojo: la crónica de «mi equipo» se siente distinta y dice la verdad.
