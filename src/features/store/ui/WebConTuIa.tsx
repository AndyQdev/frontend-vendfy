import { useState } from "react";
import { Check, Copy, Globe, Link as LinkIcon, LogIn, MessageSquareText, Palette, PlugZap, Rocket, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/cn";

/**
 * "Tu propia web, hecha con tu IA": cómo conectar una IA (Claude, ChatGPT,
 * Cursor…) al MCP de Vendfy para que diseñe una web a medida de esta tienda.
 *
 * El MCP vive en ventas-service (`src/mcp`): es de solo lectura
 * (`storefront:read`), se entra con la cuenta de Vendfy (OAuth) y le da a la
 * IA una guía para que la web lea productos, precios y stock EN VIVO y mande
 * los pedidos a Vendfy. Esta sección solo explica los pasos: no hay nada que
 * configurar de este lado.
 */

const MCP_URL = import.meta.env.VITE_MCP_URL ?? "https://api.vendfy.shop/mcp";

type Herramienta = "claude" | "chatgpt" | "claude-code" | "cursor" | "antigravity";

const HERRAMIENTAS: { id: Herramienta; nombre: string }[] = [
  { id: "claude", nombre: "Claude" },
  { id: "chatgpt", nombre: "ChatGPT" },
  { id: "claude-code", nombre: "Claude Code" },
  { id: "cursor", nombre: "Cursor" },
  { id: "antigravity", nombre: "Antigravity" },
];

export function WebConTuIa({
  nombreTienda,
  url,
  onUrlChange,
}: {
  nombreTienda: string;
  /** La web propia ya publicada, si la hay. */
  url?: string;
  onUrlChange: (url: string) => void;
}) {
  const [herramienta, setHerramienta] = useState<Herramienta>("claude");

  // El pedido es corto a propósito: la IA ya trae instrucciones para preguntar
  // lo que falte (color, logo, frase de inicio) y para elegir la tecnología.
  // Un prompt largo compite con esa guía en vez de ayudar.
  const pedido = `Usando el conector de Vendfy, creá la web de mi tienda "${nombreTienda}".`;

  return (
    <Card className="space-y-6 p-6">
      <header className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Globe className="size-5" />
        </span>
        <div>
          <h3 className="text-lg font-semibold">¿Querés una web con tu propio diseño? Hacela con tu IA</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            El “Tema de Vendfy” sirve para empezar rápido. Si querés una web única, conectá tu propia IA a Vendfy y pedile
            el diseño que imagines. Ella usa tus productos, precios, stock, envíos y reseñas de verdad, y los pedidos
            que entren por esa web llegan a <strong className="text-foreground">Pedidos</strong> como siempre.
          </p>
        </div>
      </header>

      {/* Mientras mejor cargada esté la tienda, menos tiene que preguntar la IA
          y mejor sale la web. Esto evita el ida y vuelta. */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
        <Palette className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold">Antes de empezar, cargá tu marca</p>
          <p className="text-muted-foreground">
            Mientras más completa esté tu tienda, mejor sale la web y menos preguntas te hace la IA. Lo que más
            importa: tu <strong className="text-foreground">color</strong>, tu{" "}
            <strong className="text-foreground">logo</strong> y las{" "}
            <strong className="text-foreground">fotos de los productos</strong>. Lo que falte lo resuelve igual, pero
            con algo provisional que vas a querer cambiar después.
          </p>
        </div>
      </div>

      <WebPublicada url={url} onUrlChange={onUrlChange} />

      <ol className="space-y-5">
        {/* 1 */}
        <Paso numero={1} icono={PlugZap} titulo="Copiá la dirección del conector de Vendfy">
          <Copiable valor={MCP_URL} etiqueta="Dirección del conector" />
        </Paso>

        {/* 2 */}
        <Paso numero={2} icono={MessageSquareText} titulo="Agregala a tu IA">
          <div role="tablist" className="mb-3 flex flex-wrap gap-1.5">
            {HERRAMIENTAS.map((h) => (
              <button
                key={h.id}
                type="button"
                role="tab"
                aria-selected={herramienta === h.id}
                onClick={() => setHerramienta(h.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                  herramienta === h.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {h.nombre}
              </button>
            ))}
          </div>
          <InstruccionesDe herramienta={herramienta} />
        </Paso>

        {/* 3 */}
        <Paso numero={3} icono={LogIn} titulo="Entrá con tu cuenta de Vendfy">
          <p className="text-sm text-muted-foreground">
            La primera vez, tu IA abre una ventana de Vendfy. Entrá con el mismo correo y contraseña de este panel y
            tocá <strong className="text-foreground">Conectar</strong>. Si tenés varias tiendas, la IA te va a
            preguntar para cuál es la web.
          </p>
        </Paso>

        {/* 4 */}
        <Paso numero={4} icono={MessageSquareText} titulo="Pedile la web">
          <p className="mb-2 text-sm text-muted-foreground">
            Con esta frase alcanza. No hace falta que expliques el diseño: la IA te va a preguntar lo que necesite.
          </p>
          <Copiable valor={pedido} etiqueta="Pedido para tu IA" multilinea />
          <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p className="font-semibold">Trabaja en tres pasos y te pide permiso dos veces</p>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground marker:text-foreground">
              <li>
                <strong className="text-foreground">Te pregunta.</strong> Tu color, tu logo, qué frase querés al
                entrar. Si no tenés algo, te propone una alternativa; nunca se lo inventa.
              </li>
              <li>
                <strong className="text-foreground">Te muestra el plan.</strong> Qué pantallas va a hacer y cómo se
                va a ver, antes de escribir nada.
              </li>
              <li>
                <strong className="text-foreground">La construye</strong> y revisa una lista de control antes de
                decirte que terminó.
              </li>
            </ol>
            <p className="text-muted-foreground">
              Si se pone a programar sin preguntarte nada, pedile que use primero la herramienta{" "}
              <code className="rounded bg-muted px-1">describe_storefront_flow</code> del conector.
            </p>
          </div>
        </Paso>

        {/* 5 */}
        <Paso numero={5} icono={Rocket} titulo="Publicala">
          <p className="text-sm text-muted-foreground">
            Cuando te guste, pedile a tu IA que te ayude a publicarla (por ejemplo en Vercel o Netlify, que tienen plan
            gratis) o subila a tu propio dominio. Como la web lee todo de Vendfy, cuando cambies un precio o se
            acabe un producto, la web se actualiza sola.
          </p>
        </Paso>
      </ol>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold">Tu IA solo puede mirar, no cambiar nada</p>
          <p className="text-muted-foreground">
            El conector es de solo lectura: ve el catálogo, los precios, el stock, las categorías, las reseñas y la
            configuración de envío de tus tiendas. No puede modificar productos ni ver tus clientes, ventas o caja.
            Los pedidos de la web entran como <em>pendientes</em> para que los confirmes vos.
          </p>
        </div>
      </div>
    </Card>
  );
}

function InstruccionesDe({ herramienta }: { herramienta: Herramienta }) {
  switch (herramienta) {
    case "claude":
      return (
        <Pasos
          items={[
            <>En claude.ai, entrá a <strong>Configuración → Conectores</strong>.</>,
            <>Tocá <strong>Agregar conector personalizado</strong>, ponele de nombre “Vendfy” y pegá la dirección del paso 1.</>,
            <>Tocá <strong>Conectar</strong>. En un chat nuevo, activá el conector Vendfy desde el menú de herramientas.</>,
          ]}
        />
      );
    case "chatgpt":
      return (
        <Pasos
          items={[
            <>En ChatGPT, entrá a <strong>Configuración → Aplicaciones y conectores</strong> y activá el <strong>modo desarrollador</strong> (en opciones avanzadas).</>,
            <>Creá un conector nuevo: nombre “Vendfy”, pegá la dirección del paso 1 y elegí autenticación <strong>OAuth</strong>.</>,
            <>En un chat nuevo, elegí el conector Vendfy desde el botón <strong>+</strong>. Necesita un plan que incluya conectores personalizados.</>,
          ]}
        />
      );
    case "claude-code":
      return (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            En la terminal (con <code className="rounded bg-muted px-1">--scope user</code> queda disponible en
            todas tus carpetas):
          </p>
          <Copiable valor={`claude mcp add --transport http --scope user vendfy ${MCP_URL}`} etiqueta="Comando" codigo />
          <Pasos
            items={[
              <>Abrí <code className="rounded bg-muted px-1">claude</code> en la carpeta donde va a vivir tu web.</>,
              <>Escribí <code className="rounded bg-muted px-1">/mcp</code>, elegí <strong>vendfy</strong> y tocá <strong>Authenticate</strong>.</>,
              <>Se abre el navegador: entrá con tu cuenta de Vendfy y tocá <strong>Conectar</strong>. Al volver, “vendfy” aparece como conectado.</>,
            ]}
          />
        </div>
      );
    case "antigravity":
      return (
        <div className="space-y-2">
          <Pasos
            items={[
              <>En Antigravity, abrí el panel del agente y tocá el menú <strong>⋯ → MCP Servers</strong>.</>,
              <>Entrá a <strong>Manage MCP Servers → View raw config</strong>: se abre el archivo <code className="rounded bg-muted px-1">mcp_config.json</code>.</>,
              <>Agregá esto (si ya tenés otros servidores, sumá solo el bloque <code className="rounded bg-muted px-1">"vendfy"</code> dentro de <code className="rounded bg-muted px-1">mcpServers</code>), guardá y tocá <strong>Refresh</strong>:</>,
            ]}
          />
          <Copiable
            valor={JSON.stringify({ mcpServers: { vendfy: { serverUrl: MCP_URL } } }, null, 2)}
            etiqueta="Configuración MCP de Antigravity"
            codigo
            multilinea
          />
          <p className="text-sm text-muted-foreground">
            Al usarlo por primera vez te pide entrar con tu cuenta de Vendfy. Después pedíselo al agente en el chat,
            como en el paso 4.
          </p>
        </div>
      );
    case "cursor":
      return (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            En Cursor, entrá a <strong>Settings → MCP → Add new MCP server</strong> y pegá esto (queda en{" "}
            <code className="rounded bg-muted px-1">.cursor/mcp.json</code>):
          </p>
          <Copiable
            valor={JSON.stringify({ mcpServers: { vendfy: { url: MCP_URL } } }, null, 2)}
            etiqueta="Configuración MCP"
            codigo
            multilinea
          />
          <p className="text-sm text-muted-foreground">Al usarlo por primera vez te pide entrar con tu cuenta de Vendfy.</p>
        </div>
      );
  }
}

function Paso({
  numero,
  icono: Icono,
  titulo,
  children,
}: {
  numero: number;
  icono: typeof Globe;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {numero}
      </span>
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <p className="flex items-center gap-2 font-semibold">
          <Icono className="size-4 text-muted-foreground" />
          {titulo}
        </p>
        {children}
      </div>
    </li>
  );
}

function Pasos({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-foreground [&_strong]:text-foreground">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ol>
  );
}

function Copiable({
  valor,
  etiqueta,
  codigo = false,
  multilinea = false,
}: {
  valor: string;
  etiqueta: string;
  codigo?: boolean;
  multilinea?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      toast.success("Copiado");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("No se pudo copiar. Seleccioná el texto y copialo a mano.");
    }
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-2 pl-3">
      <p
        aria-label={etiqueta}
        className={cn(
          "min-w-0 flex-1 py-1.5 text-sm",
          codigo && "font-mono text-[13px]",
          multilinea ? "whitespace-pre-wrap break-words" : "truncate",
        )}
      >
        {valor}
      </p>
      <button
        type="button"
        onClick={copiar}
        aria-label={`Copiar ${etiqueta.toLowerCase()}`}
        className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {copiado ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}

/**
 * Enganchar la web ya publicada.
 *
 * Sin esto, el boton del globo del encabezado seguia llevando a
 * `compras.vendfy.shop/{slug}`: una tienda que existe pero que el comerciante
 * ya no muestra. Pegando aca su direccion, ese boton pasa a abrir la suya.
 *
 * Lo carga a mano a proposito. El MCP es de solo lectura y ademas no
 * despliega -la IA genera el codigo y el dueno lo sube donde quiere-, asi que
 * el servidor no tiene forma de enterarse de esta direccion.
 *
 * La de Vendfy no se apaga: sigue accesible desde el menu del perfil, y es
 * donde viven el Modo Live y el seguimiento de pedidos.
 */
function WebPublicada({
  url,
  onUrlChange,
}: {
  url?: string;
  onUrlChange: (url: string) => void;
}) {
  const valor = url ?? "";
  // Un error silencioso aca deja el boton del encabezado apuntando a la nada.
  const invalida = valor.trim().length > 0 && !/^https?:\/\/\S+$/i.test(valor.trim());

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex items-start gap-3">
        <LinkIcon className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">¿Ya publicaste tu web?</p>
          <p className="text-sm text-muted-foreground">
            Pegá su dirección y el botón de “tienda online” del encabezado va a abrir la tuya en vez de la de Vendfy.
            Dejalo vacío si todavía no la tenés.
          </p>
        </div>
      </div>

      <Input
        value={valor}
        onChange={(e) => onUrlChange(e.target.value)}
        placeholder="https://mitienda.com"
        inputMode="url"
        aria-label="Dirección de tu web"
        aria-invalid={invalida}
      />

      {invalida ? (
        <p className="text-xs text-destructive">
          Tiene que empezar con <code className="rounded bg-muted px-1">https://</code>.
        </p>
      ) : (
        valor.trim().length > 0 && (
          <a
            href={valor.trim()}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-xs text-primary underline underline-offset-2"
          >
            Abrir para comprobar
          </a>
        )
      )}
    </div>
  );
}
