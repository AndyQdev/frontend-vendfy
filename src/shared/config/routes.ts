export const routes = {
  // Auth
  login: "/login",
  register: "/register",
  
  // Main views (orden por frecuencia de uso según doc)
  caja: "/caja",
  orders: "/orders",
  sales: "/sales",
  products: "/products",
  inventory: "/inventory",
  customers: "/customers",
  reports: "/reports",
} as const;
