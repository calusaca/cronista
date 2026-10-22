// Brief 043 (nota del 22 oct) · Sintetiza las reservas de voz con Azure Speech y la voz del narrador
// (src/arena/voz.ts, misma interpretación serena que antes) y las guarda como archivos estáticos:
//   public/voz-reserva/{es,en}/NN.mp3, {es,en}/cierre.mp3 y public/voz-reserva/indice.json.
// El consumidor del búfer las descarga al activar la voz; ya no van incrustadas en el paquete.
// Uso: node --import tsx scripts/sintetizar-reservas.mjs [--todas]
//   Sin --todas, conserva un clip cuyo texto y voz no cambiaron y su archivo coincide con la huella.
// Las credenciales se leen de .env y .cache/azure-servicios.env; nunca se imprimen ni se guardan.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const FRASES = {
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
    "Una pausa con la pelota puede dar tiempo para que los compañeros se acomoden.",
    "Conservar la posesión también sirve para descansar mientras circula la pelota.",
    "Atraer rivales hacia un lado puede dejar más espacio en el sector contrario.",
    "Un apoyo cercano permite tocar, moverse y ofrecerse para recibir de nuevo.",
    "La primera línea de presión intenta orientar la salida rival hacia un costado.",
    "Un control orientado ahorra un toque y acelera la acción siguiente.",
    "Mirar alrededor antes de recibir ayuda a decidir más rápido qué hacer.",
    "Ocupar todo el ancho del campo obliga a la defensa a cubrir más terreno.",
    "Las diagonales sin balón pueden arrastrar marcas y abrir un pasillo para otro compañero.",
    "Un pase firme al pie facilita el control; uno al espacio invita a correr.",
    "Justo después de recuperar, suelen aparecer huecos antes de que el rival se reorganice.",
    "Defender con las líneas juntas reduce los huecos por donde puede filtrarse un pase.",
    "Hablar entre compañeros ayuda a repartir las marcas y a corregir posiciones.",
    "Un centro necesita compañeros que lleguen al área con el tiempo justo.",
    "Tener paciencia con el balón es otra manera de buscar el desequilibrio.",
    "Un pase entre líneas puede dejar atrás a varios rivales con un solo toque.",
    "Cubrir el balón con el cuerpo da tiempo para que lleguen los apoyos.",
    "Una buena cobertura ocupa el espacio que deja el compañero que sale a presionar.",
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
    "Pausing on the ball can give teammates time to settle into position.",
    "Keeping possession can also be a way of resting while the ball keeps moving.",
    "Drawing opponents towards one side can leave more room on the opposite side.",
    "A nearby teammate allows a quick exchange and a fresh run to receive again.",
    "The first line of pressure often tries to steer the build-up towards a flank.",
    "Receiving with an open body shape saves a touch and speeds up the next action.",
    "Scanning before receiving helps a player decide faster what to do next.",
    "Spreading across the whole width forces a defence to cover more ground.",
    "Diagonal runs without the ball can drag markers away and open a lane for someone else.",
    "A firm pass into feet helps control, while a pass into space invites a run.",
    "Straight after winning possession, gaps often appear before the other side reorganises.",
    "Keeping the lines compact reduces the gaps a pass can slip through.",
    "Talking to teammates helps share out the marking and correct positions.",
    "A cross needs teammates arriving in the area with good timing.",
    "Patience on the ball can be another way of trying to unbalance a defence.",
    "A pass between the lines can take several opponents out of the move with one touch.",
    "Shielding the ball with the body buys time for support to arrive.",
    "Good cover means filling the space left by a teammate who steps out to press.",
  ],
};
const CIERRE = {
  es: "Ha terminado el encuentro. Gracias por acompañarnos en esta transmisión.",
  en: "The match has finished. Thank you for joining us for this broadcast.",
};

const raiz = resolve(import.meta.dirname, ".."), destino = join(raiz, "public", "voz-reserva"), rutaIndice = join(destino, "indice.json");
for (const f of [".env", ".cache/azure-servicios.env"]) if (existsSync(join(raiz, f))) process.loadEnvFile(join(raiz, f));
process.env.CRONISTA_TELEMETRIA = "0"; // Script local: sin trazas hacia Application Insights.
const { RESERVAS_VOZ } = await import("../src/sim/limites.ts");
const { sintetizarTexto } = await import("../src/arena/voz.ts");
const todas = process.argv.includes("--todas");
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const previo = existsSync(rutaIndice) ? JSON.parse(readFileSync(rutaIndice, "utf8")) : null;

const indice = { version: 1, formato: "audio/mpeg", voces: {}, es: null, en: null };
let sintetizados = 0, caracteres = 0, conservados = 0;
for (const idioma of ["es", "en"]) {
  const frases = FRASES[idioma];
  if (frases.length < RESERVAS_VOZ.minimoPorIdioma) throw new Error(`Faltan reservas en ${idioma}: ${frases.length} < ${RESERVAS_VOZ.minimoPorIdioma}`);
  if (new Set([...frases, CIERRE[idioma]]).size !== frases.length + 1) throw new Error(`Reservas repetidas en ${idioma}`);
  mkdirSync(join(destino, idioma), { recursive: true });
  const clip = async (texto, nombre) => {
    const archivo = `${idioma}/${nombre}.mp3`, ruta = join(destino, archivo);
    const anterior = [...(previo?.[idioma]?.reservas ?? []), previo?.[idioma]?.cierre].find(c => c?.archivo === archivo);
    if (!todas && anterior?.texto === texto && previo.voces?.[idioma] && existsSync(ruta) && sha256(readFileSync(ruta)) === anterior.sha256) {
      indice.voces[idioma] = previo.voces[idioma]; conservados++;
      return anterior;
    }
    const audio = await sintetizarTexto(texto, idioma, 0);
    const bytes = Buffer.from(audio.base64, "base64");
    if (audio.tipo !== "audio/mpeg" || !bytes.length) throw new Error(`Audio inesperado para ${archivo}`);
    if (indice.voces[idioma] && indice.voces[idioma] !== audio.voz) throw new Error(`Voz inconsistente en ${idioma}`);
    indice.voces[idioma] = audio.voz;
    writeFileSync(ruta, bytes); sintetizados++; caracteres += texto.length;
    return { archivo, texto, bytes: bytes.length, sha256: sha256(bytes) };
  };
  const reservas = [];
  for (const [i, texto] of frases.entries()) reservas.push(await clip(texto, String(i + 1).padStart(2, "0")));
  indice[idioma] = { reservas, cierre: await clip(CIERRE[idioma], "cierre") };
}
writeFileSync(rutaIndice, JSON.stringify(indice, null, 1) + "\n");
const bytes = ["es", "en"].flatMap(i => [...indice[i].reservas, indice[i].cierre]).reduce((n, c) => n + c.bytes, 0);
console.log(JSON.stringify({ reservasPorIdioma: { es: indice.es.reservas.length, en: indice.en.reservas.length }, voces: indice.voces, sintetizados, conservados, caracteresSintetizados: caracteres, bytes }));
