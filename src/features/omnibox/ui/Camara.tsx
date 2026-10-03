import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, Upload } from "lucide-react";

import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogBody as DialogBody,
} from "@/shared/ui/responsive-dialog";

import { BotonCta, BotonSecundario } from "./piezas";

/**
 * Sacar la foto con la cámara de la compu.
 *
 * En el teléfono no hace falta: el `<input capture>` abre la cámara del
 * sistema, que enfoca y dispara mejor que cualquier cosa que se arme acá. En
 * la compu ese atributo se ignora y abriría el explorador de archivos, que no
 * es "tomar foto". Por eso acá se abre la cámara web en vivo.
 *
 * Si no hay cámara o se niega el permiso, se ofrece subir un archivo: nunca
 * queda un botón que no hace nada.
 */
export function CamaraDialog({
  abierta,
  onCerrar,
  onFoto,
  onSubirArchivo,
}: {
  abierta: boolean;
  onCerrar: () => void;
  onFoto: (archivo: File) => void;
  onSubirArchivo: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const flujo = useRef<MediaStream | null>(null);
  const [estado, setEstado] = useState<"abriendo" | "lista" | "sin-camara">("abriendo");
  const [foto, setFoto] = useState<{ url: string; archivo: File } | null>(null);

  useEffect(() => {
    if (!abierta) return;
    let cancelado = false;
    setEstado("abriendo");
    setFoto(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setEstado("sin-camara");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        // La de atrás si la hay (una tablet); la resolución más alta que dé,
        // que una factura tiene letra chica.
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      .then((s) => {
        if (cancelado) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        flujo.current = s;
        if (video.current) video.current.srcObject = s;
        setEstado("lista");
      })
      .catch(() => !cancelado && setEstado("sin-camara"));

    return () => {
      cancelado = true;
      flujo.current?.getTracks().forEach((t) => t.stop());
      flujo.current = null;
    };
  }, [abierta]);

  // La vista previa es un object URL: se libera al cambiarla o al cerrar.
  useEffect(() => () => {
    if (foto) URL.revokeObjectURL(foto.url);
  }, [foto]);

  function disparar() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const lienzo = document.createElement("canvas");
    lienzo.width = v.videoWidth;
    lienzo.height = v.videoHeight;
    lienzo.getContext("2d")!.drawImage(v, 0, 0);
    lienzo.toBlob(
      (blob) => {
        if (!blob) return;
        const archivo = new File([blob], `factura-${Date.now()}.jpg`, { type: "image/jpeg" });
        setFoto({ url: URL.createObjectURL(blob), archivo });
      },
      "image/jpeg",
      0.9,
    );
  }

  return (
    <Dialog open={abierta} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-w-2xl bg-card">
        <DialogHeader>
          <DialogTitle>Foto de la factura</DialogTitle>
          <DialogDescription>
            Que se vea entera y derecha, con buena luz. Los números tienen que poder leerse.
          </DialogDescription>
        </DialogHeader>

      <DialogBody>
        <div className="relative grid aspect-video place-items-center overflow-hidden rounded-lg border border-border bg-muted">
          {estado === "sin-camara" ? (
            <p className="max-w-xs p-6 text-center text-sm text-muted-foreground">
              No encontré una cámara, o el navegador no dio permiso para usarla.
            </p>
          ) : (
            <>
              <video
                ref={video}
                autoPlay
                playsInline
                muted
                aria-label="Vista de la cámara"
                className={foto ? "hidden" : "h-full w-full object-contain"}
              />
              {foto && <img src={foto.url} alt="Foto sacada" className="h-full w-full object-contain" />}
              {estado === "abriendo" && <Loader2 className="absolute size-6 animate-spin text-muted-foreground" />}
            </>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {estado === "sin-camara" ? (
            <BotonCta
              onClick={() => {
                onCerrar();
                onSubirArchivo();
              }}
            >
              <Upload className="size-4" />
              Subir una foto o PDF
            </BotonCta>
          ) : foto ? (
            <>
              <BotonSecundario onClick={() => setFoto(null)}>
                <RotateCcw className="size-4" />
                Sacar otra
              </BotonSecundario>
              <BotonCta
                data-testid="omnibox-usar-foto"
                onClick={() => {
                  onFoto(foto.archivo);
                  onCerrar();
                }}
              >
                Leer esta factura
              </BotonCta>
            </>
          ) : (
            <BotonCta data-testid="omnibox-disparar" onClick={disparar} disabled={estado !== "lista"}>
              <Camera className="size-4" />
              Sacar foto
            </BotonCta>
          )}
        </div>

      </DialogBody>

      </DialogContent>
    </Dialog>
  );
}
