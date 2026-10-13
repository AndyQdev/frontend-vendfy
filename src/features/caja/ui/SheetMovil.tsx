import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Label } from "@/shared/ui/label";
import { Input } from "@/shared/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import {
  User,
  Trash2,
  ShoppingCart,
  Plus,
  Minus,
  Zap,
  Truck,
  Calendar,
  MapPin,
} from "lucide-react";
import type { ReactNode } from "react";
import { type Customer } from "@/entities/customer";
import { ComboBoxClient } from "./ComboBoxClient";

// Tipos para los productos y carrito
interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  imageUrl: string;
  category: string;
}

interface CartItem {
  id: string;
  storeProductId: string; // ID del StoreProduct desde inventory
  name: string;
  price: number;
  quantity: number;
  stock: number;
  imageUrl?: string;
}

interface SheetMovileCartProps {
  // Estados del Sheet
  cartSheetOpen: boolean;
  setCartSheetOpen: (open: boolean) => void;

  // Datos del carrito
  cart: CartItem[];
  setCart: (cart: CartItem[]) => void;
  products: Product[];

  // Cliente
  selectedClient: Customer | null;
  setSelectedClient: (client: Customer | null) => void;
  clientSearch: string;
  setClientSearch: (search: string) => void;
  clientSearchOpen: boolean;
  setClientSearchOpen: (open: boolean) => void;
  displayedClients: Customer[];
  isLoadingClients: boolean;

  // Callbacks
  onCreateNewClient: (name: string) => void;
  incrementQuantity: (id: string) => void;
  decrementQuantity: (id: string) => void;
  removeFromCart: (id: string) => void;

  /** El pie del carrito: método de pago, totales (y el cobro en dólares) y el botón. */
  resumen: ReactNode;
  
  // Tipo de venta
  saleType: 'quick' | 'installment' | 'delivery';
  setSaleType: (type: 'quick' | 'installment' | 'delivery') => void;
}

export function SheetMovileCart({
  cartSheetOpen,
  setCartSheetOpen,
  cart,
  setCart,
  products,
  selectedClient,
  setSelectedClient,
  clientSearch,
  setClientSearch,
  clientSearchOpen,
  setClientSearchOpen,
  displayedClients,
  isLoadingClients,
  onCreateNewClient,
  incrementQuantity,
  decrementQuantity,
  removeFromCart,
  resumen,
  saleType,
  setSaleType,
}: SheetMovileCartProps) {
  return (
    <Sheet open={cartSheetOpen} onOpenChange={setCartSheetOpen}>
      <SheetContent side="right" className="w-full sm:w-[400px] p-0 flex flex-col">
        {/* Tabs de tipo de venta */}
        <div className="px-1 pb-1 pt-4">
          <Tabs value={saleType} onValueChange={(value) => setSaleType(value as any)}>
            <TabsList className="grid w-full grid-cols-3 h-9">
              <TabsTrigger value="quick" className="text-xs px-2">
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                Rápida
              </TabsTrigger>
              <TabsTrigger value="installment" className="text-xs px-2">
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                Cuota
              </TabsTrigger>
              <TabsTrigger value="delivery" className="text-xs px-2">
                <Truck className="h-3.5 w-3.5 mr-1.5" />
                Delivery
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Contenido del carrito (reutilizando la misma estructura) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header del carrito */}
          <div className="shrink-0 px-4 pb-3 bg-white">
            {/* Select de cliente con botón de limpiar carrito */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Cliente
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <ComboBoxClient
                    selectedClient={selectedClient}
                    clientSearch={clientSearch}
                    clientSearchOpen={clientSearchOpen}
                    displayedClients={displayedClients}
                    isLoadingClients={isLoadingClients}
                    setClientSearch={setClientSearch}
                    setClientSearchOpen={setClientSearchOpen}
                    onSelectClient={setSelectedClient}
                    onCreateNew={onCreateNewClient}
                  />
                </div>
                {cart.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCart([])}
                    className="h-10 w-10 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Items del carrito: lo único que se desplaza */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 bg-white">
            {cart.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <ShoppingCart className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-lg text-muted-foreground font-semibold">Carrito vacío</p>
                  <p className="text-sm text-muted-foreground mt-1">Agrega productos para comenzar</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 py-2">
                {cart.map((item) => {
                  const product = products.find((p) => p.id === item.id);
                  return (
                    <Card key={item.id} className="p-3 hover:bg-accent/50 transition-colors">
                      <div className="flex gap-3">
                        {/* Imagen */}
                        <div className="w-16 h-16 rounded-md overflow-hidden bg-muted shrink-0">
                          {/* Lo escaneado puede no estar en la página visible: la foto viaja con el renglón. */}
                          {(item.imageUrl || product?.imageUrl) && (
                            <img
                              src={item.imageUrl || product?.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>

                        {/* Info y controles */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div>
                            <h4 className="text-sm font-medium line-clamp-1">{item.name}</h4>
                            <p className="text-sm font-bold text-emerald-600">
                              Bs. {item.price.toFixed(2)}
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            {/* Controles de cantidad */}
                            <div className="flex items-center gap-1.5 bg-muted rounded-lg p-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-background"
                                onClick={() => decrementQuantity(item.id)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="text-sm font-semibold w-8 text-center">
                                {item.quantity}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-background"
                                onClick={() => incrementQuantity(item.id)}
                                disabled={item.quantity >= item.stock}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>

                            {/* Precio total y eliminar */}
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">
                                Bs. {(item.price * item.quantity).toFixed(2)}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => removeFromCart(item.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pie pegado abajo (el mismo que en escritorio): el botón siempre a la vista */}
          <div className="shrink-0 border-t border-border/60 bg-card p-4">{resumen}</div>
        </div>
      </SheetContent>
    </Sheet>
  );
}