import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  CheckCircle2,
  Circle,
  ChevronUp,
  ChevronDown,
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

const COLLAPSED_KEY = "onboarding-checklist-collapsed";

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

// Rutas donde NO mostrar el widget (para no estorbar)
const HIDDEN_PATHS = ["/login", "/register", "/onboarding", "/stores/new"];

export function OnboardingChecklist() {
  const { user, refreshUser } = useAuth();
  const { data: stores } = useStores();
  const location = useLocation();
  const navigate = useNavigate();

  const { dismissed, hide } = useOnboardingVisibility();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSED_KEY) === "1",
  );

  // Refrescar user cuando cambian de ruta para detectar pasos auto-marcados desde otras secciones
  useEffect(() => {
    if (!dismissed && user) {
      refreshUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  if (!user || dismissed) return null;
  if (HIDDEN_PATHS.some((p) => location.pathname.startsWith(p))) return null;

  const completedSteps = new Set<number>(user.onboardingSteps || []);
  // Paso 1 se marca automáticamente si tiene tiendas (legacy users sin step 1 explícito)
  if ((stores?.length ?? 0) > 0) completedSteps.add(1);

  const completedCount = completedSteps.size;
  const allDone = completedCount >= TOTAL_ONBOARDING_STEPS;
  const progress = Math.round((completedCount / TOTAL_ONBOARDING_STEPS) * 100);

  // Si todo está completo y el usuario no lo ha cerrado, mostramos celebración minimal
  if (allDone) {
    return (
      <div className="fixed bottom-4 right-4 z-40 animate-in slide-in-from-bottom-4 fade-in">
        <div className="bg-card border border-emerald-300 dark:border-emerald-700 rounded-lg shadow-xl p-4 max-w-xs">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">¡Felicidades! 🎉</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Completaste tu configuración inicial.
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 h-7 px-2 text-xs"
                onClick={hide}
              >
                Ocultar
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

  const toggleCollapsed = () => {
    const newVal = !collapsed;
    setCollapsed(newVal);
    localStorage.setItem(COLLAPSED_KEY, newVal ? "1" : "0");
  };

  // Próximo paso pendiente (para mostrar destacado cuando está colapsado)
  const nextStep = STEPS.find((s) => !completedSteps.has(s.id));

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[calc(100vw-2rem)]">
      <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in">
        {/* Header */}
        <button
          onClick={toggleCollapsed}
          className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 transition-colors"
        >
          <Sparkles className="h-4 w-4 flex-shrink-0" />
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold leading-tight">Primeros pasos</p>
            <p className="text-[11px] text-emerald-50/90 leading-tight">
              {completedCount} de {TOTAL_ONBOARDING_STEPS} completados
            </p>
          </div>
          <span className="text-xs font-bold">{progress}%</span>
          {collapsed ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {/* Progress bar */}
        <div className="h-1 bg-emerald-100 dark:bg-emerald-950/40">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Cuerpo */}
        {collapsed ? (
          // Vista colapsada: solo el siguiente paso
          nextStep && (
            <div className="p-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <nextStep.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">Siguiente: {nextStep.title}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => handleStepClick(nextStep)}
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )
        ) : (
          // Vista expandida: lista completa
          <div className="max-h-[60vh] overflow-y-auto">
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
                      isNext && "bg-emerald-50/50 dark:bg-emerald-950/20",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {done ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            done && "line-through text-muted-foreground",
                          )}
                        >
                          {step.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {step.description}
                        </p>
                        {!done && (
                          <button
                            onClick={() => handleStepClick(step)}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
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

            <div className="px-4 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
              <button
                onClick={hide}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Ocultar (lo verás en el header)
              </button>
              <p className="text-[10px] text-muted-foreground">Sin obligación · A tu ritmo</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
