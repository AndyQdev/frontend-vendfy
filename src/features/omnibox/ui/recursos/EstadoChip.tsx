import { cn } from "@/shared/lib/cn";

import { tonoDe } from "../../model/recursos";

/** "Completada" en verde, "Pendiente" en ámbar, "Cancelada" en rojo: el color sale de lo que dice. */
export function EstadoChip({ texto, className }: { texto: string; className?: string }) {
  const tono = tonoDe(texto);
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
        tono === "exito" && "bg-success-soft text-success-soft-foreground",
        tono === "aviso" && "bg-warning-soft text-warning-soft-foreground",
        tono === "error" && "bg-destructive-soft text-destructive",
        tono === "info" && "bg-primary-soft text-primary",
        tono === "neutro" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      {texto}
    </span>
  );
}
