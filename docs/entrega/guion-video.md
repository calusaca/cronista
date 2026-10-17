# Guion del video — versión realizable con la evidencia actual

Actualizado el 17 de octubre de 2026. Borrador de pantalla montado: `demo-en-borrador.mp4`,
1:50 exactos, 1280×900, subtítulos EN quemados y sin audio. Decodificado completo
sin errores; fotogramas revisados. Es una demo local con caché, no un despliegue público.
La narración propuesta tiene 233 palabras; puede añadirse voz o conservar subtítulos.
Se muestra una crónica real de GPT-6.1 Sol, sus citas y el proceso que realmente
ocurrió. **No se necesita encontrar un error del modelo para terminar el video.**
No usar el modo `ensayo`, una frase falsa de maqueta ni el falso positivo histórico
de la semilla 7 como si fueran una alucinación atrapada. El resultado 0/163 frente
a 0/167 se muestra sin atribuir una ventaja factual que no observamos.

| Tiempo | En pantalla | Voz EN |
|---|---|---|
| 0:00–0:12 | Home real, semilla 246. Cursor sobre una frase; clic para iluminar sus eventos. | An AI match report can sound convincing. But can you prove what it says? CRONISTA makes every published sentence inspectable, right down to the events behind it. |
| 0:12–0:30 | Frase seleccionada y eventos resaltados. Abrir Analyst para exponer hecho, números e IDs. | Our simulator creates fictional football matches. A deterministic Analyst extracts facts and links them to events. The Writer turns those facts into English and Spanish. Then the Verifier checks citations, numbers, names, and supported claims before publication. |
| 0:30–0:45 | View process: intentos registrados del partido. Mantener visibles sus estados reales. | The Writer runs on Microsoft Foundry through Azure OpenAI. This view shows its actual drafts and verdicts. Rejected output gets feedback and a limited retry; unresolved failures lead to an explicitly labeled analyst record. |
| 0:45–1:00 | EN → ES; volver a EN. Fan ↔ Analyst. | Click a sentence and its evidence lights up. Switch languages or inspect the underlying facts. Player ratings also unfold into the events that earned them. The story changes; the recorded match does not. |
| 1:00–1:17 | Gol de la portada → pizarra 2D → 3D. Esperar el trayecto del balón; rótulo de posiciones estáticas visible. | A goal becomes a tactics board, including a three-dimensional view. Only the ball moves, because that trajectory is recorded. Player pieces stay in their recorded zones. We make the limits visible. |
| 1:17–1:32 | Data: cifras y enlace de descarga. Plano breve del diagrama de arquitectura del README. | Everything is synthetic: teams, players, events. The downloadable dataset includes its methodology and statistical checks. Automated tests exercise the simulator, verification rules, and the reader's path through the application. |
| 1:32–1:50 | Cartela: “20 matches · baseline 0/163 flagged · pipeline 0/167 flagged · no reduction demonstrated”. Cierre en la home. | Across twenty real-model matches, both the baseline and pipeline passed these checks. That sample showed no reduction in findings, and our verifier has documented limits. What readers gain is an audit trail they can inspect. CRONISTA: personalize the story. Never the truth. |

La [sonda del 10 oct](../evidencia/verificador-2026-10-10.md) ya mostró una
frase ajena a los hechos que pasa las reglas. Cero hallazgos del mismo verificador
no equivale a cero alucinaciones; la evaluación semántica independiente sigue
pendiente. El video hace explícitos los límites y no afirma una garantía universal.

## Preparación y montaje

1. Arrancar con la configuración real de Azure, nunca con `CRONISTA_LLM=ensayo`.
   El pie debe identificar Microsoft Foundry y la crónica debe estar en modo LLM.
2. `npm run capture:demo -- http://127.0.0.1:3418` guarda capturas y un clip de
   pantalla sin voz en `.cache/demo-recording/`. Son material de montaje local,
   no una demo pública ni el video final de entrega. Se capturan acciones reales;
   no se modifican las respuestas ni los estados del DOM.
3. Las capturas aprobadas visualmente se pueden copiar a `docs/entrega/capturas/`.
   Evitar capturar Azure Portal, claves, correo o pestañas personales.
4. Grabar o añadir voz EN al montaje, y subtítulos EN. Sin música ni metraje de terceros.
   Leer los textos del proceso tal como aparezcan; no llamar «corrección» a un
   primer intento aprobado ni «alucinación» a una regla demasiado estricta.
5. Ensayar y medir la narración. Cortar pausas y planos secundarios para conservar
   margen bajo dos minutos. Ver el archivo final completo y probar la URL pública
   antes de declarar la entrega terminada.

No afirmar que está desplegado en Azure Container Apps hasta que exista el hosting
y pase el smoke externo. No afirmar Microsoft Agent Framework: la orquestación
actual es TypeScript propio. El registro original de 41 llamadas y su falso
positivo permanece reproducible; la revalidación posterior usa las respuestas
guardadas, sin llamar de nuevo al modelo.

## Reproducir el montaje offline

Después de `capture:demo`, con FFmpeg disponible y soporte libx264/libass:

```bash
CRONISTA_FFMPEG=/ruta/a/ffmpeg python3 scripts/render-demo.py
```

El resultado queda en `.cache/demo-edit/cronista-demo-en.mp4`; la copia de revisión
está en `docs/entrega/demo-en-borrador.mp4`. El script genera `subtitulos-en.srt`
desde la columna de narración y usa las cartelas de `tarjetas-video.html`.
Los clips se ralentizan y las capturas se mantienen para dar tiempo de lectura;
no se cambia ningún dato, borrador o veredicto. La captura fuente sin montaje
permanece en `.cache/demo-recording/` (no se versiona). Los subtítulos corresponden
al montaje de 110 segundos, no al clip fuente de unos veinte segundos.
