import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiFetch } from "@/shared/api/client";

import { cantidadNoDichaVigente, deSugerencia, type MensajeGuia, type SugerenciaServidor } from "../../model/guia";
import type { Mesa } from "../../model/mesa";
import {
  MEMORIA_VACIA,
  aceptar,
  contarVenta as contarVentaEn,
  descartar,
  esTip,
  leerMemoria,
  permitida,
  pideRevision,
  tipVisto,
  type MemoriaGuia,
} from "../../model/memoria-guia";

/** Cuánto tiene que quedarse quieto el borrador antes de pedir sugerencias. */
const ESPERA = 1200;
/** Un tip se va solo: es una ayuda al paso, no algo que haya que cerrar. */
const VIDA_TIP = 15_000;

type Evento = "mostrada" | "aceptada" | "descartada";

/**
 * Las sugerencias de la Guía (Fase G2a): las pide al servidor cuando el
 * borrador se queda quieto, junta las de la pantalla ("no dijiste cuántas",
 * tips) y decide UNA para mostrar, respetando la memoria anti-molestia.
 *
 * `pausado`: mientras se escribe o se dicta no se muestra nada (no se
 * interrumpe); la sugerencia vuelve sola al terminar.
 */
export function useSugerencias({ storeId, mesa, pausado }: { storeId: string | null; mesa: Mesa; pausado: boolean }) {
  // ---- la memoria, por tienda
  const claveMemoria = storeId ? `vendfy.guia.${storeId}` : null;
  const [memoria, setMemoria] = useState<MemoriaGuia>(MEMORIA_VACIA);
  useEffect(() => {
    let crudo: string | null = null;
    try {
      crudo = claveMemoria ? localStorage.getItem(claveMemoria) : null;
    } catch {
      crudo = null;
    }
    setMemoria(leerMemoria(crudo));
  }, [claveMemoria]);
  // Para leerla al pedir sin volver a pedir cada vez que cambia.
  const memoriaRef = useRef(memoria);
  memoriaRef.current = memoria;
  const guardar = useCallback(
    (f: (m: MemoriaGuia) => MemoriaGuia) =>
      setMemoria((m) => {
        const n = f(m);
        try {
          if (claveMemoria) localStorage.setItem(claveMemoria, JSON.stringify(n));
        } catch {
          // Sin almacenamiento (modo privado): la memoria dura la sesión.
        }
        return n;
      }),
    [claveMemoria],
  );

  // ---- medir
  const registrar = useCallback(
    (m: MensajeGuia, evento: Evento) => {
      if (!storeId) return;
      apiFetch("/api/omnibox/sugerencias/evento", {
        method: "POST",
        body: { storeId, codigo: m.codigo, evento },
      }).catch(() => undefined);
    },
    [storeId],
  );

  // ---- las del servidor, por mesa
  const [servidor, setServidor] = useState<{ venta: MensajeGuia[]; compra: MensajeGuia[] }>({ venta: [], compra: [] });

  useEffect(() => {
    const v = mesa.venta;
    if (!storeId || v.lineas.length === 0) {
      setServidor((s) => (s.venta.length ? { ...s, venta: [] } : s));
      return;
    }
    const control = new AbortController();
    const t = window.setTimeout(() => {
      apiFetch<SugerenciaServidor[]>("/api/omnibox/sugerencias", {
        method: "POST",
        signal: control.signal,
        body: {
          storeId,
          mesa: "venta",
          lineas: v.lineas.map((l) => ({ productId: l.productId, cantidad: l.cantidad, precio: l.precio })),
          ...(v.clienteId ? { clienteId: v.clienteId, clienteNombre: v.clienteNombre } : {}),
          revisar: pideRevision(memoriaRef.current, Date.now()),
        },
      })
        .then((r) => setServidor((s) => ({ ...s, venta: (r.data ?? []).map(deSugerencia) })))
        .catch(() => undefined);
    }, ESPERA);
    return () => {
      window.clearTimeout(t);
      control.abort();
    };
  }, [storeId, mesa.venta]);

  useEffect(() => {
    const c = mesa.compra;
    if (!storeId || c.lineas.length === 0) {
      setServidor((s) => (s.compra.length ? { ...s, compra: [] } : s));
      return;
    }
    const control = new AbortController();
    const t = window.setTimeout(() => {
      apiFetch<SugerenciaServidor[]>("/api/omnibox/sugerencias", {
        method: "POST",
        signal: control.signal,
        body: {
          storeId,
          mesa: "compra",
          lineas: c.lineas.map((l) => ({ productId: l.productId, cantidad: l.cantidad, costo: l.costo })),
          proveedor: c.proveedor,
          revisar: pideRevision(memoriaRef.current, Date.now()),
        },
      })
        .then((r) => setServidor((s) => ({ ...s, compra: (r.data ?? []).map(deSugerencia) })))
        .catch(() => undefined);
    }, ESPERA);
    return () => {
      window.clearTimeout(t);
      control.abort();
    };
  }, [storeId, mesa.compra]);

  // ---- las de la pantalla
  const [locales, setLocales] = useState<MensajeGuia[]>([]);
  const agregarLocal = useCallback((m: MensajeGuia) => {
    setLocales((prev) => [...prev.filter((x) => x.clave !== m.clave), m]);
  }, []);

  // Aceptadas o descartadas en esta sesión: no vuelven aunque el servidor
  // las siga calculando (el borrador puede no haber cambiado).
  const resueltas = useRef(new Set<string>());
  const [version, refrescar] = useState(0);

  // ---- la que se muestra
  // La que corresponde mostrar, aunque esté en pausa: mientras se escribe
  // "6" la franja se esconde, pero la respuesta igual sabe a qué contesta (G2b).
  const candidata = useMemo(() => {
    const ahora = Date.now();
    const vigentes = locales.filter((m) =>
      m.codigo === "CANTIDAD_NO_DICHA" ? cantidadNoDichaVigente(m, mesa.venta, mesa.compra) : true,
    );
    // Primero lo de la última frase; después la mesa con la que se trabaja.
    const otra = mesa.ultima === "venta" ? "compra" : "venta";
    const candidatas = [...vigentes, ...servidor[mesa.ultima], ...servidor[otra]];
    return candidatas.find((m) => !resueltas.current.has(m.clave) && permitida(m, memoria, ahora)) ?? null;
    // `version` fuerza recalcular cuando cambia `resueltas` (un ref).
  }, [locales, servidor, memoria, mesa.venta, mesa.compra, mesa.ultima, version]);
  const actual = pausado ? null : candidata;

  // "mostrada": una vez por clave y por sesión.
  const mostradas = useRef(new Set<string>());
  useEffect(() => {
    if (!actual || mostradas.current.has(actual.clave)) return;
    mostradas.current.add(actual.clave);
    registrar(actual, "mostrada");
  }, [actual, registrar]);

  const resolver = useCallback(
    (m: MensajeGuia, como: "aceptada" | "descartada") => {
      resueltas.current.add(m.clave);
      setLocales((prev) => prev.filter((x) => x.clave !== m.clave));
      guardar((mem) => (como === "aceptada" ? aceptar(mem, m) : descartar(mem, m, Date.now())));
      registrar(m, como);
      refrescar((n) => n + 1);
    },
    [guardar, registrar],
  );

  // Los tips se van solos y no vuelven (sin contarlo como "descartada").
  useEffect(() => {
    if (!actual || !esTip(actual)) return;
    const t = window.setTimeout(() => {
      resueltas.current.add(actual.clave);
      setLocales((prev) => prev.filter((x) => x.clave !== actual.clave));
      guardar((mem) => tipVisto(mem, actual.codigo));
      refrescar((n) => n + 1);
    }, VIDA_TIP);
    return () => window.clearTimeout(t);
  }, [actual, guardar]);

  const contarVenta = useCallback(() => guardar(contarVentaEn), [guardar]);

  return { actual, candidata, agregarLocal, resolver, contarVenta, memoria };
}
