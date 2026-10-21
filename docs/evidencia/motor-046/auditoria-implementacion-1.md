# Auditoría adversaria de la implementación del brief 046 (iteración 1)

Agente `auditor-adversario` (Opus), 21 oct 2026, sobre una instantánea del árbol sin commit (16:55 UTC),
semillas 201–400 y duraciones 60, 120 y 180 s. Scripts fuera del repo.

**Veredicto:** cumple la salida a achicar (0 de 593 mano a mano con el portero quieto; mediana 1,17 m) y los
centros (45,4 % de pases de banda al área; 0,745 centros por partido); reproducción y versiones intactas
(9 registros archivados idénticos; v1–v3 iguales a HEAD en 330 partidos; fuzz LLM sin fallos). **No cumple el
objetivo 3 de Carlos en la práctica.**

| # | Severidad | Hallazgo |
|---|---|---|
| A1 | Mayor | `respetarManos` deja al rival a ~3,9 m, lo que bloquea el saque voluntario (umbral 4 m); a los 4 s el saque forzado elige al compañero más aislado ignorando la línea de pase y el rival plantado lo intercepta. 200 semillas: 188 forzados, 135 con un rival a 3,5–4 m; 111 saques perdidos sin toque de compañero, 38 interceptados al tick siguiente y 37 goles sin toque defensor tras el saque (23 de saques forzados). Semilla 202: atajada tick 121, saque forzado tick 162, intercepción 163, gol 186. |
| A2 | Mayor | La métrica «pérdida del portero en su área» solo ve el paso directo portero→rival; una intercepción del saque en vuelo no cuenta, y la banda ≤ 0,03 se da por cumplida con 0,19 intercepciones por partido. |
| B1 | Menor | `centrar` aceptado para el portero: con el balón en los pies fuera del área queda congelado y se lo roban. |
| B2 | Menor | 6 mutantes sobreviven (saque con `pasar` sin límite de 40 m, receptor de centro portero, portero con manos obedece `conducir`, borde del área −0,5 m, ventaja de centro negativa, robo duro sin faltas). |
| B3 | Menor | Un `centrar` a x = 105 deja el balón parado sobre la línea de gol sin poseedor. |
