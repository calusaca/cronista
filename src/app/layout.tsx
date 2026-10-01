import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";

// Dos familias: sans para el chrome, serif para la crónica (es un texto de periódico).
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Newsreader({ subsets: ["latin"], variable: "--font-serif", display: "swap", weight: ["400", "600"] });

export const metadata: Metadata = {
  title: "CRONISTA — Verifiable match reports",
  description: "Bilingual match reports where every sentence links to the events that prove it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
