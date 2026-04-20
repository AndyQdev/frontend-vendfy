import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Package,
  ShoppingCart,
  CreditCard,
  Banknote,
  Grid3x3,
  Soup,
  Beef,
  Sandwich,
  QrCode,
  Filter,
  ScanLine,
  ChevronLeft,
  ChevronRight,
  User,
  Apple,
  Milk,
  Droplets,
  Boxes,
  Sparkles,
  ShoppingBag,
  Cookie,
  Zap,
  Truck,
  Calendar,
  MapPin,
  DollarSign,
  type LucideIcon
} from "lucide-react";
import { getCategoryIcon as getCategoryIconByName, isValidIconName } from "@/shared/lib/category-icons";
import { Separator } from "@/shared/ui/separator";
import { Skeleton } from "@/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { toast } from "sonner";
import { useCustomers, useCreateCustomer, useAddCustomerAddress, type Customer } from "@/entities/customer";
import { useInfiniteInventory } from "@/entities/inventory/api";
import { useCategories } from "@/entities/product/api";
import { useCreateOrder, OrderType } from "@/entities/order";
import { useStore } from "@/app/providers/auth";
import { useStore as useStoreDetail } from "@/entities/store/api";
import { ComboBoxClient, CreateClientModal, SheetMovileCart } from "./";

// Helper: prioriza el icono guardado en BD; si no hay, infiere por nombre
const getCategoryIcon = (name: string, iconName?: string | null): LucideIcon => {
  if (iconName && isValidIconName(iconName)) {
    return getCategoryIconByName(iconName);
  }

  const nameLower = name.toLowerCase();
  if (nameLower.includes('lácteo') || nameLower.includes('lacteo') || nameLower.includes('leche')) return Milk;
  if (nameLower.includes('pan') || nameLower.includes('panadería')) return Sandwich;
  if (nameLower.includes('carne') || nameLower.includes('pollo')) return Beef;
  if (nameLower.includes('bebida') || nameLower.includes('jugo') || nameLower.includes('refresco')) return Soup;
  if (nameLower.includes('snack') || nameLower.includes('galleta') || nameLower.includes('dulce')) return Cookie;
  if (nameLower.includes('fruta') || nameLower.includes('verdura')) return Apple;
  if (nameLower.includes('abarrote') || nameLower.includes('despensa')) return Boxes;
  if (nameLower.includes('limpieza') || nameLower.includes('higiene')) return Sparkles;
  if (nameLower.includes('aceite') || nameLower.includes('condimento')) return Droplets;
  if (nameLower.includes('enlata')) return Package;

  return ShoppingBag;
};

const PAYMENT_METHODS = [
  { id: 'cash', name: 'Efectivo', icon: Banknote },
  { id: 'qr', name: 'QR', icon: QrCode },
  { id: 'card', name: 'Tarjeta', icon: CreditCard },
];

interface CartItem {
  id: string;
  storeProductId: string; // ID del StoreProduct desde inventory
  name: string;
  price: number;
  quantity: number;
  stock: number;
  imageUrl?: string;
}

export default function Caja() {
  // Ref para el observador de intersección
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { selectedStore } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Fetch de categorías del backend con filtro por tienda
  const { data: categoriesResponse, isLoading: categoriesLoading } = useCategories(
    selectedStore === "all" ? undefined : selectedStore?.id
  );
  const backendCategories: any[] = categoriesResponse || [];

  // Construir array de categorías con iconos y conteos
  const CATEGORIES = useMemo(() => {
    // Categoría "Todos" con conteo total de productos
    const totalProductCount = backendCategories.reduce((sum, cat) => sum + (cat.productCount || 0), 0);
    const allCategory = { 
      id: 'all', 
      name: "Todos", 
      icon: Grid3x3,
      productCount: totalProductCount
    };
    
    const mappedCategories = backendCategories.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      icon: getCategoryIcon(cat.name, cat.icon),
      productCount: cat.productCount || 0
    }));
    return [allCategory, ...mappedCategories];
  }, [backendCategories]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [showOnlyInStock, setShowOnlyInStock] = useState(false);
  const categoriesRef = useRef<HTMLDivElement>(null);
  console.log('Caja:', cart);
  // Determinar storeId basado en la tienda seleccionada
  const storeId = selectedStore === "all" ? "all" : (selectedStore?.id || "all");

  // Hook de inventario con scroll infinito
  const {
    data: inventoryData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingInventory,
  } = useInfiniteInventory({
    order: "DESC",
    storeId,
    pageSize: 8,
    ...(debouncedSearch && { attr: "product.name", value: debouncedSearch }),
    ...(selectedCategory !== "all" && { categoryId: selectedCategory }),
  });

  // Debounce del término de búsqueda
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Estados para clientes
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [prefilledClientName, setPrefilledClientName] = useState("");
  
  // Estado para Sheet del carrito en móvil
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  
  // Estado para tipo de venta
  const [saleType, setSaleType] = useState<'quick' | 'installment' | 'delivery'>('quick');
  
  // Estados para modal de cuota
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [installmentData, setInstallmentData] = useState({
    initialPayment: '',
    numberOfInstallments: '2',
    installmentAmount: '0',
    nextPaymentDate: '',
  });
  
  // Estados para modal de delivery
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryData, setDeliveryData] = useState({
    address: '',
    deliveryCost: '',
    notes: '',
  });
  const [selectedAddrIdx, setSelectedAddrIdx] = useState(-1);
  const [deliveryDistance, setDeliveryDistance] = useState<number | null>(null);
  const [showAddAddr, setShowAddAddr] = useState(false);
  const [newAddrName, setNewAddrName] = useState('');
  const [newAddrLat, setNewAddrLat] = useState('');
  const [newAddrLng, setNewAddrLng] = useState('');

  // Store detail for delivery config
  const storeDetailId = selectedStore === "all" ? undefined : selectedStore?.id;
  const { data: storeDetail } = useStoreDetail(storeDetailId);
  const deliveryConfig = storeDetail?.config?.delivery;
  const storeCoords = storeDetail?.config?.contact?.coordinates;
  const deliveryType = deliveryConfig?.type ?? "fixed";
  const addAddressMutation = useAddCustomerAddress();

  // Hooks de clientes
  const { data: customersData, isLoading: isLoadingClients } = useCustomers({
    limit: 100,
    attr: clientSearch.trim() ? 'name' : undefined,
    value: clientSearch.trim() || undefined,
  });
  const createCustomerMutation = useCreateCustomer();
  const createOrderMutation = useCreateOrder();

  // Clientes filtrados para el dropdown
  const displayedClients = useMemo(() => {
    if (!customersData?.data) return [];
    
    const search = clientSearch.toLowerCase().trim();
    if (!search) return customersData.data;

    return customersData.data.filter(client => 
      client.name.toLowerCase().includes(search) ||
      (client.phone && client.phone.includes(search))
    );
  }, [customersData, clientSearch]);

  // Productos del inventario aplanados
  const allProducts = useMemo(() => {
    if (!inventoryData) return [];
    const pages = ('pages' in inventoryData ? inventoryData.pages : []) as any[];
    return pages.flatMap((page: any) => 
      page.data.map((inventory: any) => ({
        id: inventory.id,
        storeProductId: inventory.storeProductId, // ID del StoreProduct
        name: inventory.product.name,
        price: inventory.product.price || 0,
        stock: inventory.stockQuantity,
        imageUrl: inventory.product.imageUrls?.[0],
        category: "Todos", // Por ahora todas las categorías en "Todos"
      }))
    );
  }, [inventoryData]);

  // Abrir Sheet automáticamente en móvil cuando se agrega un producto
  useEffect(() => {
    if (cart.length > 0 && window.innerWidth < 1024) {
      setCartSheetOpen(true);
    }
  }, [cart.length]);

  // Intersection Observer para scroll infinito
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { 
        threshold: 0.1, // Reducido de 0.5 a 0.1 para activar antes
        rootMargin: '200px' // Se activa 200px antes de que el sentinel sea visible
      }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Contar productos por categoría (ahora viene del backend)
  const getProductCountByCategory = (categoryId: string) => {
    const category = CATEGORIES.find(cat => cat.id === categoryId);
    return category?.productCount || 0;
  };

  // Filtrar productos (por ahora solo por stock, búsqueda y categoría se harán en el backend)
  const filteredProducts = allProducts.filter(product => {
    const matchesStock = !showOnlyInStock || product.stock > 0;
    return matchesStock;
  });

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Scroll de categorías
  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoriesRef.current) {
      const scrollAmount = 300;
      categoriesRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Agregar producto al carrito
  const addToCart = useCallback((product: typeof allProducts[0]) => {
    if (product.stock === 0) return;

    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity < product.stock) {
        setCart(cart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      }
    } else {
      setCart([...cart, {
        id: product.id,
        storeProductId: product.storeProductId, // Guardar storeProductId
        name: product.name,
        price: product.price,
        quantity: 1,
        stock: product.stock,
        imageUrl: product.imageUrl,
      }]);
    }
  }, [cart]);

  // Incrementar cantidad
  const incrementQuantity = (id: string) => {
    setCart(cart.map(item =>
      item.id === id && item.quantity < item.stock
        ? { ...item, quantity: item.quantity + 1 }
        : item
    ));
  };

  // Decrementar cantidad
  const decrementQuantity = (id: string) => {
    setCart(cart.map(item =>
      item.id === id && item.quantity > 1
        ? { ...item, quantity: item.quantity - 1 }
        : item
    ));
  };

  // Eliminar item del carrito
  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  // Calcular totales
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal; // Por ahora sin descuentos

  // Crear nuevo cliente
  const handleCreateClient = async (data: { name: string; phone: string }) => {
    try {
      const newClient = await createCustomerMutation.mutateAsync(data);
      setSelectedClient(newClient);
      setShowClientModal(false);
      setPrefilledClientName("");
      toast.success("Cliente creado exitosamente");
    } catch (error) {
      toast.error("Error al crear el cliente");
      throw error;
    }
  };

  // Finalizar venta
  const finalizeSale = () => {
    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }
    
    if (!selectedClient) {
      toast.error("Debes seleccionar un cliente");
      return;
    }
    
    // Abrir modal según el tipo de venta
    if (saleType === 'installment') {
      setShowInstallmentModal(true);
    } else if (saleType === 'delivery') {
      setShowDeliveryModal(true);
    } else {
      // Venta rápida - procesar directamente
      processQuickSale();
    }
  };
  
  // Procesar venta rápida
  const processQuickSale = async () => {
    if (!selectedClient || !selectedStore || selectedStore === "all") {
      toast.error("Selecciona un cliente y tienda válidos");
      return;
    }

    try {
      await createOrderMutation.mutateAsync({
        totalAmount: total,
        type: OrderType.QUICK,
        paymentMethod: paymentMethod,
        paymentDate: new Date().toISOString(),
        totalReceived: total,
        storeId: selectedStore.id,
        customerId: selectedClient.id,
        items: cart.map(item => ({
          storeProductId: item.storeProductId, // ID del StoreProduct desde inventory
          quantity: item.quantity,
          price: item.price,
        })),
      });

      toast.success(`Venta rápida finalizada! Total: Bs. ${total.toFixed(2)}`);
      setCart([]);
      setSelectedClient(null);
    } catch (error) {
      // El error ya se muestra en el hook useCreateOrder
      console.error('Error en venta rápida:', error);
    }
  };
  
  // Procesar venta a cuotas
  const processInstallmentSale = async () => {
    const initialPayment = parseFloat(installmentData.initialPayment);
    if (!initialPayment || initialPayment <= 0) {
      toast.error("Ingresa el pago inicial");
      return;
    }
    if (initialPayment > total) {
      toast.error("El pago inicial no puede ser mayor al total");
      return;
    }
    if (!installmentData.nextPaymentDate) {
      toast.error("Selecciona la fecha del próximo pago");
      return;
    }
    
    if (!selectedClient || !selectedStore || selectedStore === "all") {
      toast.error("Selecciona un cliente y tienda válidos");
      return;
    }

    try {
      await createOrderMutation.mutateAsync({
        totalAmount: total,
        type: OrderType.INSTALLMENT,
        paymentMethod: paymentMethod,
        paymentDate: new Date().toISOString(),
        totalReceived: initialPayment,
        installmentInfo: {
          numberOfInstallments: parseInt(installmentData.numberOfInstallments),
          nextPaymentDate: installmentData.nextPaymentDate,
        },
        storeId: selectedStore.id,
        customerId: selectedClient.id,
        items: cart.map(item => ({
          storeProductId: item.storeProductId, // ID del StoreProduct desde inventory
          quantity: item.quantity,
          price: item.price,
        })),
      });

      toast.success(`Venta a cuotas registrada! Pago inicial: Bs. ${initialPayment.toFixed(2)}`);
      setCart([]);
      setSelectedClient(null);
      setShowInstallmentModal(false);
      setInstallmentData({
        initialPayment: '',
        numberOfInstallments: '2',
        installmentAmount: '0',
        nextPaymentDate: '',
      });
    } catch (error) {
      // El error ya se muestra en el hook useCreateOrder
      console.error('Error en venta a cuotas:', error);
    }
  };
  
  // Haversine distance
  const calcDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const calcDeliveryCost = (km: number) => Math.round(5 + km * 2);

  // Auto-select first address when delivery modal opens
  useEffect(() => {
    if (showDeliveryModal && selectedClient) {
      const addrs = selectedClient.addresses ?? [];
      if (addrs.length > 0 && selectedAddrIdx < 0) {
        setSelectedAddrIdx(0);
      } else if (addrs.length === 0) {
        setShowAddAddr(true);
      }
      // Set cost based on type
      if (deliveryType === "free") setDeliveryData(p => ({ ...p, deliveryCost: '0' }));
      else if (deliveryType === "fixed") setDeliveryData(p => ({ ...p, deliveryCost: String(deliveryConfig?.value ?? 0) }));
      else if (deliveryType === "pending") setDeliveryData(p => ({ ...p, deliveryCost: '0' }));
    }
  }, [showDeliveryModal, selectedClient, deliveryType]);

  // Calculate distance when address changes
  useEffect(() => {
    const addrs = selectedClient?.addresses ?? [];
    if (selectedAddrIdx < 0 || !addrs[selectedAddrIdx] || !storeCoords) { setDeliveryDistance(null); return; }
    const addr = addrs[selectedAddrIdx];
    const dist = calcDistance(storeCoords.latitude, storeCoords.longitude, addr.latitude, addr.longitude);
    setDeliveryDistance(dist);
    setDeliveryData(p => ({ ...p, address: addr.name }));
    if (deliveryType === "calculated") {
      setDeliveryData(p => ({ ...p, deliveryCost: String(calcDeliveryCost(dist)) }));
    }
  }, [selectedAddrIdx, storeCoords, selectedClient]);

  // Procesar venta con delivery
  const processDeliverySale = async () => {
    if (!deliveryData.address.trim()) {
      toast.error("Selecciona o agrega una dirección");
      return;
    }
    const deliveryCost = deliveryType === "pending" ? 0 : parseFloat(deliveryData.deliveryCost);
    if (deliveryType !== "pending" && deliveryType !== "free" && (!deliveryCost || deliveryCost <= 0)) {
      toast.error("El costo de delivery es requerido");
      return;
    }

    if (!selectedClient || !selectedStore || selectedStore === "all") {
      toast.error("Selecciona un cliente y tienda válidos");
      return;
    }

    const totalWithDelivery = total + (deliveryCost || 0);

    try {
      await createOrderMutation.mutateAsync({
        totalAmount: totalWithDelivery,
        type: OrderType.DELIVERY,
        paymentMethod: paymentMethod,
        paymentDate: new Date().toISOString(),
        totalReceived: totalWithDelivery,
        deliveryInfo: {
          address: deliveryData.address,
          cost: deliveryCost || 0,
          notes: deliveryData.notes || undefined,
        },
        storeId: selectedStore.id,
        customerId: selectedClient.id,
        items: cart.map(item => ({
          storeProductId: item.storeProductId,
          quantity: item.quantity,
          price: item.price,
        })),
      });

      toast.success(`Pedido con delivery registrado! Total: Bs. ${totalWithDelivery.toFixed(2)}`);
      setCart([]);
      setSelectedClient(null);
      setShowDeliveryModal(false);
      setSelectedAddrIdx(-1);
      setDeliveryDistance(null);
      setDeliveryData({ address: '', deliveryCost: '', notes: '' });
    } catch (error) {
      console.error('Error en venta con delivery:', error);
    }
  };

  const handleAddNewAddress = async () => {
    if (!selectedClient || !newAddrName.trim() || !newAddrLat || !newAddrLng) {
      toast.error("Completa nombre, latitud y longitud");
      return;
    }
    try {
      await addAddressMutation.mutateAsync({
        customerId: selectedClient.id,
        address: { name: newAddrName.trim(), latitude: parseFloat(newAddrLat), longitude: parseFloat(newAddrLng) },
      });
      toast.success("Dirección agregada");
      setShowAddAddr(false);
      setNewAddrName(''); setNewAddrLat(''); setNewAddrLng('');
    } catch { toast.error("Error al agregar dirección"); }
  };
  
  // Calcular monto de cuota cuando cambia el pago inicial o número de cuotas
  useEffect(() => {
    const initialPayment = parseFloat(installmentData.initialPayment) || 0;
    const remaining = total - initialPayment;
    const installments = parseInt(installmentData.numberOfInstallments) || 1;
    const installmentAmount = remaining / installments;
    setInstallmentData(prev => ({
      ...prev,
      installmentAmount: installmentAmount.toFixed(2),
    }));
  }, [installmentData.initialPayment, installmentData.numberOfInstallments, total]);

  const getStockIndicator = (stock: number) => {
    if (stock === 0) return { color: 'bg-red-500', text: 'Agotado', textColor: 'text-red-600' };
    if (stock < 10) return { color: 'bg-orange-500', text: `${stock} disponibles`, textColor: 'text-orange-600' };
    return { color: 'bg-emerald-500', text: `Stock: ${stock}`, textColor: 'text-emerald-600' };
  };

  return (
    <div className="relative h-[calc(100vh-2rem)] lg:h-[calc(100vh-2rem)] min-w-0 overflow-hidden">
      {/* Layout: Catálogo + Carrito */}
        <div className="grid h-full gap-4 grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_420px]">
            <div className="flex flex-col gap-3 sm:gap-4 min-w-0 h-full overflow-hidden">
                    {/* Búsqueda con botones laterales */}
                <div className="space-y-3 sm:space-y-4">
                    <div className="flex gap-2 sm:gap-3 items-center">
                        <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 hidden sm:flex"
                        >
                        <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Button>
                        
                        <div className="relative flex-1">
                        <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                        <Input
                            placeholder="Buscar productos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 sm:pl-12 pr-4 h-10 sm:h-12 text-sm sm:text-base"
                            autoFocus
                        />
                        </div>
                        
                        <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 hidden sm:flex"
                        >
                        <ScanLine className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Button>
                    </div>

                    {/* Categorías con scroll horizontal */}
                    <div className="relative w-full min-w-0">
                        {/* Botón izquierda */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background shadow-md hidden sm:flex"
                            onClick={() => scrollCategories('left')}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>

                        <div
                            ref={categoriesRef}
                            className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] scroll-smooth px-1 sm:px-10"
                        >
                            {categoriesLoading ? (
                              Array.from({ length: 6 }).map((_, i) => (
                                <Card key={`cat-skel-${i}`} className="shrink-0 w-[110px] sm:w-[140px] p-3 sm:p-4">
                                  <div className="flex flex-col items-center gap-1.5 sm:gap-2">
                                    <Skeleton className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg" />
                                    <div className="w-full space-y-1">
                                      <Skeleton className="h-3 w-16 sm:w-20 mx-auto" />
                                      <Skeleton className="h-2.5 w-10 sm:w-14 mx-auto" />
                                    </div>
                                  </div>
                                </Card>
                              ))
                            ) : (
                              CATEGORIES.map((category) => {
                                const Icon = category.icon;
                                const isActive = selectedCategory === category.id;
                                const productCount = getProductCountByCategory(category.id);

                                return (
                                  <Card
                                    key={category.id}
                                    className={`shrink-0 w-[110px] sm:w-[140px] p-3 sm:p-4 cursor-pointer transition-all ${
                                      isActive
                                        ? 'bg-emerald-100 dark:bg-emerald-950 border-emerald-300 shadow-md'
                                        : 'hover:border-emerald-200 shadow-sm'
                                    }`}
                                    onClick={() => setSelectedCategory(category.id)}
                                  >
                                    <div className="flex flex-col items-center gap-1.5 sm:gap-2 text-center">
                                      <div className={`p-1.5 sm:p-2 rounded-lg ${
                                        isActive ? 'bg-emerald-200/50' : 'bg-emerald-100/50'
                                      }`}>
                                        <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                                      </div>

                                      <div className="w-full">
                                        <span className="text-[10px] sm:text-xs font-semibold block truncate">
                                          {category.name}
                                        </span>
                                        <span className="text-[9px] sm:text-[10px] text-muted-foreground block mt-0.5">
                                          {productCount} producto{productCount !== 1 ? 's' : ''}
                                        </span>
                                      </div>
                                    </div>
                                  </Card>
                                );
                              })
                            )}
                        </div>

                        {/* Botón derecha */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background shadow-md hidden sm:flex"
                            onClick={() => scrollCategories('right')}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

            {/* Grid de productos */}
            <div className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {isLoadingInventory ? (
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 pb-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Card key={`prod-skel-${i}`} className="overflow-hidden">
                      <Skeleton className="aspect-square w-full" />
                      <div className="p-3 space-y-2">
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-3.5 w-3/5" />
                        <div className="space-y-1 pt-1">
                          <Skeleton className="h-6 w-24" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
            ) : filteredProducts.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-lg text-muted-foreground">No se encontraron productos</p>
                    <p className="text-sm text-muted-foreground mt-1">Intenta con otro filtro o búsqueda</p>
                </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 pb-4">
                {filteredProducts.map(product => {
                    const stockInfo = getStockIndicator(product.stock);
                    return (
                    <Card
                    key={product.id}
                    className={`group relative overflow-hidden transition-all duration-200 ${
                        product.stock === 0 
                        ? 'opacity-60 cursor-not-allowed' 
                        : 'cursor-pointer hover:shadow-sm hover:border-emerald-300'
                    }`}
                    onClick={() => addToCart(product)}
                    >
                    <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 overflow-hidden relative">
                        <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        {product.stock === 0 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-white font-bold text-lg">AGOTADO</span>
                        </div>
                        )}
                        {/* Dot indicador de stock en esquina superior izquierda */}
                        {/* <div className="absolute top-2 left-2">
                          <div className={`h-2.5 w-2.5 rounded-full ${stockInfo.color} ring-2 ring-white shadow-sm`} />
                        </div> */}
                    </div>
                    <div className="p-3">
                        <h3 className="font-semibold text-sm mb-1.5 line-clamp-2 min-h-[2.5rem]">
                        {product.name}
                        </h3>
                        <div className="space-y-0.5">
                          <p className="text-xl font-bold text-emerald-600">
                            Bs. {product.price.toFixed(2)}
                          </p>
                          <p className={`text-[10px] font-medium ${stockInfo.textColor}`}>
                            {stockInfo.text}
                          </p>
                        </div>
                    </div>
                    {product.stock > 0 && (
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-primary text-primary-foreground rounded-full p-1.5">
                            <Plus className="h-4 w-4" />
                        </div>
                        </div>
                    )}
                    </Card>
                    );
                })}
                
                {/* Skeletons para infinite scroll */}
                {isFetchingNextPage && (
                  <>
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Card key={`skeleton-${index}`} className="overflow-hidden">
                        <Skeleton className="aspect-square w-full" />
                        <div className="p-3 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                          <div className="flex items-center justify-between pt-1">
                            <Skeleton className="h-6 w-20" />
                            <Skeleton className="h-5 w-16 rounded-full" />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </>
                )}
                
                {/* Sentinel para infinite scroll (invisible) */}
                <div ref={loadMoreRef} className="col-span-full h-1" />
                </div>
            )}
            </div>
        </div>

        {/* Botón flotante del carrito para móvil */}
        <div className="lg:hidden fixed bottom-6 right-6 z-40">
          <Button
            size="lg"
            onClick={() => setCartSheetOpen(true)}
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all relative"
          >
            <ShoppingCart className="h-6 w-6" />
            {cart.length > 0 && (
              <Badge className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center bg-red-500 hover:bg-red-600">
                {totalItems}
              </Badge>
            )}
          </Button>
        </div>

        {/* Panel del Carrito */}
        <div className="bg-white border-l rounded-tl-3xl rounded-bl-3xl overflow-hidden hidden lg:block relative">
            {/* Tabs de tipo de venta - Pegados arriba */}
            <div className="absolute top-0 left-0 right-0 z-10 bg-white border-b px-2 pt-2 pb-1 rounded-tl-3xl">
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
            
            <div className="h-full flex flex-col overflow-hidden pt-12">
            {/* Header del carrito */}
            <div className="px-4 lg:px-6 pt-2 pb-3 lg:pb-4 bg-white">
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
                        onCreateNew={(name) => {
                          setPrefilledClientName(name);
                          setShowClientModal(true);
                        }}
                      />
                    </div>
                    {cart.length > 0 && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCart([])}
                        className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive hover:border-destructive"
                        title="Limpiar carrito"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
            </div>

            {/* Items del carrito */}
            <div className="flex-1 overflow-y-auto px-3 lg:px-4 bg-white">
                {cart.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                    <div className="p-4 bg-muted/50 rounded-full w-fit mx-auto mb-4">
                        <ShoppingCart className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground font-medium text-sm">Carrito vacío</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Selecciona productos para comenzar
                    </p>
                    </div>
                </div>
                ) : (
                <div className="space-y-2 py-2">
                    {cart.map((item) => {
                      const product = allProducts.find(p => p.id === item.id);
                      return (
                    <Card key={item.id} className="flex gap-3 p-3 shadow-sm hover:shadow-md transition-shadow">
                        {/* Imagen del producto */}
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                        <img
                            src={product?.imageUrl || ''}
                            alt={item.name}
                            className="w-full h-full object-cover"
                        />
                        </div>
                        
                        {/* Info del producto */}
                        <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm mb-1 line-clamp-1">
                            {item.name}
                        </h4>
                        <p className="text-xs text-muted-foreground mb-2">
                            Bs. {item.price.toFixed(2)}
                        </p>
                        
                        {/* Stepper de cantidad */}
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-muted/50 rounded-md">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 hover:bg-background"
                                onClick={() => decrementQuantity(item.id)}
                                disabled={item.quantity <= 1}
                            >
                                <Minus className="h-3 w-3" />
                            </Button>
                            <span className="font-semibold text-xs w-8 text-center">
                                {item.quantity}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 hover:bg-background"
                                onClick={() => incrementQuantity(item.id)}
                                disabled={item.quantity >= item.stock}
                            >
                                <Plus className="h-3 w-3" />
                            </Button>
                            </div>
                            
                            <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => removeFromCart(item.id)}
                            >
                            <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                        </div>
                        
                        {/* Precio total del item */}
                        <div className="text-right shrink-0">
                        <p className="font-bold text-sm text-emerald-600">
                            Bs. {(item.price * item.quantity).toFixed(2)}
                        </p>
                        </div>
                    </Card>
                      );
                    })}
                </div>
                )}
            </div>

            {/* Resumen pegado abajo */}
            <div className="bg-white p-3 lg:p-4 space-y-2 lg:space-y-2.5">
                {/* Card de totales con fondo gris pastel */}
                <Card className="bg-slate-50/50 border-slate-200/50 p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">Bs. {subtotal.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Descuento</span>
                    <span className="font-medium">Bs. 0.00</span>
                </div>
                
                <Separator className="my-1.5" />
                
                <div className="flex justify-between items-center pt-1">
                    <span className="text-sm font-bold">Total</span>
                    <span className="text-xl font-bold">
                    Bs. {total.toFixed(2)}
                    </span>
                </div>
                </Card>

                {/* Métodos de pago en cards */}
                <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Método de Pago</label>
                <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon;
                    const isActive = paymentMethod === method.id;
                    return (
                        <Card
                        key={method.id}
                        className={`p-2.5 cursor-pointer transition-all ${
                            isActive 
                            ? 'bg-emerald-100 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700' 
                            : 'hover:border-emerald-200 bg-card'
                        }`}
                        onClick={() => setPaymentMethod(method.id)}
                        >
                        <div className="flex flex-col items-center gap-1.5 text-center">
                            <div className={`p-1.5 rounded-lg ${
                            isActive ? 'bg-emerald-200/50 dark:bg-emerald-900/50' : 'bg-emerald-100/50 dark:bg-emerald-900/30'
                            }`}>
                            <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <span className="text-[10px] font-medium">
                            {method.name}
                            </span>
                        </div>
                        </Card>
                    );
                    })}
                </div>
                </div>

                {/* Botón finalizar */}
                <Button
                className="w-full h-11 text-sm font-bold"
                size="lg"
                onClick={finalizeSale}
                disabled={cart.length === 0}
                >
                Finalizar Venta
                </Button>
            </div>
            </div>
        </div>
        </div>

      {/* Sheet del carrito para móvil */}
      <SheetMovileCart
        cartSheetOpen={cartSheetOpen}
        setCartSheetOpen={setCartSheetOpen}
        cart={cart}
        setCart={setCart}
        products={allProducts}
        selectedClient={selectedClient}
        setSelectedClient={setSelectedClient}
        clientSearch={clientSearch}
        setClientSearch={setClientSearch}
        clientSearchOpen={clientSearchOpen}
        setClientSearchOpen={setClientSearchOpen}
        displayedClients={displayedClients}
        isLoadingClients={isLoadingClients}
        onCreateNewClient={(name) => {
          setPrefilledClientName(name);
          setShowClientModal(true);
        }}
        incrementQuantity={incrementQuantity}
        decrementQuantity={decrementQuantity}
        removeFromCart={removeFromCart}
        finalizeSale={finalizeSale}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        paymentMethods={PAYMENT_METHODS}
        saleType={saleType}
        setSaleType={setSaleType}
        total={total}
      />

      {/* Modal de crear cliente */}
      <CreateClientModal
        open={showClientModal}
        onOpenChange={setShowClientModal}
        onSave={handleCreateClient}
        isCreating={createCustomerMutation.isPending}
        initialName={prefilledClientName}
      />
      
      {/* Modal de Venta a Cuotas */}
      <Dialog open={showInstallmentModal} onOpenChange={setShowInstallmentModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-600" />
              Venta a Cuotas
            </DialogTitle>
            <DialogDescription>
              Configura el plan de pagos para este pedido
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Total */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-emerald-900">Total del pedido</span>
                <span className="text-xl font-bold text-emerald-600">Bs. {total.toFixed(2)}</span>
              </div>
            </div>
            
            {/* Pago Inicial */}
            <div className="space-y-2">
              <Label htmlFor="initialPayment" className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                Pago Inicial
              </Label>
              <Input
                id="initialPayment"
                type="number"
                placeholder="0.00"
                value={installmentData.initialPayment}
                onChange={(e) => setInstallmentData(prev => ({ ...prev, initialPayment: e.target.value }))}
                step="0.01"
                min="0"
                max={total}
              />
            </div>
            
            {/* Número de Cuotas */}
            <div className="space-y-2">
              <Label htmlFor="installments">Número de Cuotas</Label>
              <select
                id="installments"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={installmentData.numberOfInstallments}
                onChange={(e) => setInstallmentData(prev => ({ ...prev, numberOfInstallments: e.target.value }))}
              >
                <option value="2">2 cuotas</option>
                <option value="3">3 cuotas</option>
                <option value="4">4 cuotas</option>
                <option value="6">6 cuotas</option>
                <option value="12">12 cuotas</option>
              </select>
            </div>
            
            {/* Monto por Cuota */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Monto por cuota</span>
                <span className="text-lg font-bold">Bs. {installmentData.installmentAmount}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Saldo restante: Bs. {(total - (parseFloat(installmentData.initialPayment) || 0)).toFixed(2)}
              </p>
            </div>
            
            {/* Fecha del Próximo Pago */}
            <div className="space-y-2">
              <Label htmlFor="nextPaymentDate">Fecha del Próximo Pago</Label>
              <Input
                id="nextPaymentDate"
                type="date"
                value={installmentData.nextPaymentDate}
                onChange={(e) => setInstallmentData(prev => ({ ...prev, nextPaymentDate: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowInstallmentModal(false)}>
              Cancelar
            </Button>
            <Button onClick={processInstallmentSale} className="bg-emerald-600 hover:bg-emerald-700">
              Confirmar Venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal de Delivery */}
      <Dialog open={showDeliveryModal} onOpenChange={setShowDeliveryModal}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-emerald-600" />
              Pedido con Delivery
            </DialogTitle>
            <DialogDescription>
              Tipo: {deliveryType === "free" ? "Gratis" : deliveryType === "fixed" ? "Fijo" : deliveryType === "calculated" ? "Calculado por distancia" : "Por definir"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Total */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex justify-between items-center">
              <span className="text-sm font-medium text-emerald-900">Total del pedido</span>
              <span className="text-lg font-bold text-emerald-600">Bs. {total.toFixed(2)}</span>
            </div>

            {/* Direcciones del cliente */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Dirección de entrega
              </Label>
              {(selectedClient?.addresses ?? []).length > 0 && (
                <div className="space-y-1.5">
                  {(selectedClient?.addresses ?? []).map((addr, i) => (
                    <button key={i} type="button"
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${selectedAddrIdx === i ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:border-emerald-200'}`}
                      onClick={() => { setSelectedAddrIdx(i); setShowAddAddr(false); }}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedAddrIdx === i ? 'bg-emerald-500 text-white' : 'bg-gray-100'}`}>
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${selectedAddrIdx === i ? 'text-emerald-800' : ''}`}>{addr.name}</p>
                        <p className="text-xs text-muted-foreground">{addr.latitude.toFixed(4)}, {addr.longitude.toFixed(4)}</p>
                      </div>
                      {selectedAddrIdx === i && <div className="text-emerald-500">✓</div>}
                    </button>
                  ))}
                </div>
              )}

              {/* Add address */}
              <button type="button" className="flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700 py-1"
                onClick={() => setShowAddAddr(!showAddAddr)}>
                <span className="text-lg">+</span> {showAddAddr ? "Cancelar" : "Agregar nueva dirección"}
              </button>

              {showAddAddr && (
                <div className="space-y-2 p-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
                  <Input placeholder="Nombre (Casa, Oficina...)" value={newAddrName} onChange={(e) => setNewAddrName(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Latitud" type="number" step="any" value={newAddrLat} onChange={(e) => setNewAddrLat(e.target.value)} />
                    <Input placeholder="Longitud" type="number" step="any" value={newAddrLng} onChange={(e) => setNewAddrLng(e.target.value)} />
                  </div>
                  <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleAddNewAddress} disabled={addAddressMutation.isPending}>
                    {addAddressMutation.isPending ? "Guardando..." : "Guardar Dirección"}
                  </Button>
                </div>
              )}
            </div>

            {/* Distance + map */}
            {deliveryDistance != null && storeCoords && selectedClient?.addresses?.[selectedAddrIdx] && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Distancia:</span>
                  <span className="font-bold text-emerald-600">{deliveryDistance.toFixed(1)} km</span>
                </div>
                <div className="rounded-lg overflow-hidden border">
                  <img
                    src={`https://maps.googleapis.com/maps/api/staticmap?size=640x200&scale=2&maptype=roadmap&style=feature:all|element:geometry|color:0xf5f5f5&style=feature:road|element:geometry|color:0xffffff&style=feature:water|element:geometry|color:0xc9e8fc&markers=color:0x172554|label:T|${storeCoords.latitude},${storeCoords.longitude}&markers=color:0x10b981|label:C|${selectedClient.addresses[selectedAddrIdx].latitude},${selectedClient.addresses[selectedAddrIdx].longitude}&path=color:0x10b981cc|weight:5|geodesic:true|${storeCoords.latitude},${storeCoords.longitude}|${selectedClient.addresses[selectedAddrIdx].latitude},${selectedClient.addresses[selectedAddrIdx].longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`}
                    alt="Ruta" className="w-full h-[180px] object-cover" />
                </div>
              </div>
            )}

            {/* Delivery cost info by type */}
            {deliveryType === "free" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex justify-between items-center">
                <span className="text-sm font-semibold text-emerald-800">Envío gratuito</span>
                <span className="font-bold text-emerald-600">Bs. 0</span>
              </div>
            )}
            {deliveryType === "fixed" && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex justify-between items-center">
                <span className="text-sm font-semibold">Costo fijo de envío</span>
                <span className="font-bold text-emerald-600">Bs. {(deliveryConfig?.value ?? 0).toFixed(2)}</span>
              </div>
            )}
            {deliveryType === "pending" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex justify-between items-center">
                <span className="text-sm font-semibold text-yellow-800">Costo por definir</span>
                <span className="font-bold text-yellow-600">Pendiente</span>
              </div>
            )}
            {deliveryType === "calculated" && deliveryDistance != null && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-semibold">Costo calculado</p>
                    <p className="text-xs text-muted-foreground">Base Bs. 5 + {deliveryDistance.toFixed(1)} km × Bs. 2</p>
                  </div>
                  <span className="text-lg font-bold text-emerald-600">Bs. {(parseFloat(deliveryData.deliveryCost) || 0).toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notas Adicionales (Opcional)</Label>
              <Input placeholder="Referencias, instrucciones..." value={deliveryData.notes}
                onChange={(e) => setDeliveryData(prev => ({ ...prev, notes: e.target.value }))} />
            </div>

            {/* Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>Bs. {total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery</span>
                <span>{deliveryType === "pending" ? "Por definir" : `Bs. ${(parseFloat(deliveryData.deliveryCost) || 0).toFixed(2)}`}</span>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total</span>
                <span className="text-xl font-bold text-emerald-600">
                  Bs. {(total + (parseFloat(deliveryData.deliveryCost) || 0)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeliveryModal(false)}>Cancelar</Button>
            <Button onClick={processDeliverySale} className="bg-emerald-600 hover:bg-emerald-700">Confirmar Pedido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
