/**
 * Esqueleto de carga. A propósito NO se parece al resultado final: si pareciera
 * terminado, el usuario leería la espera como el dato del día.
 */
export function DailyTowerSkeleton() {
  return (
    <div
      className="flex h-full items-end justify-center gap-2 rounded-[18px] bg-muted/30"
      aria-hidden="true"
    >
      {[0.45, 0.7, 0.55].map((scale, index) => (
        <div
          key={index}
          className="w-10 animate-pulse rounded-t-lg bg-muted"
          style={{ height: `${scale * 70}%` }}
        />
      ))}
      <span className="sr-only">Cargando el pulso del día…</span>
    </div>
  );
}
