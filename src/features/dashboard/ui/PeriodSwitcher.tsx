import { cn } from "@/shared/lib/cn";
import {
  DASHBOARD_PERIODS,
  type DashboardPeriod,
} from "../model/use-dashboard-data";

export function PeriodSwitcher({
  value,
  onChange,
}: {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
}) {
  return (
    <div
      className="glass-track inline-flex gap-1 rounded-full p-1"
      role="group"
      aria-label="Período del inicio"
    >
      {DASHBOARD_PERIODS.map((period) => {
        const isActive = period.value === value;
        return (
          <button
            key={period.value}
            type="button"
            onClick={() => onChange(period.value)}
            aria-pressed={isActive}
            className={cn(
              "press rounded-full px-3 py-1.5 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {period.label}
          </button>
        );
      })}
    </div>
  );
}
