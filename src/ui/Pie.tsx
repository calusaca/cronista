// Pie: la honestidad de los datos y del modelo, siempre visible.
import type { DatosPartido } from "../vista/servidor";

export function Pie({ datos }: { datos: DatosPartido }) {
  return (
    <footer className="footer" data-testid="footer">
      <span>Every match is simulated. Teams and players are fictitious; no real match data is used.</span>
      <span data-testid="llm-label" data-fixture={datos.llm.fixture ? "true" : "false"}>
        Writer: <span className={datos.llm.fixture ? "fixture-flag" : undefined}>{datos.llm.etiqueta}</span>
        {datos.desdeCache ? " · served from cache" : ""}
      </span>
    </footer>
  );
}
