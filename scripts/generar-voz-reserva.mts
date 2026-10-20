import { writeFile } from "node:fs/promises";
import { sintetizarTexto } from "../src/arena/voz.ts";

// Las credenciales se cargan desde el entorno; nunca se guardan en el catálogo.
const frases = {
  es: [
    "Además de quien lleva la pelota, conviene seguir los movimientos de sus compañeros.",
    "Un pase hacia atrás también puede servir para encontrar una nueva salida.",
    "En una recepción, el primer control puede facilitar la siguiente jugada.",
    "Cambiar el juego de una banda a otra puede abrir un camino diferente hacia el área.",
    "La distancia entre los compañeros importa: acercarse ofrece una opción de pase corto.",
    "Para defender también cuenta lo que ocurre lejos de la pelota, especialmente a la espalda.",
    "Cuando un equipo pierde la posesión, regresar a tiempo ayuda a cerrar espacios.",
    "Un remate no empieza solo al golpear: el pase anterior también forma parte de la jugada.",
    "Jugar por fuera puede dar amplitud; por dentro, las líneas de pase suelen ser más estrechas.",
    "En un saque, la colocación de los compañeros ayuda a ofrecer distintas opciones.",
    "La precisión y la elección del momento cuentan tanto como la fuerza de un pase.",
    "El portero también puede ser un apoyo para volver a empezar la circulación.",
    "Ha terminado el encuentro. Gracias por acompañarnos en esta transmisión.",
  ],
  en: [
    "There is more to follow than the ball carrier: the movement around them matters too.",
    "Going backwards can sometimes offer a different route forwards.",
    "A good first touch can make the next part of a move much easier.",
    "Switching play from one flank to the other can open a different route towards the box.",
    "The distance between teammates matters: coming closer offers a shorter passing option.",
    "Defending also means watching what happens away from the ball, especially in behind.",
    "After losing possession, getting back quickly can help close the spaces.",
    "A shot is only part of a move; the pass that sets it up matters as well.",
    "Width can stretch the play, while passing lanes through the middle tend to be tighter.",
    "At a restart, teammates can offer different options through their positioning.",
    "Timing and accuracy can matter just as much as the power behind a pass.",
    "The goalkeeper can also offer a way to recycle possession and start again.",
    "The match has finished. Thank you for joining us for this broadcast.",
  ],
};
const catalogo = {} as Record<string, { texto: string; base64: string; tipo: string }[]>;
for (const idioma of ["es", "en"] as const) {
  catalogo[idioma] = [];
  for (const texto of frases[idioma]) {
    const audio = await sintetizarTexto(texto, idioma, 0);
    catalogo[idioma].push({ texto, base64: audio.base64, tipo: audio.tipo });
  }
}
await writeFile(new URL("../src/arena/voz-reserva.json", import.meta.url), JSON.stringify(catalogo));
console.log(JSON.stringify({ idiomas: Object.keys(catalogo), clips: Object.values(catalogo).flat().length, caracteres: Object.values(frases).flat().join("").length }));
