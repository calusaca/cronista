// Brief 044: único mapeo de los controles del formulario de arena a las condiciones
// pedidas. Lo comparten la simulación guardada y ArenaEnDirecto para que no diverjan.
import { TEMPERATURA_C, type ClimaPartido } from "../sim/limites";
import type { Condiciones } from "../sim/tipos";

export interface FormularioEntorno {
  clima: ClimaPartido | "auto"; temperatura: string;
  superficie: NonNullable<Condiciones["superficie"]> | "auto"; cesped: NonNullable<Condiciones["cesped"]>;
  presion: "baja" | "media" | "auto";
}

/** Una temperatura vacía, no entera o fuera de la banda del clima se omite: el motor
 * asigna entonces una válida en lugar de recibir `Number("") = 0`. */
export function entornoDeFormulario(f: FormularioEntorno): Partial<Condiciones> {
  const banda = f.clima === "calor" || f.clima === "frio" ? TEMPERATURA_C[f.clima] : null;
  const texto = f.temperatura.trim(), valor = Number(texto);
  const temperaturaC = banda && /^-?\d+$/.test(texto) && valor >= banda.min && valor <= banda.max ? valor : undefined;
  return {
    ...(f.clima !== "auto" ? { clima: f.clima, ...(temperaturaC !== undefined ? { temperaturaC } : {}) } : {}),
    ...(f.superficie !== "auto" ? { superficie: f.superficie, ...(f.superficie === "natural" ? { cesped: f.cesped } : {}) } : {}),
    ...(f.presion !== "auto" ? { presion: { local: f.presion, visita: f.presion === "baja" ? "media" : "alta" } } : {}),
  };
}
