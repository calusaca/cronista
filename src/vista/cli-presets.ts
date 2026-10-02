// `npm run presets`: caza las cinco historias de la vitrina (brief 014 §2) y las imprime
// con su marcador y el dato que las hace historia. Determinista: misma salida siempre.
import { analizar } from "../analista/analista";
import { simular } from "../sim/motor";
import { configDeSemilla } from "../sim/plantillas";
import { CORPUS_PRESETS, CRITERIOS, cazarPresets, PRESETS } from "./presets";

const elegidas = cazarPresets();
console.log(`Presets cazados sobre las semillas 1..${CORPUS_PRESETS}:`);
for (const c of CRITERIOS) {
  const seed = elegidas[c.id];
  const p = simular(configDeSemilla(seed));
  const hs = analizar(p);
  const r = hs.find((h) => h.tipo === "resultado_final");
  console.log(`  ${c.id.padEnd(17)} seed ${String(seed).padStart(4)} · ${r?.texto_en} · puntaje ${c.puntaje(hs, p)} · «${c.historia}»`);
}
const iguales = CRITERIOS.every((c) => PRESETS[c.id] === elegidas[c.id]);
console.log(iguales ? "PRESETS (src/vista/presets.ts) coincide con lo cazado." : "ATENCIÓN: PRESETS no coincide con lo cazado; actualizalo.");
