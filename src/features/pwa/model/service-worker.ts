import { toast } from "sonner";

/**
 * Alta y baja del service worker.
 *
 * Solo en producción. En desarrollo no se registra y además se DESREGISTRA
 * cualquiera que haya quedado de una build anterior: el SW cachea /assets y
 * pelea con el recambio en caliente de Vite, dejando módulos viejos servidos
 * desde disco y errores que no se entienden.
 */
export function iniciarServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  if (!import.meta.env.PROD) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registros) => registros.forEach((r) => r.unregister()))
      .catch(() => {});
    return;
  }

  // Después de `load` para no competir por ancho de banda con el arranque.
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registro) => vigilarActualizaciones(registro))
      .catch(() => {
        // Sin service worker la app funciona igual: solo pierde el modo
        // offline y la instalación. No hay por qué molestar a nadie.
      });
  });
}

/**
 * Avisa cuando hay una versión nueva esperando.
 *
 * El SW no hace `skipWaiting()` solo: recargar de prisa en medio de una venta
 * es peor que esperar. Se ofrece y decide la persona.
 */
function vigilarActualizaciones(registro: ServiceWorkerRegistration) {
  const ofrecer = (esperando: ServiceWorker) => {
    toast("Hay una versión nueva de Vendfy", {
      description: "Actualizá cuando termines lo que estás haciendo.",
      duration: Infinity,
      action: {
        label: "Actualizar",
        onClick: () => {
          esperando.postMessage({ type: "SKIP_WAITING" });
        },
      },
    });
  };

  if (registro.waiting) ofrecer(registro.waiting);

  registro.addEventListener("updatefound", () => {
    const nuevo = registro.installing;
    if (!nuevo) return;
    nuevo.addEventListener("statechange", () => {
      // Con `controller` ya había una versión corriendo: esto es un recambio,
      // no la primera instalación, y ahí sí hay algo que ofrecer.
      if (nuevo.state === "installed" && navigator.serviceWorker.controller) {
        ofrecer(nuevo);
      }
    });
  });

  // Cuando el nuevo toma el control, recargar una sola vez.
  let recargando = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (recargando) return;
    recargando = true;
    window.location.reload();
  });
}

/**
 * Vacía las cachés al cerrar sesión.
 *
 * En un mostrador el equipo se comparte: deja la máquina limpia para quien
 * entre después. Es higiene, no seguridad — el SW no cachea HTML con sesión.
 */
export function limpiarCachesDelServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_CACHES" });
}
