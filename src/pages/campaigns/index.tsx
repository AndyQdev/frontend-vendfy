import { Megaphone } from "lucide-react";
import { Card } from "@/shared/ui/card";

/**
 * Campañas — placeholder.
 * El módulo de campañas se construirá después del chat de WhatsApp.
 */
export default function CampaignsPage() {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <Card className="flex max-w-md flex-col items-center gap-4 p-10 text-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl text-white"
          style={{ background: "var(--primary-grad)" }}
        >
          <Megaphone className="h-7 w-7" />
        </div>
        <div>
          <h1 className="titulo-pagina">Campañas</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pronto podrás crear y enviar campañas de WhatsApp a tus clientes.
            Estamos trabajando en ello.
          </p>
        </div>
      </Card>
    </div>
  );
}
