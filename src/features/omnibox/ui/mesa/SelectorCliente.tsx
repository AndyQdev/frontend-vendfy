import { useEffect, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Loader2, Search, User, UserPlus } from "lucide-react";

import { useClientes } from "@/entities/omnibox/api";
import type { ClienteOpcion } from "@/entities/omnibox/model/types";
import { useCreateCustomer } from "@/entities/customer";
import { cn } from "@/shared/lib/cn";

import { BotonCta, BotonSecundario } from "../piezas";

/**
 * A quién se le vende.
 *
 * Por defecto "Consumidor final": obligar a elegir un cliente para vender un
 * chicle es la fricción que el asistente viene a sacar.
 *
 * Al buscar, muestra VARIOS con su teléfono y cuántas veces compraron: con dos
 * "José" en la agenda, elegir es de la persona, no del sistema. Y cuando los
 * primeros se parecen igual de mucho, lo dice.
 */
export function SelectorCliente({
  storeId,
  clienteId,
  nombre,
  onElegir,
}: {
  storeId: string;
  clienteId: string | null;
  nombre: string;
  onElegir: (id: string | null, nombre: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [consulta, setConsulta] = useState("");
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setConsulta(texto.trim()), 250);
    return () => clearTimeout(t);
  }, [texto]);

  const { data: opciones = [], isFetching } = useClientes(storeId, consulta, abierto);
  const ambiguo = empate(opciones);

  const elegir = (id: string | null, n: string) => {
    onElegir(id, n);
    setAbierto(false);
    setTexto("");
    setCreando(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="omnibox-cliente"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
        className="flex h-11 w-full items-center gap-2 rounded-lg border border-border bg-card px-3 text-left text-sm transition-colors hover:border-border-strong"
      >
        <User className="size-4 shrink-0 text-muted-foreground" />
        <span className={cn("min-w-0 flex-1 truncate", clienteId ? "font-semibold" : "text-muted-foreground")}>
          {nombre}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", abierto && "rotate-180")} />
      </button>

      {abierto && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-full min-w-[18rem] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {creando ? (
            <NuevoCliente
              nombreInicial={texto}
              onCreado={(id, n) => elegir(id, n)}
              onVolver={() => setCreando(false)}
            />
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-border px-3">
                <Search className="size-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Nombre o teléfono…"
                  aria-label="Buscar cliente"
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                {isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              </div>

              {ambiguo && (
                <p className="flex items-center gap-1.5 bg-warning-soft px-3 py-1.5 text-xs font-medium text-warning-soft-foreground">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  Hay {ambiguo} parecidos: fijate el teléfono.
                </p>
              )}

              <ul className="max-h-64 overflow-y-auto py-1">
                <Opcion activa={!clienteId} onClick={() => elegir(null, "Consumidor final")}>
                  <span className="font-medium">Consumidor final</span>
                  <span className="text-xs text-muted-foreground">sin datos</span>
                </Opcion>
                {opciones.map((c) => (
                  <Opcion key={c.id} activa={c.id === clienteId} onClick={() => elegir(c.id, c.nombre)}>
                    <span className="truncate font-medium capitalize">{c.nombre.toLowerCase()}</span>
                    <span className="cifra shrink-0 text-xs text-muted-foreground">
                      {c.telefono} · {c.compras} {c.compras === 1 ? "compra" : "compras"}
                    </span>
                  </Opcion>
                ))}
                {consulta && !isFetching && opciones.length === 0 && (
                  <li className="px-3 py-2 text-xs text-muted-foreground">Nadie se llama así.</li>
                )}
              </ul>

              <button
                type="button"
                onClick={() => setCreando(true)}
                className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-sm font-medium text-primary hover:bg-muted"
              >
                <UserPlus className="size-4" />
                Nuevo cliente{texto.trim() && ` “${texto.trim()}”`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Cuántos de los primeros se parecen igual de mucho. Con "andrés" y dos
 * Andrés en la agenda, el sistema no elige: avisa.
 */
function empate(opciones: ClienteOpcion[]): number | null {
  if (opciones.length < 2 || opciones[0].similitud < 0.6) return null;
  const tope = opciones[0].similitud;
  const cerca = opciones.filter((o) => tope - o.similitud < 0.15).length;
  return cerca >= 2 ? cerca : null;
}

function Opcion({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={activa}
        onClick={onClick}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
      >
        <span className="flex min-w-0 flex-1 items-center justify-between gap-3">{children}</span>
        {activa && <Check className="size-4 shrink-0 text-primary" />}
      </button>
    </li>
  );
}

/** Alta rápida: nombre y teléfono. El resto se completa en Clientes. */
export function NuevoCliente({
  nombreInicial,
  onCreado,
  onVolver,
  sinVolver = false,
}: {
  nombreInicial: string;
  onCreado: (id: string, nombre: string) => void;
  onVolver: () => void;
  /** Sin opciones a las que volver (no existe nadie con ese nombre). */
  sinVolver?: boolean;
}) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);
  const crear = useCreateCustomer();

  const valido = nombre.trim().length >= 2 && telefono.replace(/\D/g, "").length >= 7;

  return (
    <form
      className="space-y-3 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valido) return;
        setError(null);
        try {
          const c = await crear.mutateAsync({ name: nombre.trim(), phone: telefono.replace(/\D/g, "") });
          onCreado(c!.id, c!.name);
        } catch (err: any) {
          setError(err?.message ?? "No se pudo crear el cliente");
        }
      }}
    >
      <p className="text-sm font-semibold">Nuevo cliente</p>
      <input
        autoFocus
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre"
        aria-label="Nombre del cliente"
        className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
      />
      <input
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        placeholder="Teléfono (WhatsApp)"
        inputMode="tel"
        aria-label="Teléfono del cliente"
        className="cifra h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
      />
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      <div className={cn("grid gap-2", sinVolver ? "grid-cols-1" : "grid-cols-2")}>
        {!sinVolver && (
          <BotonSecundario type="button" onClick={onVolver}>
            Volver
          </BotonSecundario>
        )}
        <BotonCta type="submit" disabled={!valido || crear.isPending}>
          {crear.isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          Crear
        </BotonCta>
      </div>
    </form>
  );
}
