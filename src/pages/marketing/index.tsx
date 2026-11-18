import { useSearchParams } from "react-router-dom";
import { Megaphone } from "lucide-react";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { useStore } from "@/app/providers/auth";
import { useAcceso } from "@/app/providers/acceso";
import { PERMISO } from "@/shared/acceso/permisos";
import { ResumenMarketing } from "@/features/marketing/ui/ResumenMarketing";
import { IdeasMarketing } from "@/features/marketing/ui/IdeasMarketing";
import { CampanasLista } from "@/features/marketing/ui/CampanasLista";
import { TableroChats } from "@/features/marketing/ui/TableroChats";

const PESTANAS = ["resumen", "ideas", "campanas", "chats"] as const;
type Pestana = (typeof PESTANAS)[number];

/**
 * Marketing: del dato a la venta, en un solo lugar. Las ideas salen de los
 * datos de la tienda, las campañas se crean en Meta en pausa y se activan con
 * un toque, y el tablero junta a quienes escribieron hasta que compran.
 */
export default function MarketingPage() {
  const { selectedStore } = useStore();
  const tienda = selectedStore && selectedStore !== "all" ? selectedStore : null;
  const acceso = useAcceso();
  const puedeGestionar = acceso.puede(PERMISO.GESTIONAR_MARKETING);
  const puedeChats = acceso.puede(PERMISO.GESTIONAR_WHATSAPP);
  const [params, setParams] = useSearchParams();
  const tab = (PESTANAS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Pestana) : "resumen";
  const irA = (t: Pestana) => {
    params.set("tab", t);
    setParams(params, { replace: true });
  };

  if (!tienda) {
    return (
      <div className="space-y-6">
        <PageHeader title="Marketing" description="Ideas de campaña, anuncios en Meta y el tablero de los chats." />
        <EmptyState
          icon={Megaphone}
          title="Elige una tienda"
          description="Las campañas y los chats son de cada tienda. Elige una arriba, en el selector de tienda."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Marketing" description="Del dato a la venta: qué anunciar, cuánto invertir y quién compró." />
      <Tabs value={tab} onValueChange={(v) => irA(v as Pestana)}>
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="ideas">Ideas</TabsTrigger>
          <TabsTrigger value="campanas">Campañas</TabsTrigger>
          <TabsTrigger value="chats">Chats</TabsTrigger>
        </TabsList>
        <TabsContent value="resumen" className="mt-4">
          <ResumenMarketing storeId={tienda.id} dias={30} onIrA={irA} />
        </TabsContent>
        <TabsContent value="ideas" className="mt-4">
          <IdeasMarketing storeId={tienda.id} puedeGestionar={puedeGestionar} />
        </TabsContent>
        <TabsContent value="campanas" className="mt-4">
          <CampanasLista storeId={tienda.id} puedeGestionar={puedeGestionar} onIrAIdeas={() => irA("ideas")} />
        </TabsContent>
        <TabsContent value="chats" className="mt-4">
          <TableroChats storeId={tienda.id} puedeGestionar={puedeChats} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
