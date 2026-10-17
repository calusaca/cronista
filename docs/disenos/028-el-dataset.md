# 028 — El dataset: la creación de datos como entregable

**Fecha:** 2026-10-05 · **Diseña:** Fable (pedido de Carlos: «mejora la parte
de crear datos») · **Implementa:** Opus · **Estado:** cerrado

## Objetivo

«Optimized synthetic data creation» es el PRIMER desempate del jurado — y hoy
nuestros datos viven encerrados en la app. Este brief los convierte en un
dataset descargable, documentado y validado: la diferencia entre decir «tenemos
buenos datos» y ponerlos en la mano del juez.

## 1 · `npm run dataset` (`src/dataset/cli.ts`)

- `npm run dataset -- --n 100 --out docs/dataset/muestra` (defaults sensatos).
- Exporta, determinista y reproducible byte a byte:
  - `partidos.jsonl`: una línea por partido — semilla, equipos (con niveles),
    condiciones si las hay, eventos macro completos, hechos del Analista con
    sus citas. Campo `esquema: "cronista/1"`.
  - `micro.jsonl.gz` (opcional con `--micro`): los ~2.100 micro-eventos por
    partido (pesa; comprimido).
  - `resumen.csv`: una fila por partido (goles, xG, tarjetas, condiciones,
    rachas, insólitos) — para quien quiere Excel en 10 segundos.
- Fuente: los partidos por semilla con TODAS las variantes encendidas
  (niveles, insólitos, lesiones, autogoles) + nota de que la liga añade
  condiciones/temporada; el flag `--liga` exporta una temporada completa.
- Los nombres de campo del JSONL son los del código (ES): el data card los
  documenta en EN. No se traduce el esquema (una fuente de verdad).

## 2 · El data card (`docs/dataset/DATASHEET.md`, generado por el mismo CLI)

Formato «datasheet for datasets» (Gebru et al.) — los jueces de IA lo
reconocen al instante. Secciones, TODAS generadas desde el código y la
corrida (cero cifras a mano, que driftean):

1. **Motivation**: por qué datos sintéticos (cero datos reales de la PL —
   regla del hackathon — y reproducibilidad total).
2. **Composition**: conteos reales de ESTA corrida (partidos, eventos, micro,
   hechos; goles/partido, % empates…).
3. **Generation process**: cadena determinista por semilla, streams
   derivados, variantes; el espacio de semillas (2^32 por partido suelto, más
   mundo × temporada en liga) — enunciado como tamaño del espacio, sin
   afirmaciones de «unicidad» no computables.
4. **Validation**: la tabla bandas-vs-medido — importada de `limites.ts` y
   re-medida en la corrida (goles 2,2–3,4 ⇒ medido X; estilos distinguibles;
   A/B de condiciones con sus cocientes; rarezas de definiciones e
   insólitos). Referencias de orden de magnitud de ligas top (las del
   comentario de limites).
5. **Uses & limitations** (honesto): streams correlacionados por diseño, sin
   posiciones continuas (zonas), lesiones/sanciones solo liga, 1 temporada.
6. **License**: la del repo, datos 100 % ficticios, cero marcas.

## 3 · Página `/datos` («Data» en la barra)

- La historia del dataset en una pantalla: los números de cabecera (N
  partidos, ~2.100 micro/partido, bandas validadas), el esquema en una tabla
  corta, botón de descarga de una muestra REAL (`public/muestra-10.jsonl`,
  10 partidos generados por el CLI y commiteados — regenerables, con su
  semilla anotada) y link al DATASHEET en el repo.
- Rotulado honesto de siempre; 360 px sin desborde; 1 e2e (página carga,
  descarga presente, números visibles).

## Propiedades verificables

1. Determinismo: dos corridas del CLI ⇒ bytes idénticos (incl. el gz).
2. Validez: cada línea del JSONL parsea contra el zod del esquema; las citas
   de los hechos apuntan a eventos presentes en la misma línea.
3. El DATASHEET no contiene cifras huérfanas: toda cifra viene de limites o
   de la corrida (prueba: regenerar ⇒ idéntico).
4. La muestra de `public/` es exactamente la salida del CLI para sus semillas
   (prueba que la regenera y compara).
5. E2e de `/datos`.

## Mutaciones mínimas

Cita de hecho a evento ausente ⇒ validez; CSV con goles de otra fuente ⇒
comparación con JSONL; DATASHEET con cifra a mano ⇒ regeneración; muestra
desactualizada ⇒ prueba 4.

## Fuera de alcance

Formatos parquet/arrow, API de descarga dinámica, dataset multi-temporada.

## Aceptación

Suites + e2e vistos por Fable; `npm run dataset` corrido dos veces por Fable
con hash idéntico; DATASHEET leído completo por Fable («¿lo firmaría como
revisor de datasets?»); smoke de `/datos` a ojo.

## Revisión 28.1 · Memoria del A/B (2026-10-10)

CI en Node 22 agotó el heap al conservar simultáneamente los nueve brazos de
condiciones, cada uno con N_AB partidos y todos sus micro-eventos. La revisión
acumula las medidas partido por partido; conserva semillas, tamaños de muestra,
criterios y orden de las mediciones. Solo los contadores sobreviven a cada partido.

Propiedad adicional: el CLI completo, ejecutado en un subproceso con
`--max-old-space-size=512`, debe regenerar DATASHEET, ficha, partidos y CSV
idénticos a los archivos de referencia. La exportación mantiene su contrato;
no se regeneran fixtures para aceptar diferencias. Evidencia y comandos en
[ci-memoria-2026-10-10.md](../evidencia/ci-memoria-2026-10-10.md).
