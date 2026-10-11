import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ShoppingCart } from "lucide-react";

import { totalesVenta, useVentaEnCurso } from "@/entities/order";
import { formatMoney } from "@/shared/lib/money";

/**
 * La venta en curso, a mano en cualquier pantalla: lo que se agregó
 * escaneando en Inventario o en Reportes no queda "perdido" hasta ir a Caja.
 * En Caja no hace falta: el carrito está ahí.
 */
export function VentaFlotante() {
  const [venta] = useVentaEnCurso();
  const location = useLocation();
  const navigate = useNavigate();
  const { unidades, total } = totalesVenta(venta);
  // En el asistente taparía el campo de abajo, y cobra por su cuenta.
  const visible = unidades > 0 && !/^\/(caja|omnibox)\b/.test(location.pathname);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={() => navigate("/caja")}
          initial={{ y: 40, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
          aria-label={`Venta en curso: ${unidades} productos, ${formatMoney(total)}. Ir a cobrar`}
          className="group fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full bg-primary py-2 pl-2 pr-4 text-primary-foreground shadow-float transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:left-auto sm:right-6 sm:translate-x-0"
        >
          <span className="relative grid size-9 place-items-center rounded-full bg-primary-foreground/15">
            <ShoppingCart className="size-4" aria-hidden />
            <motion.span
              key={unidades}
              initial={{ scale: 1.6 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
              className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-background px-1 text-[11px] font-bold text-foreground"
            >
              {unidades}
            </motion.span>
          </span>
          <span className="text-left leading-tight">
            <span className="block text-[11px] font-medium opacity-80">Venta en curso</span>
            <span className="block text-sm font-bold tabular-nums">{formatMoney(total)}</span>
          </span>
          <span className="ml-1 inline-flex items-center gap-1 text-sm font-semibold">
            Cobrar
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
