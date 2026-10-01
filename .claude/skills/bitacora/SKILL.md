---
name: bitacora
description: Cómo llevar la bitácora de CRONISTA. Usar cada vez que se cierra o avanza una entrada de trabajo (brief implementado, auditoría, decisión de alcance, deuda nueva o saldada), o cuando el usuario pida ver el estado del proyecto.
---

# Bitácora de CRONISTA

La bitácora vive en `BITACORA.md` en la raíz del repo. Es el registro honesto del
proyecto: lo que se hizo, quién, y en qué estado real quedó.

## Formato

Tabla con columnas exactas: `Fecha | Fase | Entrada | Responsable | Estado`.

- **Fecha**: siempre absoluta, `AAAA-MM-DD`. Nunca "hoy" ni "ayer".
- **Fase**: Diseño, Implementación, Auditoría, Integración, Entrega.
- **Entrada**: una línea concreta; nombra el brief o archivo tocado.
- **Responsable**: Fable (diseño/verificación), Opus (implementación), Carlos
  (registro, cuentas, video), o el nombre del agente.
- **Estado**: `✅` / `⏳ pendiente` / `❌ bloqueado (motivo)`.

## Reglas que no se negocian

1. **✅ solo con evidencia vista**: `npm test` o el smoke corrido y su salida mirada
   en esta sesión. Lo que un agente reporta como verde queda `⏳` hasta que Fable lo
   ve correr. Nunca marcar ✅ por confianza.
2. **«Deudas conocidas (honestas)»** es la segunda sección del archivo y se mantiene
   al día: toda limitación, atajo o pendiente entra ahí al descubrirse, y se borra
   solo cuando se salda (con su entrada ✅ en la tabla).
3. Las filas no se reescriben para quedar mejor: si algo que era ✅ resultó roto,
   se agrega una fila nueva con el hallazgo, no se edita la vieja.
4. Al cerrar una sesión de trabajo con avances, la última acción es actualizar la
   bitácora; una sesión que no la toca no avanzó o lo está ocultando.
