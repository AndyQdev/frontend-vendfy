import { KPICards } from "./kpi-cards";
import { SalesChart } from "./sales-chart";
import { OrderChannelsChart } from "./order-channels-chart";
import { OrdersStatusChart } from "./orders-status-chart";
import { TopProductsChart } from "./top-products-chart";
import { SalesByCategoryChart } from "./sales-by-category-chart";
import { LowStockTable } from "./low-stock-table";
import { FrequentCustomers } from "./frequent-customers";
import { SalesByDay } from "./sales-by-day";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { useState } from "react";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Mock Data
const mockKPIData = {
  totalSales: 45750,
  totalOrders: 128,
  averageTicket: 357,
  lowStockProducts: 8,
  pendingOrders: 12,
};

const mockSalesData = [
  { date: "Lun", sales: 4200, previousPeriod: 3800 },
  { date: "Mar", sales: 3800, previousPeriod: 4100 },
  { date: "Mié", sales: 5100, previousPeriod: 4500 },
  { date: "Jue", sales: 4700, previousPeriod: 4200 },
  { date: "Vie", sales: 6300, previousPeriod: 5800 },
  { date: "Sáb", sales: 7200, previousPeriod: 6500 },
  { date: "Dom", sales: 5400, previousPeriod: 4900 },
];

const mockOrdersStatusData = [
  { status: "Pendiente", count: 12, color: "#fbbf24" },
  { status: "En Proceso", count: 18, color: "#3b82f6" },
  { status: "En Camino", count: 25, color: "#8b5cf6" },
  { status: "Completado", count: 73, color: "#10b981" },
  { status: "Cancelado", count: 5, color: "#ef4444" },
];

const mockTopProductsData = [
  { name: "iPhone 15 Pro", quantity: 45, revenue: 135000 },
  { name: "MacBook Air M2", quantity: 32, revenue: 256000 },
  { name: "AirPods Pro", quantity: 78, revenue: 156000 },
  { name: "iPad Air", quantity: 28, revenue: 112000 },
  { name: "Apple Watch S9", quantity: 56, revenue: 224000 },
  { name: "Magic Keyboard", quantity: 34, revenue: 68000 },
  { name: "AirTag Pack", quantity: 89, revenue: 44500 },
  { name: "HomePod Mini", quantity: 23, revenue: 46000 },
  { name: "MagSafe Charger", quantity: 67, revenue: 33500 },
  { name: "USB-C Cable", quantity: 156, revenue: 31200 },
];

const mockCategoryData = [
  { category: "Electrónica", sales: 285000 },
  { category: "Ropa", sales: 145000 },
  { category: "Hogar", sales: 98000 },
  { category: "Deportes", sales: 67000 },
  { category: "Belleza", sales: 54000 },
  { category: "Juguetes", sales: 43000 },
];

const mockLowStockData = [
  { id: "3", name: "Perfume Chanel N°5", currentStock: 1, minStock: 8, category: "Belleza" },
  { id: "8", name: "Reloj Casio G-Shock", currentStock: 1, minStock: 6, category: "Accesorios" },
  { id: "1", name: "iPhone 15 Pro Max 256GB", currentStock: 2, minStock: 10, category: "Electrónica" },
  { id: "4", name: "Smart TV Samsung 55\"", currentStock: 2, minStock: 5, category: "Electrónica" },
  { id: "7", name: "Licuadora Oster Pro", currentStock: 2, minStock: 8, category: "Hogar" },
  { id: "2", name: "Zapatillas Nike Air Max", currentStock: 3, minStock: 15, category: "Deportes" },
  { id: "6", name: "Auriculares Sony WH-1000XM5", currentStock: 3, minStock: 10, category: "Electrónica" },
];

const mockFrequentCustomersData = [
  { id: "1", name: "María González", email: "maria@email.com", totalOrders: 23, totalSpent: 45600 },
  { id: "2", name: "Juan Pérez", email: "juan@email.com", totalOrders: 19, totalSpent: 38200 },
  { id: "3", name: "Ana Rodríguez", email: "ana@email.com", totalOrders: 17, totalSpent: 34100 },
  { id: "4", name: "Carlos López", email: "carlos@email.com", totalOrders: 15, totalSpent: 29800 },
  { id: "5", name: "Laura Martínez", email: "laura@email.com", totalOrders: 14, totalSpent: 28400 },
];

const mockSalesByDayData = [
  { day: "Lunes", sales: 4200 },
  { day: "Martes", sales: 3800 },
  { day: "Miércoles", sales: 5100 },
  { day: "Jueves", sales: 4700 },
  { day: "Viernes", sales: 6300 },
  { day: "Sábado", sales: 7200 },
  { day: "Domingo", sales: 5400 },
];

const mockOrderChannelsData = [
  { channel: "Sistema", count: 68, color: "#3b82f6" },
  { channel: "Web", count: 42, color: "#10b981" },
  { channel: "App", count: 18, color: "#f59e0b" },
];

export function Reports() {
  const [period, setPeriod] = useState("7days");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [customDateOpen, setCustomDateOpen] = useState(false);

  const periods = [
    { value: "today", label: "Hoy" },
    { value: "7days", label: "7 días" },
    { value: "30days", label: "30 días" },
    { value: "thisMonth", label: "Este mes" },
    { value: "custom", label: "Personalizado" },
  ];

  const handlePeriodClick = (value: string) => {
    setPeriod(value);
    if (value !== "custom") {
      setCustomDateOpen(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header con Filtros */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold">Dashboard de Reportes</h1>
        <div className="flex gap-2 flex-wrap items-center">
          {periods.map((p) => (
            p.value === "custom" ? (
              <Popover key={p.value} open={customDateOpen} onOpenChange={setCustomDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={period === p.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePeriodClick(p.value)}
                  >
                    {dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, "dd MMM", { locale: es })} - ${format(dateRange.to, "dd MMM", { locale: es })}`
                      : p.label}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    disabled={(date) =>
                      date > new Date() || date < new Date("2020-01-01")
                    }
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <Button
                key={p.value}
                variant={period === p.value ? "default" : "outline"}
                size="sm"
                onClick={() => handlePeriodClick(p.value)}
              >
                {p.label}
              </Button>
            )
          ))}
        </div>
      </div>
      
      {/* Bloque 1: KPIs Principales */}
      <KPICards data={mockKPIData} />

      {/* Bloque 2: Gráficas de Ventas */}
      <div className="grid gap-6 md:grid-cols-2">
        <SalesChart data={mockSalesData} />
        <SalesByCategoryChart data={mockCategoryData} />
      </div>

      {/* Bloque 3: Análisis de Pedidos */}
      <div className="grid gap-6 md:grid-cols-2">
        <OrdersStatusChart data={mockOrdersStatusData} />
        <OrderChannelsChart data={mockOrderChannelsData} />
      </div>

      {/* Bloque 4: Productos e Inventario */}
      <div className="grid gap-6 md:grid-cols-2">
        <TopProductsChart data={mockTopProductsData} />
        <LowStockTable data={mockLowStockData} />
      </div>

      {/* Bloque 5: Información Estratégica */}
      <div className="grid gap-6 md:grid-cols-2">
        <FrequentCustomers data={mockFrequentCustomersData} />
        <SalesByDay data={mockSalesByDayData} />
      </div>
    </div>
  );
}
