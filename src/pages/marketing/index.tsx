import { useState } from "react";
import { Megaphone, Plus } from "lucide-react";
import { EmptyState } from "@/shared/ui/empty-state";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { useStore } from "@/app/providers/auth";
import { useAcceso } from "@/app/providers/acceso";
import { PERMISO } from "@/shared/acceso/permisos";
import { useCampanas } from "@/entities/marketing/api";
import { WhatsAppConfigModal, type ConfigTab } from "@/features/whatsapp/config/ui/WhatsAppConfigModal";
import { ChipsConexion, OnboardingModulo, PanelConexiones, useRegresosDeConexion } from "@/features/marketing/ui/Conexiones";
import { ComoFunciona } from "@/features/marketing/ui/ComoFunciona";
import { NuevaCampana } from "@/features/marketing/ui/NuevaCampana";
import { ProbarAgente } from "@/features/marketing/ui/ProbarAgente";
import { TarjetaCampana, TarjetaDirecto, TarjetaNueva } from "@/features/marketing/ui/TarjetasCampana";

/**
 * Marketing: campañas, sus chats de WhatsApp y lo que vendieron, en un solo
 * lugar. Todo gira alrededor de las campañas: se elige una y se ve su tablero
 * de chats y si valió la pena. Los chats que no vinieron por un anuncio viven
 * en «WhatsApp directo», con el mismo tablero.
 */
export default function MarketingPage() {
  const { selectedStore } = useStore();
  const tienda = selectedStore && selectedStore !== "all" ? selectedStore : null;
  const acceso = useAcceso();
  const conAnuncios = acceso.tiene("anuncios_meta");
  const conWhatsapp = acceso.tiene("whatsapp");
  const puedeGestionar = acceso.puede(PERMISO.GESTIONAR_MARKETING);

  const [config, setConfig] = useState<ConfigTab | null>(null);
  const [conexiones, setConexiones] = useState(false);
  const [nueva, setNueva] = useState(false);
  const [probar, setProbar] = useState(false);

  useRegresosDeConexion({ storeId: tienda?.id, onConfigWhatsapp: setConfig, onConexiones: () => setConexiones(true) });
  const { data: campanas = [], isLoading } = useCampanas(conAnuncios ? tienda?.id : undefined);

  if (!tienda) {
    return (
      <div className="space-y-6">
        <Encabezado />
        <EmptyState icon={Megaphone} title="Elige una tienda" description="Las campañas y los chats son de cada tienda. Elige una arriba, en el selector de tienda." />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Encabezado>
        <ChipsConexion storeId={tienda.id} onAbrir={() => setConexiones(true)} />
        {conAnuncios && puedeGestionar && (
          <Button onClick={() => setNueva(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Nueva campaña
          </Button>
        )}
      </Encabezado>

      <OnboardingModulo
        storeId={tienda.id}
        hayCampanas={campanas.length > 0}
        onConfigWhatsapp={setConfig}
        onConexiones={() => setConexiones(true)}
        onNuevaCampana={() => setNueva(true)}
      />

      <ComoFunciona />

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">{conAnuncios ? "Tus campañas" : "Tus chats"}</h2>
          {conAnuncios && campanas.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {campanas.filter((c) => c.estado === "activa").length} activas · {campanas.length} en total
            </span>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {conAnuncios && puedeGestionar && <TarjetaNueva onClick={() => setNueva(true)} />}
          {conWhatsapp && <TarjetaDirecto storeId={tienda.id} />}
          {isLoading
            ? [0, 1].map((i) => <Skeleton key={i} className="h-[18rem] rounded-2xl" />)
            : campanas.map((c) => <TarjetaCampana key={c.id} c={c} />)}
        </div>
        {conAnuncios && !isLoading && campanas.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Todavía no hay campañas. Toca <b>Nueva campaña</b>: Vendfy te propone qué anunciar con tus datos, cuánto invertir y qué esperar.
          </p>
        )}
      </section>

      <PanelConexiones
        storeId={tienda.id}
        open={conexiones}
        onOpenChange={setConexiones}
        onConfigWhatsapp={(t) => {
          setConexiones(false);
          setConfig(t);
        }}
        onProbarAgente={() => {
          setConexiones(false);
          setProbar(true);
        }}
      />
      <WhatsAppConfigModal open={!!config} onOpenChange={(o) => !o && setConfig(null)} storeId={tienda.id} initialTab={config ?? "connection"} />
      {conAnuncios && <NuevaCampana storeId={tienda.id} open={nueva} onOpenChange={setNueva} puedeGestionar={puedeGestionar} />}
      <ProbarAgente
        storeId={tienda.id}
        open={probar}
        onOpenChange={setProbar}
        onConfigurarAgente={() => {
          setProbar(false);
          setConfig("agent");
        }}
      />
    </div>
  );
}

function Encabezado({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ background: "var(--primary-grad)" }}>
          <Megaphone className="h-6 w-6" />
        </span>
        <div>
          <h1 className="titulo-pagina">Marketing</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Tus campañas, sus chats de WhatsApp y lo que vendieron, en un solo lugar.</p>
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}
