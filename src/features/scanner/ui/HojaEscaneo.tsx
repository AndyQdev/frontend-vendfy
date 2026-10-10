import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import confetti from "canvas-confetti";
import { RotateCw, Volume2, VolumeX, WifiOff } from "lucide-react";

import { buscarPorCodigo, claveEscaneo, useCreateProduct } from "@/entities/product/api";
import type { ResultadoEscaneo } from "@/entities/product/model/escaneo";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/shared/ui/responsive-dialog";
import { useEscaner } from "../model/ScannerProvider";
import { setSonidoActivo, sonar, sonidoActivo } from "../model/sonido";
import { useTiendaActiva } from "../model/useTiendaActiva";
import { CodigoDeBarras } from "./piezas";
import { cn } from "@/shared/lib/cn";
import { VistaAlta, type DatosAlta } from "./VistaAlta";
import { VistaEncontrado } from "./VistaEncontrado";

/** Los colores de la marca, para el confeti (canvas: no entiende variables CSS). */
const COLORES_CONFETI = ["#06B6D4", "#0E7490", "#7DD3E3", "#16A36A", "#F59E0B"];

function festejar() {
  void confetti({
    particleCount: 90,
    spread: 75,
    startVelocity: 38,
    origin: { y: 0.75 },
    colors: COLORES_CONFETI,
    zIndex: 80,
    disableForReducedMotion: true,
  });
}

/**
 * La hoja del producto escaneado. Una sola para todo el panel: la abre el
 * escáner desde cualquier ruta, o una pantalla que quiere mostrar algo que no
 * supo resolver sola (Caja con un código desconocido).
 */
export function HojaEscaneo() {
  const { hoja, cerrar } = useEscaner();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const crear = useCreateProduct();
  const { tiendas, tiendaId } = useTiendaActiva();
  const [recienCreado, setRecienCreado] = useState(false);
  const [errorAlta, setErrorAlta] = useState<string | null>(null);
  const [conSonido, setConSonido] = useState(sonidoActivo);
  const sonoParaClave = useRef(0);

  const consulta = useQuery({
    queryKey: claveEscaneo(hoja.codigo),
    queryFn: ({ signal }) => buscarPorCodigo(hoja.codigo, signal),
    enabled: hoja.abierta && !!hoja.codigo,
    staleTime: 5_000,
    retry: 1,
  });
  const resultado = consulta.data;

  // Cada lectura nueva empieza de cero.
  useEffect(() => {
    setRecienCreado(false);
    setErrorAlta(null);
  }, [hoja.clave]);

  // Un sonido por lectura, distinto según lo que se encontró.
  useEffect(() => {
    if (!hoja.abierta || !resultado || sonoParaClave.current === hoja.clave) return;
    sonoParaClave.current = hoja.clave;
    sonar(resultado.producto ? "encontrado" : resultado.sugerencia ? "sugerido" : "nuevo");
  }, [hoja.abierta, hoja.clave, resultado]);

  useEffect(() => {
    if (consulta.isError && hoja.abierta) sonar("error");
  }, [consulta.isError, hoja.abierta]);

  const registrar = async (datos: DatosAlta) => {
    if (!resultado) return;
    setErrorAlta(null);
    try {
      await crear.mutateAsync({
        name: datos.name,
        price: datos.price,
        initialStock: datos.initialStock,
        storeId: datos.storeId,
        barcode: resultado.codigo,
        brandId: datos.brandId,
        brandName: datos.brandName,
        categoryId: datos.categoryId,
        categoryName: datos.categoryName,
        description: datos.description,
        imageUrls: datos.imageUrl ? [datos.imageUrl] : undefined,
        metadata: { tags: datos.tags, specifications: datos.specifications },
      });
      // Lo que cambió: el producto, su stock, y lo que la hoja muestra.
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory-infinite"] });
      const nuevo = await queryClient.fetchQuery({
        queryKey: claveEscaneo(hoja.codigo),
        queryFn: ({ signal }) => buscarPorCodigo(hoja.codigo, signal),
        staleTime: 0,
      });
      setRecienCreado(true);
      sonar("creado");
      festejar();
      hoja.alRegistrar?.(nuevo);
      // En Caja ya se agregó a la venta: la hoja se va sola para seguir cobrando.
      if (hoja.contexto === "caja") setTimeout(cerrar, 1100);
    } catch (error) {
      sonar("error");
      setErrorAlta(error instanceof ApiError ? error.message : "No se pudo registrar. Probá de nuevo.");
    }
  };

  // Todo lo que ya se completó en la hoja viaja al formulario completo.
  const completar = (datos: Partial<DatosAlta>) => {
    if (!resultado) return;
    cerrar();
    navigate("/products/create", {
      state: {
        prefill: {
          name: datos.name ?? resultado.sugerencia?.nombre ?? "",
          price: datos.price && datos.price > 0 ? datos.price : undefined,
          initialStock: datos.initialStock,
          barcode: resultado.codigoLegible,
          brandId: datos.brandId,
          brandName: datos.brandName,
          categoryId: datos.categoryId,
          categoryName: datos.categoryName,
          imageUrls: datos.imageUrl ? [datos.imageUrl] : undefined,
          description: datos.description,
          metadata: { tags: datos.tags ?? [], specifications: datos.specifications ?? {} },
        },
      },
    });
  };

  const vender = (r: ResultadoEscaneo) => {
    cerrar();
    navigate("/caja", { state: { agregarCodigo: r.codigo } });
  };

  const alternarSonido = () => {
    setSonidoActivo(!conSonido);
    setConSonido(!conSonido);
  };

  return (
    <ResponsiveDialog open={hoja.abierta} onOpenChange={(abierta) => !abierta && cerrar()}>
      <ResponsiveDialogContent
        // Ancha: la foto va al costado del formulario, con presencia.
        className={cn(
          "transition-[max-width] duration-300",
          resultado && !consulta.isPending ? "md:max-w-[920px]" : "md:max-w-[520px]",
        )}
        // El foco lo maneja cada vista (al precio, al nombre): Radix no debe
        // robárselo al primer botón.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <MotionConfig reducedMotion="user">
          <button
            type="button"
            onClick={alternarSonido}
            aria-label={conSonido ? "Silenciar el escáner" : "Activar el sonido del escáner"}
            title={conSonido ? "Silenciar" : "Activar sonido"}
            className="absolute right-12 top-3.5 z-10 grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:right-3"
          >
            {conSonido ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>

          <AnimatePresence mode="wait" initial={false}>
            {consulta.isPending || (!resultado && consulta.isFetching) ? (
              <motion.div
                key={`buscando-${hoja.clave}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <ResponsiveDialogHeader className="items-center text-center">
                  <ResponsiveDialogTitle>Buscando…</ResponsiveDialogTitle>
                  <ResponsiveDialogDescription>Un segundo, estamos leyendo el código.</ResponsiveDialogDescription>
                </ResponsiveDialogHeader>
                <ResponsiveDialogBody className="pb-8 pt-2">
                  <CodigoDeBarras codigo={hoja.codigo} buscando />
                </ResponsiveDialogBody>
              </motion.div>
            ) : consulta.isError || !resultado ? (
              <motion.div
                key={`error-${hoja.clave}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <ResponsiveDialogHeader className="items-center text-center">
                  <span className="mb-2 grid size-12 place-items-center rounded-full bg-destructive-soft text-destructive-soft-foreground">
                    <WifiOff className="size-6" aria-hidden />
                  </span>
                  <ResponsiveDialogTitle>No pudimos buscar el código</ResponsiveDialogTitle>
                  <ResponsiveDialogDescription>
                    {consulta.error instanceof ApiError ? consulta.error.message : "Revisá la conexión e intentá de nuevo."}
                  </ResponsiveDialogDescription>
                </ResponsiveDialogHeader>
                <ResponsiveDialogBody className="flex justify-center pb-8">
                  <Button variant="outline" onClick={() => consulta.refetch()} loading={consulta.isFetching}>
                    {!consulta.isFetching && <RotateCw aria-hidden />}
                    Reintentar
                  </Button>
                </ResponsiveDialogBody>
              </motion.div>
            ) : resultado.producto ? (
              <VistaEncontrado
                key={`encontrado-${hoja.clave}`}
                resultado={resultado}
                tiendaId={tiendaId}
                recienCreado={recienCreado}
                onVender={() => vender(resultado)}
                onEditar={() => {
                  cerrar();
                  navigate(`/products/${resultado.producto!.id}`);
                }}
              />
            ) : (
              <VistaAlta
                key={`alta-${hoja.clave}`}
                resultado={resultado}
                contexto={hoja.contexto ?? "general"}
                tiendas={tiendas}
                tiendaId={tiendaId}
                guardando={crear.isPending}
                error={errorAlta}
                onRegistrar={registrar}
                onCompletar={completar}
              />
            )}
          </AnimatePresence>
        </MotionConfig>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
