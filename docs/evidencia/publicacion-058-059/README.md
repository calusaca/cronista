# Smoke público de los briefs 058 (antesala) y 059 (torneo)

Scripts fuera de git: `.cache/smoke-058b-059.mjs` y `.cache/smoke-058b-b.mjs`.
Chromium headless con `--autoplay-policy=user-gesture-required`. Directo con «Programmed demonstration», que no
gasta el cupo de partidos con modelos; Speech real.

## Revisión 0000027 (commit `b52202e`), 24 oct, 02:42 UTC: [smoke.json](smoke.json)

| Comprobación | Resultado |
|---|---|
| `/arena/torneo` a 1440 y 360 px | La clasificación coincide con el torneo 2026-10-24, la nota estadística aparece y hay 60 enlaces de repetición; `scrollWidth` igual al ancho; sin errores de JS |
| Repetición de un partido del torneo | Carga con su procedencia («Match 28 … GPT-6 Astra … GPT-6.1 Sol») y el marcador final correcto |
| Antesala con clic esperando 3 s | «Pre-match presentation», «Skip to kick-off» y narración activa; peticiones `intervencion: antesala:*` en EN |
| **Antesala con clic inmediato** (antes de que respondiera `/herramientas`) | **Defecto**: ni narración ni antesala. Reproducido 2 de 2 veces. |

## Revisión cronista-arena--0000028 (commit `8bab548`), 24 oct, ~03:10 UTC

El defecto se corrigió en `a60239a`: el audio se ceba dentro del gesto aunque la voz aún no se conozca, y se
activa cuando `/herramientas` confirma `voz: true`. La e2e B13 incluye su mutación.

Repetición con clic inmediato (`ESPERA=0`): a 5,2 s ya se ve «Pre-match presentation · 0/20 s ready»; a 10 s
«broadcast ready», con «Skip to kick-off» y «Turn narration off». A 35 s el saque sigue retenido mientras suena
la antesala.

## Sin comprobar

Escucha humana de la antesala; navegadores distintos de Chromium.
