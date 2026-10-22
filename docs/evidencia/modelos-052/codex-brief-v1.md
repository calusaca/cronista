# Revisión de Codex del brief 052 (versión 1)

GPT-6.1 Sol vía `npx @openai/codex exec --sandbox read-only`, 22 oct 2026. Informe íntegro.

**Veredicto: NO CERRADO.** El brief tiene una costura razonable, pero aún contiene contradicciones que afectan la seguridad del razonamiento, la admisión de modelos y el presupuesto.

Revisión estática y de solo lectura. La [evidencia disponible](docs/evidencia/modelos-052/factibilidad-2026-10-22.json) demuestra llamadas a GPT mini; no demuestra inferencia con otra familia. Distingo abajo defectos del diseño de funcionalidades pendientes de implementación.

1. **Alta — Razonamiento: la limpieza no garantiza que nunca llegue al historial o al validador.**  
   **Sección:** [Adaptador, líneas 143–149](docs/disenos/052-modelos-de-otras-familias.md:143).  
   **Por qué:** solo se especifican bloques completos y aperturas `<think>` sin cierre. Queda indefinido el caso `razonamiento…</think>{…}`. En modo texto, el primer objeto balanceado podría ser un ejemplo dentro de ese razonamiento. En otros modos, el contenido rechazado se reinyecta íntegro como `assistant` en [controladores.ts](src/arena/controladores.ts:230). Además, eliminar etiquetas indiscriminadamente podría modificar cadenas legítimas del JSON. Descartar `reasoning_content` sí es correcto, pero no cubre estos casos.  
   **Cómo corregir:** definir una gramática de envoltura admitida; rechazar delimitadores huérfanos o ambiguos antes de extraer JSON. Probar que marcadores de razonamiento no llegan al reintento, al objeto validado ni a la evidencia.

2. **Alta — Reintentos: extraer JSON puede impedir la corrección prometida.**  
   **Sección:** [Adaptador, líneas 146–149](docs/disenos/052-modelos-de-otras-familias.md:146).  
   **Por qué:** `extraerObjetoJson` lanza cuando no encuentra objeto. Sin embargo, `crearControladorLlm` no captura errores de `completar`: el coordinador cae directamente al respaldo. Una respuesta textual sin objeto no recibe la segunda solicitud, mientras que una cadena JSON inválida devuelta por Azure OpenAI sí puede recibirla. La afirmación de corrección idéntica entre adaptadores resulta falsa.  
   **Cómo corregir:** separar errores de transporte/proveedor de errores corregibles de contenido. Establecer explícitamente cuáles permiten reintento, conservando el límite de dos llamadas y el plazo compartido; nunca reinyectar razonamiento para corregirlos.

3. **Alta — Inclusión: el denominador mezcla decisiones del candidato y del rival.**  
   **Sección:** [Smoke, líneas 209–223](docs/disenos/052-modelos-de-otras-familias.md:209).  
   **Por qué:** el espejo produce ocho decisiones del candidato; el cruzado produce cuatro del candidato y cuatro de mini. Son **12 decisiones del candidato**, no 16. Evaluar las 16 puede rechazarlo por un fallo de mini y atribuye al candidato cuatro éxitos ajenos. Tampoco se prescribe persistir `origen`, aunque es el campo decisivo de admisión.  
   **Cómo corregir:** evaluar por identidad y lado; registrar `origen` y cantidades esperadas explícitas. Para obtener 16 decisiones del candidato, añadir un cruzado con lados invertidos.

4. **Alta — Formato y representatividad: una respuesta pequeña no valida la configuración pública.**  
   **Secciones:** [Sonda de formato](docs/disenos/052-modelos-de-otras-familias.md:205) y [variante de 4096 tokens](docs/disenos/052-modelos-de-otras-familias.md:347).  
   **Por qué:** una respuesta conforme con un esquema de dos órdenes no demuestra que el proveedor aplique `strict`, ni que acepte el esquema real de once jugadores y gestión. Con 200 tokens también puede descartarse un formato compatible por truncado. Los partidos de 60 segundos no cubren todo el crecimiento de contexto y las ventanas de gestión de la web. Finalmente, admitir tras probar 4096 tokens no reproduce la web: el controlador siempre pasa `ARENA.tokensOrdenes`, actualmente 2048.  
   **Cómo corregir:** probar el esquema real y observaciones de distintas fases; distinguir incompatibilidad HTTP, truncado y fallo semántico. Exigir que el smoke final use exactamente formato, presupuesto y configuración publicados.

5. **Alta — Coste: el “peor caso < 60 USD” contradice sus propias condiciones.**  
   **Sección:** [Costos por partido](docs/disenos/052-modelos-de-otras-familias.md:305).  
   **Por qué:** permitir Luna a aproximadamente 0,50 USD por lado permite aproximadamente **190 USD** en 190 partidos con Luna en ambos lados, antes de narración y otros servicios. El catálogo admite selección manual del mismo modelo. Los 8200 tokens son una observación, no una cota de entrada; el reintento añade respuesta y diagnóstico. El narrador/comentarista dispone además de hasta 12 llamadas compartidas. Faltan precios de Luna y de los sustitutos.  
   **Cómo corregir:** retirar la afirmación de peor caso; calcular por combinación permitida, incluyendo reintentos y servicios auxiliares. Verificar precios antes de admitir modelos y fijar una condición presupuestaria comprobable.

6. **Alta — Cuotas y sustitutos: cuota positiva no equivale a deployment viable ni reproducible.**  
   **Sección:** [Deployments](docs/disenos/052-modelos-de-otras-familias.md:225).  
   **Por qué:** ambos modelos principales tienen cuota cero. Para Scout y Mistral se piden capacidades 10, pero la evidencia solo aporta valores predeterminados de 1000, con mínimos y pasos desconocidos. Eso no demuestra que 10 sea inválido, pero tampoco justifica llamarlos sustitutos comprobados. La reproducción Bicep propuesta solo contempla los tres modelos originales; no define cómo representar Grok, Mistral o Scout con identidad y versión reales.  
   **Cómo corregir:** comprobar capacidad aceptada y creación real de al menos dos familias alternativas; parametrizar modelo, versión, formato, capacidad y nombre público en la reproducción. No aumentar capacidad automáticamente sin verificar unidades y cuota.

7. **Media — Secretos: proteger el catálogo público no protege los demás canales.**  
   **Secciones:** [Errores HTTP](docs/disenos/052-modelos-de-otras-familias.md:150), [evidencia del smoke](docs/disenos/052-modelos-de-otras-familias.md:205) y [publicación](scripts/deploy-azure-arena.mjs:16).  
   **Por qué:** copiar 200 caracteres del error del proveedor y guardar 120 caracteres de respuesta carece de redacción explícita; este último registro también puede publicar pensamiento crudo. El escaneo del contexto de publicación solo conoce `AZURE_OPENAI_API_KEY` y `FOUNDRY_API_KEY`, aunque se introduce otra variable de clave. Reutilizar el mismo secreto reduce el riesgo actual, pero no garantiza esa igualdad en todos los entornos. No observé claves expuestas en la evidencia revisada.  
   **Cómo corregir:** redactar errores y artefactos con todas las credenciales efectivas, incluidas las prefijadas; registrar indicadores de razonamiento sin muestras crudas. Añadir pruebas con secretos centinela en errores y respuestas.

8. **Alta — Pruebas: la prueba 9 evita precisamente la protección que pretende demostrar.**  
   **Sección:** [Pruebas 1–9](docs/disenos/052-modelos-de-otras-familias.md:269).  
   **Por qué:** un `Llm` falso que devuelve `<think>` directamente al controlador evita el adaptador encargado de limpiarlo. El controlador actual lo reinyectaría sin limpiar. Probar el limpiador por separado tampoco detectaría necesariamente que `completar` dejó de invocarlo. Faltan pruebas explícitas de propagación y cancelación del `AbortSignal`, ausencia de reintentos HTTP, validación del presupuesto y contabilización de uso antes de rechazar una respuesta truncada o bloqueada, como hace Azure OpenAI.  
   **Cómo corregir:** usar el adaptador real con `fetch` falso y capturar la segunda petición completa. Exigir que fallen mutaciones que omitan la limpieza, eliminen `signal`, dupliquen solicitudes, sumen dos veces `reasoning_tokens` o pierdan uso de respuestas rechazadas.

9. **Media — Media jornada: el plan depende de incógnitas externas y carece de salida mínima.**  
   **Sección:** [Plan de media jornada](docs/disenos/052-modelos-de-otras-familias.md:358).  
   **Por qué:** suma 215 minutos sin margen para resolver cuotas, capacidades, diferencias entre proveedores, precios o construcción/publicación. Cinco candidatos, dos partidos y cuatro rondas por partido pueden consumir unos 40 minutos solo de espera con decisiones de 60 segundos; faltan sondas y repeticiones. El texto también menciona tres partidos por modelo en costes, frente a dos en el protocolo.  
   **Cómo corregir:** separar entrega del adaptador y pruebas de la admisión operativa; hacer precondición la disponibilidad de deployments y precios. Definir un corte temporal y cerrar con candidatos rechazados documentados si corresponde, sin prometer diversidad aún no demostrada.

No modifiqué archivos ni ejecuté inferencias o despliegues.