import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Table } from "@/shared/ui/table";
import { Badge } from "@/shared/ui/badge";

interface LowStockTableProps {
  data: Array<{
    id: string;
    name: string;
    currentStock: number;
    minStock: number;
    category: string;
  }>;
}

export function LowStockTable({ data }: LowStockTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock Bajo</CardTitle>
        <CardDescription>Productos que requieren reposición</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between border-b pb-3 last:border-0"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">
                  {product.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {product.category}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="font-mono">
                  {product.currentStock}/{product.minStock}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
