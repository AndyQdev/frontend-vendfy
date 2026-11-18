import { useEffect, useRef, useState } from "react";

import { avisarManosLibres, oidoNativo } from "@/shared/nativo";

import { Oido, type ControlOido, type EstadoOido, type EventosOido } from "../oido/oido";
import { OidoTelefono } from "../oido/oido-telefono";

/**
 * Manos libres: el oído escucha "Oye Vendfy" mientras Vendfy está abierto.
 *
 * Es una preferencia del equipo (no de la cuenta): la caja la deja prendida
 * todo el turno; un celular personal, quizá no. Nada sale del equipo hasta que
 * se oye la palabra.
 */
const CLAVE = "vendfy.manosLibres";

function leer(): boolean {
  try {
    return localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

function guardar(valor: boolean) {
  try {
    if (valor) localStorage.setItem(CLAVE, "1");
    else localStorage.removeItem(CLAVE);
  } catch {
    // dura la sesión
  }
}

export interface ConductorConOido {
  alOirPalabra: () => void;
  oirConPalabra: (wav: Blob) => void | Promise<void>;
}

export function useManosLibres(conductor: ConductorConOido) {
  const [activo, setActivo] = useState(leer);
  const [estado, setEstado] = useState<EstadoOido>("apagado");
  const oido = useRef<ControlOido | null>(null);
  const actual = useRef(conductor);
  actual.current = conductor;

  useEffect(() => {
    // La app de Android prende su servicio de micrófono (con su notificación) a la par.
    avisarManosLibres(activo);
    if (!activo) {
      oido.current?.apagar();
      return;
    }
    if (!oido.current) {
      const eventos: EventosOido = {
        palabra: () => actual.current.alOirPalabra(),
        comando: (wav) => void actual.current.oirConPalabra(wav),
        estado: (e) => setEstado(e),
        // El «Apagar» de la notificación del teléfono apaga también la preferencia.
        apagadoAfuera: () => {
          guardar(false);
          setActivo(false);
        },
      };
      // En la app de Android escucha el teléfono (sigue con la pantalla apagada).
      oido.current = oidoNativo() ? new OidoTelefono(eventos) : new Oido(eventos);
    }
    void oido.current.encender();
    return () => oido.current?.apagar();
  }, [activo]);

  useEffect(() => () => oido.current?.destruir(), []);

  const alternar = () => {
    const valor = !activo;
    guardar(valor);
    setActivo(valor);
  };

  return { activo, estado, alternar };
}
