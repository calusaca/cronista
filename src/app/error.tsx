"use client";

import { useState } from "react";
import Link from "../ui/Enlace";
import { useAvisoCarga } from "../ui/Actividad";

export default function ErrorPagina() {
  const [pendiente, setPendiente] = useState(false);
  useAvisoCarga(pendiente, "Trying again…", "Please wait while the page loads.");
  return <main className="work-page-error" data-testid="page-error">
    <h1>The page could not be loaded</h1>
    <p role="alert">Please try again, or return to the featured match.</p>
    {/* La recarga permite recuperar también un módulo cuyo import quedó rechazado. */}
    <button type="button" className="btn btn-primary" disabled={pendiente} onClick={() => { setPendiente(true); window.location.reload(); }}>Try again</button>{" "}
    <Link href="/cronicas" prefetch={false} className="btn">Featured match</Link>
  </main>;
}
