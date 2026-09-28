import { useState } from "react";
import { cn } from "@/shared/lib/cn";

/**
 * Espacio reservado para la ilustración del dashboard.
 * Si el archivo todavía no existe, se muestra un fondo de marca en lugar de una imagen rota.
 */
export function DashboardIllustration({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={cn(
        "relative aspect-[4/3] w-full overflow-hidden rounded-[22px]",
        "bg-gradient-to-br from-emerald-100 via-emerald-50 to-cyan-50",
        "dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-950",
        className,
      )}
    >
      {!failed && (
        <img
          src="/dashboard-vendfy-illustration.webp"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain object-center"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
