import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./button";
import { cn } from "@/shared/lib/cn";

/**
 * "Exportar a Excel" de los listados y Reportes (H4).
 *
 * La espera se ve solo en el propio botón (el ícono gira y el botón se
 * deshabilita): nada de cargadores a pantalla completa.
 */
export function BotonExportar({
  onExportar,
  disabled,
  className,
  texto = "Exportar a Excel",
  compacto = false,
  size = "default",
}: {
  /** Arma y descarga el archivo. Puede pedir datos antes. */
  onExportar: () => Promise<void> | void;
  disabled?: boolean;
  className?: string;
  texto?: string;
  /** Solo el ícono (pantallas angostas). */
  compacto?: boolean;
  size?: "default" | "sm";
}) {
  const [exportando, setExportando] = useState(false);

  const exportar = async () => {
    if (exportando) return;
    setExportando(true);
    try {
      await onExportar();
    } catch (e) {
      console.error("Exportar a Excel:", e);
      toast.error("No se pudo exportar", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setExportando(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={compacto ? (size === "sm" ? "icon-sm" : "icon") : size}
      onClick={exportar}
      disabled={disabled || exportando}
      className={cn(className)}
      title={texto}
      aria-label={texto}
    >
      {exportando ? <Loader2 className="animate-spin" /> : <Download />}
      {!compacto && <span>{exportando ? "Exportando…" : texto}</span>}
    </Button>
  );
}
