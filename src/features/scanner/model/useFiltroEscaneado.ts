import { useEffect, useRef, useState } from "react";

import { decirFrases, type FraseVoz } from "@/shared/voz";

import { useEscaner, useManejadorEscaneo } from "./ScannerProvider";
import { sonar } from "./sonido";

export interface ProductoFiltrado {
  id: string;
  nombre: string;
  imagen: string | null;
  /** Cuándo se escaneó: volver a escanear el mismo lo vuelve a decir. */
  vez: number;
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
      setProducto({ id: p.id, nombre: p.name, imagen: p.imageUrls[0] ?? null, vez: Date.now() });
      return true;
    },
    activo,
    etiqueta,
  );

  return { producto, quitar: () => setProducto(null) };
}

/**
 * La voz de una lista filtrada por lo escaneado: dice lo que muestra el
 * resumen ("Mermelada Arcor. Lo compraste tres veces.") cuando llegan los
 * datos de ese producto, una vez por escaneo. `listo`: ya no está cargando.
 */
export function useVozAlFiltrar(producto: ProductoFiltrado | null, listo: boolean, frases: () => FraseVoz[]) {
  const dicho = useRef<number | null>(null);
  const armar = useRef(frases);
  armar.current = frases;
  useEffect(() => {
    if (!producto || !listo || dicho.current === producto.vez) return;
    dicho.current = producto.vez;
    decirFrases(armar.current());
  }, [producto, listo]);
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
