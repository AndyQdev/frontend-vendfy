import { useState } from "react";
import { Camera, PackageSearch } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { AltaRapidaProducto } from "./AltaRapidaProducto";
import { SelectorProductosDisponibles } from "./SelectorProductosDisponibles";

/**
 * Las dos formas de sumar una prenda, juntas.
 *
 * Son dos casos igual de comunes: lo que se fotografía en el momento y lo que
 * sobró del Live anterior. Y las dos tienen que estar también en pleno aire
 * —acordarse a mitad de la transmisión de algo que quedó del domingo pasado no
 * puede obligar a salir de la pantalla—, así que van en una pieza sola en vez
 * de repetirse en cada vista.
 *
 * `compacto` es para la fila del encabezado mientras se transmite, donde el
 * lugar es de los contadores y de las cuentas por cobrar. Sacar la foto sigue
 * a un toque: es la acción caliente y no se esconde detrás de un menú.
 */
export function AgregarPrendas({
  liveId,
  storeId,
  compacto,
}: {
  liveId: string;
  storeId?: string;
  compacto?: boolean;
}) {
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [selectorAbierto, setSelectorAbierto] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={compacto ? "outline" : "default"}
          onClick={() => setAltaAbierta(true)}
        >
          <Camera className="h-4 w-4" />
          <span className="ml-1">{compacto ? "Agregar" : "Agregar con foto"}</span>
        </Button>

        <Button
          variant="outline"
          size={compacto ? "icon" : "default"}
          onClick={() => setSelectorAbierto(true)}
          title="Usar productos disponibles"
        >
          <PackageSearch className="h-4 w-4" />
          {!compacto && <span className="ml-1">Usar productos disponibles</span>}
        </Button>
      </div>

      <AltaRapidaProducto
        open={altaAbierta}
        onOpenChange={setAltaAbierta}
        liveId={liveId}
      />

      <SelectorProductosDisponibles
        open={selectorAbierto}
        onOpenChange={setSelectorAbierto}
        liveId={liveId}
        storeId={storeId}
      />
    </>
  );
}
