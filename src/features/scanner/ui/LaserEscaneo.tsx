import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { useEscaner } from "../model/ScannerProvider";

/**
 * Un destello que cruza la parte de arriba de la pantalla en cada lectura.
 *
 * Es la respuesta inmediata —antes de que llegue el resultado— de que la
 * pistola fue escuchada, esté donde esté el usuario. Sin esto, en la Caja el
 * producto aparece en el carrito y no queda claro si fue el escaneo o un clic.
 */
export function LaserEscaneo() {
  const { pulso } = useEscaner();
  const reducido = useReducedMotion();
  if (!pulso || reducido) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-1 overflow-hidden">
      <AnimatePresence>
        <motion.div
          key={pulso}
          className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-acento to-transparent shadow-[0_0_18px_4px_hsl(var(--acento)/0.6)]"
          initial={{ left: "-35%", opacity: 1 }}
          animate={{ left: "105%", opacity: [1, 1, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        />
      </AnimatePresence>
    </div>
  );
}
