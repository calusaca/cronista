# Brief 070 § 3 · Bolsas de voz de un directo narrado de 120 s con `reinicios-v11` (27 oct 2026)

Misma medición que `docs/evidencia/motor-068/voz/`: Speech simulado y el narrador fiel de las pruebas del 048, sin LLM
real. El script es `medir-voz-070.test.ts.txt`, la copia del 068 con los nombres de v11. Se colocó temporalmente en
`src/arena/__tests__/`, se corrió con vitest y se retiró.

- Semillas 1–8 en directo programado; las sesiones usan `ARENA.reglas`, que ahora es `reinicios-v11`.
- Los datos están en `medicion.jsonl` (una línea por partido).
- Bolsas vigentes, sin cambios:
  - narrador: 80 solicitudes y 24.000 caracteres, con 2 y 800 reservados para el cierre;
  - invitados: 40 solicitudes y 24.000 caracteres;
  - previa: 12 solicitudes y 9.000 caracteres.

Cada cifra es el máximo entre las 8 semillas. La columna «Intervenciones» da el rango.

| Duración | Idiomas | Intervenciones | Narrador y cierre | Invitados servidos (pedidos) | Previa | Partidos con rechazos |
|---|---|---|---|---|---|---|
| 120 s | ES | 11–13 | 26 / 10.219 c | 13 / 9.326 c (11–13) | 3 / 1.673 c | 0 de 8 |
| 120 s | ES+EN | 11–13 | 52 / 20.271 c | 26 / 19.828 c (22–26) | 6 / 3.601 c | 0 de 8 |

**Conclusión.** Con los cantos del tiro libre y el penal, ni el narrador ni los invitados ni la previa se quedan sin
bolsa a 120 s (v10: narrador 21.156 c e invitados 18.574 c en el peor caso ES+EN). No se subió ninguna bolsa.
