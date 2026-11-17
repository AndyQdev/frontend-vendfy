import { useMemo } from "react";

import { evaluar, type Acceso, type Funcion, type Requisito } from "@/shared/acceso/permisos";
import { useAuth } from "./auth";

/**
 * Qué puede hacer quien entró: el dueño todo lo de su plan; un empleado, lo de
 * su rol. Para esconder lo que no va; el backend lo vuelve a revisar siempre.
 */
export function useAcceso() {
  const { user } = useAuth();
  const acceso = (user as { acceso?: Acceso } | null)?.acceso;

  return useMemo(
    () => ({
      acceso,
      esDueno: acceso ? acceso.esDueno : true,
      /** ¿Tiene alguno de estos permisos? */
      puede: (...permisos: string[]) => evaluar(acceso, { permisos }) === "ok",
      /** ¿Su plan incluye esta función? */
      tiene: (funcion: Funcion) => evaluar(acceso, { funcion }) === "ok",
      cumple: (req: Requisito) => evaluar(acceso, req) === "ok",
      motivo: (req: Requisito) => evaluar(acceso, req),
    }),
    [acceso]
  );
}
