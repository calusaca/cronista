# 069 — El host de crónicas con el aspecto actual

## Estado

Brief **cerrado v1.0**, 27 oct 2026, 05:45 UTC. Lo diseña Opus 5.5 (coordinador). Carlos eligió la opción B el
27 oct («2- B»).

## Hallazgo

`https://cronista.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io/` es la «Verified match recap» que enlazan el
README, la guía de jueces y la plataforma.

- Corre la revisión `cronista--0000006`, con una imagen del 18 oct (`demo-20261018042118`). Por eso tiene el
  aspecto y el menú viejos: League mode, Data y Team agents lab.
- Escribe con el modelo real, GPT-6.1 Sol (`CRONISTA_LLM=azure-openai`).
- El host de la arena sirve `/cronicas` con el aspecto nuevo (061/064), pero con el redactor stub.

## Alcance

1. **Código.** En el host de crónicas, la barra única (`src/ui/BarraSitio.tsx`, `enlacesSitio`) debe llevar a la
   arena pública y no a su propia `/arena`, que no tiene catálogo de modelos ni voz.
   - Variable de entorno de servidor, por ejemplo `CRONISTA_ARENA_URL`. Si está, la marca, «Arena» y «Torneo» son
     URL absolutas a ese origen, con el `lang` aplicado como hoy. Si no está, el comportamiento es idéntico al
     actual (relativo).
   - El valor se lee en el servidor y llega a la barra por props o por el patrón que ya use la app para
     `CRONISTA_RAIZ`. Nada de `NEXT_PUBLIC_` compilado en la imagen.
   - Si hay otros enlaces del host de crónicas que lleven a la arena («Watch live», pie, etc.), se aplica lo
     mismo, sin rediseñar.
2. **Infraestructura.** `infra/app.bicep` añade `CRONISTA_ARENA_URL` con la URL pública de la arena (parámetro
   con ese valor por defecto) junto a `CRONISTA_RAIZ=cronicas`.
3. **Pruebas.**
   - Unitarias de `enlacesSitio` con y sin la variable.
   - La e2e existente de la barra sigue en verde sin la variable.
   - Comprobar con el build standalone y la variable puesta que `/` (con `CRONISTA_RAIZ=cronicas`) muestra la
     portada nueva y que la barra apunta a la URL absoluta.
4. **Despliegue.** Lo hace el coordinador con `scripts/deploy-azure.mjs`, desde un worktree limpio.
   - Smoke: `npm run smoke:public -- <url> --raiz cronicas` y una mirada en el navegador.
   - Si algo falla, se vuelve a `cronista--0000006`.

## Fuera de alcance

- Cambiar el contenido de las crónicas o el redactor.
- Tocar la arena.
- El bloque B4 del 064 sin commit (`BotonCronica.tsx`, `CronicaArena.tsx`, `textos-cronica-arena.ts`,
  `src/app/arena/cronica/`, cambios en `CajaDeCristal.tsx`, `textos.ts`, `globals.css` y `Arena.tsx`), `CLAUDE.md`,
  `BITACORA.md` y `HANDOFF.md`: ni se tocan ni se commitean.
