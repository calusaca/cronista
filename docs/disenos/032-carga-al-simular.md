# 032 — Respuesta inmediata durante las esperas del sitio

Carlos señala que Simulate match y Random match parecen no responder mientras
el servidor prepara el partido y genera su crónica.
Amplía después el pedido: revisar el mismo problema en todo el sitio.

## Alcance cerrado

Una transición de React enlaza los tres controles de navegación del simulador
(semilla, partido aleatorio e historias) con el trabajo pendiente del router.
Mostrar inmediatamente «Preparing your match…» y explicar que la preparación
puede tardar. Mantener el partido anterior visible hasta recibir el nuevo.
Deshabilitar botones, semilla e historias durante la transición para evitar
solicitudes repetidas. Retirar el aviso y habilitar los controles al completarla.

El estado usa una región accesible `status` persistente en el layout, fuera del
formulario `aria-busy`, visible en cualquier posición de scroll.
El indicador respeta movimiento reducido y los colores de ambos temas; debe
caber a 360 px. Sin porcentajes, etapas ni estimaciones de tiempo inventadas,
prefetch de crónicas, llamadas adicionales ni cambios al generador o al modelo.
La validación de semilla conserva su error y no inicia la espera; reenviar la
misma ruta no puede dejar un indicador permanente.

## Revisión de todo el sitio

| Operación | Respuesta durante la espera |
| --- | --- |
| Simulate, Random e historias | `useTransition`, aviso y controles deshabilitados |
| Marca/inicio, League mode, Data y enlace desde dataset | `useLinkStatus` del enlace nativo de Next |
| Perspectiva local/visitante/neutral | Mismo estado del enlace; mensaje de preparación del reporte |
| Liga: pestañas, jornadas, partidos, anterior/siguiente y regreso | Mismo estado del enlace, incluidos cambios solo de query |
| Primera apertura de relato/formaciones | Suspense del módulo diferido con aviso hasta resolver |
| Motor 3D | Aviso durante importación; error/sin WebGL conserva alternativa 2D |
| Replay/Watch live | Aviso global y local; reloj detenido hasta tener updates, error con reintento |
| Muestra JSONL | Espera hasta recibir los bytes, evita duplicados, descarga del navegador y error recuperable |
| TXT del relato/registro | Generación local y descarga inmediata, sin trabajo de red |
| DATASHEET Markdown | Documento nativo del navegador, conserva su endpoint y contenido |
| Idioma, modo Fan/Analyst, filtros, paginación y reproducción | Cambios locales inmediatos; no añadir esperas artificiales |

El proveedor retira cada aviso al resolver o desmontarse la operación. Los enlaces
conservan su comportamiento original de Next (scroll, sin prefetch, Enter,
modificadores/nueva pestaña e historial). El replay reutiliza la petición pendiente
al salir y volver a entrar, y aborta al desmontar. Un partido de otra semilla
reinicia la vista y su petición anterior, además de actualizar el campo de semilla.
La página de error ofrece reintento con recarga y regreso al inicio, sin exponer el error del
servidor. No se instala un `loading.tsx` global que convierta las rutas inválidas
en respuestas HTTP 200 por comenzar el streaming antes de su validación.

## Verificación

Navegador sobre build de producción, reteniendo la respuesta de navegación:
el aviso aparece antes de liberarla y permanece visible mientras se espera;
controles deshabilitados y un solo destino solicitado, luego partido correcto
y controles disponibles. Cubrir ambos botones, Enter con semilla vacía e
historias, validación inválida, misma ruta, móvil, tema oscuro y movimiento
reducido. Navegaciones reales retenidas para cada familia de rutas; descarga con
bytes originales, error/reintento, replay pendiente sin duplicados y módulos
diferidos retenidos o fallidos. Typecheck y recorridos existentes del sitio.

## Resultado local

Typecheck aprobado; 1429/1429 pruebas unitarias, 84/84 de navegador sobre
standalone con ensayo explícito y 2/2 de empaquetado. Son 22 recorridos nuevos
de espera/recuperación y los 62 existentes. Las pruebas retienen peticiones reales
del navegador, sin añadir demoras al producto. Tres capturas revisadas:
escritorio, móvil de 360 px y oscuro con movimiento reducido, sin desborde ni
errores JS. Gitleaks del candidato sin hallazgos y contexto de ACR validado:
206 archivos, sin entorno ni claves conocidas. Publicación y CI pendientes.
