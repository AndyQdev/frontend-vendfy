import { useEffect, useState } from "react";

/** Segundos que faltan hasta `hasta` (nunca negativo). */
function faltan(hasta: string): number {
  return Math.max(0, Math.ceil((new Date(hasta).getTime() - Date.now()) / 1000));
}

/**
 * El tiempo que le queda a una puja con cierre automático: "1:45".
 *
 * En cero muestra "cerrando…": el servidor la cierra en los segundos
 * siguientes y la grilla se actualiza sola con el aviso del socket.
 */
export function CuentaRegresiva({ hasta }: { hasta: string }) {
  const [resto, setResto] = useState(() => faltan(hasta));

  useEffect(() => {
    setResto(faltan(hasta));
    const id = setInterval(() => setResto(faltan(hasta)), 1000);
    return () => clearInterval(id);
  }, [hasta]);

  if (resto === 0) return <span>cerrando…</span>;
  const m = Math.floor(resto / 60);
  const s = String(resto % 60).padStart(2, "0");
  return <span className="tabular-nums">{`${m}:${s}`}</span>;
}
