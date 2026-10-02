import type { Metadata } from "next";
import { Archivo, Source_Sans_3 } from "next/font/google";
import "./globals.css";

// Brief 010: dos familias, las de la maqueta aprobada. Archivo para titulares, marcador y
// equipos; Source Sans 3 para todo lo demás (también la crónica: la maqueta es sans).
const display = Archivo({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["500", "700", "900"] });
const sans = Source_Sans_3({ subsets: ["latin"], variable: "--font-sans", display: "swap", weight: ["400", "600", "700"] });

export const metadata: Metadata = {
  title: "CRONISTA — Verifiable match reports",
  description: "Bilingual match reports where every sentence links to the events that prove it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
