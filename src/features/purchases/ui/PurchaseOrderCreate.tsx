import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useProducts } from "@/entities/product/api";
import type { ResultadoEscaneo } from "@/entities/product/model/escaneo";
import { fichaProductoConsulta } from "@/entities/omnibox/api";
import { useCreatePurchaseOrder, useConfirmPurchaseOrder } from "@/entities/purchase-order/api";
import { useStore } from "@/app/providers/auth";
import type { Moneda } from "@/entities/exchange-rate/model/types";
import { LineaDolar, SelectorMoneda, useDolarElegido } from "@/entities/exchange-rate/ui/dolar";
import { centavos, formatDolar, formatEn, formatMoney } from "@/shared/lib/money";
import { fraseNombre, fraseVan, frasesNuevaCompra, sonar, useEscaner, useManejadorEscaneo } from "@/features/scanner";
import { decirFrases } from "@/shared/voz";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import {
  ListaTarjetas,
  SoloEscritorio,
  TarjetaFila,
  FilaTitulo,
  FilaAcciones,
} from "@/shared/ui/lista-tarjetas";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  Save,
  CheckCircle,
  Search,
  ScanBarcode,
  Loader2,
  Package,
} from "lucide-react";
import { toast } from "sonner";

interface PurchaseItem {
  productId: string;
  productName: string;
  productImage?: string;
  productSku?: string;
  quantity: number;
  /** En la moneda de la compra: Bs, o dólares si es en $us. */
  unitCost: number;
}

/**
 * La moneda de la última compra a cada proveedor, en este navegador: si a
 * "Importadora X" se le compra en dólares, la próxima arranca en dólares.
 * El proveedor es texto libre, así que la clave es el nombre en minúsculas.
 */
const CLAVE_MONEDA_PROVEEDOR = "vendfy.moneda-proveedor";
const claveProveedor = (nombre: string) => nombre.trim().toLowerCase();
function monedaDelProveedor(nombre: string): Moneda | null {
  if (!claveProveedor(nombre)) return null;
  try {
    const mapa = JSON.parse(localStorage.getItem(CLAVE_MONEDA_PROVEEDOR) || "{}");
    const m = mapa[claveProveedor(nombre)];
    return m === "USD" || m === "BOB" ? m : null;
  } catch {
    return null;
  }
}
function recordarMonedaDelProveedor(nombre: string, moneda: Moneda) {
  if (!claveProveedor(nombre)) return;
  try {
    const mapa = JSON.parse(localStorage.getItem(CLAVE_MONEDA_PROVEEDOR) || "{}");
    mapa[claveProveedor(nombre)] = moneda;
    localStorage.setItem(CLAVE_MONEDA_PROVEEDOR, JSON.stringify(mapa));
  } catch {
    /* sin almacenamiento: no se recuerda, nada más */
  }
}

/**
 * El renglón editable: cuántas unidades y a qué costo.
 *
 * Son los dos únicos controles de la pantalla y aparecen en la tabla y en la
 * tarjeta del teléfono, así que viven una sola vez.
 */
function PasoCantidad({
  item,
  index,
  adjustQuantity,
  updateItem,
}: {
  item: PurchaseItem;
  index: number;
  adjustQuantity: (index: number, delta: number) => void;
  updateItem: (index: number, field: keyof PurchaseItem, value: any) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-input bg-background">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-r-none"
        onClick={() => adjustQuantity(index, -1)}
        disabled={item.quantity <= 1}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <Input
        type="number"
        min={1}
        value={item.quantity}
        onChange={(e) =>
          updateItem(index, "quantity", Math.max(1, parseInt(e.target.value) || 1))
        }
        className="h-8 w-14 border-0 px-1 text-center focus-visible:border-0 focus-visible:ring-0 max-md:h-11"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-l-none"
        onClick={() => adjustQuantity(index, 1)}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function CostoUnitario({
  item,
  index,
  updateItem,
  moneda,
}: {
  item: PurchaseItem;
  index: number;
  updateItem: (index: number, field: keyof PurchaseItem, value: any) => void;
  moneda: Moneda;
}) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <span className="text-xs text-muted-foreground">{moneda === "USD" ? "$us" : "Bs"}</span>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={item.unitCost || ""}
        onChange={(e) =>
          updateItem(index, "unitCost", parseFloat(e.target.value) || 0)
        }
        placeholder="0.00"
        aria-label={`Costo de ${item.productName} en ${moneda === "USD" ? "dólares" : "bolivianos"}`}
        className="h-8 w-24 text-right"
      />
    </div>
  );
}

export function PurchaseOrderCreate() {
  const navigate = useNavigate();
  const { selectedStore } = useStore();
  const storeId = selectedStore && selectedStore !== "all" ? selectedStore.id : undefined;

  const [supplierName, setSupplierName] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [saveMode, setSaveMode] = useState<"pending" | "confirm">("confirm");

  // ─── Moneda ────────────────────────────────────────────────────────────
  // En dólares se escriben los costos como los cobra el proveedor; la
  // compra guarda los dólares y el dólar, y al inventario entra en Bs.
  const [moneda, setMoneda] = useState<Moneda>("BOB");
  const [monedaTocada, setMonedaTocada] = useState(false);
  const dolar = useDolarElegido(storeId);
  const monedaRef = useRef(moneda);
  monedaRef.current = moneda;
  const dolarRef = useRef(dolar.valor);
  dolarRef.current = dolar.valor;

  /** Cambia la moneda pasando los costos ya escritos a la nueva. */
  const cambiarMoneda = (nueva: Moneda) => {
    if (nueva === moneda) return;
    const d = dolar.valor;
    const conCosto = items.some((i) => i.unitCost > 0);
    if (d && conCosto) {
      setItems((prev) =>
        prev.map((i) => ({ ...i, unitCost: centavos(nueva === "USD" ? i.unitCost / d : i.unitCost * d) })),
      );
      toast.info(nueva === "USD" ? "Pasé los costos a dólares" : "Pasé los costos a bolivianos", { duration: 2200 });
    }
    setMoneda(nueva);
  };

  // Si a este proveedor ya se le compró en otra moneda, arranca en esa
  // (mientras no se haya elegido a mano).
  useEffect(() => {
    if (monedaTocada || !dolar.disponible) return;
    const t = setTimeout(() => {
      const recordada = monedaDelProveedor(supplierName);
      if (recordada && recordada !== monedaRef.current) cambiarMoneda(recordada);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierName, monedaTocada, dolar.disponible]);

  // Debounce search 400ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: productsResponse, isLoading: productsLoading } = useProducts({
    limit: 30,
    ...(debouncedSearch && { attr: "name", value: debouncedSearch }),
  });
  const allProducts = productsResponse?.data || [];

  const createMutation = useCreatePurchaseOrder();
  const confirmMutation = useConfirmPurchaseOrder();

  const addedIds = new Set(items.map(i => i.productId));
  const filteredProducts = allProducts.filter(p => !addedIds.has(p.id));

  const toggleProduct = (product: { id: string; name: string; sku?: string; imageUrls?: string[] }) => {
    if (addedIds.has(product.id)) {
      setItems(prev => prev.filter(i => i.productId !== product.id));
    } else {
      setItems(prev => [...prev, {
        productId: product.id,
        productName: product.name,
        productImage: product.imageUrls?.[0],
        productSku: product.sku,
        quantity: 1,
        unitCost: 0,
      }]);
    }
  };

  const adjustQuantity = (index: number, delta: number) => {
    setItems(prev => {
      const updated = [...prev];
      const next = Math.max(1, (updated[index].quantity || 0) + delta);
      updated[index] = { ...updated[index], quantity: next };
      return updated;
    });
  };

  const updateItem = (index: number, field: keyof PurchaseItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // ─── Escáner ───────────────────────────────────────────────────────────
  // Una lectura no abre la ficha: el producto entra a la tabla, o suma uno si
  // ya estaba, con el costo que se pagó la última vez. Solo si no está
  // registrado se abre la hoja para darlo de alta, y al registrarlo entra acá.
  const queryClient = useQueryClient();
  const { buscar, abrir: abrirHojaEscaneo } = useEscaner();
  const [resaltado, setResaltado] = useState<{ id: string; vez: number } | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const agregarProducto = useCallback(
    (p: { id: string; name: string; imageUrl: string | null; sku: string | null }, cantidad = 1) => {
      const yaEstaba = itemsRef.current.find((i) => i.productId === p.id);
      setItems((prev) =>
        prev.some((i) => i.productId === p.id)
          ? prev.map((i) => (i.productId === p.id ? { ...i, quantity: i.quantity + cantidad } : i))
          : [
              ...prev,
              {
                productId: p.id,
                productName: p.name,
                productImage: p.imageUrl ?? undefined,
                productSku: p.sku ?? undefined,
                quantity: cantidad,
                unitCost: 0,
              },
            ],
      );
      sonar("encontrado");
      // La voz: desde el segundo, cuántos van; el primero espera al costo
      // ("Mermelada Arcor. La última vez, cuarenta y cinco bolivianos.").
      if (yaEstaba) decirFrases([fraseVan(yaEstaba.quantity + cantidad)]);
      setResaltado({ id: p.id, vez: Date.now() });
      const total = (yaEstaba?.quantity ?? 0) + cantidad;
      toast.success(p.name, {
        description: total > 1 ? `${total} en la compra` : "Agregado a la compra",
        duration: 1600,
      });

      // El costo llega después, para no frenar la pistola: casi siempre es
      // el de la última vez. Si ya escribieron uno, no se pisa. En dólares,
      // lo último que se pagó en dólares (el proveedor suele cobrar lo mismo
      // en dólares aunque en Bs salga distinto) o el último en Bs pasado a
      // dólares.
      if (yaEstaba) return;
      if (!storeId) {
        decirFrases([fraseNombre(p.name)]);
        return;
      }
      void queryClient
        .fetchQuery(fichaProductoConsulta(p.id, storeId))
        .then((ficha) => {
          const enBs = ficha?.costo?.ultimoCosto ?? ficha?.costo?.costoPromedio ?? null;
          const d = dolarRef.current;
          const enDolares = monedaRef.current === "USD";
          const costo = enDolares
            ? ficha?.costo?.ultimoCostoUsd ?? (enBs && d ? centavos(enBs / d) : null)
            : enBs;
          decirFrases(
            frasesNuevaCompra(p.name, cantidad, costo ? { monto: costo, moneda: enDolares ? "USD" : "BOB" } : null),
          );
          if (!costo) return;
          setItems((prev) =>
            prev.map((i) => (i.productId === p.id && !i.unitCost ? { ...i, unitCost: costo } : i)),
          );
        })
        .catch(() => decirFrases([fraseNombre(p.name)]));
    },
    [queryClient, storeId],
  );

  const agregarEscaneado = useCallback(
    (r: ResultadoEscaneo, cantidad = 1) => {
      const p = r.producto;
      if (!p) return;
      agregarProducto({ id: p.id, name: p.name, imageUrl: p.imageUrls[0] ?? null, sku: p.sku ?? null }, cantidad);
    },
    [agregarProducto],
  );

  // "Comprar" desde la ficha de un producto: llega ya cargado.
  const location = useLocation();
  const desdeFicha = useRef(false);
  useEffect(() => {
    const comprar = (location.state as { comprar?: { id: string; name: string; imageUrl: string | null; sku: string | null } } | null)
      ?.comprar;
    if (!comprar || desdeFicha.current) return;
    desdeFicha.current = true;
    agregarProducto(comprar);
    // Que volver o recargar no lo agregue otra vez.
    navigate(location.pathname, { replace: true, state: null });
  }, [location, agregarProducto, navigate]);

  useManejadorEscaneo(async (lectura) => {
    const r = await buscar(lectura.codigo);
    if (r.producto) {
      agregarEscaneado(r);
    } else {
      abrirHojaEscaneo(lectura.codigo, {
        resultado: r,
        contexto: "compra",
        alRegistrar: (nuevo, alta) => agregarEscaneado(nuevo, alta.cantidad),
      });
    }
    return true;
  }, true, "Lo agrega a la compra");

  // El renglón recién escaneado se trae a la vista y brilla un momento.
  useEffect(() => {
    if (!resaltado) return;
    // Está dos veces (la tabla y la tarjeta del teléfono): la que se ve.
    Array.from(document.querySelectorAll<HTMLElement>(`[data-compra-item="${resaltado.id}"]`))
      .find((el) => el.offsetParent !== null)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const t = setTimeout(() => setResaltado(null), 1200);
    return () => clearTimeout(t);
  }, [resaltado]);

  const total = items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
  const enDolares = moneda === "USD";
  /** Lo mismo que calcula el servidor: cada línea en Bs, redondeada. */
  const aBs = (usd: number) => (dolar.valor ? centavos(usd * dolar.valor) : 0);
  const totalBs = enDolares ? centavos(items.reduce((s, i) => s + aBs(i.unitCost * i.quantity), 0)) : total;
  const isSubmitting = createMutation.isPending || confirmMutation.isPending;

  const handleSubmit = async () => {
    if (!storeId) { toast.error("Selecciona una tienda en el sidebar"); return; }
    if (items.length === 0) { toast.error("Agrega al menos un producto"); return; }
    for (const item of items) {
      if (item.quantity <= 0) { toast.error(`Cantidad inválida en "${item.productName}"`); return; }
    }
    if (enDolares && !dolar.valor) { toast.error("Escribí el dólar de la compra"); return; }

    try {
      const created = await createMutation.mutateAsync({
        storeId,
        supplierName: supplierName || undefined,
        supplierContact: supplierContact || undefined,
        referenceNumber: referenceNumber || undefined,
        notes: notes || undefined,
        ...(enDolares ? { currency: "USD" as const, exchangeRate: dolar.valor! } : {}),
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity, unitCost: i.unitCost })),
      });
      recordarMonedaDelProveedor(supplierName, moneda);

      if (saveMode === "confirm" && created.id) {
        await confirmMutation.mutateAsync(created.id);
        toast.success("Compra registrada y stock actualizado");
      } else {
        toast.success("Compra guardada como pendiente");
      }
      navigate("/purchases");
    } catch (error: any) {
      toast.error(error?.message || "Error al crear la compra");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigate("/purchases")} aria-label="Volver a compras">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="titulo-pagina">Nueva compra</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Escaneá los productos o elegilos de la lista, y registrá la compra</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Product picker */}
        <Card className="lg:col-span-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Package className="h-4 w-4" />
              Productos
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar producto..."
                className="pl-10 h-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[500px]">
            {productsLoading ? (
              <div className="divide-y">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 py-2.5">
                    <Skeleton className="h-8 w-8 rounded flex-shrink-0" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {search ? "Sin resultados" : "Todos los productos fueron agregados"}
              </div>
            ) : (
              filteredProducts.map(product => (
                <button
                  key={product.id}
                  className="w-full text-left px-4 py-2.5 hover:bg-muted/50 flex items-center justify-between text-sm border-b last:border-0 transition-colors"
                  onClick={() => toggleProduct(product)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {product.imageUrls?.[0] ? (
                      <img src={product.imageUrls[0]} className="h-8 w-8 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <span className="truncate">{product.name}</span>
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))
            )}
          </div>
          {items.length > 0 && (
            <div className="p-3 border-t bg-muted/30 text-center text-xs text-muted-foreground">
              {items.length} producto{items.length !== 1 ? "s" : ""} seleccionado{items.length !== 1 ? "s" : ""}
            </div>
          )}
        </Card>

        {/* Right Column: Form + Items */}
        <div className="lg:col-span-2 space-y-4">
          {/* Supplier info - compact */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Proveedor</Label>
                <Input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Nombre" className="h-9 mt-1" />
              </div>
              <div>
                <Label className="text-xs">Contacto</Label>
                <Input value={supplierContact} onChange={e => setSupplierContact(e.target.value)} placeholder="Teléfono o email" className="h-9 mt-1" />
              </div>
              <div>
                <Label className="text-xs">Nro. Referencia</Label>
                <Input value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} placeholder="FAC-001234" className="h-9 mt-1" />
              </div>
            </div>
            {dolar.disponible && (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="moneda-compra">
                <span className="text-xs font-medium">Moneda</span>
                <SelectorMoneda
                  valor={moneda}
                  etiqueta="Moneda de la compra"
                  onCambio={(m) => {
                    setMonedaTocada(true);
                    cambiarMoneda(m);
                  }}
                />
                {enDolares && (
                  <LineaDolar
                    valor={dolar.valor}
                    delDia={dolar.delDia}
                    aMano={dolar.aMano}
                    onCambio={dolar.cambiar}
                    onVolver={dolar.volverAlDelDia}
                  />
                )}
              </div>
            )}
            <div className="mt-3">
              <Label className="text-xs">Notas</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones..." rows={2} className="mt-1" />
            </div>
          </Card>

          {/* Items Table */}
          {items.length > 0 ? (
            <Card className="overflow-hidden">
              <SoloEscritorio>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[60px]"></TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="w-[170px] text-center">Cantidad</TableHead>
                    <TableHead className="w-[140px] text-right">Costo unit.{enDolares ? " ($us)" : ""}</TableHead>
                    <TableHead className="w-[120px] text-right">Subtotal</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow
                      key={item.productId}
                      data-compra-item={item.productId}
                      className={cn(
                        "align-middle transition-colors duration-700",
                        resaltado?.id === item.productId && "bg-acento/10",
                      )}
                    >
                      {/* Imagen */}
                      <TableCell>
                        {item.productImage ? (
                          <img
                            src={item.productImage}
                            alt={item.productName}
                            className="h-11 w-11 rounded-md object-cover border"
                          />
                        ) : (
                          <div className="h-11 w-11 rounded-md bg-muted border flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>

                      {/* Nombre + SKU */}
                      <TableCell>
                        <p className="font-medium leading-tight line-clamp-2">
                          {item.productName}
                        </p>
                        {item.productSku && (
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                            {item.productSku}
                          </p>
                        )}
                      </TableCell>

                      {/* Cantidad con stepper */}
                      <TableCell className="text-center">
                        <PasoCantidad
                          item={item}
                          index={index}
                          adjustQuantity={adjustQuantity}
                          updateItem={updateItem}
                        />
                      </TableCell>

                      {/* Costo unitario */}
                      <TableCell>
                        <CostoUnitario
                          item={item}
                          index={index}
                          updateItem={updateItem}
                          moneda={moneda}
                        />
                      </TableCell>

                      {/* Subtotal */}
                      <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="cifra">{formatEn(item.quantity * item.unitCost, moneda)}</span>
                        {enDolares && dolar.valor && (
                          <span className="cifra block text-xs font-normal text-muted-foreground">
                            ≈ {formatMoney(aBs(item.quantity * item.unitCost))}
                          </span>
                        )}
                      </TableCell>

                      {/* Eliminar */}
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => removeItem(index)}
                          title="Quitar producto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </SoloEscritorio>

              {/* Seis columnas piden 540 px fijos. En el teléfono cada producto
                  es una tarjeta, con los mismos dos controles. */}
              <ListaTarjetas className="p-3">
                {items.map((item, index) => (
                  <TarjetaFila
                    key={item.productId}
                    data-compra-item={item.productId}
                    className={cn(
                      "transition-colors duration-700",
                      resaltado?.id === item.productId && "border-acento bg-acento/10",
                    )}
                    acciones={
                      <FilaAcciones>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Quitar
                        </Button>
                      </FilaAcciones>
                    }
                  >
                    <FilaTitulo
                      medio={
                        item.productImage ? (
                          <img
                            src={item.productImage}
                            alt=""
                            className="h-11 w-11 shrink-0 rounded-md border object-cover"
                          />
                        ) : (
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-muted">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )
                      }
                      titulo={item.productName}
                      subtitulo={item.productSku || undefined}
                      derecha={
                        <span className="text-right">
                          <span className="cifra block text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatEn(item.quantity * item.unitCost, moneda)}
                          </span>
                          {enDolares && dolar.valor && (
                            <span className="cifra block text-xs text-muted-foreground">
                              ≈ {formatMoney(aBs(item.quantity * item.unitCost))}
                            </span>
                          )}
                        </span>
                      }
                    />

                    <div className="flex items-end justify-between gap-3">
                      <label className="space-y-1">
                        <span className="etiqueta block text-[10px] text-muted-foreground">
                          Cantidad
                        </span>
                        <PasoCantidad
                          item={item}
                          index={index}
                          adjustQuantity={adjustQuantity}
                          updateItem={updateItem}
                        />
                      </label>

                      <label className="space-y-1 text-right">
                        <span className="etiqueta block text-[10px] text-muted-foreground">
                          Costo unit.{enDolares ? " ($us)" : ""}
                        </span>
                        <CostoUnitario
                          item={item}
                          index={index}
                          updateItem={updateItem}
                          moneda={moneda}
                        />
                      </label>
                    </div>
                  </TarjetaFila>
                ))}
              </ListaTarjetas>

              {/* Footer con total destacado */}
              <div className="flex items-center justify-between gap-4 border-t bg-muted/30 px-4 py-3">
                <div className="text-sm text-muted-foreground">
                  {items.length} producto{items.length !== 1 ? "s" : ""} •{" "}
                  {items.reduce((s, i) => s + i.quantity, 0)} unidad
                  {items.reduce((s, i) => s + i.quantity, 0) !== 1 ? "es" : ""}
                </div>
                <div className="text-right" data-testid="total-compra">
                  <p className="text-xs text-muted-foreground">Total a pagar</p>
                  <p className="cifra text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatEn(total, moneda)}
                  </p>
                  {enDolares && dolar.valor && (
                    <p className="cifra text-xs text-muted-foreground">
                      = {formatMoney(totalBs)} al dólar de {formatDolar(dolar.valor)}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-12 text-center text-muted-foreground border-dashed">
              <ScanBarcode className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Sin productos todavía</p>
              <p className="text-sm mt-1">
                Pasá los productos por el escáner: se van cargando acá. También podés elegirlos de la lista.
              </p>
            </Card>
          )}

          {/* Actions */}
          {items.length > 0 && (
            <div className="flex items-center justify-end gap-3">
              <Select value={saveMode} onValueChange={(v: "pending" | "confirm") => setSaveMode(v)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirm">Guardar y confirmar stock</SelectItem>
                  <SelectItem value="pending">Guardar como pendiente</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : saveMode === "confirm" ? (
                  <CheckCircle className="h-4 w-4 mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isSubmitting ? "Procesando..." : saveMode === "confirm" ? "Registrar Compra" : "Guardar Pendiente"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
