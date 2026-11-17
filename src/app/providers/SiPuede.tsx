import type { ReactNode } from "react";

import type { Requisito } from "@/shared/acceso/permisos";
import { useAcceso } from "./acceso";

/**
 * Muestra lo de adentro solo si quien entró cumple: alguno de los permisos,
 * la función del plan, o ser el dueño. Para los botones de crear, editar y
 * borrar: el empleado no ve lo que no puede usar. El backend lo vuelve a
 * revisar siempre; esto es para no ofrecer lo que después rebota.
 */
export function SiPuede({ children, sino = null, ...req }: Requisito & { children: ReactNode; sino?: ReactNode }) {
  const { cumple } = useAcceso();
  return <>{cumple(req) ? children : sino}</>;
}
