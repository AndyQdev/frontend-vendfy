import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { formatMoney } from "@/shared/lib/money";
import type { DepartmentSalesItem } from "@/features/reports/model/types";
import { DailyTowerFallback } from "./DailyTowerFallback";
import { DailyTowerSkeleton } from "./DailyTowerSkeleton";
import type { MapPalette } from "./DailyTowerScene";
import { buildMapLayout, rampColor, rankedDepartments } from "./tower-model";

const BoliviaMapScene = lazy(() => import("./DailyTowerScene"));

/** Una sola sonda de WebGL por sesión: crear contextos de prueba no es gratis. */
let webglSupport: boolean | null = null;
function detectWebgl(): boolean {
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement("canvas");
    webglSupport = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

/**
 * Los colores llegan como tokens CSS. WebGL necesita un color resuelto, así que
 * se le pregunta al navegador. Se rehace cuando cambia el tema para que la
 * escena no se quede con la paleta del modo anterior.
 */
function resolveColors(values: string[]): string[] {
  if (typeof document === "undefined") return values;
  const probe = document.createElement("span");
  probe.style.display = "none";
  document.body.appendChild(probe);
  const resolved = values.map((value) => {
    probe.style.color = "";
    probe.style.color = value;
    return getComputedStyle(probe).color || value;
  });
  probe.remove();
  return resolved;
}

function useThemeVersion(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const observer = new MutationObserver(() => setVersion((v) => v + 1));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return version;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

export interface BoliviaSalesMapProps {
  departments: DepartmentSalesItem[];
  /** Ventas que no se pudieron ubicar; se informan, no se reparten. */
  unassigned?: { sales: number; count: number };
  className?: string;
}

export function BoliviaSalesMap({
  departments,
  unassigned,
  className,
}: BoliviaSalesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canUse3d, setCanUse3d] = useState<boolean | null>(null);
  const [onScreen, setOnScreen] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [spinning, setSpinning] = useState(true);
  const themeVersion = useThemeVersion();

  useEffect(() => {
    setCanUse3d(detectWebgl());
  }, []);

  useEffect(() => {
    setSpinning(!reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const update = () => setTabVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const palette = useMemo<MapPalette>(() => {
    const [cold, edge, shadow] = resolveColors([
      "hsl(var(--muted))",
      "hsl(var(--foreground))",
      "hsl(var(--muted-foreground))",
    ]);
    return { cold, edge, shadow };
    // themeVersion fuerza recalcular los tokens al cambiar claro/oscuro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeVersion]);

  const layout = useMemo(() => buildMapLayout(departments), [departments]);
  const ranked = useMemo(() => rankedDepartments(layout), [layout]);
  const active = onScreen && tabVisible;
  const hovered = layout.departments.find(
    (department) => department.code === hoveredCode,
  );

  const summary = ranked
    .map((department) => `${department.name}: ${formatMoney(department.sales)}`)
    .join(". ");

  return (
    <div className={cn("space-y-3", className)}>
      <div ref={containerRef} className="relative">
        <div
          className="h-[280px] sm:h-[400px] xl:h-[460px]"
          role="img"
          aria-label={
            layout.isEmpty
              ? "Mapa de Bolivia sin ventas registradas en el período"
              : `Ventas por departamento. ${summary}`
          }
        >
          {canUse3d === null && <DailyTowerSkeleton />}

          {canUse3d === true && (
            <Suspense fallback={<DailyTowerSkeleton />}>
              <BoliviaMapScene
                layout={layout}
                palette={palette}
                active={active}
                spinning={spinning}
                hoveredCode={hoveredCode}
                onHoverChange={setHoveredCode}
              />
            </Suspense>
          )}

          {canUse3d === false && (
            <DailyTowerFallback
              layout={layout}
              hoveredCode={hoveredCode}
              onHoverChange={setHoveredCode}
            />
          )}
        </div>

        {/* El nombre vive en HTML, no dentro del lienzo: así lo lee un lector de
            pantalla y no hay que proyectar coordenadas 3D a la pantalla. */}
        {hovered && (
          <div className="glass pointer-events-none absolute left-3 top-3 rounded-xl px-3 py-2">
            <p className="text-sm font-semibold">{hovered.name}</p>
            <p className="text-xs text-muted-foreground">
              {hovered.sales > 0
                ? `${formatMoney(hovered.sales)} · ${hovered.share.toFixed(0)}% · ${
                    hovered.count
                  } ${hovered.count === 1 ? "venta" : "ventas"}`
                : "Sin ventas todavía"}
            </p>
          </div>
        )}

        {canUse3d === true && (
          <button
            type="button"
            onClick={() => setSpinning((value) => !value)}
            className="press absolute right-2 top-2 rounded-full border bg-background/80 p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-pressed={spinning}
            aria-label={spinning ? "Pausar el giro" : "Reanudar el giro"}
          >
            {spinning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {/* La lista es el dato: nunca hay que interpretar el relieve del mapa. */}
      {ranked.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aquí vas a ver en qué departamentos vendés más.
        </p>
      ) : (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {ranked.slice(0, 6).map((department) => (
            <li key={department.code}>
              <button
                type="button"
                onMouseEnter={() => setHoveredCode(department.code)}
                onMouseLeave={() => setHoveredCode(null)}
                onFocus={() => setHoveredCode(department.code)}
                onBlur={() => setHoveredCode(null)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  hoveredCode === department.code ? "bg-accent" : "hover:bg-accent/60",
                )}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: rampColor(department.intensity) }}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{department.name}</span>
                <span className="text-sm font-semibold">
                  {formatMoney(department.sales)}
                </span>
                <span className="w-12 text-right text-xs text-muted-foreground">
                  {department.share.toFixed(0)}%
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {unassigned && unassigned.sales > 0 && (
        <p className="text-xs text-muted-foreground">
          {formatMoney(unassigned.sales)} sin ubicación: la tienda no tiene ciudad
          configurada.
        </p>
      )}
    </div>
  );
}
