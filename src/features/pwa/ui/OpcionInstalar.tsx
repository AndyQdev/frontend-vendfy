import { useState } from "react";
import { Download } from "lucide-react";

import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import { useInstalacion } from "../model/instalacion";
import { InstruccionesIOS } from "./InstruccionesIOS";

/**
 * La entrada "Instalar Vendfy" del menú del perfil.
 *
 * Es el camino estable: el aviso del pie se puede posponer una semana, pero
 * desde acá siempre se puede instalar. Si ya corre instalada no aparece.
 */
export function OpcionInstalar() {
  const { puedeInstalar, instalada, ios, instalar } = useInstalacion();
  const [verIOS, setVerIOS] = useState(false);

  if (instalada || (!puedeInstalar && !ios)) return null;

  return (
    <>
      <DropdownMenuItem
        onSelect={(evento) => {
          // En iOS hay que abrir una hoja encima: si el menú se cierra solo,
          // se lleva la hoja puesta.
          if (ios && !puedeInstalar) {
            evento.preventDefault();
            setVerIOS(true);
            return;
          }
          void instalar();
        }}
      >
        <Download />
        Instalar Vendfy
      </DropdownMenuItem>

      <InstruccionesIOS open={verIOS} onOpenChange={setVerIOS} />
    </>
  );
}
