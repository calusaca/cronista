# Brief 065 § 3 · Bolsas de voz de un directo narrado a 60, 120 y 180 s (26 oct 2026)

Medición con Speech simulado y el narrador fiel de las pruebas del 048, sin LLM real. El consumidor pide, por idioma:

- la previa;
- la apertura;
- los tramos del narrador cada 50 ticks;
- las intervenciones de la mesa, en una variante (completa) o en las dos;
- el cierre.

Se usaron las semillas 1–8 en directo programado (`intervaloS` 30). Las reservas se suman desde `extras.json` por
clase. El script es `medir-voz-065.test.ts.txt`: se colocó temporalmente en `src/arena/__tests__/`, se corrió con
vitest y se retiró. Los datos están en `medicion.jsonl` y las bolsas vigentes en `bolsas.json`.

Bolsas vigentes:

- narrador: 80 solicitudes y 24.000 caracteres, con 2 y 800 reservados para el cierre;
- invitados: 16 solicitudes y 4.800 caracteres;
- previa: 12 solicitudes y 9.000 caracteres.

Las cifras de cada fila son el máximo entre las 8 semillas.

| Duración | Idiomas | Variantes | Narrador y cierre | Invitados servidos (pedidos) | Previa | Rechazos |
|---|---|---|---|---|---|---|
| 60 s | ES | completa | 14 / 5.364 c | 7 / 4.765 c (5–7) | 3 / 1.673 c | ninguno |
| 60 s | ES+EN | completa | 28 / 10.662 c | 6 / 4.721 c (10–14) | 6 / 3.601 c | invitados en 8/8 |
| 120 s | ES | completa | 26 / 9.706 c | 7 / 4.797 c (10–13) | 3 / 1.673 c | invitados en 8/8 |
| 120 s | ES+EN | ambas | 52 / 19.398 c | 8 / 4.757 c (40–52) | 12 / 5.844 c | invitados en 8/8 |
| 180 s | ES+EN | completa | 75 / 23.841 c | 6 / 4.721 c (28–34) | 6 / 3.601 c | narrador e invitados en 8/8 |

En la fila de 180 s, el narrador recibe 68 rechazos «reservado para el cierre».

## Conclusión a 120 s

- **La bolsa del narrador no se agota.** El peor caso, ES+EN, llega a 52 solicitudes y 19.398 caracteres, dentro de
  80 / 24.000 menos la reserva del cierre.
- **La bolsa de la previa no se agota.** Llega como mucho a 12 solicitudes y 5.844 caracteres, de 12 / 9.000.
- **La bolsa de los invitados se agota en las 8 semillas**, incluso con un solo idioma y una sola variante. Solo
  caben 6–8 audios, porque el límite real son los 4.800 caracteres. A 60 s, con un solo idioma, no se agotaba.

Los invitados reciben un 429 propio, que no afecta al narrador ni al cierre. Este brief no sube ninguna bolsa: queda
como deuda para Carlos.

## Bolsa de invitados subida a 40 / 24.000 (26 oct, decisión de Carlos)

Se repitió la misma medición, con el script de arriba colocado temporalmente y las semillas 1–8. Los datos están en
`medicion-bolsa-40.jsonl`.

Antes se probó 32 / 19.200, pero a 120 s ES+EN completa aún rechazaba invitados en 1 de 8 semillas, con un máximo de
18.804 c.

Con 40 / 24.000:

| Duración | Idiomas | Variantes | Invitados pedidos | Máximo servido | Semillas con rechazo de invitados | Semillas con rechazo del narrador |
|---|---|---|---|---|---|---|
| 60 s | ES / ES+EN | completa | 5–7 / 10–14 | 7 / 14 (10.118 c) | 0 / 0 | 0 / 0 |
| **120 s** | **ES** | completa | 10–13 | 13 (9.127 c) | **0** | 0 |
| **120 s** | **ES+EN** | completa | 20–26 | 26 (19.465 c) | **0** | 0 |
| 120 s | ES+EN | ambas | 40–52 | 38 (23.908 c) | 8 | 0 |
| 180 s | ES+EN | completa | 28–34 | 34 (23.733 c) | 0 | 8 (ya antes) |

Coste máximo añadido por encuentro: 24.000 caracteres de Speech. Los topes diarios
(`ARENA_SPEECH_DIARIO_*`) siguen siendo la salvaguarda global.
