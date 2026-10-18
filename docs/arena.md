# Laboratorio experimental de equipos

El [brief 034](disenos/034-arena-dos-controladores.md) implementa dos controladores
independientes sobre un motor espacial compartido. El simulador de las crónicas y
su dataset histórico conservan su comportamiento. La página `/arena` permite
inspeccionar el experimento en inglés o español.

## Qué se puede probar

- 22 jugadores con identidad y puesto estable; tres formaciones y cambios de
  estructura con/sin balón, apoyos, presión cercana y cobertura.
- Paso fijo de 0,1 s con velocidad y aceleración acotadas. Fotogramas cada 0,5 s;
  reproducción interpolada o estados discretos con movimiento reducido.
- Trayectorias de pases, recepciones, interceptaciones, recuperación, tiros,
  atajadas, goles y fuera de juego puntual al intervenir un receptor.
- Observación compartida, órdenes simultáneas, plazos, cancelación y respaldo.
- Registro descargable y reproducción recalculada sin inferencia. Comprobar la
  consistencia del archivo no autentica la identidad del modelo que lo produjo.

Los planes contienen 11 objetivos individuales. El control local reacciona ante
cambios de posesión, recepción y balón cercano durante el intervalo. Un pase que
se detiene conserva su referencia de fuera de juego hasta el siguiente contacto.
Los golpes se fechan en el paso que avanza, sin añadir eventos al prefijo anterior.

## Prueba en el navegador

Abre **Team agents lab** desde la barra superior. El escenario inicial y
**Run programmed teams** usan políticas programadas, sin llamadas a IA. Puedes
cambiar semilla, formación y duración; reproducir/pausar, saltar en el tiempo,
abrir las 11 órdenes, cambiar idioma y descargar el registro completo.

**Load recorded AI run** carga el [ejemplo real archivado](../public/experimentos/arena-llm-v1.json):
10 segundos simulados, dos rondas, cuatro decisiones válidas, siete eventos y cero
respaldos. Se generó con dos controladores independientes del **mismo** deployment
Azure OpenAI GPT-6.1 Sol, esfuerzo low. Cargarlo o reproducirlo no llama al modelo.
También puedes abrir un archivo generado por la CLI; el servidor recalcula estados
y eventos y rechaza las inconsistencias.

## CLI

Desde la raíz, con dependencias instaladas:

```bash
# 3 minutos simulados con políticas programadas, sin credenciales.
npm run arena -- --salida .cache/arena-programada.json

# 2 rondas × 2 equipos: máximo 4 solicitudes de inferencia, sin reintentos SDK.
npm run arena -- --modo llm --segundos 10 --intervalo 5 --salida .cache/arena-modelos.json

# Recalcular el registro sin llamar al modelo.
npm run arena -- --reproducir .cache/arena-modelos.json
```

El directorio debe existir y el archivo de salida debe ser nuevo. La CLI carga
`.env` solo en modo `llm`; no imprime claves ni respuestas crudas del proveedor.
Las variables exportadas en el proceso tienen precedencia. La web no expone un
endpoint de inferencia; la ejecución real se solicita explícitamente por CLI.

Opciones: `--seed`, `--segundos` (1–180), `--intervalo` (2–30 s), `--local` y
`--visita` (4-3-3 / 4-2-3-1 / 4-4-2), `--espera` (ms, máximo 60000),
`--salida`, `--reproducir` y `--config` (JSON de tipo `SimConfig`; extraer el campo
`config` si se parte de un `Partido`). Duración predeterminada: 180 s; intervalo:
15 s; 12 rondas y hasta 24 solicitudes en modo LLM. Cada llamada representa un
equipo, no un jugador.

## Deployment actual y segundo modelo

Dos controladores pueden usar el deployment existente. Ambos heredan la
configuración de `src/lib/llm.ts`. Para otros deployments/proveedores, sobrescribir
por equipo; los nombres siguientes son ejemplos, no recursos creados:

```dotenv
ARENA_LOCAL_LLM=azure-openai
ARENA_LOCAL_AZURE_OPENAI_DEPLOYMENT=nombre-del-deployment-local
ARENA_VISITA_LLM=foundry
ARENA_VISITA_FOUNDRY_DEPLOYMENT=nombre-del-deployment-visitante
```

Claves, endpoints y opciones restantes se heredan de `AZURE_OPENAI_*` o
`FOUNDRY_*`; se pueden sobrescribir con el mismo prefijo, por ejemplo
`ARENA_VISITA_FOUNDRY_BASE_URL`. No usar `NEXT_PUBLIC_*` para claves. El Writer
conserva su modelo. `stub` y `ensayo` se rechazan en el modo LLM de la arena;
el modo programado se declara por separado.

La prueba real acredita dos agentes, **no dos modelos diferentes**. Para esa
comparación falta un segundo deployment operativo. El bloqueo histórico de Claude
en Marketplace no se considera resuelto por esta entrega.

## Parámetros y límites

| Dato | Uso en el prototipo |
| --- | --- |
| Ataque/defensa | Disputa del balón y nivel derivado cuando no se activa nivel individual. |
| Nivel individual | Precisión, locomoción y disputa si `variantes.niveles` está activa. |
| Estilo | Preferencias de pase, amplitud y bloque programadas; contexto del agente LLM. |
| Formación y órdenes | Referencias por fase, objetivos, amplitud y altura del bloque. |
| Lluvia/calor | Error adicional del golpe y esfuerzo acumulado; cifras sintéticas. |
| Otras condiciones | Contexto del agente; no se han trasladado todos los modificadores históricos. |
| Reservas y bajas | Se valida la plantilla; el escenario utiliza los once titulares. |

Sin juego aéreo, faltas, tarjetas, lesiones, sustituciones o cambio de campo.
Las variantes activadas de lesiones, autogoles, insólitos o sanciones se rechazan.
Tras gol, tiro fuera o fuera de juego se registra un **reinicio experimental**:
el balón se coloca en el portero correspondiente sin teletransportar jugadores.
No se afirma que sea un saque de centro o de meta reglamentario.

El contacto usa un radio y una trayectoria 2D. El fuera de juego usa puntos, no
partes del cuerpo ni todos los supuestos de interferencia. Las instrucciones
persisten varios segundos con control local entre consultas. Los parámetros
`ARENA` en `src/sim/limites.ts` están por calibrar; reproducibilidad no acredita
realismo futbolístico profesional.

La narración usa plantillas desde eventos y distingue pase intentado y recepción.
Es independiente de V1–V8. La siguiente evaluación debe medir plausibilidad con
revisión humana, comparar con políticas programadas y alternar lados antes de
atribuir una ventaja a un modelo.
