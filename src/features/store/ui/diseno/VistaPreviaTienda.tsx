import { useEffect, useRef, useState } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";

import { Button } from "@/shared/ui/button";
import type { AparienciaGuardada } from "@/entities/store/model/types";
import { URL_TIENDA } from "../../model/catalogo-temas";

/**
 * La tienda en un iframe, con lo que el comerciante va eligiendo aplicado
 * antes de guardar.
 *
 * El protocolo (client-frontend/components/apariencia/ContextoApariencia.tsx):
 * la tienda avisa `vendfy:vista-previa-lista` cuando ya escucha y recién ahí
 * se le manda el borrador; después, en cada cambio. Mandarlo al cargar el
 * iframe no sirve: llegaría antes de que la página escuche y se perdería.
 */

const MENSAJE_LISTA = "vendfy:vista-previa-lista";
const MENSAJE_APARIENCIA = "vendfy:apariencia";
const ORIGEN_TIENDA = new URL(URL_TIENDA).origin;

/**
 * Cada dispositivo se dibuja a su ancho real y se achica para entrar en la
 * columna. Con el iframe al ancho de la columna, "Computadora" mostraba la
 * versión de celular: la tienda cambia de diseño según el ancho.
 */
const DISPOSITIVOS = [
  { id: "escritorio", nombre: "Computadora", icono: Monitor, ancho: 1280, alto: 860 },
  { id: "tableta", nombre: "Tablet", icono: Tablet, ancho: 768, alto: 1024 },
  { id: "movil", nombre: "Celular", icono: Smartphone, ancho: 390, alto: 844 },
] as const;

export function VistaPreviaTienda({
  slug,
  themeId,
  apariencia,
}: {
  slug: string;
  themeId: string;
  apariencia: AparienciaGuardada | undefined;
}) {
  const [dispositivo, setDispositivo] = useState<(typeof DISPOSITIVOS)[number]["id"]>("escritorio");
  const iframe = useRef<HTMLIFrameElement>(null);
  const lista = useRef(false);
  const ultima = useRef(apariencia);
  ultima.current = apariencia;

  const enviada = useRef<string | null>(null);
  const enviar = (a: AparienciaGuardada | undefined, aunqueSeaIgual = false) => {
    if (!lista.current) return;
    // El panel re-renderiza por cualquier cosa; la tienda solo se repinta si
    // la apariencia cambió de verdad.
    const json = JSON.stringify(a ?? {});
    if (!aunqueSeaIgual && json === enviada.current) return;
    enviada.current = json;
    iframe.current?.contentWindow?.postMessage({ tipo: MENSAJE_APARIENCIA, apariencia: a ?? {} }, ORIGEN_TIENDA);
  };

  useEffect(() => {
    const alRecibir = (e: MessageEvent) => {
      if (e.origin !== ORIGEN_TIENDA || e.data?.tipo !== MENSAJE_LISTA) return;
      if (e.source !== iframe.current?.contentWindow) return;
      lista.current = true;
      // Un iframe recién cargado no tiene nada: se manda aunque sea lo mismo.
      enviar(ultima.current, true);
    };
    window.addEventListener("message", alRecibir);
    return () => window.removeEventListener("message", alRecibir);
  }, []);

  // Cada cambio, con un respiro: escribir un título no manda un mensaje por letra.
  useEffect(() => {
    const t = setTimeout(() => enviar(apariencia), 120);
    return () => clearTimeout(t);
  }, [apariencia]);

  // Otro tema u otro tamaño recargan el iframe: hay que esperar el nuevo "lista".
  useEffect(() => {
    lista.current = false;
  }, [themeId, dispositivo]);

  const { ancho, alto } = DISPOSITIVOS.find((d) => d.id === dispositivo)!;

  // El lugar disponible, para calcular cuánto achicar.
  const marco = useRef<HTMLDivElement>(null);
  const [lugar, setLugar] = useState({ ancho: 0, alto: 0 });
  useEffect(() => {
    const el = marco.current;
    if (!el) return;
    // Alto: lo que queda de la ventana bajo la barra de la vista previa.
    const medir = () => setLugar({ ancho: el.clientWidth, alto: Math.max(480, window.innerHeight - 120) });
    window.addEventListener("resize", medir);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => {
      obs.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, []);
  // Achica para que entre a lo ancho y a lo alto: con una pantalla "real" de
  // alto, la portada a pantalla completa se ve como en el dispositivo (más
  // alto, la portada medía lo que midiera el iframe).
  const escala = lugar.ancho ? Math.min(1, (lugar.ancho - 16) / ancho, (lugar.alto - 16) / alto) : 1;
  const altoReal = alto;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Vista previa</p>
          <p className="text-xs text-muted-foreground">Así queda con lo que elegiste. Se publica al guardar.</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
          {DISPOSITIVOS.map((d) => (
            <Button
              key={d.id}
              type="button"
              variant={dispositivo === d.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setDispositivo(d.id)}
              className="h-8 px-2.5"
              aria-label={d.nombre}
              title={d.nombre}
            >
              <d.icono className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </div>

      <div
        ref={marco}
        className="relative overflow-hidden rounded-xl border border-border bg-muted/20"
        style={{ height: Math.round(alto * escala) + 16 }}
      >
        {/* Ancho real del dispositivo, achicado con transform desde arriba al centro. */}
        <div
          className="absolute left-1/2 top-2 origin-top"
          style={{ width: ancho, height: altoReal, transform: `translateX(-50%) scale(${escala})` }}
        >
          <iframe
            ref={iframe}
            key={`${themeId}-${dispositivo}`}
            src={`${URL_TIENDA}/${slug}?theme=${encodeURIComponent(themeId)}&preview=true`}
            title="Vista previa de la tienda"
            className="h-full w-full rounded-lg bg-white shadow-lg"
          />
        </div>
      </div>
    </div>
  );
}
