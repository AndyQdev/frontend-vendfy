import { Sparkles } from "lucide-react";
import { useAuth } from "@/app/providers/auth";
import { useStores } from "@/entities/store/api";
import { TOTAL_ONBOARDING_STEPS } from "@/entities/user/api/onboarding";
import { useOnboardingVisibility } from "@/widgets/onboarding/visibility";
import { Button } from "@/shared/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";

/**
 * El botón del header: el ÚNICO lugar desde donde se abre la guía de primeros
 * pasos. Muestra cuánto falta y, al tocarlo, abre o cierra el panel.
 *
 * Cuando ya está todo hecho desaparece: no queda nada que abrir, y un botón
 * permanente que dice "Todo listo" es ruido en la barra para siempre.
 */
export function OnboardingHeaderButton() {
  const { user } = useAuth();
  const { data: stores } = useStores();
  const { abierto, alternar } = useOnboardingVisibility();

  if (!user) return null;

  const completed = new Set<number>(user.onboardingSteps || []);
  if ((stores?.length ?? 0) > 0) completed.add(1);

  const completedCount = completed.size;
  if (completedCount >= TOTAL_ONBOARDING_STEPS) return null;

  const progress = Math.round((completedCount / TOTAL_ONBOARDING_STEPS) * 100);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={alternar}
            className="h-9 gap-2 px-2.5 hidden sm:inline-flex"
            aria-expanded={abierto}
            aria-label={abierto ? "Cerrar primeros pasos" : "Ver primeros pasos"}
          >
            <div className="relative">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              {/* El puntito recuerda que quedan pasos, sin tapar nada. Con el
                  panel abierto sobra: ya lo estás mirando. */}
              {!abierto && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium hidden md:inline">
                Primeros pasos
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                {completedCount}/{TOTAL_ONBOARDING_STEPS}
              </span>
            </div>
            <div className="h-1 w-10 bg-muted rounded-full overflow-hidden hidden md:block">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {abierto
            ? "Cerrar la guía"
            : `Te faltan ${TOTAL_ONBOARDING_STEPS - completedCount} pasos. Click para ver`}
        </TooltipContent>
      </Tooltip>

      {/* Versión compacta para mobile (solo icono) */}
      <Button
        variant="ghost"
        size="icon"
        onClick={alternar}
        className="h-9 w-9 relative sm:hidden"
        aria-expanded={abierto}
        aria-label={abierto ? "Cerrar primeros pasos" : "Ver primeros pasos"}
      >
        <Sparkles className="h-[1.2rem] w-[1.2rem] text-emerald-600 dark:text-emerald-400" />
        {!abierto && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        )}
      </Button>
    </TooltipProvider>
  );
}
