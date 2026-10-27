# 071 — Servidor MCP de solo lectura y el cronista como cliente MCP

## Estado

Brief **cerrado v1.0**, 27 oct 2026, 22:00 UTC. Lo diseña Opus 5.5 (coordinador) y lo implementa
`opus-implementador`.

**Pedido de Carlos (27 oct):**
- «para la forma en que el cronista obtiene la información para hacer la crónica creamos un MCP o intentamos
  utilizar una de las formas de orquestación que nos hizo falta»;
- «el cronista no sería un agente que lo utiliza?»; aprobado con «dale» a las ~22:00 UTC.

**Plazo:**
- Todo en verde y commiteado **antes de las 03:30 UTC**.
- Corte del coordinador a las **04:00 UTC**: si no está en verde, no se despliega y se declara.
- Desplegar lo hace el coordinador, con otro «dale» de Carlos.

## 1. Por qué y qué no

**Por qué.** En la simulación de juzgamiento (`BITACORA.md`, 27 oct), la ausencia de MCP, Agent Framework y A2A fue la
alerta más repetida. El criterio 2 de las OFFICIAL RULES nombra «MCP integration».

**Qué se descarta y por qué:**
- **Agent Framework:** SDK Python/.NET; el proyecto es TypeScript.
- **A2A:** sería artificial entre agentes de un mismo proceso.
- **Que el modelo llame al MCP desde Azure en plena generación:** cambia la entrada del redactor y solo se prueba con
  inferencia real. Fuera de plazo.

**Lo que se hace:**
1. Un **servidor MCP de solo lectura** sobre partidos **terminados**.
2. El **agente cronista** (cadena Analista de arena → Redactor → Verificador, `src/arena/cronica.ts`) obtiene sus
   hechos **como cliente MCP** de ese mismo servidor.
   - El modelo recibe exactamente los mismos hechos que hoy.
   - V1–V8 no cambian.

## 2. Alcance

### A. Servidor MCP (`src/mcp/servidor.ts` + `src/app/api/mcp/route.ts`)

**SDK y transporte.**
- SDK oficial `@modelcontextprotocol/sdk`, versión exacta `1.32.2` (fijada en `package.json`, sin `^`).
- El implementador lee la documentación del SDK en `node_modules` antes de escribir y elige el transporte
  **Streamable HTTP sin sesión** compatible con un route handler de esta versión de Next.
- Leer `node_modules/next/dist/docs/` para route handlers.
- `GET` sin SSE: responde 405 si el SDK lo permite; si no, lo que haga el modo sin sesión.

**Nombre y versión del servidor.** `cronista`, con la versión del paquete.

**Herramientas.** Todas `readOnlyHint: true`, entradas validadas con zod y salida en `structuredContent` + texto JSON.

1. `list_matches`
   - Devuelve los partidos terminados disponibles:
     - los archivos de ejemplo de `ARCHIVOS_EJEMPLO` (`duelo`, `ejemplo-v3`, `ejemplo`);
     - los encuentros de los torneos guardados que ya existen para la crónica (`DepsFuentes`).
   - Por cada partido: su `fuente` (el mismo objeto que acepta `esquemaFuente`, sin `registro` ni `sesion`), los equipos,
     el marcador, las reglas y la duración.
   - Tope en `limites.ts`.
2. `get_match_facts` (`fuente`: solo `archivo` | `torneo`+`encuentro` | `huella` de un registro guardado)
   - Devuelve la selección de `seleccionCronicaArena(registro)`: hechos con sus ids de evento, más la `huella`,
     los equipos, el marcador y las reglas.
   - **Nunca** acepta `sesion` (directo, evita adelantar resultados) ni `registro` (subidas: coste de CPU).
3. `get_match_report` (`huella`)
   - Devuelve la crónica verificada **si ya está guardada**: frases ES/EN, autor rotulado, estado y verificación.
   - **Nunca genera.** Si no existe, devuelve un error de herramienta legible con la URL del botón «Match report».

**Límites.**
- **Cuerpo:** tope en bytes.
- **Tasa:** tope por IP y por hora, con el mismo patrón y las mismas cabeceras que la admisión de crónicas.
- Constantes nuevas `MCP_ARENA` en `src/sim/limites.ts`, comentadas; ninguna prueba repite cifras.

**Seguridad y coste.**
- Sin secretos ni variables de entorno en las respuestas.
- Sin CORS.
- Ninguna llamada a un LLM ni a Speech desde el servidor MCP.

### B. El cronista como cliente MCP (`src/arena/cronica.ts`)

**Dónde.** En la generación (`seleccionCronicaArena` en ≈ l. 205), los hechos se obtienen llamando a `get_match_facts`
con un **cliente MCP del SDK** conectado al mismo `McpServer`.
- Transporte en memoria del SDK (in-process): el mismo servidor que expone `/api/mcp`, sin red.
- Para la `fuente` el cronista usa la `huella` del registro ya resuelto: el registro se guarda antes de generar; si no
  es así, adaptarlo de la forma mínima.

**Equivalencia (invariante nuevo).** Los hechos por MCP son **idénticos** (deep-equal) a los de la llamada directa,
para todos los fixtures de la matriz del 064 y los registros v10/v11.

**Respaldo.**
- Si la llamada MCP falla o tarda más de `MCP_ARENA.plazoClienteMs`, el cronista usa la llamada directa.
- Lo deja registrado en el audit de la crónica: `hechosVia: "mcp" | "directo"`, con el motivo.
- Nunca falla la crónica por el MCP.

**Página.** La de la crónica muestra discretamente «Facts retrieved via MCP» / «Hechos obtenidos por MCP» cuando
`hechosVia === "mcp"`. Compatible con las crónicas ya guardadas sin ese campo: no se muestra nada.

### C. Documentación

- **README:** sección corta «MCP server», con:
  - la URL pública `/api/mcp`;
  - las tres herramientas;
  - un ejemplo de `.vscode/mcp.json` para GitHub Copilot (agent mode) o cualquier cliente MCP;
  - el límite honesto: solo lectura, partidos terminados, no genera.
- En la tabla de tecnologías:
  - MCP pasa a «implementado (servidor de solo lectura + cliente in-process del cronista)»;
  - Agent Framework y A2A siguen como no implementados.
- **`docs/entrega/judges-guide.md`:** un párrafo opcional al final, «Query CRONISTA from an MCP client».
- No tocar `docs/entrega/plataforma.md`, `BITACORA.md`, `CLAUDE.md` ni `HANDOFF.md`: los actualiza el coordinador.

## 3. Pruebas (vistas correr)

**Unitarias:**
- cada herramienta (entrada válida e inválida, `sesion`/`registro` rechazados, tope de lista);
- `get_match_report` nunca genera: un espía sobre el redactor recibe 0 llamadas;
- equivalencia MCP = directo en la matriz;
- respaldo cuando el MCP falla (`hechosVia: "directo"` con motivo);
- la página con y sin `hechosVia`.

**E2e (Playwright, build de producción, puerto 3417):**
- el **cliente MCP oficial del SDK por HTTP** contra `http://localhost:3417/api/mcp`: `initialize`, `tools/list` con las 3
  herramientas, `list_matches` y `get_match_facts` del `duelo`;
- un tope de tasa devuelve el error esperado;
- la crónica B1 del 064 sigue en verde y muestra «Facts retrieved via MCP».

**Mutaciones en rojo:**
- el MCP devuelve un hecho de menos (la equivalencia falla);
- `get_match_report` genera;
- se acepta `sesion`.

**Entrega:**
- tsc, `npm test` completo y e2e completa;
- inestables conocidas: `arena-buffer:343`, `arena-gol-visual:126`, `arena-volver-066:254` («caducada»), que se repiten
  antes de declararlas.

## 4. Fuera de alcance

- Generar crónicas por MCP.
- Herramientas sobre partidos en directo.
- Autenticación.
- Que el modelo invoque MCP desde Azure.
- Agent Framework y A2A.
- Recursos o prompts MCP: solo herramientas.

## 5. Entrega

**Trabajo y commits:**
- Worktree aislado, a partir del último commit de B4.
- Commits con rutas explícitas y gitleaks.
- Sin push ni despliegue.

**Informe:**
- commits;
- pruebas con cifras;
- mutaciones;
- transporte elegido y por qué;
- el snippet de `.vscode/mcp.json`;
- desviaciones;
- variables de entorno, si alguna.
