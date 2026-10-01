import { useEffect, useRef, useState } from "react";

import { interpolar, movimientoReducido } from "./animaciones";

const DURACION = 450;

/**
 * Un monto que cuenta hasta su valor nuevo en vez de saltar: Bs 18 → Bs 54
 * pasando por los intermedios. Es lo que hace notar que el total cambió sin
 * tener que compararlo de memoria.
 *
 * El valor de verdad está siempre en `valor`; lo animado es solo lo que se ve.
 * Con movimiento reducido, salta directo.
 */
export function NumeroAnimado({ valor, formato }: { valor: number; formato: (n: number) => string }) {
  const [mostrado, setMostrado] = useState(valor);
  const desde = useRef(valor);

  useEffect(() => {
    const inicio = desde.current;
    if (inicio === valor || movimientoReducido()) {
      desde.current = valor;
      setMostrado(valor);
      return;
    }
    let cuadro = 0;
    const t0 = performance.now();
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - t0) / DURACION);
      const v = interpolar(inicio, valor, t);
      desde.current = v;
      setMostrado(v);
      if (t < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [valor]);

  return <>{formato(mostrado)}</>;
}
