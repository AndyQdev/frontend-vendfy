import { useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useStore } from "@/app/providers/auth";
import { Button } from "@/shared/ui/button";
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

import { useEstadoBeta, useResponderEncuesta } from "../api";

const CLAVE_POSPUESTA = "beta.encuesta.pospuesta";
const ESCALA = [
  { v: 1, texto: "Muy en desacuerdo" },
  { v: 2, texto: "En desacuerdo" },
  { v: 3, texto: "Neutral" },
  { v: 4, texto: "De acuerdo" },
  { v: 5, texto: "Muy de acuerdo" },
];

/**
 * La encuesta de la beta (SUS + NPS), cuando le toca: a las dos semanas y al
 * cierre. Se puede dejar para después (vuelve en la próxima sesión); se
 * contesta una vez.
 */
export function EncuestaBeta() {
  const { selectedStore } = useStore();
  const tienda = selectedStore && selectedStore !== "all" ? selectedStore : null;
  const { data } = useEstadoBeta(tienda?.id);
  const responder = useResponderEncuesta(tienda?.id);
  const [sus, setSus] = useState<Array<number | null>>(Array(10).fill(null));
  const [nps, setNps] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [pospuesta, setPospuesta] = useState(() => {
    try {
      return sessionStorage.getItem(CLAVE_POSPUESTA) === tienda?.id;
    } catch {
      return false;
    }
  });

  const encuesta = data?.participa && !data.textoConsentimiento ? data.encuesta : null;
  if (!tienda || !encuesta || pospuesta) return null;

  const posponer = () => {
    try {
      sessionStorage.setItem(CLAVE_POSPUESTA, tienda.id);
    } catch {
      /* sin almacenamiento: vuelve al recargar */
    }
    setPospuesta(true);
  };
  const faltan = sus.filter((x) => x === null).length + (nps === null ? 1 : 0);

  const enviar = async () => {
    try {
      await responder.mutateAsync({
        storeId: tienda.id,
        momento: encuesta.momento,
        sus: sus as number[],
        nps: nps!,
        comentario: comentario.trim() || undefined,
      });
      toast.success("¡Gracias! Tus respuestas nos ayudan a mejorar Vendfy.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo enviar. Prueba de nuevo.");
    }
  };

  return (
    <ResponsiveDialog open onOpenChange={(v) => !v && posponer()}>
      <ResponsiveDialogContent className="sm:max-w-[640px]">
        <ResponsiveDialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ClipboardList className="size-5" />
          </span>
          <ResponsiveDialogTitle>
            {encuesta.momento === "cierre" ? "La beta está terminando: ¿cómo te fue?" : "¿Cómo te va con Vendfy?"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Son 11 preguntas rápidas, unos 2 minutos. No hay respuestas buenas ni malas: queremos saber qué te cuesta.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className="space-y-5">
          <ol className="space-y-4">
            {encuesta.preguntasSus.map((p, i) => (
              <li key={i} data-testid="pregunta-sus">
                <p className="mb-1.5 text-sm font-medium">
                  {i + 1}. {p}
                </p>
                <div role="radiogroup" aria-label={p} className="grid grid-cols-5 gap-1">
                  {ESCALA.map((e) => (
                    <button
                      key={e.v}
                      type="button"
                      role="radio"
                      aria-checked={sus[i] === e.v}
                      aria-label={e.texto}
                      title={e.texto}
                      onClick={() => setSus((s) => s.map((x, j) => (j === i ? e.v : x)))}
                      className={cn(
                        "rounded-lg border px-1 py-1.5 text-[11px] leading-tight transition-colors",
                        sus[i] === e.v ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/50",
                      )}
                    >
                      <span className="block text-sm font-semibold">{e.v}</span>
                      <span className="hidden sm:block">{e.texto}</span>
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>

          <div data-testid="pregunta-nps">
            <p className="mb-1.5 text-sm font-medium">11. {encuesta.preguntaNps}</p>
            <div role="radiogroup" aria-label={encuesta.preguntaNps} className="grid grid-cols-11 gap-1">
              {Array.from({ length: 11 }, (_, n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={nps === n}
                  aria-label={String(n)}
                  onClick={() => setNps(n)}
                  className={cn(
                    "rounded-md border py-1.5 text-sm font-semibold tabular-nums transition-colors",
                    nps === n ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>Nada probable</span>
              <span>Muy probable</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="encuesta-comentario" className="text-sm font-medium">
              ¿Qué cambiarías primero? (opcional)
            </label>
            <Textarea id="encuesta-comentario" rows={2} maxLength={4000} value={comentario} onChange={(e) => setComentario(e.target.value)} />
          </div>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button variant="ghost" onClick={posponer}>
            Más tarde
          </Button>
          <Button disabled={faltan > 0 || responder.isPending} onClick={enviar} className="gap-2">
            {responder.isPending && <Loader2 className="size-4 animate-spin" />}
            {faltan > 0 ? `Faltan ${faltan}` : "Enviar"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
