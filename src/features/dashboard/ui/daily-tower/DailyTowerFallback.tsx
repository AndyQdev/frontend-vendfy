import { MAP_DEPTH, MAP_WIDTH, rampColor, type MapLayout } from "./tower-model";

/**
 * Mapa plano para cuando no hay WebGL. Usa exactamente los mismos contornos y la
 * misma rampa de color que la escena 3D: no es un adorno de reemplazo.
 */
export function DailyTowerFallback({
  layout,
  hoveredCode,
  onHoverChange,
}: {
  layout: MapLayout;
  hoveredCode: string | null;
  onHoverChange: (code: string | null) => void;
}) {
  const padding = 0.25;

  return (
    <div className="flex h-full items-center justify-center rounded-[18px] bg-muted/20 p-3">
      <svg
        viewBox={`${-MAP_WIDTH / 2 - padding} ${-MAP_DEPTH / 2 - padding} ${
          MAP_WIDTH + padding * 2
        } ${MAP_DEPTH + padding * 2}`}
        className="h-full w-auto text-foreground"
        role="presentation"
      >
        {layout.departments.map((department) => (
          <path
            key={department.code}
            // La Y se invierte porque en SVG el eje crece hacia abajo y el norte
            // tiene que quedar arriba.
            d={`M ${department.outline.map(([x, y]) => `${x} ${-y}`).join(" L ")} Z`}
            fill={department.sales > 0 ? rampColor(department.intensity) : "currentColor"}
            fillOpacity={department.sales > 0 ? 1 : 0.12}
            stroke="currentColor"
            strokeOpacity={hoveredCode === department.code ? 0.9 : 0.3}
            strokeWidth={0.016}
            onMouseEnter={() => onHoverChange(department.code)}
            onMouseLeave={() => onHoverChange(null)}
          />
        ))}
      </svg>
    </div>
  );
}
