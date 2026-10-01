import { createContext, useContext } from "react";

import type { ProductoOpcion, VistaFijada } from "@/entities/omnibox/model/types";

import type { Reposicion } from "../../model/vistas";

/**
 * Lo que una vista puede hacer fuera de sí misma (G4): abrir la ficha de un
 * producto y cargar productos a la compra. Lo resuelve la pantalla, que es
 * la dueña de la mesa (y sabe de dónde vino el cambio, para la Guía).
 *
 * Fuera del asistente (una vista impresa, una prueba) no hay acciones: los
 * productos no se tocan y "Reponer" no aparece.
 */
export interface AccionesVista {
  verProducto: (producto: ProductoOpcion) => void;
  reponer: (items: Reposicion[]) => void;
  /**
   * ¿Esos productos ya están en la compra? Se mira la compra y no un "ya lo
   * toqué": si después los sacan, "Reponer" vuelve a aparecer.
   */
  enCompra: (productIds: string[]) => boolean;
  verCompra: () => void;
  /** Abrir una vista fijada del tablero (queda como un mensaje más del chat). */
  abrirFijada: (fijada: VistaFijada) => void;
}

export const AccionesVistaContext = createContext<AccionesVista | null>(null);

export function useAccionesVista(): AccionesVista | null {
  return useContext(AccionesVistaContext);
}
