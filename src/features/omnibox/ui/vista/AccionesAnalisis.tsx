import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, Pin, PinOff } from "lucide-react";
import { toast } from "sonner";

import { useDesfijarVista, useFijarVista, useVistasFijadas } from "@/entities/omnibox/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

import type { Analisis } from "../../model/mesa";
import { mismaVista } from "../../model/vistas";
import { BotonIcono } from "../piezas";
import { useExportarVista } from "./exportar";

/**
 * Lo que se hace CON un análisis (G4), en la cabecera del panel: fijarlo en
 * el tablero de la tienda y exportarlo a Excel o PDF.
 */
export function AccionesAnalisis({ analisis, storeId, tienda }: { analisis: Analisis; storeId: string; tienda: string }) {
  const fijadas = useVistasFijadas(storeId);
  const fijar = useFijarVista();
  const desfijar = useDesfijarVista();
  const exportar = useExportarVista(storeId, tienda);
  const [exportando, setExportando] = useState(false);

  const fijada = fijadas.data?.find((f) => mismaVista(f.vista, analisis.vista)) ?? null;
  const ocupado = fijar.isPending || desfijar.isPending;

  async function alternarFijada() {
    try {
      if (fijada) {
        await desfijar.mutateAsync({ storeId, id: fijada.id });
        toast.success("La saqué de tu tablero");
      } else {
        await fijar.mutateAsync({ storeId, nombre: analisis.vista.titulo, pregunta: analisis.pregunta, vista: analisis.vista });
        toast.success("Fijada: la vas a encontrar al entrar al asistente, con los datos al día");
      }
    } catch (error: any) {
      toast.error(error?.message ?? "No pude guardarla. Prueba de nuevo.");
    }
  }

  async function aExcel() {
    setExportando(true);
    try {
      await exportar.excel(analisis);
    } catch {
      toast.error("No pude armar el Excel. Prueba de nuevo.");
    } finally {
      setExportando(false);
    }
  }

  function aPdf() {
    const vista = document.querySelector<HTMLElement>('[data-testid="omnibox-vista"]');
    if (!vista) return;
    if (!exportar.pdf(vista, analisis.vista.titulo)) {
      toast.error("El navegador bloqueó la ventana para imprimir. Permite las ventanas emergentes de Vendfy.");
    }
  }

  return (
    <>
      <BotonIcono
        etiqueta={fijada ? "Sacar de tu tablero" : "Fijar en tu tablero"}
        data-testid="vista-fijar"
        aria-pressed={Boolean(fijada)}
        disabled={ocupado || fijadas.isLoading}
        onClick={alternarFijada}
        className={fijada ? "border-primary/40 bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary" : undefined}
      >
        {fijada ? <PinOff /> : <Pin />}
      </BotonIcono>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <BotonIcono etiqueta="Exportar" data-testid="vista-exportar" disabled={exportando}>
            {exportando ? <Loader2 className="animate-spin" /> : <Download />}
          </BotonIcono>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[12rem]">
          <DropdownMenuItem data-testid="vista-exportar-excel" onSelect={aExcel} className="gap-2 text-[13px]">
            <FileSpreadsheet className="size-4" />
            Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem data-testid="vista-exportar-pdf" onSelect={aPdf} className="gap-2 text-[13px]">
            <FileText className="size-4" />
            PDF (imprimir)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
