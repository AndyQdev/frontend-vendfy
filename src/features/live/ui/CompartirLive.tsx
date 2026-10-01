import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";

/**
 * El enlace público del Live.
 *
 * La URL cuelga de la tienda (`/{slug}/live/{token}`) para que la página
 * herede su tema y su cabecera, y para no reservar la palabra "live" como
 * nombre de tienda: `store.slug` es único y no tiene lista de reservadas.
 *
 * El token no es el id ni un correlativo: `/live/25` invitaría a probar
 * `/live/26` y espiar el Live que todavía no salió al aire.
 */
export function CompartirLive({
  token,
  storeSlug,
  compacto,
}: {
  token: string;
  storeSlug?: string;
  compacto?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);

  // `VITE_URL_PUBLIC` es la tienda web, que es OTRO servidor que este panel.
  // Sin esto el enlace apunta al origen del panel y el catch-all del router se
  // lo lleva a /caja: el vendedor comparte un link que devuelve a su propio
  // escritorio. El valor local trae barra final, así que se normaliza.
  const base = (
    (import.meta.env.VITE_URL_PUBLIC as string | undefined) ||
    "https://compras.vendfy.shop"
  ).replace(/\/+$/, "");

  // Sin slug la URL saldría con un tramo vacío y no llevaría a ningún lado.
  // Mejor decirlo que entregar un enlace roto que el vendedor ya compartió.
  if (!storeSlug) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
        No se pudo armar el enlace: falta la dirección de la tienda.
      </p>
    );
  }

  const url = `${base}/${storeSlug}/live/${token}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles -pasa fuera de https- al menos que lo vea.
      toast.error("No se pudo copiar. El enlace es: " + url);
    }
  };

  if (compacto) {
    return (
      <Button variant="outline" size="sm" onClick={copiar}>
        {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        <span className="ml-1">Copiar enlace</span>
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
      <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
        {url}
      </code>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={copiar}>
          {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span className="ml-1">Copiar</span>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            <span className="ml-1">Abrir</span>
          </a>
        </Button>
      </div>
    </div>
  );
}
