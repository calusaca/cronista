# 021 — La pizarra 3D: el gol como diorama

**Fecha:** 2026-10-02 · **Diseña:** Fable (pedido de Carlos, tercera vez:
«animaciones del gol con modelos descargados… lo haría ver mucho más
realista») · **Implementa:** Opus (tras el 020) · **Estado:** cerrado

## Objetivo

La tarjeta «cómo fue el gol» gana una vista **3D**: el mismo diorama táctico
de la pizarra 2D, pero como maqueta tridimensional con cámara cinematográfica
y el **vuelo real del balón** animado. La regla que lo hace posible sin
traicionar el pitch: **el balón tiene trayectoria registrada (origen por zona,
palo y altura de destino, velocidad, distancia) — los jugadores no**. Por eso
el balón se anima y los jugadores son **piezas de pizarra** (fichas
estilizadas), quietas en sus zonas registradas, como en la 2D. No se inventa
coreografía: se dramatiza el dato.

## Qué se ve

- Campo esquemático en 3D (tablero), marco del arco, fichas de los jugadores
  implicados en sus zonas (misma convención de posiciones que la 2D), y el
  balón recorriendo un arco paramétrico del origen registrado al destino
  registrado (palo + altura), con duración derivada de `velocidad` y
  `distanciaM` del 015 y clase de altura respetada. Si el 020 ya está: la
  `definicion` ajusta el arco (vaselina = comba alta; media cancha = su
  distancia real; chilena = rótulo, no acrobacia inventada).
- Cámara: órbita lenta automática durante el vuelo + leve slow-mo al llegar.
  Sin controles de arrastre en v1.
- Rótulo honesto SIEMPRE visible: «positions by zone, from match data —
  schematic» (el de la 2D, mismo texto).
- Botón «3D» en la tarjeta; la 2D sigue siendo el default. Sin WebGL ⇒ la 2D,
  sin error.

## Reglas duras

1. **Nada inventado**: todo parámetro de la escena sale de campos registrados
   del evento (misma función de posiciones que la 2D — compartida, no
   duplicada). Las fichas NO caminan, NO patean, NO celebran.
2. **Modelos descargados**: primero geometría procedural (cero dependencias,
   cero riesgo de licencia). Un modelo CC0 estático de utilería (arco,
   gradería) solo si en ≤ 1 día supera a lo procedural a ojo, con verificación
   de licencia y `CREDITOS.json` (flujo Valle Sediento). **Prohibido**:
   humanoides riggeados/animados — su coreografía sería dato inventado.
3. Three.js plano, componente cliente con `import()` perezoso: el chunk solo
   se descarga al tocar «3D»; presupuesto ≤ 180 KB gz. La página sin tocar el
   botón no carga nada.
4. Determinismo: mismos eventos ⇒ mismos parámetros de escena (prueba sobre la
   función pura evento→parámetros; el render no se testea por píxeles).
5. Live (008): sin clarividencia — la 3D solo existe para goles ya emitidos.
6. `data-anim-3d` con los estados de la animación (contrato del cierre del
   016: la e2e graba la transición con MutationObserver, no muestrea).

## Propiedades verificables

1. evento→parámetros: pura, determinista, y cada parámetro cita su campo
   (unit).
2. Coherencia: el arco termina en el palo+altura registrados; la duración
   respeta velocidad y distancia (unit, con tolerancia en umbrales).
3. E2e: abrir tarjeta → «3D» → canvas presente → transición completa de
   `data-anim-3d` → rótulo honesto visible. Y sin WebGL (context bloqueado) ⇒
   2D visible, sin crash.
4. Presupuesto: prueba del tamaño del chunk en CI (límite en umbrales/config).
5. Mutaciones mínimas: arco al palo contrario ⇒ muere; duración ignora
   velocidad ⇒ muere; rótulo ausente ⇒ e2e; carga ansiosa del chunk ⇒ prueba
   de red tipo P8.

## Fuera de alcance

Jugadores animados, repetición 3D de jugadas que no son gol, controles de
cámara, texturas fotorrealistas, sonido.

## Aceptación

Suites + e2e vistos por Fable; smoke a ojo de 2 goles distintos (un penal y un
cabezazo; si el 020 llegó, también la chilena del corpus): «¿se siente de
transmisión de TV sin mentir?». Presupuesto de chunk verificado. Carlos da el
veredicto estético final.
