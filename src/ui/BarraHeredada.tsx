"use client";
// Brief 064 § 3.1/§ 3.3 · La barra única en las páginas del servidor heredadas (/cronicas, /match, /liga, /datos):
// guarda el idioma en estado (inicial `en`, o `es` con `?lang=es`). Cambia la barra y el `lang` de sus enlaces, no el
// marco ni la crónica histórica, que conserva su propio conmutador (límite declarado, D-9).
import { useState } from "react";
import { BarraSitio } from "./BarraSitio";

export function BarraHeredada({ idiomaInicial }: { idiomaInicial: "es" | "en" }) {
  const [idioma, setIdioma] = useState(idiomaInicial);
  return <BarraSitio idioma={idioma} alCambiarIdioma={() => setIdioma((i) => (i === "es" ? "en" : "es"))} seccion={null} />;
}
