import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  CheckCircle2,
  Circle,
  X,
  Sparkles,
  Store as StoreIcon,
  Package,
  Truck,
  ShoppingCart,
  Palette,
  Globe,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/app/providers/auth";
import { useStores } from "@/entities/store/api";
import { TOTAL_ONBOARDING_STEPS } from "@/entities/user/api/onboarding";
import { useOnboardingVisibility } from "@/widgets/onboarding/visibility";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";

type Step = {
  id: number;
  title: string;
  description: string;
  icon: typeof StoreIcon;
  ctaLabel: string;
  ctaHref: string;
};

const STEPS: Step[] = [
  {
    id: 1,
    title: "Crea tu tienda",
    description: "Define el nombre, categoría y datos básicos.",
    icon: StoreIcon,
    ctaLabel: "Configurar tienda",
    ctaHref: "/stores",
  },
  {
    id: 2,
    title: "Agrega tu primer producto",
    description: "Lo que vas a vender en caja y en tu tienda online.",
    icon: Package,
    ctaLabel: "Crear producto",
    ctaHref: "/products/create",
  },
  {
    id: 3,
    title: "Registra tu primera compra",
    description: "Carga stock para tu inventario y reportes.",
    icon: Truck,
    ctaLabel: "Registrar compra",
    ctaHref: "/purchases/new",
  },
  {
    id: 4,
    title: "Haz tu primera venta",
    description: "Vende desde caja o recibe pedidos online.",
    icon: ShoppingCart,
    ctaLabel: "Ir a caja",
    ctaHref: "/caja",
  },
  {
    id: 5,
    title: "Personaliza tu tienda",
    description: "Logo, banner, colores, redes sociales.",
    icon: Palette,
    ctaLabel: "Personalizar",
    ctaHref: "/stores",
  },
  {
    id: 6,
    title: "Visita tu tienda online",
    description: "Mira cómo la ven tus clientes y compártela.",
    icon: Globe,
    ctaLabel: "Abrir mi tienda",
    ctaHref: "__VISIT_STORE__",
  },
];

/**
 * Rutas donde NO se muestra el widget flotante. Incluye /whatsapp: el chat
 * ocupa toda la pantalla y tiene su caja de escritura abajo a la derecha —
 * el flotante la taparía. Ahí el checklist sigue disponible desde el botón
 * de progreso del header.
 */
export function OnboardingChecklist() {
  const { user, refreshUser } = useAuth();
  const { data: stores } = useStores();
  const location = useLocation();
  const navigate = useNavigate();

  const { abierto, cerrar } = useOnboardingVisibility();

  // Los pasos se marcan solos desde otras secciones -crear un producto, hacer
  // una compra-, asi que se relee el usuario al abrir el panel y al cambiar de
  // ruta MIENTRAS esta abierto. Cerrado no se pide nada: era una llamada por
  // navegacion para todo el mundo, sin que nadie la estuviera mirando.
  useEffect(() => {
    if (abierto && user) refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, location.pathname]);

  if (!user || !abierto) return null;

  const completedSteps = new Set<number>(user.onboardingSteps || []);
  // Paso 1 se marca automáticamente si tiene tiendas (legacy users sin step 1 explícito)
  if ((stores?.length ?? 0) > 0) completedSteps.add(1);

  const completedCount = completedSteps.size;
  const allDone = completedCount >= TOTAL_ONBOARDING_STEPS;
  const progress = Math.round((completedCount / TOTAL_ONBOARDING_STEPS) * 100);

  // Solo se llega acá con el panel abierto: si se completó el último paso
  // mientras estaba a la vista, el momento se festeja.
  if (allDone) {
    return (
      <div className="fixed bottom-4 right-4 z-40 animate-in fade-in slide-in-from-bottom-4">
        <div className="max-w-xs rounded-2xl border border-emerald-300 bg-card/95 p-4 shadow-xl backdrop-blur dark:border-emerald-800">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">¡Felicidades! 🎉</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Completaste tu configuración inicial.
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 h-7 px-2 text-xs"
                onClick={cerrar}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleStepClick = (step: Step) => {
    if (step.ctaHref === "__VISIT_STORE__") {
      const slug = stores?.[0]?.slug;
      const baseUrl =
        (import.meta.env.VITE_URL_PUBLIC as string) || "https://compras.vendfy.shop";
      if (slug) {
        window.open(`${baseUrl}/${slug}`, "_blank", "noopener,noreferrer");
        // Marcar paso 6 como completado al abrir la tienda
        import("@/entities/user/api/onboarding").then((m) => m.markOnboardingStep(6));
        setTimeout(() => refreshUser(), 800);
      }
      return;
    }
    navigate(step.ctaHref);
  };

  const nextStep = STEPS.find((s) => !completedSteps.has(s.id));

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[calc(100vw-2rem)]">
      <div className="overflow-hidden rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur animate-in fade-in slide-in-from-bottom-4">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 text-white"
          style={{ background: "var(--primary-grad)" }}
        >
          <Sparkles className="h-4 w-4 flex-shrink-0" />
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold leading-tight">Primeros pasos</p>
            <p className="text-[11px] leading-tight text-white/85">
              {completedCount} de {TOTAL_ONBOARDING_STEPS} completados
            </p>
          </div>
          <span className="text-xs font-bold">{progress}%</span>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar primeros pasos"
            className="-mr-1 rounded-md p-1 transition-colors hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-primary-soft/40">
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${progress}%`, background: "var(--primary-grad)" }}
          />
        </div>

        {/* Lista de pasos */}
        <div className="max-h-[55vh] overflow-y-auto">
          <ul className="divide-y divide-border">
            {STEPS.map((step) => {
              const done = completedSteps.has(step.id);
              const isNext = step.id === nextStep?.id;
              return (
                <li
                  key={step.id}
                  className={cn(
                    "px-4 py-3 transition-colors",
                    done && "opacity-60",
                    isNext && "bg-primary-soft/20",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      {done ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          done && "text-muted-foreground line-through",
                        )}
                      >
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {step.description}
                      </p>
                      {!done && (
                        <button
                          onClick={() => handleStepClick(step)}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-soft-foreground hover:underline"
                        >
                          {step.ctaLabel}
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3">
            <p className="text-[11px] text-muted-foreground">
              Lo abrís cuando quieras desde "Primeros pasos", arriba.
            </p>
            <p className="text-[10px] text-muted-foreground">A tu ritmo</p>
          </div>
        </div>
      </div>
    </div>
  );
}
