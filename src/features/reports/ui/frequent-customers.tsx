import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";

interface FrequentCustomersProps {
  data: Array<{
    id: string;
    name: string;
    email: string;
    totalOrders: number;
    totalSpent: number;
  }>;
}

export function FrequentCustomers({ data }: FrequentCustomersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Clientes Frecuentes</CardTitle>
        <CardDescription>Top clientes por número de compras</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((customer, index) => (
            <div
              key={customer.id}
              className="flex items-center gap-4"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  {index + 1}
                </div>
                <Avatar className="h-9 w-9">
                  <AvatarFallback>
                    {customer.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {customer.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {customer.email}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{customer.totalOrders} pedidos</p>
                <p className="text-sm text-muted-foreground">
                  Bs. {customer.totalSpent.toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
