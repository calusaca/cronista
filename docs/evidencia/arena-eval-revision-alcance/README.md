# Revisión del alcance de citas

El narrador ahora recibe el dorsal comprobado del receptor/pasador dentro del
hecho correspondiente y utiliza JSON Schema con IDs de hechos. El verificador
mantiene sus reglas: no se habilitan cifras de hechos ajenos.

Se generaron dos comentarios nuevos con GPT-5.4 mini y se evaluaron cuatro filas
pareadas con GPT-5.6 Luna como juez. Las cuatro aprobaron: groundedness 5/5 y
relevance 4/5. Primer borrador y pipeline recibieron las mismas puntuaciones;
**esta muestra no demuestra ventaja del pipeline**. El narrador hizo dos
solicitudes, con 2.025 tokens de entrada y 406 de salida informados.

No es una comparación causal con la primera evaluación: cambió el juez y las
generaciones. Los resultados anteriores permanecen en
[su archivo original](../arena-eval-foundry/README.md). La
[revalidación offline](../arena-eval-foundry/revalidacion-alcance.json) acepta sus
dos borradores tras enriquecer los hechos, sin nuevas llamadas al modelo.

Archivos: [resultados del juez](resultado.json), [dataset](dataset.jsonl),
[respuestas y auditoría](informe.json), [IDs de corrida](foundry-corrida.json).
Continúan pendientes una muestra mayor y revisión humana ciega.
