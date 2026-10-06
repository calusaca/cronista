// Brief 028 — texto con CIFRAS MARCADAS. Toda cifra que llega al DATASHEET pasa por `t` (plantilla
// etiquetada) o por `cifra`: así el render puede marcarlas y una prueba borra lo marcado y exige
// que no quede ni un dígito. Una cifra escrita a mano en una plantilla (que driftea) no sobrevive.

export interface Cifra {
  cifra: string;
}
export type Parte = string | Cifra;
export type Texto = Parte[];

const esCifra = (x: unknown): x is Cifra => typeof x === "object" && x !== null && "cifra" in x;

/** Una cifra: un valor que viene del código (constante importada) o de la corrida. */
export const cifra = (v: string | number): Cifra => ({ cifra: String(v) });

/** Plantilla etiquetada: cada interpolación es una cifra (o un Texto ya hecho, que se aplana). */
export function t(partes: TemplateStringsArray, ...valores: (string | number | Cifra | Texto)[]): Texto {
  const out: Texto = [];
  partes.forEach((p, i) => {
    if (p) out.push(p);
    if (i < valores.length) {
      const v = valores[i] as string | number | Cifra | Texto;
      if (Array.isArray(v)) out.push(...v);
      else if (esCifra(v)) out.push(v);
      else out.push(cifra(v));
    }
  });
  return out;
}

/** Marcas invisibles (U+2063 / U+2064) que delimitan una cifra en el modo instrumentado. */
export const MARCA = { abre: "⁣", cierra: "⁤" } as const;

export function aTexto(x: Texto, instrumentado: boolean): string {
  return x.map((p) => (typeof p === "string" ? p : instrumentado ? `${MARCA.abre}${p.cifra}${MARCA.cierra}` : p.cifra)).join("");
}

// ---- formatos (deterministas: sin Intl, la misma salida en cualquier máquina) ----

/** Separador de miles en inglés sobre un número ya escrito: "12345.6" ⇒ "12,345.6"; "-0.00" ⇒ "0.00". */
function conMiles(s: string): string {
  const limpio = /^-0(\.0+)?$/.test(s) ? s.slice(1) : s;
  const [ent, frac] = limpio.split(".");
  const signo = (ent as string).startsWith("-") ? "-" : "";
  const abs = (ent as string).replace("-", "");
  return signo + abs.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (frac !== undefined ? `.${frac}` : "");
}

/** Entero con miles. */
export const miles = (n: number) => conMiles(String(Math.round(n)));
/** Decimal con `d` cifras y miles. */
export const dec = (x: number, d: number) => conMiles(x.toFixed(d));
/** Porcentaje con `d` decimales (0.1234, 1 ⇒ "12.3%"). */
export const pct = (x: number, d: number) => `${conMiles((x * 100).toFixed(d))}%`;
