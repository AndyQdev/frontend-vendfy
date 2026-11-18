/**
 * Estadísticas a Excel (H4): una hoja por sección, con lo mismo que muestra la
 * pantalla para el período y la tienda elegidos.
 */
import type { HojaExcel } from "@/shared/lib/exportar-excel";
import type {
  FinancialComparisonItem,
  FrequentCustomerItem,
  KPIData,
  OrderChannelItem,
  OrderStatusItem,
  SalesByCategoryItem,
  SalesByDayAndHour,
  SalesOverTimeItem,
  TopProductItem,
} from "./types";

export interface DatosDeReportes {
  periodo: string;
  tienda: string;
  kpis?: KPIData;
  ventasEnElTiempo?: SalesOverTimeItem[];
  pedidosPorEstado?: OrderStatusItem[];
  canales?: OrderChannelItem[];
  financiero?: FinancialComparisonItem[];
  topProductos?: TopProductItem[];
  porCategoria?: SalesByCategoryItem[];
  clientesFrecuentes?: FrequentCustomerItem[];
  porDia?: SalesByDayAndHour;
}

export function hojasDeReportes(d: DatosDeReportes): HojaExcel[] {
  const hojas: HojaExcel[] = [];

  const k = d.kpis;
  hojas.push({
    nombre: "Indicadores",
    columnas: [
      { titulo: "Indicador", tipo: "texto", ancho: 28 },
      { titulo: "Valor", tipo: "numero", ancho: 16 },
      { titulo: "Detalle", tipo: "texto", ancho: 36 },
    ],
    filas: [
      ["Período", d.periodo, ""],
      ["Tienda", d.tienda, ""],
      ...(k
        ? ([
            ["Ingresos (Bs)", k.totalSales, `${k.totalOrders} pedidos completados`],
            ["Invertido (Bs)", k.totalCompras, "Total gastado en compras"],
            ["Ganancia neta (Bs)", k.gananciaReal, "Ingresos - costo de lo vendido"],
            ["Margen (%)", Math.round(k.margen * 10) / 10, "Rentabilidad sobre ventas"],
            ["Pedidos", k.totalOrders, "Órdenes en este período"],
          ] as HojaExcel["filas"])
        : []),
    ],
  });

  hojas.push({
    nombre: "Ventas en el tiempo",
    columnas: [
      { titulo: "Fecha", tipo: "texto", ancho: 16 },
      { titulo: "Ventas (Bs)", tipo: "dinero", ancho: 14 },
      { titulo: "Período anterior (Bs)", tipo: "dinero", ancho: 20 },
    ],
    filas: (d.ventasEnElTiempo ?? []).map((r) => [r.date, r.sales, r.previousPeriod]),
  });

  hojas.push({
    nombre: "Pedidos por estado",
    columnas: [
      { titulo: "Estado", tipo: "texto", ancho: 20 },
      { titulo: "Pedidos", tipo: "numero", ancho: 12 },
    ],
    filas: (d.pedidosPorEstado ?? []).map((r) => [r.status, r.count]),
  });

  hojas.push({
    nombre: "Canal de pedidos",
    columnas: [
      { titulo: "Canal", tipo: "texto", ancho: 20 },
      { titulo: "Pedidos", tipo: "numero", ancho: 12 },
      { titulo: "Ventas (Bs)", tipo: "dinero", ancho: 14 },
    ],
    filas: (d.canales ?? []).map((r) => [r.channel, r.count, r.sales]),
  });

  hojas.push({
    nombre: "Ventas vs compras",
    columnas: [
      { titulo: "Fecha", tipo: "texto", ancho: 16 },
      { titulo: "Ventas (Bs)", tipo: "dinero", ancho: 14 },
      { titulo: "Compras (Bs)", tipo: "dinero", ancho: 14 },
      { titulo: "Ganancia (Bs)", tipo: "dinero", ancho: 14 },
    ],
    filas: (d.financiero ?? []).map((r) => [r.date, r.ventas, r.compras, r.ganancia]),
  });

  hojas.push({
    nombre: "Productos más vendidos",
    columnas: [
      { titulo: "Producto", tipo: "texto", ancho: 36 },
      { titulo: "Cantidad", tipo: "numero", ancho: 12 },
      { titulo: "Ingresos (Bs)", tipo: "dinero", ancho: 14 },
    ],
    filas: (d.topProductos ?? []).map((r) => [r.name, r.quantity, r.revenue]),
  });

  hojas.push({
    nombre: "Ventas por categoría",
    columnas: [
      { titulo: "Categoría", tipo: "texto", ancho: 28 },
      { titulo: "Ventas (Bs)", tipo: "dinero", ancho: 14 },
    ],
    filas: (d.porCategoria ?? []).map((r) => [r.category, r.sales]),
  });

  hojas.push({
    nombre: "Clientes frecuentes",
    columnas: [
      { titulo: "Cliente", tipo: "texto", ancho: 28 },
      { titulo: "Correo", tipo: "texto", ancho: 28 },
      { titulo: "Pedidos", tipo: "numero", ancho: 10 },
      { titulo: "Total gastado (Bs)", tipo: "dinero", ancho: 18 },
    ],
    filas: (d.clientesFrecuentes ?? []).map((r) => [r.name, r.email ?? "", r.totalOrders, r.totalSpent]),
  });

  hojas.push({
    nombre: "Días con más ventas",
    columnas: [
      { titulo: "Día", tipo: "texto", ancho: 16 },
      { titulo: "Ventas (Bs)", tipo: "dinero", ancho: 14 },
    ],
    filas: (d.porDia?.salesByDay ?? []).map((r) => [r.day, r.sales]),
  });

  if (d.porDia?.salesByHour?.length) {
    hojas.push({
      nombre: "Ventas por hora",
      columnas: [
        { titulo: "Hora", tipo: "texto", ancho: 10 },
        { titulo: "Ventas (Bs)", tipo: "dinero", ancho: 14 },
        { titulo: "Pedidos", tipo: "numero", ancho: 10 },
      ],
      filas: d.porDia.salesByHour.map((r) => [r.hour, r.sales, r.orders]),
    });
  }

  return hojas;
}
