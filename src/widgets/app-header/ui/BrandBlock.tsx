import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Check, ChevronsUpDown, Plus, Store as StoreIcon } from "lucide-react";

import { useStore } from "@/app/providers/auth";
import { useStores } from "@/entities/store/api";
import { useAcceso } from "@/app/providers/acceso";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { VendfyMark } from "@/shared/ui/VendfyLogo";
import { cn } from "@/shared/lib/cn";

/**
 * BLOQUE DE MARCA — la burbuja azul marino de la izquierda.
 *
 * Dice dos cosas: que esto es Vendfy, y en qué tienda se está trabajando. Por
 * eso es también el selector de tienda: tocarlo despliega la lista. Es donde
 * el ojo busca "¿dónde estoy?", así que es donde se cambia.
 *
 * Debajo cuelga el festón del toldo, el único adorno propio de la marca.
 */
export function BrandBlock({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { selectedStore, setSelectedStore } = useStore();
  const { data: stores = [], isLoading } = useStores();
  // Un empleado ve solo sus sucursales: no abre tiendas nuevas y, si trabaja
  // en algunas y no en todas, tampoco ve "todas" juntas.
  const { acceso, esDueno } = useAcceso();
  const verTodas = stores.length > 1 && !acceso?.sucursalesLimitadas;

  // Selección automática (heredada del selector del sidebar):
  //  1. Sin tienda elegida y con tiendas → la primera.
  //  2. Una sola tienda y "todas" elegido → esa. "Todas" con una no tiene sentido.
  React.useEffect(() => {
    if (stores.length === 0) return;
    if (!selectedStore) {
      setSelectedStore(stores[0]);
      return;
    }
    if (selectedStore === "all" && !verTodas) setSelectedStore(stores[0]);
  }, [stores, selectedStore, setSelectedStore, verTodas]);

  const current =
    selectedStore && selectedStore !== "all" ? stores.find((s) => s.id === selectedStore.id) : undefined;

  const subtitle = isLoading
    ? "Cargando…"
    : selectedStore === "all"
      ? "Todas las tiendas"
      : current
        ? [current.name, current.config?.contact?.city].filter(Boolean).join(" · ")
        : selectedStore
          ? selectedStore.name
          : "Sin tienda";

  const sinTiendas = !isLoading && stores.length === 0;

  const cuerpo = (
    <>
      <VendfyMark size={30} className="flex-none" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="font-display text-[15px] font-bold tracking-[-0.02em] text-tinta-foreground">
          Vendfy
        </span>
        <span className="truncate text-[9.5px] font-bold uppercase tracking-[0.12em] text-tinta-muted">
          {sinTiendas ? (esDueno ? "Crea tu tienda" : "Sin sucursal asignada") : subtitle}
        </span>
      </span>
    </>
  );

  const clasesBloque = cn(
    "relative flex h-12 min-w-0 items-center gap-2.5 rounded-2xl bg-tinta pl-3 pr-3 text-left lg:h-[var(--alto-burbuja)] lg:min-w-[190px] lg:pl-3.5 lg:pr-3",
    "shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_20px_-12px_rgba(15,23,42,0.45)]",
    "transition-colors duration-150 hover:bg-tinta/95",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    className
  );

  const feston = <span aria-hidden className="feston pointer-events-none absolute inset-x-4 top-full" />;

  if (sinTiendas && !esDueno) {
    return <div className={clasesBloque}>{cuerpo}{feston}</div>;
  }

  if (sinTiendas) {
    return (
      <button type="button" onClick={() => navigate("/stores/new")} className={clasesBloque}>
        {cuerpo}
        <Plus className="ml-auto size-4 flex-none text-tinta-muted" />
        {feston}
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={clasesBloque} aria-label="Cambiar de tienda">
        {cuerpo}
        <ChevronsUpDown className="ml-auto size-3.5 flex-none text-tinta-muted" />
        {feston}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={10} className="w-64">
        <DropdownMenuLabel>{esDueno ? "Mis tiendas" : "Mis sucursales"}</DropdownMenuLabel>

        {verTodas ? (
          <>
            <StoreOption
              icon={Building2}
              name="Todas las tiendas"
              detail="Ver todo junto"
              selected={selectedStore === "all"}
              onSelect={() => setSelectedStore("all")}
            />
            <DropdownMenuSeparator />
          </>
        ) : null}

        {stores.map((store) => (
          <StoreOption
            key={store.id}
            icon={StoreIcon}
            name={store.name}
            detail={`@${store.slug}`}
            selected={selectedStore !== "all" && selectedStore?.id === store.id}
            onSelect={() => setSelectedStore(store)}
          />
        ))}

        {esDueno ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate("/stores/new")}>
              <Plus />
              Agregar tienda
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StoreOption({
  icon: Icon,
  name,
  detail,
  selected,
  onSelect,
}: {
  icon: typeof StoreIcon;
  name: string;
  detail: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className={cn(selected && "font-semibold text-foreground")}>
      <span className="grid size-8 flex-none place-items-center rounded-md bg-muted">
        <Icon />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate">{name}</span>
        <span className="truncate text-[11px] font-normal text-muted-foreground">{detail}</span>
      </span>
      {selected ? <Check className="!text-primary" /> : null}
    </DropdownMenuItem>
  );
}
