import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { formatMoney } from "@/shared/lib/money";
import type { DashboardChannel } from "../model/use-dashboard-data";

export function ChannelsCompact({ channels }: { channels: DashboardChannel[] }) {
  const active = channels.filter((channel) => channel.sales > 0);
  const total = active.reduce((sum, channel) => sum + channel.sales, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">De dónde llegan las ventas</CardTitle>
      </CardHeader>
      <CardContent>
        {active.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Todavía no hay ventas en este período.
          </p>
        ) : (
          <ul className="space-y-3">
            {active.map((channel) => {
              const share = total > 0 ? (channel.sales / total) * 100 : 0;
              return (
                <li key={channel.key} className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: channel.color }}
                    />
                    <span className="min-w-0 flex-1 truncate">{channel.label}</span>
                    <span className="font-semibold">{formatMoney(channel.sales)}</span>
                  </div>
                  <div className="glass-track h-1.5 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${share}%`, backgroundColor: channel.color }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {share.toFixed(0)}% · {channel.count}{" "}
                    {channel.count === 1 ? "venta" : "ventas"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
