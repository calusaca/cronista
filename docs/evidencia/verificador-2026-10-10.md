# Revisión del verificador: afirmación sin respaldo aceptada

**Fecha:** 2026-10-10. **Código revisado:** `c27518de36f0b90a291d2a506908b36118029845`. Prueba local sin API, caché ni modelo externo.

## Resultado observado

Partido de semilla **246**, hecho principal **h01**. Se obtuvo un borrador válido desde las plantillas del Analista y se añadieron estas afirmaciones a su primera entrada:

- ES: «El estadio tenía techo retráctil.»
- EN: «The stadium had a retractable roof.»

El hecho h01 describe una expulsión, su minuto y el marcador; no registra un techo. La entrada conserva sus cifras y nombres válidos, pero añade información sin evidencia.

`verificarDraft` devolvió **`[]`**. `generarCronica` publicó la entrada modificada en **modo `llm`, intento 1**, sin omisión. Se observó tanto la aprobación del verificador como la salida final de la cadena.

Esto demuestra una limitación de cobertura semántica. No mide la frecuencia del problema en un modelo real. El objeto `Llm` de esta sonda devuelve deliberadamente el borrador modificado; el nombre del modo `llm` describe el protocolo, no una inferencia real de Foundry.

## Reproducción

Guardar temporalmente este archivo como `sonda-revision.ts` en la raíz y ejecutar `npx tsx sonda-revision.ts`:

```ts
import { analizar } from './src/analista/analista';
import { generarCronica } from './src/cadena/cadena';
import { mensajeInicial } from './src/cadena/prompt';
import { verificarDraft } from './src/cadena/verificador';
import { borradorDesdeHechos } from './src/lib/llm-stub';
import { simular } from './src/sim/motor';
import { configDeSemilla } from './src/sim/plantillas';

async function main() {
  const partido = simular(configDeSemilla(246));
  const hechos = analizar(partido);
  const draft = borradorDesdeHechos(mensajeInicial(hechos));
  draft.oraciones[0].texto_es += ' El estadio tenía techo retráctil.';
  draft.oraciones[0].texto_en += ' The stadium had a retractable roof.';
  console.log('Motivos:', verificarDraft(draft, hechos, partido));
  const { cronica } = await generarCronica(partido, {
    llm: { id: 'sonda-revision', completar: async () => JSON.stringify(draft) },
  });
  console.log(cronica.modo, cronica.intentos, cronica.oraciones[0]);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
```

## Implicación para la entrega

La promesa defendible es: **cada entrada publicada pasa V1–V8 y permite inspeccionar sus citas**. Esas reglas comprueban estructura, cifras, nombres, cobertura y familias de afirmaciones mantenidas; no demuestran toda la semántica de texto libre.

La evaluación con el mismo verificador mide hallazgos de esas reglas. Un resultado cero no constituye una medición independiente de ausencia de alucinaciones. Antes de publicar una cifra general de fidelidad, revisar una muestra a ciegas con un criterio independiente y contar afirmaciones sin respaldo, incluyendo las que pasan V1–V8.

Posibles mejoras de implementación: representar afirmaciones verificables de forma estructurada, restringir contenido a campos respaldados, o añadir revisión semántica independiente con abstención. Añadir únicamente «techo retráctil» al léxico cerraría este ejemplo, pero dejaría abierta la clase del problema.
