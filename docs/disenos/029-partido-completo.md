# 029 — Partido completo, pase por pase

**Fecha:** 2026-10-17 · **Pedido de Carlos:** abrir el partido completo y leer
cada jugada, pase y movimiento registrado, con explicación detallada.

## Comportamiento

- Botón «Full match / Partido completo», según el idioma, junto a «Watch live».
  Disponible en el partido terminado, tanto suelto como de liga. Durante el replay
  se oculta para conservar la vista sin información futura.
- Ventana amplia con todas las acciones de `micro(partido)` y todos los eventos
  macro del **mismo config y stream mostrado**. El tramo micro precede a su ancla;
  los empates de minuto conservan ese orden causal. Cada registro aparece una vez.
- Relato determinista ES/EN: autor, receptor y resultado del pase, metros,
  conducción, rival del regate/duelo, pérdida/recuperación, tercio y canal cuando
  están registrados. Goles, tiros, faltas, tarjetas, cambios, lesiones y demás
  eventos conservan sus detalles. Marcador progresivo, sin atribuir una atajada
  al equipo del tirador ni un autogol al equipo de su autor.
- Buscar jugador/equipo, filtrar por tiempo/tipo/equipo y saltar al minuto deseado.
  Se muestran 80 acciones por página, con total visible y navegación hasta el final;
  la paginación no descarta registros. Descargar TXT incluye el partido entero,
  independientemente de los filtros de pantalla.
- Modal nativo con teclado, cierre Escape y devolución del foco. Diseño legible
  a 360 px, claro/oscuro; carga del componente al pulsar el botón.

## Límites y alcance

El simulador registra minutos enteros, zonas y acciones con balón. No registra
segundos exactos ni trayectorias continuas o desmarques de los 22 jugadores:
la vista lo explica y no los inventa. No cambia sorteos, eventos, resultados,
dataset, Verificador ni prompt. Abrir, buscar, traducir y descargar el detalle no
llama al LLM ni solicita un nuevo partido.

## Validación

Pruebas con oráculo de cobertura y orden sobre partidos reales del simulador;
prefijos, empate de minutos entre tiempos, marcador y autogoles/atajadas,
eventos especiales y exportación bilingüe. Navegador: apertura, filtros,
paginación/final, salto de minuto, descarga completa, idioma, teclado y móvil;
entrada en liga y ausencia durante replay. Suites existentes conservadas.
