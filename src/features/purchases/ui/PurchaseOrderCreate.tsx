import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProducts } from "@/entities/product/api";
import { useCreatePurchaseOrder, useConfirmPurchaseOrder } from "@/entities/purchase-order/api";
import { useStore } from "@/app/providers/auth";
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
  ShoppingBag,
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
  unitCost: number;
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

  const total = items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
  const isSubmitting = createMutation.isPending || confirmMutation.isPending;

  const handleSubmit = async () => {
    if (!storeId) { toast.error("Selecciona una tienda en el sidebar"); return; }
    if (items.length === 0) { toast.error("Agrega al menos un producto"); return; }
    for (const item of items) {
      if (item.quantity <= 0) { toast.error(`Cantidad inválida en "${item.productName}"`); return; }
    }

    try {
      const created = await createMutation.mutateAsync({
        storeId,
        supplierName: supplierName || undefined,
        supplierContact: supplierContact || undefined,
        referenceNumber: referenceNumber || undefined,
        notes: notes || undefined,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity, unitCost: i.unitCost })),
      });

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
        <Button variant="ghost" size="icon" onClick={() => navigate("/purchases")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Nueva Compra</h1>
          <p className="text-muted-foreground mt-1">Selecciona productos y registra la compra</p>
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
            <div className="mt-3">
              <Label className="text-xs">Notas</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones..." rows={2} className="mt-1" />
            </div>
          </Card>

          {/* Items Table */}
          {items.length > 0 ? (
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[60px]"></TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="w-[170px] text-center">Cantidad</TableHead>
                    <TableHead className="w-[140px] text-right">Costo unit.</TableHead>
                    <TableHead className="w-[120px] text-right">Subtotal</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.productId} className="align-middle">
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
                      <TableCell>
                        <div className="inline-flex items-center rounded-md border border-input bg-background mx-auto">
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
                              updateItem(
                                index,
                                "quantity",
                                Math.max(1, parseInt(e.target.value) || 1),
                              )
                            }
                            className="h-8 w-14 border-0 text-center px-1 focus-visible:ring-0 focus-visible:border-0"
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
                      </TableCell>

                      {/* Costo unitario */}
                      <TableCell>
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className="text-xs text-muted-foreground">Bs.</span>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.unitCost || ""}
                            onChange={(e) =>
                              updateItem(
                                index,
                                "unitCost",
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            placeholder="0.00"
                            className="h-8 w-24 text-right"
                          />
                        </div>
                      </TableCell>

                      {/* Subtotal */}
                      <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        Bs. {(item.quantity * item.unitCost).toFixed(2)}
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

              {/* Footer con total destacado */}
              <div className="flex items-center justify-between gap-4 border-t bg-muted/30 px-4 py-3">
                <div className="text-sm text-muted-foreground">
                  {items.length} producto{items.length !== 1 ? "s" : ""} •{" "}
                  {items.reduce((s, i) => s + i.quantity, 0)} unidad
                  {items.reduce((s, i) => s + i.quantity, 0) !== 1 ? "es" : ""}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total a pagar</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    Bs. {total.toFixed(2)}
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-12 text-center text-muted-foreground border-dashed">
              <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Sin productos seleccionados</p>
              <p className="text-sm mt-1">
                Selecciona productos de la lista de la izquierda para empezar
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
