# Revisión de Codex del brief 055 (versión 1)

GPT-6.1 Sol vía `npx @openai/codex exec --sandbox read-only`, 22 oct 2026. Informe íntegro.

**Veredicto: NO CERRADO.**

Revisión estática y cálculos WCAG sobre la paleta propuesta y los tokens actuales. No modifiqué archivos ni ejecuté suites que generen artefactos. Los fallos de cascada y contraste siguientes se deducen del código; la geometría y el foco necesitan validación en navegador.

1. **ALTA — §5.5: cifras ilegibles cuando la visita viste oscuro.**  
   **Por qué:** [globals.css:3014](src/app/globals.css:3014) pinta el valor líder visitante con fondo `--ar-away-ui` y texto `--ar-away-ink`. Dentro de `.arena-stats`, el primero es claro incluso en tema claro; con equipación oscura, el segundo pasa a blanco. Resultado: blanco sobre `uiOscuro`, con contrastes entre **1,58:1 y 2,14:1**. Esto ocurre cuando el local viste claro y la visita oscuro, una combinación válida.  
   **Cómo corregir:** usar tinta específica para las pastillas sobre el marcador, por ejemplo `--ar-bug`, como hace el local. Probar texto/fondo de ambos líderes para las diez equipaciones en ambos temas. Las pruebas propuestas solo verifican `uiOscuro` contra superficies oscuras; no detectan este fallo.

2. **ALTA — §5.7: el nuevo anillo se convierte en un disco por la cascada existente.**  
   **Por qué:** [globals.css:2882](src/app/globals.css:2882) y la regla visitante aplican `fill` y `stroke` a **todos** los círculos hijos de `.arena-token`. Tienen más especificidad que `.arena-select-ring`, por lo que vencen a `fill: none` y al trazo lima propuestos. El círculo nuevo, situado después del dorsal, puede taparlo. Además, las reglas de favorito también afectan a todos los círculos; conservarlas repinta el anillo nuevo.  
   **Cómo corregir:** limitar las reglas de camiseta y favorito al círculo base mediante clase propia o `:first-child`. Eliminar también la sobreescritura de seleccionado favorito. Comprobar estilos computados: relleno transparente, trazo lima, radio y dorsal visible; contar un círculo no basta.

3. **ALTA — §§5.7 y 9: el favorito sigue sin contraste garantizado.**  
   **Por qué:** el anillo `--ar-live` frente al césped da **1,03/1,10:1 en claro** y **1,66/1,90:1 en oscuro**. La propuesta conserva ese resaltado y solo mide explícitamente el anillo de selección. Que el favorito seleccionado conserve un segundo anillo legible no resuelve el favorito sin seleccionar.  
   **Cómo corregir:** representar el favorito con un borde doble, una marca de forma o un color que cumpla 3:1, conservando información redundante. Incluir favorito solo, seleccionado solo, ambos y celebración en las pruebas.

4. **MEDIA — §§8–10: se exige un contraste imposible al contorno de los escudos claros.**  
   **Por qué:** para las cinco equipaciones claras, `tinta = #0b1220`, exactamente el fondo `--ar-bug` del marcador: el contorno mide **1:1**, aunque §9 exige 3:1. El relleno claro delimita correctamente la figura, pero el criterio escrito obliga a rechazarla.  
   **Cómo corregir:** medir la silueta por el relleno **o** por el contorno según corresponda, o añadir un borde exterior independiente. Añadir selectores explícitos para contorno y campo de iniciales: `stroke` del SVG raíz no representa el trazo de su último hijo, y `rect:nth-of-type(2)` cambia con el patrón o puede faltar en `liso`.

5. **ALTA — §§4 y 15: cargar un ejemplo no pliega hoy la configuración.**  
   **Por qué:** el brief afirma que, al iniciar **o cargar**, la configuración se pliega y la Mesa sube. En [Arena.tsx:143](src/ui/Arena.tsx:143), `ejecutar()` carga ejemplos y grabaciones sin llamar a `setConfigurando(false)`. La pestaña «Saved matches» sí lo pone en `true`. Por tanto, ese flujo deja los controles abiertos encima de narración y Mesa. Además, `ArenaEnDirecto` queda fuera del `details`: plegar configuración no elimina todo el panel de control.  
   **Cómo corregir:** decidir y especificar el estado tras cada flujo real. Si se quiere plegar tras cargar, autorizar expresamente ese cambio de comportamiento y comprobar sus efectos en e2e. Medir la Mesa tras inicio, ejemplo cargado y URL con partido, sin asumir que son equivalentes.

6. **MEDIA — §§4, 9 y 11: el CTA necesita un contrato de foco y desplazamiento.**  
   **Por qué:** `href="#arena-control"` apunta a un `div` sin tratamiento de foco ni margen para la cabecera fija. Llevarlo visualmente al viewport no garantiza un recorrido de teclado útil; tampoco garantiza que el primer control quede descubierto. El scroll interno del acompañante añade otro estado que verificar.  
   **Cómo corregir:** definir foco programático o destino enfocable, margen de desplazamiento y llegada al primer control. Probar con teclado desde la cabecera, en escritorio y móvil, y después de desplazar internamente el acompañante. Conservar formulario abierto al cargar es correcto para los e2e existentes, pero no cubre esta accesibilidad.

7. **MEDIA — §6.2: los eventos sin icono rompen la asignación de columnas.**  
   **Por qué:** [ArenaDescripcion.tsx](src/ui/ArenaDescripcion.tsx) tiene tres hijos por fila: tiempo, texto e identificador. El brief cambia la rejilla a cuatro columnas, pero devuelve `null` para seis tipos de evento. En esas filas, texto e identificador ocupan columnas distintas de las previstas para los eventos con icono.  
   **Cómo corregir:** asignar áreas o columnas explícitas al tiempo, texto e identificador; alternativamente, mantener una celda decorativa vacía. Probar una lista mixta con pase, gol, tarjeta y reinicio a 360 px. Además, las tarjetas de `Iconos.tsx` fijan su propio color: cambiar `color` del contenedor no cambia su `fill`/`stroke`; medir el SVG real.

8. **ALTA — §10: varias mutaciones prometidas pueden seguir en verde.**  
   **Por qué:**
   - Restaurar `::before` no elimina los escudos; comprobar que existen no detecta la barra reaparecida.
   - `count 1` del anillo no detecta relleno opaco, color incorrecto ni dorsal tapado.
   - Medir solo el primer `.arena-local circle` no cubre visita, favorito ni anillos adicionales.
   - El feed muestra únicamente los **cinco últimos eventos**; avanzar al final no garantiza que contengan un evento con icono.
   - Comparar identidades normalizadas completas puede fallar legítimamente si `IdentidadClub.nombre` conserva el nombre recibido.
   
   **Cómo corregir:** exigir ausencia efectiva de pseudoelementos mediante estilos computados, verificar propiedades visuales, usar ticks y eventos controlados para el feed y separar nombre mostrado de identidad normalizada. Documentar qué aserción concreta mata cada mutación.

9. **MEDIA — §§9 y 13: el procedimiento de evidencia falla necesariamente en el “antes”.**  
   **Por qué:** se exige código 0 antes de implementar, pero el script nuevo debe fallar si falta favicon o si la cancha termina después de 900 px. El propio diagnóstico inicial confirma ambas condiciones. Copiar el script del 047 también conserva mediciones posteriores a desplazamientos y solo mide explícitamente la vista con partido; eso no demuestra el primer encuadre de ambas vistas.  
   **Cómo corregir:** distinguir captura de referencia, que registra incumplimientos esperados, de aceptación posterior, que sí falla. Medir portada y partido inmediatamente tras restablecer el scroll, antes de cualquier interacción que provoque desplazamiento automático. `offsetTop` tampoco demuestra pertenencia al acompañante: comprobar la relación DOM directamente.

10. **MEDIA — §§5.6 y 15: el realce de gol contiene CSS inválido.**  
    **Por qué:** `drop-shadow(0 0 0 2px …)` tiene cuatro longitudes; `drop-shadow()` no admite expansión como `box-shadow`. La declaración se descarta.  
    **Cómo corregir:** usar una sombra válida o un contorno SVG adicional. Cubrir local y visita y comprobar el estilo computado durante la celebración. Esto puede resolverse sin aplicar `transform` CSS a jugador, balón o árbitro, respetando el 047.

11. **MEDIA — §§5 y 15: la identidad persistente del club necesita una decisión más precisa.**  
    **Por qué:** derivarla del nombre es coherente con favoritos del 049, pero el escudo cambia de colores cuando el club usa alternativa. Además, cambiar bits del hash para evitar un parecido puede alterar identidades de muchos clubes. Añadir colores “al final” tampoco garantiza estabilidad si se cambia el módulo de selección. La lista de prohibiciones evita motivos concretos; no garantiza ausencia de parecido entre todas las combinaciones heráldicas.  
    **Cómo corregir:** distinguir escudo permanente de equipación del partido, o declarar expresamente esa variación. Fijar ejemplos de identidad esperada y revisar una lámina del universo de clubes generado. Corregir parecidos con ajustes acotados y documentados. No identifico una copia concreta del emblema a partir del trazado, pero falta la revisión visual exigida.

12. **ALTA — §12: el alcance obligatorio no está cerrado para un día.**  
    **Por qué:** los seis pasos suman **8,5 horas**, no aproximadamente ocho, antes de incidencias y de la suite completa. El corte permite entregar sin Z2 aunque Z2 sea P1 y sus métricas sigan siendo obligatorias. También se exige importar `LUGARES`, que actualmente no se exporta de `plantillas.ts`.  
    **Cómo corregir:** separar criterios obligatorios y criterios del recorte aprobado, reservar tiempo real de verificación y resolver la fuente del corpus de nombres. El coste de cálculo del hash y de unos pocos SVG parece bajo; el riesgo principal es integrar muchas superficies y estados. Calcular identidades, kits y variables una vez por nombres evita repetir trabajo durante los renders del reloj.

La base sí es aprovechable: recalculé el mínimo entre familias en **11,08:1** y el mínimo camiseta/césped en **3,01:1**. La regla de cambiar la visita a la familia opuesta cubre también dos principales iguales. La convención `src/app/icon.svg` está respaldada por la documentación **local de Next 16.3.8** y no requiere `metadata.icons`. El `style` de variables derivadas sobre `main` es una excepción acotada razonable; prohibir hex literales en TSX, por sí solo, no garantiza su correcta aplicación.