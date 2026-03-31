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
  Trash2,
  Save,
  CheckCircle,
  Search,
  ShoppingBag,
  Loader2,
  Package,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface PurchaseItem {
  productId: string;
  productName: string;
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

  const toggleProduct = (product: { id: string; name: string }) => {
    if (addedIds.has(product.id)) {
      setItems(prev => prev.filter(i => i.productId !== product.id));
    } else {
      setItems(prev => [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitCost: 0,
      }]);
    }
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
              <div className="p-4 text-center text-sm text-muted-foreground">Cargando...</div>
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
            {notes || true ? (
              <div className="mt-3">
                <Label className="text-xs">Notas</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones..." rows={2} className="mt-1" />
              </div>
            ) : null}
          </Card>

          {/* Items Table */}
          {items.length > 0 ? (
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="w-[100px]">Cantidad</TableHead>
                    <TableHead className="w-[130px]">Costo Unit. (Bs)</TableHead>
                    <TableHead className="w-[100px]">Subtotal</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={e => updateItem(index, "quantity", parseInt(e.target.value) || 0)}
                          className="h-8 w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unitCost}
                          onChange={e => updateItem(index, "unitCost", parseFloat(e.target.value) || 0)}
                          className="h-8 w-28"
                        />
                      </TableCell>
                      <TableCell className="font-semibold">
                        Bs. {(item.quantity * item.unitCost).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(index)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total row */}
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-semibold">Total</TableCell>
                    <TableCell className="font-bold text-red-600">Bs. {total.toFixed(2)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
          ) : (
            <Card className="p-8 text-center text-muted-foreground">
              <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Selecciona productos de la lista izquierda</p>
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
