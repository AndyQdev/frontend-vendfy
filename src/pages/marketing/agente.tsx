import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bot, MessageCircle, Settings2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState } from "@/shared/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { useStore } from "@/app/providers/auth";
import { useConocimiento } from "@/entities/agente/api";
import { Preparacion } from "@/features/agente/ui/Preparacion";
import { FichaTienda } from "@/features/agente/ui/FichaTienda";
import { FichasProductos } from "@/features/agente/ui/FichasProductos";
import { Preguntas } from "@/features/agente/ui/Preguntas";
import { ProbarMiAgente } from "@/features/agente/ui/ProbarMiAgente";
import { ProbarAgente } from "@/features/marketing/ui/ProbarAgente";
import { WhatsAppConfigModal } from "@/features/whatsapp/config/ui/WhatsAppConfigModal";

type Pestana = "resumen" | "tienda" | "productos" | "preguntas" | "probar";

/** A qué pestaña lleva cada punto de la preparación. */
const DESTINO: Record<string, Pestana> = {
  ficha: "tienda",
  derivacion: "tienda",
  anunciados: "productos",
  catalogo: "productos",
  prueba: "probar",
  preguntas: "preguntas",
};

/**
 * Tu vendedor IA: lo que sabe de tu tienda, las fichas de tus productos, las
 * preguntas que no supo responder y la prueba antes de pautar. Es la misma
 * para cualquier tienda de Vendfy; lo de cada rubro (perfumería, moda…) lo
 * pone el paquete del rubro.
 */
export default function AgentePage() {
  const { selectedStore } = useStore();
  const tienda = selectedStore && selectedStore !== "all" ? selectedStore : null;
  const { data, isLoading } = useConocimiento(tienda?.id);
  const [pestana, setPestana] = useState<Pestana>("resumen");
  const [chat, setChat] = useState(false);
  const [config, setConfig] = useState(false);

  if (!tienda) {
    return <EmptyState icon={Bot} title="Elige una tienda" description="Cada tienda tiene su propio vendedor. Elígela arriba, en el selector de tienda." />;
  }

  const irA = (id: string) => {
    if (id === "encendido") return setConfig(true);
    if (id === "rubro") return;
    setPestana(DESTINO[id] ?? "resumen");
  };

  return (
    <div className="space-y-5">
      <Link to="/marketing" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Marketing
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ background: "var(--primary-grad)" }}>
            <Bot className="h-6 w-6" />
          </span>
          <div>
            <h1 className="titulo-pagina">Tu vendedor IA</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Atiende tu WhatsApp como tu mejor vendedor{data ? ` · rubro: ${data.paquete.nombre}` : ""}.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setChat(true)}>
            <MessageCircle className="mr-1.5 h-4 w-4" /> Chatear con él
          </Button>
          <Button variant="ghost" onClick={() => setConfig(true)}>
            <Settings2 className="mr-1.5 h-4 w-4" /> Modelo e instrucciones
          </Button>
        </div>
      </header>

      {isLoading || !data ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : (
        <Tabs value={pestana} onValueChange={(v) => setPestana(v as Pestana)}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="resumen" className="shrink-0 whitespace-nowrap">Resumen</TabsTrigger>
            <TabsTrigger value="tienda" className="shrink-0 whitespace-nowrap">Tu tienda</TabsTrigger>
            <TabsTrigger value="productos" className="shrink-0 whitespace-nowrap">Productos</TabsTrigger>
            <TabsTrigger value="preguntas" className="shrink-0 whitespace-nowrap">
              Preguntas{data.preguntasPendientes ? ` (${data.preguntasPendientes})` : ""}
            </TabsTrigger>
            <TabsTrigger value="probar" className="shrink-0 whitespace-nowrap">Probar</TabsTrigger>
          </TabsList>
          <TabsContent value="resumen" className="mt-4 space-y-4">
            <Preparacion items={data.preparacion} onIr={irA} />
            {!data.rubro && (
              <p className="text-sm text-muted-foreground">
                Tu tienda no tiene rubro. Elígelo en <Link to={`/stores/${tienda.id}`} className="underline">la configuración de la tienda</Link> para que tu vendedor use las preguntas de tu rubro.
              </p>
            )}
          </TabsContent>
          <TabsContent value="tienda" className="mt-4">
            <FichaTienda storeId={tienda.id} data={data} />
          </TabsContent>
          <TabsContent value="productos" className="mt-4">
            <FichasProductos storeId={tienda.id} data={data} />
          </TabsContent>
          <TabsContent value="preguntas" className="mt-4">
            <Preguntas storeId={tienda.id} />
          </TabsContent>
          <TabsContent value="probar" className="mt-4">
            <ProbarMiAgente storeId={tienda.id} />
          </TabsContent>
        </Tabs>
      )}

      <ProbarAgente
        storeId={tienda.id}
        open={chat}
        onOpenChange={setChat}
        onConfigurarAgente={() => {
          setChat(false);
          setConfig(true);
        }}
      />
      <WhatsAppConfigModal open={config} onOpenChange={setConfig} storeId={tienda.id} initialTab="agent" />
    </div>
  );
}
