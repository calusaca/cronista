# Primera evaluación de narración de arena en Foundry

Ejecutada el 18 de octubre de 2026, hora de Guatemala. Estado local; publicación pendiente.

Se generaron comentarios reales con GPT-5.4 mini y se comparó el mismo primer
borrador con su resultado tras verificación y feedback. Son dos ventanas del
[encuentro v3 archivado](../../../public/experimentos/arena-llm-v3.json), no dos
partidos independientes. Foundry evaluó las cuatro respuestas precomputadas con
`builtin.groundedness` y `builtin.relevance`, usando el mismo deployment mini como
juez. El umbral configurado por estos evaluadores fue 3/5.

| Tiempo simulado | Respuesta | Groundedness | Relevance |
| --- | --- | --- | --- |
| 15 s | Primer borrador | 4/5 | 4/5 |
| 15 s | Pipeline | 2/5, rechazada | 3/5 |
| 30 s | Primer borrador | 5/5 | 4/5 |
| 30 s | Pipeline | 4/5 | 3/5 |

**La muestra no demuestra mejora.** El juez puntuó mejor el primer borrador en
ambas ventanas. Tres filas aprobaron ambos criterios y una falló groundedness.
Esto no permite concluir que una arquitectura sea superior: la muestra es pequeña,
el juez comparte modelo con el narrador y sus juicios también necesitan revisión.
Relevance solo recibe consulta y respuesta; no evalúa fidelidad al contexto.

V3 rechazó un dorsal del pasador incluido en otro hecho del contexto, pero fuera
del alcance citado en esa oración. No se cuenta como una alucinación demostrada.
Tras feedback se eliminaron cláusulas, y el juez no premió esa simplificación.
La siguiente evaluación debe revisar el alcance de citas, ampliar ventanas y
semillas y añadir un juez distinto y revisión humana ciega.

El narrador consumió cuatro solicitudes, 3.675 tokens de entrada y 800 de salida,
todos con uso informado por el proveedor. El consumo del juez está registrado
por criterio en `resultado.json`; no se suma al consumo del narrador ni se
convierte a un precio estimado.

- [Dataset de respuestas pareadas](dataset.jsonl).
- [Comentarios completos, borradores, rechazos y consumo](informe.json).
- [Resultados del servicio, razones del juez y hashes](resultado.json).

Para comprobar los archivos y consultar los resultados archivados, sin red ni
credenciales:

```bash
node docs/evidencia/arena-eval-foundry/reproducir.mjs
```

El enlace al informe remoto y los IDs de corrida están en `resultado.json`; el
portal necesita permisos del proyecto. Los hashes comprueban consistencia local,
no autentican al proveedor. Las generaciones nuevas pueden variar.
