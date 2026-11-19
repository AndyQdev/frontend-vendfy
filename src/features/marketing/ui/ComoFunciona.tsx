import { useState } from "react";
import { Bot, ChevronDown, Columns3, Lightbulb, MessageCircle, TrendingUp, type LucideIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/collapsible";
import { Card } from "@/shared/ui/card";

const PASOS: Array<{ icono: LucideIcon; titulo: string; texto: string; color: string }> = [
  {
    icono: Lightbulb,
    titulo: "1. Creas la campaña",
    texto: "Vendfy mira tus ventas, tu stock y tus chats, te propone qué anunciar y te dice cuánto invertir y qué esperar.",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  {
    icono: MessageCircle,
    titulo: "2. Te escriben por WhatsApp",
    texto: "Quien ve el anuncio en Facebook o Instagram toca «WhatsApp» y le llega un chat a tu número.",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  {
    icono: Bot,
    titulo: "3. El agente responde",
    texto: "Contesta al instante con tu catálogo y tus precios. Puedes tomar el chat cuando quieras.",
    color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  },
  {
    icono: Columns3,
    titulo: "4. Cada persona avanza en el tablero",
    texto: "Pasa sola de Nuevo a Compró. La IA te dice quién está por comprar y qué escribirle para cerrar o recuperarla.",
    color: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  },
  {
    icono: TrendingUp,
    titulo: "5. Ves si valió la pena",
    texto: "Cada venta se cuenta en su campaña: cuánto gastaste, cuánto volvió y qué conviene hacer. Y Meta aprende a quién mostrarla.",
    color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
];

/** Cómo se conecta todo: de la idea a la venta, y la venta mejora la próxima idea. */
export function ComoFunciona() {
  const clave = "vendfy:marketing:como-funciona-cerrado";
  const [abierto, setAbierto] = useState(() => {
    try {
      return localStorage.getItem(clave) !== "1";
    } catch {
      return true;
    }
  });
  const cambiar = (o: boolean) => {
    setAbierto(o);
    try {
      localStorage.setItem(clave, o ? "0" : "1");
    } catch {
      /* sin almacenamiento */
    }
  };

  return (
    <Card className="overflow-hidden">
      <Collapsible open={abierto} onOpenChange={cambiar}>
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left">
          <span>
            <span className="text-sm font-semibold">Cómo funciona</span>
            <span className="ml-2 text-xs text-muted-foreground">de la idea a la venta, y la venta mejora la próxima idea</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ol className="grid gap-3 border-t border-border px-5 py-4 sm:grid-cols-2 lg:grid-cols-5">
            {PASOS.map((p) => (
              <li key={p.titulo} className="relative">
                <span className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${p.color}`}>
                  <p.icono className="h-4 w-4" />
                </span>
                <p className="text-sm font-semibold">{p.titulo}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{p.texto}</p>
              </li>
            ))}
          </ol>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
