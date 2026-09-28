import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { formatMoney } from "@/shared/lib/money";
import type { TopProductItem } from "@/features/reports/model/types";

export function TopProductsCompact({ products }: { products: TopProductItem[] }) {
  const top = products.slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Más vendidos hoy</CardTitle>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Todavía no hay productos vendidos hoy.
          </p>
        ) : (
          <ol className="space-y-3">
            {top.map((product, index) => (
              <li key={`${product.name}-${index}`} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.quantity} {product.quantity === 1 ? "unidad" : "unidades"}
                  </p>
                </div>
                <span className="text-sm font-semibold">{formatMoney(product.revenue)}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
