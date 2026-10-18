"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Aviso = { titulo: string; detalle?: string };
const Actividad = createContext<((aviso: Aviso) => () => void) | null>(null);

/** Una región persistente para anunciar las esperas desde cualquier página. */
export function ProveedorActividad({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Map<symbol, Aviso>>(new Map());
  const registrar = useCallback((aviso: Aviso) => {
    const id = Symbol();
    setAvisos((actuales) => new Map(actuales).set(id, aviso));
    return () => setAvisos((actuales) => {
      const siguientes = new Map(actuales);
      siguientes.delete(id);
      return siguientes;
    });
  }, []);
  const aviso = [...avisos.values()].at(-1);
  return <Actividad.Provider value={registrar}>
    {children}
    <div className="match-loading match-loading-floating" role="status" aria-live="polite" aria-atomic="true" data-testid="match-loading">
      {aviso && <><IndicadorCarga /><div><strong>{aviso.titulo}</strong>{aviso.detalle && <span>{aviso.detalle}</span>}</div></>}
    </div>
  </Actividad.Provider>;
}

/** Se retira al resolver, cancelar o desmontar la operación; sin temporizadores ficticios. */
export function useAvisoCarga(pendiente: boolean, titulo: string, detalle?: string) {
  const registrar = useContext(Actividad);
  useEffect(() => {
    if (pendiente && registrar) return registrar({ titulo, detalle });
  }, [pendiente, registrar, titulo, detalle]);
}

export function IndicadorCarga() {
  return <span className="match-loading-spinner" aria-hidden="true" />;
}
