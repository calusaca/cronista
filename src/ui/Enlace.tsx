"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { useAvisoCarga } from "./Actividad";

function EstadoEnlace({ href }: { href: string }) {
  const { pending } = useLinkStatus();
  const partido = href === "/" || /^\/(match\/|liga\/\d+\/)/.test(href);
  const perspectiva = href.includes("perspectiva=");
  useAvisoCarga(pending,
    perspectiva ? "Preparing your report…" : partido ? "Preparing your match…" : "Loading page…",
    perspectiva ? "Updating the report for your team. This may take a little while."
      : partido ? "Generating the match and its report. This may take a little while." : "Please wait while the next page loads.");
  return null;
}

/** Conserva navegación nativa de Next, prefetch, scroll, modificadores y nuevas pestañas. */
export default function Enlace({ children, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  return <Link {...props}>{children}<EstadoEnlace href={props.href} /></Link>;
}
