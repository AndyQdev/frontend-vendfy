import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { useIsMobile } from "@/shared/hooks/use-mobile";

/**
 * Un diálogo que cambia de forma según la pantalla.
 *
 * En escritorio es el modal centrado de siempre. En teléfono se convierte en
 * una hoja que sube desde abajo, que es como se comportan los diálogos
 * nativos: aparece donde está el pulgar, aprovecha todo el ancho y se cierra
 * con el mismo gesto con el que se abrió. Un modal centrado en un teléfono
 * desperdicia los márgenes y deja los botones en el medio de la pantalla.
 *
 * Las dos variantes son el MISMO primitivo de Radix -Sheet y Dialog de shadcn
 * salen los dos de `@radix-ui/react-dialog`-, así que el foco, el `Esc`, el
 * bloqueo del scroll de fondo y la semántica de accesibilidad son idénticos.
 * Solo cambian la posición y la animación.
 *
 * Estructura obligatoria, y es lo que evita que el contenido se salga de la
 * pantalla: el encabezado y el pie quedan fijos y SOLO el cuerpo scrollea.
 *
 *   <ResponsiveDialog open={x} onOpenChange={setX}>
 *     <ResponsiveDialogContent className="sm:max-w-[460px]">
 *       <ResponsiveDialogHeader>
 *         <ResponsiveDialogTitle>…</ResponsiveDialogTitle>
 *         <ResponsiveDialogDescription>…</ResponsiveDialogDescription>
 *       </ResponsiveDialogHeader>
 *       <ResponsiveDialogBody>…</ResponsiveDialogBody>
 *       <ResponsiveDialogFooter>…</ResponsiveDialogFooter>
 *     </ResponsiveDialogContent>
 *   </ResponsiveDialog>
 */
const MobileContext = React.createContext(false);

/**
 * El valor se calcula UNA vez en la raíz y se reparte por contexto. Si cada
 * subcomponente llamara a `useIsMobile` por su cuenta, durante un cambio de
 * tamaño podrían quedar en desacuerdo y el encabezado se dibujaría con el
 * estilo de hoja mientras el cuerpo todavía cree que es un modal.
 */
const ResponsiveDialog = ({
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>) => {
  const isMobile = useIsMobile();
  return (
    <DialogPrimitive.Root {...props}>
      <MobileContext.Provider value={isMobile}>
        {children}
      </MobileContext.Provider>
    </DialogPrimitive.Root>
  );
};
ResponsiveDialog.displayName = "ResponsiveDialog";

const ResponsiveDialogTrigger = DialogPrimitive.Trigger;
const ResponsiveDialogClose = DialogPrimitive.Close;

const ResponsiveDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
      "data-[state=open]:animate-in data-[state=open]:fade-in-0",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
      className,
    )}
    {...props}
  />
));
ResponsiveDialogOverlay.displayName = "ResponsiveDialogOverlay";

const ResponsiveDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const isMobile = React.useContext(MobileContext);

  return (
    <DialogPrimitive.Portal>
      <ResponsiveDialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "glass-modal fixed z-50 flex flex-col overflow-hidden",
          isMobile
            ? [
                // Hoja anclada abajo. Sube deslizándose y baja igual.
                "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[28px] border-t",
                "duration-300 ease-out",
                "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom",
                "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
              ]
            : [
                // Modal centrado clásico, con el alto acotado a la pantalla.
                "left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
                "max-h-[calc(100dvh-2rem)] rounded-[26px] border",
                "duration-200",
                "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
              ],
          className,
        )}
        {...props}
      >
        {/* Agarradera: la señal visual de que esto es una hoja que se baja. */}
        {isMobile && (
          <div
            aria-hidden
            className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25"
          />
        )}

        {children}

        {/* En la hoja la X sobra: el gesto natural es tocar afuera o bajarla. */}
        {!isMobile && (
          <DialogPrimitive.Close
            className={cn(
              "absolute right-4 top-4 rounded-sm opacity-70 transition-opacity",
              "hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "disabled:pointer-events-none",
            )}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Cerrar</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
ResponsiveDialogContent.displayName = "ResponsiveDialogContent";

/** Queda fijo arriba; nunca scrollea. */
const ResponsiveDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex shrink-0 flex-col space-y-1.5 px-6 pb-4 pt-6 text-left",
      className,
    )}
    {...props}
  />
);
ResponsiveDialogHeader.displayName = "ResponsiveDialogHeader";

/**
 * Lo único que scrollea. `min-h-0` es imprescindible: sin él un hijo de flex
 * se niega a encogerse por debajo de su contenido y el scroll nunca aparece
 * -el cuerpo empuja al pie fuera de la pantalla, que es justo lo que se
 * quiere evitar.
 */
const ResponsiveDialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-1",
      className,
    )}
    {...props}
  />
);
ResponsiveDialogBody.displayName = "ResponsiveDialogBody";

/**
 * Queda fijo abajo, siempre alcanzable.
 *
 * En teléfono los botones van a lo ancho y en columna invertida: la acción
 * principal queda arriba, más cerca del pulgar, y "Cancelar" debajo.
 * `safe-area-inset-bottom` deja libre la barra de gestos del iPhone.
 */
const ResponsiveDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex shrink-0 flex-col-reverse gap-2 border-t border-border/60 px-6 pt-4",
      "pb-[max(1.5rem,env(safe-area-inset-bottom))]",
      // md y no sm: tiene que coincidir con el corte de `useIsMobile` (768px),
      // o entre 640 y 767 la hoja dibuja los botones como si fuera escritorio.
      "md:flex-row md:justify-end md:pb-6",
      "[&>button]:w-full md:[&>button]:w-auto",
      className,
    )}
    {...props}
  />
);
ResponsiveDialogFooter.displayName = "ResponsiveDialogFooter";

const ResponsiveDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
ResponsiveDialogTitle.displayName = "ResponsiveDialogTitle";

const ResponsiveDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
ResponsiveDialogDescription.displayName = "ResponsiveDialogDescription";

export {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogClose,
  ResponsiveDialogOverlay,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
};
