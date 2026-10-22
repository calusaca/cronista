import { prepararVoz } from "../../../src/arena/voz";
const idiomas = ["es", "en"] as const;
const textos = {
  es: { a1: "Así sale Sporting Montefrío Bajo, en cuatro-dos-tres-uno: Maximiliano Echeverría lleva el brazalete.", a2: "Once de nivel medio 71; en el banquillo, Sebastián Villanueva, bloque y contragolpe.", c1: "Arbitra Juan Pérez. Cielo despejado, 32 grados y césped natural corto.", c2: "Perfiles de equipo: Sporting Montefrío Bajo, ataque 72 y defensa 65; Olímpico Brezal, ataque 70 y defensa 68." },
  en: { a1: "Here is Sporting Montefrío Bajo, in a four-two-three-one: Maximiliano Echeverría wears the armband.", a2: "A starting eleven with an average ability of 71; Sebastián Villanueva in the dugout, block and counter.", c1: "Juan Pérez is the referee. Clear skies, 32 degrees and short natural grass.", c2: "Team profiles: Sporting Montefrío Bajo, attack 72 and defence 65; Olímpico Brezal, attack 70 and defence 68." },
};
let total = 0;
for (const idioma of idiomas) {
  const t = textos[idioma];
  const f = (texto: string, rol: "narrador" | "estadista") => ({ tick: 0, texto, emocion: "serena" as const, intensidad: rol === "narrador" ? .25 : .1, variante: 1, fuentes: [], fotogramas: [], rol });
  const casos = { completaA: [f(t.a1, "narrador"), f(t.a2, "estadista")], breveA: [f(t.a1, "narrador")], completaC: [f(t.c1, "narrador"), f(t.c2, "estadista")], breveC: [f(t.c2, "estadista")] };
  for (const [k, frags] of Object.entries(casos)) { const p = prepararVoz(frags, idioma); console.log(idioma, k, "texto", p.texto.length, "ssml", p.caracteresPresupuestados); total += p.caracteresPresupuestados; }
}
console.log("suma 8 casos (A y C, 2 variantes, 2 idiomas):", total, "→ 3 piezas ≈", Math.round(total * 1.5));
