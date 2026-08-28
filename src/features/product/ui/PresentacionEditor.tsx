import { useEffect, useMemo, useState } from "react";
import { Box, Image as ImageIcon, Loader2, Ruler, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/shared/ui/responsive-dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { ImageUploadModal } from "@/shared/ui/image-upload-modal";
import { cn } from "@/shared/lib/cn";
import { useUnitsOfMeasure } from "@/entities/inventory/api";
import {
  useCreatePresentation,
  useUpdatePresentation,
} from "@/entities/presentation/api";
import type {
  Presentation,
  PresentationKind,
  PresentationPriceMode,
} from "@/entities/presentation/model/types";

/** Las tres formas de recortar, explicadas con un ejemplo en vez de un término. */
const TIPOS: {
  id: PresentationKind;
  titulo: string;
  ejemplo: string;
  icono: React.ReactNode;
}[] = [
  {
    id: "FULL_UNIT",
    titulo: "El envase entero",
    ejemplo: "El frasco de 100 ml, cerrado",
    icono: <Box className="h-4 w-4" />,
  },
  {
    id: "FIXED_MEASURE",
    titulo: "Una medida fija",
    ejemplo: "Un decant de 5 ml",
    icono: <Ruler className="h-4 w-4" />,
  },
  {
    id: "VARIABLE_MEASURE",
    titulo: "La medida que elija el cliente",
    ejemplo: "Entre 20 y 50 ml, de a 5",
    icono: <SlidersHorizontal className="h-4 w-4" />,
  },
];

interface Props {
  abierto: boolean;
  onClose: () => void;
  storeProductId: string;
  /** Cuánto trae el envase, en unidad base. Es el techo de lo que se puede vender. */
  contenidoPorEnvase: number;
  unidadBase: { code: string; symbol: string; dimension?: string } | null;
  /** null = alta; con valor = edición. */
  presentacion: Presentation | null;
}

/**
 * Alta y edición de una forma de venta.
 *
 * La idea rectora es que el comerciante nunca tenga que pensar en unidades
 * base. Escribe "5 ml" o "Bs 7 el kilo" y acá se traduce a lo que el libro
 * entiende. El caso que más se equivoca a mano es el precio por medida: un
 * kilo a Bs 7 son Bs 0,007 el gramo, y quien lo cargue a mano se come dos
 * ceros. Por eso el precio se pide en la unidad que la persona usa para
 * hablar, y la división la hace el formulario.
 */
export function PresentacionEditor({
  abierto,
  onClose,
  storeProductId,
  contenidoPorEnvase,
  unidadBase,
  presentacion,
}: Props) {
  const crear = useCreatePresentation();
  const actualizar = useUpdatePresentation();
  const { data: unidades = [] } = useUnitsOfMeasure(false);

  const [nombre, setNombre] = useState("");
  const [kind, setKind] = useState<PresentationKind>("FIXED_MEASURE");
  const [medida, setMedida] = useState("");
  const [minimo, setMinimo] = useState("");
  const [maximo, setMaximo] = useState("");
  const [paso, setPaso] = useState("");
  const [priceMode, setPriceMode] = useState<PresentationPriceMode>("FIXED");
  const [precio, setPrecio] = useState("");
  const [precioPorUnidad, setPrecioPorUnidad] = useState("");
  const [unidadPrecio, setUnidadPrecio] = useState("");
  const [imagen, setImagen] = useState<string>("");
  const [modalImagen, setModalImagen] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const simbolo = unidadBase?.symbol ?? "";

  /**
   * En qué unidades se puede expresar el precio: la base y sus derivadas de
   * la misma dimensión. Permite cobrar "por kilo" un stock que se guarda en
   * gramos, que es como se habla en un mostrador.
   */
  const unidadesDePrecio = useMemo(() => {
    if (!unidadBase) return [];
    const base = unidades.find((u) => u.code === unidadBase.code);
    if (!base) return [];
    return unidades.filter((u) => u.dimension === base.dimension);
  }, [unidades, unidadBase]);

  const factorPrecio =
    unidadesDePrecio.find((u) => u.code === unidadPrecio)?.factorToBase ?? 1;

  useEffect(() => {
    if (!abierto) return;
    setErrores({});
    setUnidadPrecio(unidadBase?.code ?? "");

    if (presentacion) {
      setNombre(presentacion.name);
      setKind(presentacion.kind);
      setMedida(presentacion.baseQuantity?.toString() ?? "");
      setMinimo(presentacion.minBaseQuantity?.toString() ?? "");
      setMaximo(presentacion.maxBaseQuantity?.toString() ?? "");
      setPaso(presentacion.stepBaseQuantity?.toString() ?? "");
      setPriceMode(presentacion.priceMode);
      setPrecio(presentacion.price?.toString() ?? "");
      // Se guarda por unidad base; se muestra en la unidad que se eligió.
      setPrecioPorUnidad(presentacion.pricePerBaseUnit?.toString() ?? "");
      setUnidadPrecio(presentacion.displayUnit?.code ?? unidadBase?.code ?? "");
      setImagen(presentacion.imageUrl ?? "");
    } else {
      setNombre("");
      setKind("FIXED_MEASURE");
      setMedida("");
      setMinimo("");
      setMaximo("");
      setPaso("");
      setPriceMode("FIXED");
      setPrecio("");
      setPrecioPorUnidad("");
      setImagen("");
    }
  }, [abierto, presentacion, unidadBase]);

  // Al elegir "envase entero" la medida es, por definición, todo el envase.
  useEffect(() => {
    if (kind === "FULL_UNIT" && contenidoPorEnvase > 0) {
      setMedida(String(contenidoPorEnvase));
    }
  }, [kind, contenidoPorEnvase]);

  const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

  const validar = (): Record<string, string> => {
    const e: Record<string, string> = {};

    if (!nombre.trim()) e.nombre = "Ponele un nombre, es lo que ve el cliente";

    if (kind === "VARIABLE_MEASURE") {
      const mn = num(minimo);
      const mx = num(maximo);
      const ps = num(paso);
      if (!(mn > 0)) e.minimo = "Requerido";
      if (!(mx > 0)) e.maximo = "Requerido";
      if (!(ps > 0)) e.paso = "Requerido";
      if (mn > 0 && mx > 0 && mx < mn)
        e.maximo = "El máximo no puede ser menor que el mínimo";
      if (contenidoPorEnvase > 0 && mx > contenidoPorEnvase)
        e.maximo = `No entra: el envase trae ${contenidoPorEnvase} ${simbolo}`;
    } else {
      const m = num(medida);
      if (!(m > 0)) e.medida = "Indicá cuánto lleva";
      else if (contenidoPorEnvase > 0 && m > contenidoPorEnvase)
        e.medida = `No se puede vender ${m} ${simbolo} de un envase que trae ${contenidoPorEnvase}`;
    }

    if (priceMode === "FIXED") {
      const p = num(precio);
      if (!(p >= 0)) e.precio = "Falta el precio";
    } else {
      const p = num(precioPorUnidad);
      if (!(p > 0)) e.precioPorUnidad = "Falta el precio";
    }

    return e;
  };

  /** Precio por unidad BASE, que es lo único que guarda el backend. */
  const porUnidadBase =
    priceMode === "PER_BASE_UNIT" && num(precioPorUnidad) > 0
      ? num(precioPorUnidad) / factorPrecio
      : null;

  const guardar = async () => {
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length > 0) return;

    const esVariable = kind === "VARIABLE_MEASURE";
    const payload = {
      storeProductId,
      name: nombre.trim(),
      kind,
      ...(esVariable
        ? {
            minBaseQuantity: Math.round(num(minimo)),
            maxBaseQuantity: Math.round(num(maximo)),
            stepBaseQuantity: Math.round(num(paso)),
          }
        : { baseQuantity: Math.round(num(medida)) }),
      priceMode,
      ...(priceMode === "FIXED"
        ? { price: num(precio) }
        : {
            // Seis decimales: es la precisión con la que el backend lo guarda,
            // y redondear antes convertiría "Bs 7 el kilo" en gratis.
            pricePerBaseUnit: Number(porUnidadBase!.toFixed(6)),
            displayUnitCode: unidadPrecio || undefined,
          }),
      ...(imagen ? { imageUrl: imagen } : {}),
    };

    try {
      if (presentacion) {
        await actualizar.mutateAsync({
          id: presentacion.id,
          data: payload,
          storeProductId,
        });
        toast.success("Forma de venta actualizada");
      } else {
        await crear.mutateAsync(payload);
        toast.success("Forma de venta creada");
      }
      onClose();
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar");
    }
  };

  const guardando = crear.isPending || actualizar.isPending;

  // Lo que el cliente vería, calculado con las mismas reglas del servidor.
  const vistaPrevia = (() => {
    if (kind === "VARIABLE_MEASURE") {
      const mn = num(minimo);
      const mx = num(maximo);
      if (!(mn > 0) || !(mx > 0)) return null;
      const desde =
        priceMode === "FIXED"
          ? `Bs ${num(precio) || 0}`
          : porUnidadBase
            ? `desde Bs ${(porUnidadBase * mn).toFixed(2)}`
            : null;
      return desde
        ? `Elegís entre ${mn} y ${mx} ${simbolo} · ${desde}`
        : null;
    }
    const m = num(medida);
    if (!(m > 0)) return null;
    const p =
      priceMode === "FIXED" ? num(precio) : porUnidadBase ? porUnidadBase * m : NaN;
    if (!Number.isFinite(p)) return null;
    return `${m} ${simbolo} · Bs ${p.toFixed(2)} · descuenta ${m} ${simbolo} del stock`;
  })();

  return (
    <>
      <ResponsiveDialog open={abierto} onOpenChange={(o) => !o && onClose()}>
        <ResponsiveDialogContent className="sm:max-w-[520px]">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {presentacion ? "Editar forma de venta" : "Nueva forma de venta"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Sale del mismo stock del producto. No se duplica inventario.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <ResponsiveDialogBody className="space-y-5 pb-2">
            {/* Nombre */}
            <div className="space-y-2">
              <Label htmlFor="pres-nombre">Nombre</Label>
              <Input
                id="pres-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Decant 5 ml"
              />
              {errores.nombre && (
                <p className="text-sm text-destructive">{errores.nombre}</p>
              )}
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <Label>¿Cómo se vende?</Label>
              <div className="grid gap-2">
                {TIPOS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setKind(t.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      kind === t.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 shrink-0",
                        kind === t.id ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {t.icono}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {t.titulo}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t.ejemplo}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Medida */}
            {kind === "VARIABLE_MEASURE" ? (
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="pres-min">Mínimo</Label>
                  <Input
                    id="pres-min"
                    type="number"
                    min={1}
                    value={minimo}
                    onChange={(e) => setMinimo(e.target.value)}
                    placeholder="20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pres-max">Máximo</Label>
                  <Input
                    id="pres-max"
                    type="number"
                    min={1}
                    value={maximo}
                    onChange={(e) => setMaximo(e.target.value)}
                    placeholder="50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pres-paso">De a</Label>
                  <Input
                    id="pres-paso"
                    type="number"
                    min={1}
                    value={paso}
                    onChange={(e) => setPaso(e.target.value)}
                    placeholder="5"
                  />
                </div>
                <p className="col-span-3 text-xs text-muted-foreground">
                  En {unidadBase?.symbol}. El cliente elige cuánto llevar dentro
                  de ese rango.
                </p>
                {(errores.minimo || errores.maximo || errores.paso) && (
                  <p className="col-span-3 text-sm text-destructive">
                    {errores.maximo || errores.minimo || errores.paso}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="pres-medida">Cuánto lleva</Label>
                <div className="relative">
                  <Input
                    id="pres-medida"
                    type="number"
                    min={1}
                    value={medida}
                    onChange={(e) => setMedida(e.target.value)}
                    disabled={kind === "FULL_UNIT"}
                    className="pr-12"
                    placeholder="5"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {simbolo}
                  </span>
                </div>
                {kind === "FULL_UNIT" && (
                  <p className="text-xs text-muted-foreground">
                    Es el envase completo, así que la medida la fija el producto.
                  </p>
                )}
                {errores.medida && (
                  <p className="text-sm text-destructive">{errores.medida}</p>
                )}
              </div>
            )}

            {/* Precio */}
            <div className="space-y-2">
              <Label>Precio</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["FIXED", "Precio cerrado", "Bs 40 el decant"],
                    ["PER_BASE_UNIT", "Por medida", "Bs 8 el ml"],
                  ] as const
                ).map(([id, titulo, ejemplo]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPriceMode(id)}
                    className={cn(
                      "rounded-lg border p-2.5 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      priceMode === id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    <span className="block text-sm font-medium">{titulo}</span>
                    <span className="block text-xs text-muted-foreground">
                      {ejemplo}
                    </span>
                  </button>
                ))}
              </div>

              {priceMode === "FIXED" ? (
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    Bs
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value)}
                    className="pl-9"
                    placeholder="40.00"
                  />
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      Bs
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={precioPorUnidad}
                      onChange={(e) => setPrecioPorUnidad(e.target.value)}
                      className="pl-9"
                      placeholder="8.00"
                    />
                  </div>
                  <div className="w-28">
                    <Select value={unidadPrecio} onValueChange={setUnidadPrecio}>
                      <SelectTrigger aria-label="Unidad del precio">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {unidadesDePrecio.map((u) => (
                          <SelectItem key={u.code} value={u.code}>
                            por {u.symbol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {errores.precio && (
                <p className="text-sm text-destructive">{errores.precio}</p>
              )}
              {errores.precioPorUnidad && (
                <p className="text-sm text-destructive">
                  {errores.precioPorUnidad}
                </p>
              )}
              {priceMode === "PER_BASE_UNIT" && porUnidadBase !== null && (
                <p className="text-xs text-muted-foreground">
                  Se guarda como Bs {porUnidadBase.toFixed(6)} por {simbolo}.
                </p>
              )}
            </div>

            {/* Foto */}
            <div className="space-y-2">
              <Label>Foto (opcional)</Label>
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted">
                  {imagen ? (
                    <img
                      src={imagen}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setModalImagen(true)}
                  >
                    {imagen ? "Cambiar" : "Subir foto"}
                  </Button>
                  {imagen && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => setImagen("")}
                    >
                      Quitar
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Si no ponés, se usa la del producto. Un decant con foto propia
                vende mejor que el frasco grande.
              </p>
            </div>

            {/* Vista previa */}
            {vistaPrevia && (
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Así queda
                </p>
                <p className="mt-1 text-sm">
                  <span className="font-medium">{nombre || "Sin nombre"}</span>
                  {" — "}
                  {vistaPrevia}
                </p>
              </div>
            )}
          </ResponsiveDialogBody>

          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ImageUploadModal
        isOpen={modalImagen}
        onClose={() => setModalImagen(false)}
        images={imagen ? [imagen] : []}
        onImagesChange={(imgs) => setImagen(imgs[0] ?? "")}
        maxImages={1}
      />
    </>
  );
}
