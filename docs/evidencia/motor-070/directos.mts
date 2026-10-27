import { crearConfigArena } from "../../../src/arena/motor.ts";
import { ejecutarArena } from "../../../src/arena/coordinador.ts";
import { crearControladorProgramado } from "../../../src/arena/controladores.ts";
import { opcionDirecto } from "../../../src/arena/libre.ts";
const [desde, n] = process.argv.slice(2).map(Number);
let libres = 0, admiten = 0, directos = 0, directosAdmite = 0, pases = 0, largos = 0, menos30 = 0;
for (let seed = desde; seed < desde + n; seed++) {
  const r = await ejecutarArena(crearConfigArena({ seed, duracionS: 120, reglas: "reinicios-v11" as any }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
  r.eventos.forEach((e, i) => {
    if (e.tipo !== "reinicio" || e.reinicio !== "libre") return;
    libres++;
    const ad = opcionDirecto(e.hasta, e.lado); if (ad) admiten++;
    const x = e.lado === "local" ? 105 - e.hasta.x : e.hasta.x; if (Math.hypot(x, e.hasta.y - 34) <= 30) menos30++;
    const ej = r.eventos.slice(i + 1).find(x => (x.tipo === "pase" || x.tipo === "tiro") && x.reinicio === "libre");
    if (ej?.tipo === "tiro") { directos++; if (ad) directosAdmite++; } else if (ej?.motivo === "largo") largos++; else if (ej) pases++;
  });
}
console.log(JSON.stringify({ desde, n, libres, admitenDirecto: admiten, aMenosDe30m: menos30, directos, directosDentroDelPasillo: directosAdmite, pases, largos }));
