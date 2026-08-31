import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Volver a la lista exacta de la que se vino.
 *
 * Los filtros viven en la dirección (ver `useFiltrosUrl`), así que alcanza con
 * recordar cuál era esa dirección al irse. Sin esto, un `navigate("/products")`
 * al guardar deja a la persona en la lista completa y sin su búsqueda, que es
 * justo lo que se quería evitar.
 *
 * Se guarda en el estado de la navegación y no en el navegador: es un dato de
 * ESTE viaje -de esta lista a esta ficha- y no una preferencia que deba
 * sobrevivir a nada más.
 */
const CLAVE = "volverA";

/** Navega a una ficha recordando la lista, con sus filtros, desde donde se fue. */
export function useNavegarConRegreso() {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (destino: string) => {
      navigate(destino, {
        state: { [CLAVE]: location.pathname + location.search },
      });
    },
    [navigate, location.pathname, location.search],
  );
}

/**
 * En la ficha: a dónde volver. Si se llegó desde una lista, a esa lista tal
 * como estaba; si se entró por un link directo, al camino de siempre.
 */
export function useRegreso(porDefecto: string) {
  const navigate = useNavigate();
  const location = useLocation();
  const guardado = (location.state as Record<string, unknown> | null)?.[CLAVE];
  const destino = typeof guardado === "string" ? guardado : porDefecto;

  return useCallback(() => navigate(destino), [navigate, destino]);
}
