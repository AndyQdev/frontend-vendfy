import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  CheckCircle2,
  Circle,
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

/**
 * Rutas donde NO se muestra el widget flotante. Incluye /whatsapp: el chat
 * ocupa toda la pantalla y tiene su caja de escritura abajo a la derecha —
 * el flotante la taparía. Ahí el checklist sigue disponible desde el botón
 * de progreso del header.
 */
const HIDDEN_PATHS = [
  "/login",
  "/register",
  "/onboarding",
  "/stores/new",
  "/whatsapp",
];
// Pantallas densas: arranca como pastilla compacta para no tapar contenido
// (el usuario puede expandirla con un clic).
const COMPACT_PATHS = ["/caja"];

/** Anillo de progreso compacto */
function ProgressRing({ progress }: { progress: number }) {
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  return (
    <span className="relative flex h-6 w-6 items-center justify-center">
      <svg className="h-6 w-6 -rotate-90" viewBox="0 0 24 24">
        <circle
          cx="12"
          cy="12"
          r={radius}
          className="stroke-current text-border"
          strokeWidth="2.5"
          fill="none"
        />
        <circle
          cx="12"
          cy="12"
          r={radius}
          className="stroke-current text-primary-soft-foreground transition-all duration-500"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (circumference * progress) / 100}
        />
      </svg>
      <Sparkles className="absolute h-2.5 w-2.5 text-primary-soft-foreground" />
    </span>
  );
}

export function OnboardingChecklist() {
  const { user, refreshUser } = useAuth();
  const { data: stores } = useStores();
  const location = useLocation();
  const navigate = useNavigate();

  const { dismissed, hide } = useOnboardingVisibility();
  const compactRoute = COMPACT_PATHS.some((p) =>
    location.pathname.startsWith(p),
  );
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSED_KEY) === "1",
  );
  // En pantallas full-screen arranca compacto en cada visita
  const [expandedHere, setExpandedHere] = useState(false);
  useEffect(() => {
    setExpandedHere(false);
  }, [location.pathname]);

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

  const nextStep = STEPS.find((s) => !completedSteps.has(s.id));

  // Pastilla compacta: en rutas full-screen (o si el usuario colapsó) hasta
  // que la abra a propósito. Ocupa lo mínimo y no tapa el contenido.
  const showPill = (compactRoute && !expandedHere) || (!compactRoute && collapsed);

  if (showPill) {
    return (
      <div className="fixed bottom-4 right-4 z-40 animate-in fade-in slide-in-from-bottom-4">
        <button
          type="button"
          onClick={() => {
            if (compactRoute) setExpandedHere(true);
            else {
              setCollapsed(false);
              localStorage.setItem(COLLAPSED_KEY, "0");
            }
          }}
          className="flex items-center gap-2.5 rounded-full border border-border bg-card/95 py-2 pl-2.5 pr-4 shadow-lg backdrop-blur transition-colors hover:bg-accent"
        >
          <ProgressRing progress={progress} />
          <span className="text-left">
            <span className="block text-xs font-semibold leading-tight">
              Primeros pasos
            </span>
            <span className="block text-[11px] leading-tight text-muted-foreground">
              {completedCount} de {TOTAL_ONBOARDING_STEPS}
              {nextStep ? ` · ${nextStep.title}` : ""}
            </span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[calc(100vw-2rem)]">
      <div className="overflow-hidden rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur animate-in fade-in slide-in-from-bottom-4">
        {/* Header */}
        <button
          onClick={() => {
            if (compactRoute) setExpandedHere(false);
            else {
              setCollapsed(true);
              localStorage.setItem(COLLAPSED_KEY, "1");
            }
          }}
          className="flex w-full items-center gap-3 px-4 py-3 text-white transition-opacity hover:opacity-95"
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
          <ChevronDown className="h-4 w-4" />
        </button>

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
            <button
              onClick={hide}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Ocultar (lo verás en el header)
            </button>
            <p className="text-[10px] text-muted-foreground">A tu ritmo</p>
          </div>
        </div>
      </div>
    </div>
  );
}
