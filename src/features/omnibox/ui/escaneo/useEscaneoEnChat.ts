import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { buscarPorCodigo, claveEscaneo, useCreateProduct } from "@/entities/product/api";
import type { ResultadoEscaneo } from "@/entities/product/model/escaneo";
import type { ProductInput } from "@/entities/product/model/schema";
import type { ProductoOpcion } from "@/entities/omnibox/model/types";
import { frasesDeFicha, frasesFicha, sonar, useEscaner, useManejadorEscaneo } from "@/features/scanner";
import { ApiError } from "@/shared/api/client";
import { decirFrases } from "@/shared/voz";

import {
  destinoDirecto,
  estadoInicial,
  opcionDeEscaneo,
  resumenCompra,
  resumenVenta,
  type EscaneoChat,
} from "../../model/escaneo";
import { mensajeDeEscaneo, type Mensaje } from "../../model/mensaje";
import type { AccionMesa, Mesa, TipoMesa } from "../../model/mesa";

/** Lo que la tarjeta manda a crear. La tienda y el código los pone el chat. */
export type DatosNuevo = Omit<ProductInput, "storeId" | "barcode">;

/**
 * La pistola en el asistente: cada lectura es un mensaje del chat (ver
 * `model/escaneo.ts`), no la hoja que se abre en el resto del panel.
 *
 * Las acciones sobre la mesa pasan por `aplicarEnMesa`, el mismo camino que
 * una frase ("sumá una coca"): mismas advertencias de la Guía, mismo panel.
 */
export function useEscaneoEnChat({
  storeId,
  mensajesRef,
  mesaRef,
  setMensajes,
  aplicarEnMesa,
  ultimoCosto,
}: {
  storeId: string | null;
  mensajesRef: MutableRefObject<Mensaje[]>;
  mesaRef: MutableRefObject<Mesa>;
  setMensajes: Dispatch<SetStateAction<Mensaje[]>>;
  aplicarEnMesa: (acciones: AccionMesa[], destino: TipoMesa) => void;
  /** En la moneda de la compra abierta (Bs o dólares). */
  ultimoCosto: (productId: string) => Promise<{ costo: number; anterior: number | null; anteriorUsd?: number | null; moneda?: "BOB" | "USD" }>;
}) {
  const queryClient = useQueryClient();
  const { buscar, abrir } = useEscaner();
  const crear = useCreateProduct();

  const cambiar = (id: string, f: (e: EscaneoChat) => EscaneoChat) =>
    setMensajes((prev) => prev.map((m) => (m.id === id && m.escaneo ? { ...m, escaneo: f(m.escaneo) } : m)));
  const escaneoDe = (id: string) => mensajesRef.current.find((m) => m.id === id)?.escaneo;

  function vender(id: string, p: ProductoOpcion | null | undefined = escaneoDe(id)?.producto) {
    if (!p) return;
    aplicarEnMesa([{ tipo: "agregarVenta", producto: p, cantidad: 1 }], "venta");
    cambiar(id, (e) => ({ ...e, estado: "hecho", resumen: resumenVenta(p) }));
  }

  async function comprar(id: string, p: ProductoOpcion | null | undefined = escaneoDe(id)?.producto) {
    if (!p) return;
    // Con el costo de la última vez: casi siempre es ese.
    const costo = await ultimoCosto(p.productId);
    aplicarEnMesa(
      [{ tipo: "agregarCompra", producto: p, cantidad: 1, costo: costo.costo, costoAnterior: costo.anterior, costoAnteriorUsd: costo.anteriorUsd ?? null }],
      "compra",
    );
    cambiar(id, (e) => ({ ...e, estado: "hecho", resumen: resumenCompra(p, costo.costo, costo.moneda) }));
  }

  async function resolver(id: string, codigo: string) {
    if (!storeId) return;
    let r: ResultadoEscaneo;
    try {
      r = await buscar(codigo);
    } catch (error) {
      sonar("error");
      cambiar(id, (e) => ({
        ...e,
        estado: "error",
        error: error instanceof ApiError ? error.message : "No pude buscar el código. Revisa la conexión.",
      }));
      return;
    }

    const estado = estadoInicial(r, storeId);
    const producto = opcionDeEscaneo(r, storeId);
    if (estado !== "elegir" || !producto) {
      sonar(estado === "nuevo" ? (r.sugerencia ? "sugerido" : "nuevo") : "error");
      cambiar(id, (e) => ({ ...e, resultado: r, estado }));
      return;
    }

    sonar("encontrado");
    cambiar(id, (e) => ({ ...e, resultado: r, producto, estado: "elegir" }));
    // Con la venta o la compra abierta no se pregunta: entra ahí, como en Caja.
    const destino = destinoDirecto(mesaRef.current.abierta);
    // La voz: con la venta abierta, el precio (entra directo, como en Caja);
    // sin nada abierto, la ficha ("… ¿Lo vendes o lo compras?"); comprando
    // nada (el precio de venta ahí confunde).
    if (destino === "venta") decirFrases(frasesDeFicha(r, storeId));
    else if (destino !== "compra") decirFrases(frasesFicha(r, storeId));
    if (destino === "venta") vender(id, producto);
    else if (destino === "compra") await comprar(id, producto);
  }

  /** Se registró (desde la tarjeta o desde la hoja completa): ahora sí, ¿vender o comprar? */
  function registrado(id: string, r: ResultadoEscaneo) {
    const producto = storeId ? opcionDeEscaneo(r, storeId) : null;
    sonar("creado");
    cambiar(id, (e) => ({
      ...e,
      resultado: r,
      producto,
      creado: true,
      error: undefined,
      estado: producto ? "elegir" : "otra_tienda",
    }));
  }

  async function crearNuevo(id: string, datos: DatosNuevo) {
    const e = escaneoDe(id);
    if (!e?.resultado || !storeId || e.estado === "creando") return;
    cambiar(id, (x) => ({ ...x, estado: "creando", error: undefined }));
    try {
      await crear.mutateAsync({ ...datos, storeId, barcode: e.resultado.codigo } as ProductInput);
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory-infinite"] });
      const r = await queryClient.fetchQuery({
        queryKey: claveEscaneo(e.codigo),
        queryFn: ({ signal }) => buscarPorCodigo(e.codigo, signal),
        staleTime: 0,
      });
      registrado(id, r);
    } catch (error) {
      sonar("error");
      cambiar(id, (x) => ({
        ...x,
        estado: "nuevo",
        error: error instanceof ApiError ? error.message : "No se pudo crear. Prueba de nuevo.",
      }));
    }
  }

  // Sin tienda elegida el asistente no trabaja: la lectura abre la hoja de siempre.
  useManejadorEscaneo((lectura) => {
    if (!storeId) return false;
    const m = mensajeDeEscaneo(lectura.codigo);
    setMensajes((prev) => [...prev, m]);
    void resolver(m.id, lectura.codigo);
    return true;
  }, Boolean(storeId), "Lo trae al chat: vender, comprar o crearlo");

  return {
    vender: (id: string) => vender(id),
    comprar: (id: string) => void comprar(id),
    crear: (id: string, datos: DatosNuevo) => void crearNuevo(id, datos),
    /** Todos los datos (foto propia, ficha): la hoja completa, y al registrar vuelve acá. */
    masDatos: (id: string) => {
      const e = escaneoDe(id);
      if (!e?.resultado) return;
      abrir(e.codigo, { resultado: e.resultado, contexto: "asistente", alRegistrar: (r) => registrado(id, r) });
    },
    descartar: (id: string) => cambiar(id, (e) => ({ ...e, estado: "descartado" })),
    reintentar: (id: string) => {
      const e = escaneoDe(id);
      if (!e) return;
      cambiar(id, (x) => ({ ...x, estado: "buscando", error: undefined }));
      void resolver(id, e.codigo);
    },
  };
}
