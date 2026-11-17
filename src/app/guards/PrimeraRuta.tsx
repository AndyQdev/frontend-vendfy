import { Navigate } from "react-router-dom";

import { useAcceso } from "@/app/providers/acceso";
import { primeraRuta } from "@/widgets/app-header";

/**
 * "/" y las direcciones que no existen llevan a la primera pantalla que esta
 * persona puede usar: la Caja para el dueño o la cajera; Productos para quien
 * carga inventario y no cobra.
 */
export function PrimeraRuta() {
  const { cumple } = useAcceso();
  return <Navigate to={primeraRuta(cumple)} replace />;
}
