import { useState } from "react";

import { useEscaner, useManejadorEscaneo } from "./ScannerProvider";
import { sonar } from "./sonido";

export interface ProductoFiltrado {
  id: string;
  nombre: string;
  imagen: string | null;
}

/**
 * En una lista, escanear es filtrar: Ventas, Pedidos, Compras y Clientes
 * pasan a mostrar solo lo de ese producto, con un chip para sacarlo. Si el
 * código no está registrado, la hoja de siempre para darlo de alta.
 */
export function useFiltroEscaneado(etiqueta: string, activo = true) {
  const { buscar } = useEscaner();
  const [producto, setProducto] = useState<ProductoFiltrado | null>(null);

  useManejadorEscaneo(
    async (lectura) => {
      const r = await buscar(lectura.codigo);
      const p = r.producto;
      if (!p) return false;
      sonar("encontrado");
      setProducto({ id: p.id, nombre: p.name, imagen: p.imageUrls[0] ?? null });
      return true;
    },
    activo,
    etiqueta,
  );

  return { producto, quitar: () => setProducto(null) };
}

/** "hoy", "ayer", "hace 5 días", "hace 2 meses": cuándo fue lo último. */
export function haceCuanto(iso: string | null | undefined, ahora = new Date()): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((dia(ahora) - dia(fecha)) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 31) return `hace ${dias} días`;
  const meses = Math.round(dias / 30);
  if (meses < 12) return meses === 1 ? "hace un mes" : `hace ${meses} meses`;
  const anios = Math.round(dias / 365);
  return anios === 1 ? "hace un año" : `hace ${anios} años`;
}
