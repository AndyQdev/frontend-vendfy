import { useAuth, useStore } from "@/app/providers/auth";

/**
 * En qué tienda se registra y se vende lo escaneado.
 *
 * Si arriba hay una tienda elegida, esa. Si está "Todas" y el comercio tiene
 * una sola, esa también: no tiene sentido preguntar. Solo con varias tiendas
 * y "Todas" elegido hay que pedirle que elija.
 */
export function useTiendaActiva() {
  const { user } = useAuth();
  const { selectedStore } = useStore();
  const tiendas = user?.stores ?? [];

  const elegida =
    selectedStore && selectedStore !== "all"
      ? selectedStore
      : tiendas.length === 1
        ? tiendas[0]
        : null;

  return {
    tiendas,
    tiendaId: elegida?.id ?? null,
    tiendaNombre: elegida?.name ?? null,
    hayQueElegir: !elegida && tiendas.length > 1,
  };
}
