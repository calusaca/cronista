# Transcripts de referencia (no distribuidos)

Los briefs 043, 045 y 048 analizaron seis transcripts automáticos (ASR) de transmisiones reales de fútbol para
extraer patrones de narración e interacción entre voces (turnos, cesiones, cadencia). Ese material es ajeno y tiene
derechos de terceros, así que **no forma parte del repositorio ni de su historial**: vive solo en la copia local de
trabajo, en `docs/DatosPrueba/`, ignorada por git desde el 22 de octubre de 2026.

- No se usa en el simulador, en las plantillas ni en ningún dato del producto; solo orientó el diseño.
- Los briefs citan como mucho fragmentos breves con fines de análisis, con su número de línea.
- La prueba que impide que una plantilla copie cuatro o más palabras seguidas de ese material compara huellas
  SHA-256 truncadas de tramos normalizados (`src/arena/__fixtures__/huellas-transcripts.json`), que no contienen
  texto. Se regeneran con `node --import tsx src/arena/__fixtures__/generar-huellas-transcripts.ts` si se dispone
  de los archivos locales.
