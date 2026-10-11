import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useAddLiveItems } from "@/entities/live/api";
import type { LiveSessionDetail } from "@/entities/live/model/types";
import type { ResultadoEscaneo } from "@/entities/product/model/escaneo";
import { sonar, useEscaner, useManejadorEscaneo } from "@/features/scanner";

/**
 * La pistola en el Live (preparando o en el aire): el producto escaneado entra
 * como prenda. Si ya estaba, se resalta en la grilla en vez de duplicarlo. Si
 * no está registrado, la hoja de alta (con el catálogo) y al registrarlo
 * también entra al Live. Un Live cerrado no se toca: ahí vale la hoja de siempre.
 *
 * Devuelve la prenda a resaltar (su storeProductId), que se apaga sola.
 */
export function useEscanerLive(live: LiveSessionDetail | undefined) {
  const { buscar, abrir } = useEscaner();
  const agregar = useAddLiveItems(live?.id);
  const [resaltada, setResaltada] = useState<{ id: string; vez: number } | null>(null);
  const abierto = !!live && (live.status === "preparing" || live.status === "active");

  useEffect(() => {
    if (!resaltada) return;
    const t = window.setTimeout(() => setResaltada(null), 1800);
    return () => window.clearTimeout(t);
  }, [resaltada]);

  // La prenda recién agregada aparece con el refresco: se la trae a la vista
  // cuando ya está en la grilla.
  useEffect(() => {
    if (!resaltada) return;
    document
      .querySelector(`[data-live-item="${resaltada.id}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [resaltada, live?.items]);

  async function sumar(r: ResultadoEscaneo) {
    const p = r.producto;
    if (!live || !p) return;
    const tienda = p.tiendas.find((t) => t.storeId === live.store?.id);
    if (!tienda) {
      sonar("error");
      toast.error(`«${p.name}» no se vende en la tienda de este Live`);
      return;
    }
    const ya = live.items.find((i) => i.status === "active" && i.storeProductId === tienda.storeProductId);
    if (ya) {
      sonar("encontrado");
      setResaltada({ id: tienda.storeProductId, vez: Date.now() });
      toast(`«${p.name}» ya está en el Live`, {
        description: ya.disponible > 0 ? `${ya.disponible} disponible${ya.disponible === 1 ? "" : "s"}` : "Ya se vendió todo",
      });
      return;
    }
    try {
      await agregar.mutateAsync([tienda.storeProductId]);
      sonar("encontrado");
      setResaltada({ id: tienda.storeProductId, vez: Date.now() });
      toast.success(`«${p.name}» agregado al Live`);
    } catch (error) {
      sonar("error");
      toast.error((error as Error).message || "No se pudo agregar al Live");
    }
  }

  useManejadorEscaneo(
    async (lectura) => {
      const r = await buscar(lectura.codigo);
      if (!r.producto) {
        abrir(lectura.codigo, { resultado: r, contexto: "live", alRegistrar: (nuevo) => void sumar(nuevo) });
        return true;
      }
      await sumar(r);
      return true;
    },
    abierto,
    "Lo agrega al Live como prenda",
  );

  return resaltada?.id ?? null;
}
