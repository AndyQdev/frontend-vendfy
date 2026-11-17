import { useEffect, useRef, useState } from "react";

import { avisarManosLibres } from "@/shared/nativo";

import { Oido, type EstadoOido } from "../oido/oido";

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
  const oido = useRef<Oido | null>(null);
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
      oido.current = new Oido({
        palabra: () => actual.current.alOirPalabra(),
        comando: (wav) => void actual.current.oirConPalabra(wav),
        estado: (e) => setEstado(e),
      });
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
