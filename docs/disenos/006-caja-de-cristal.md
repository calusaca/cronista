# 006 — La Caja de cristal (Glass Box)

**Fecha:** 2026-09-30 · **Diseña:** Fable · **Implementa:** Opus (semana 2, junto
con 003–004) · **Estado:** cerrado · **Rol:** el factor que destaca (pedido de
Carlos: «que los jueces digan: este es el grupo que se merece el premio»)

## La apuesta

Todos los equipos van a enseñar una IA que escribe bonito. Nosotros somos los únicos
que dejan al juez **ver a los agentes trabajar**: el borrador, el rechazo con su
regla, el feedback y la corrección. Frase del pitch: **"Glass box, not black box."**
Nadie puede fingir esta pantalla sin tener el sistema de verdad — es la prueba
viviente de los criterios "Agentic Design & Innovation" y "Best Multi-Agent System".

## Qué se construye

### 1. El pipeline guarda su propia historia (extiende el contrato del 003)

```ts
interface IntentoAudit {
  n: 1 | 2 | 3;
  borrador: CronicaDraft;          // lo que el Cronista entregó
  veredicto: Motivo[];             // vacío = aprobado
  feedback?: string;               // lo que se le devolvió al Cronista
}
interface CronicaVerificada {
  /* …campos del 003… */
  audit: IntentoAudit[];           // SIEMPRE presente, también con 1 intento
}
```

La caché del 003 persiste `audit` junto con la crónica: la historia de una corrida
real queda guardada y es reproducible en la demo sin volver a llamar al LLM.

### 2. La UI lo muestra (extiende el 004)

- En cada frase: acción discreta «cómo se escribió» → panel con la historia de ESA
  frase: si hubo una versión rechazada, se muestra tachada con la regla disparada
  (V1–V6 con su explicación en palabras) y el feedback; la versión final al lado.
- Vista global «el proceso»: los intentos completos, uno al lado del otro, con las
  frases rechazadas marcadas. Para el juez que quiere auditar todo.
- Si la corrida salió perfecta a la primera, el panel lo dice tal cual («aprobada en
  el intento 1») — un proceso limpio también es información.

## Regla de honestidad (no negociable)

**Jamás se fabrica un rechazo.** El video y la demo muestran solo rechazos reales
ocurridos con el LLM real; se eligen semillas cuya corrida real los tuvo (la caché
los preserva). Si una semilla no tiene rechazos, se busca otra — no se inventa el
drama. Con los fixtures de prueba (cronista malicioso del 003) el panel se prueba en
desarrollo, pero esos fixtures nunca alimentan la demo.

## Propiedades verificables

- Unit: `audit` siempre presente; `n` consecutivos desde 1; un `IntentoAudit` con
  `veredicto` vacío es el último; todo rechazo guarda la regla y la oración.
- E2e (extiende el del 004): con el fixture malicioso, abrir «cómo se escribió» de la
  frase corregida muestra la versión rechazada, la regla y la final.
- La caché restaurada reproduce el mismo `audit` byte a byte.

## Fuera de alcance

Editar o re-ejecutar intentos desde la UI; métricas agregadas de rechazos; exponer
el system prompt completo (se muestra un resumen de las reglas, no el prompt).

## Aceptación

- Suites del 003/004 extendidas **vistas correr en verde**.
- Smoke a ojo: la historia de una frase se entiende sin que nadie la explique.
- Una corrida real con el LLM que haya tenido ≥1 rechazo, guardada en caché y
  anotada en `docs/evidencia/` (será la semilla del video).
