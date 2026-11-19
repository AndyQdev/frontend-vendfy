import { useState } from "react";
import { Bug, Lightbulb, Loader2, MessageSquareWarning } from "lucide-react";
import { toast } from "sonner";

import { useStore } from "@/app/providers/auth";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/shared/ui/responsive-dialog";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/cn";

import { useEstadoBeta, useReportarBeta, type ReporteBeta } from "../api";

const GRAVEDADES = [
  { id: "baja", texto: "Molesta, pero sigo" },
  { id: "media", texto: "Me demora" },
  { id: "alta", texto: "No puedo trabajar" },
] as const;

/**
 * "Reportar" en el header, solo para las tiendas que están en una beta: un
 * problema o una sugerencia en dos toques, con la pantalla donde estaba.
 * Llega al panel de plataforma (Reportes) con el negocio y el módulo.
 */
export function BotonReportar({ className }: { className?: string }) {
  const { selectedStore } = useStore();
  const tienda = selectedStore && selectedStore !== "all" ? selectedStore : null;
  const { data } = useEstadoBeta(tienda?.id);
  const reportar = useReportarBeta();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<ReporteBeta["tipo"]>("problema");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [gravedad, setGravedad] = useState<NonNullable<ReporteBeta["gravedad"]>>("media");

  if (!tienda || !data?.participa) return null;

  const cerrar = () => {
    setAbierto(false);
    setTitulo("");
    setDescripcion("");
    setGravedad("media");
    setTipo("problema");
  };

  const enviar = async () => {
    try {
      await reportar.mutateAsync({
        storeId: tienda.id,
        tipo,
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        gravedad: tipo === "problema" ? gravedad : undefined,
        url: window.location.href,
      });
      toast.success(tipo === "problema" ? "¡Gracias! Ya nos llegó el problema y lo vamos a revisar." : "¡Gracias por la idea! Ya nos llegó.");
      cerrar();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo enviar. Prueba de nuevo.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title={`Estás en la ${data.cohorte?.nombre}: cuéntanos un problema o una idea`}
        className={cn(
          "flex h-9 flex-none items-center gap-1.5 rounded-full bg-primary/10 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground",
          className,
        )}
      >
        <MessageSquareWarning className="size-4" />
        <span className="hidden sm:inline">Reportar</span>
      </button>

      <ResponsiveDialog open={abierto} onOpenChange={(v) => !v && cerrar()}>
        <ResponsiveDialogContent className="sm:max-w-[480px]">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Cuéntanos qué pasó</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Lo lee el equipo de Vendfy. Sabemos en qué pantalla estabas, no hace falta explicarlo.</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody className="space-y-4">
            <div role="radiogroup" aria-label="Qué quieres contarnos" className="grid grid-cols-2 gap-2">
              {(
                [
                  ["problema", "Algo no funciona", Bug],
                  ["sugerencia", "Tengo una idea", Lightbulb],
                ] as const
              ).map(([id, texto, Icono]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={tipo === id}
                  onClick={() => setTipo(id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors",
                    tipo === id ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/50",
                  )}
                >
                  <Icono className="size-4" /> {texto}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="beta-titulo">{tipo === "problema" ? "¿Qué no funciona?" : "¿Qué te gustaría?"}</Label>
              <Input
                id="beta-titulo"
                autoFocus
                maxLength={140}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder={tipo === "problema" ? "No me deja guardar el producto" : "Poder imprimir etiquetas con precio"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="beta-detalle">Más detalle (opcional)</Label>
              <Textarea id="beta-detalle" rows={3} maxLength={4000} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </div>
            {tipo === "problema" && (
              <div className="space-y-1.5">
                <Label>¿Cuánto te afecta?</Label>
                <div className="grid grid-cols-3 gap-2">
                  {GRAVEDADES.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      aria-pressed={gravedad === g.id}
                      onClick={() => setGravedad(g.id)}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-xs transition-colors",
                        gravedad === g.id ? "border-primary bg-primary/5 font-semibold text-primary" : "border-border text-muted-foreground hover:border-primary/50",
                      )}
                    >
                      {g.texto}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </ResponsiveDialogBody>
          <ResponsiveDialogFooter>
            <Button variant="ghost" onClick={cerrar}>
              Cancelar
            </Button>
            <Button disabled={titulo.trim().length < 3 || reportar.isPending} onClick={enviar} className="gap-2">
              {reportar.isPending && <Loader2 className="size-4 animate-spin" />}
              Enviar
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
