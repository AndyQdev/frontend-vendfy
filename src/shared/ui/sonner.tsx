import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Avisos: tarjeta blanca con borde, como todo lo demás. Los de estado usan
 * el fondo suave de su color, nunca el pleno.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-xl group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:bg-card group-[.toaster]:font-sans group-[.toaster]:text-[13px] group-[.toaster]:text-foreground group-[.toaster]:shadow-float",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:rounded-md group-[.toast]:bg-primary group-[.toast]:font-semibold group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:rounded-md group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error:
            "group-[.toaster]:!border-destructive/20 group-[.toaster]:!bg-destructive-soft group-[.toaster]:!text-destructive-soft-foreground",
          success:
            "group-[.toaster]:!border-success/20 group-[.toaster]:!bg-success-soft group-[.toaster]:!text-success-soft-foreground",
          warning:
            "group-[.toaster]:!border-warning/30 group-[.toaster]:!bg-warning-soft group-[.toaster]:!text-warning-soft-foreground",
          info: "group-[.toaster]:!border-primary/20 group-[.toaster]:!bg-primary-soft group-[.toaster]:!text-primary-soft-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
