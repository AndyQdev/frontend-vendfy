import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Los filtros de una lista, guardados en la dirección.
 *
 * El problema que resuelve: buscás "inebriante", entrás a editar el producto,
 * volvés, y el buscador está vacío. Hay que escribirlo de nuevo.
 *
 * La solución no es recordar la última búsqueda en algún lado, es que la
 * búsqueda SEA la dirección. `/products?q=inebriante` es un lugar al que se
 * puede volver: el botón de atrás del navegador lo restaura solo, recargar la
 * página no pierde nada, y ese link se le puede pasar a un compañero y ve lo
 * mismo. Es como funcionan las listas de cualquier panel serio, y por eso no
 * hace falta guardar nada en el navegador: el estado ya está escrito arriba.
 *
 *   const { filtros, borrador, setFiltro, limpiar, hayFiltros } = useFiltrosUrl(
 *     { q: "", categoria: "all", pagina: 1, tam: 10 },
 *     { diferidas: ["q"], reiniciar: "pagina", ignorar: ["tam"] },
 *   );
 *
 * `borrador` es lo que muestran los campos y cambia con cada tecla; `filtros`
 * es lo que se le pide al backend y espera a que la persona deje de escribir.
 * Los valores que están en su valor por defecto no se escriben, así que la
 * dirección queda corta y legible en vez de arrastrar `?q=&categoria=all`.
 */

type ValorFiltro = string | number | boolean;

/**
 * `{ conStock: false }` haría que TypeScript dedujera el tipo `false` -no
 * `boolean`- y entonces no se podría poner en true. Esto lo ensancha al tipo
 * general, que es lo que se quiso decir al escribir el valor por defecto.
 */
type Ampliar<V> = V extends boolean
  ? boolean
  : V extends number
    ? number
    : V extends string
      ? string
      : V;

type Ampliado<T> = { [K in keyof T]: Ampliar<T[K]> };

type Opciones<T> = {
  /** Claves que llegan a la dirección con retraso: el buscador. */
  diferidas?: (keyof T & string)[];
  /** Cuánto se espera antes de escribir una clave diferida. */
  retraso?: number;
  /** Al tocar cualquier otro filtro, esta clave vuelve a su valor por defecto. */
  reiniciar?: keyof T & string;
  /** Claves que no cuentan como "filtro activo" (paginación, tamaño de página). */
  ignorar?: (keyof T & string)[];
};

const aTexto = (valor: ValorFiltro): string =>
  typeof valor === "boolean" ? (valor ? "1" : "0") : String(valor);

/** El tipo se deduce del valor por defecto: la dirección solo tiene texto. */
function desdeTexto<V extends ValorFiltro>(texto: string, porDefecto: V): V {
  if (typeof porDefecto === "number") {
    const numero = Number(texto);
    return (Number.isFinite(numero) ? numero : porDefecto) as V;
  }
  if (typeof porDefecto === "boolean") {
    return (texto === "1" || texto === "true") as V;
  }
  return texto as V;
}

export function useFiltrosUrl<T extends Record<string, ValorFiltro>>(
  valoresPorDefecto: T,
  opciones: Opciones<T> = {},
) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Los valores por defecto se congelan en el primer render: son la definición
  // de la lista, no algo que cambie mientras se la mira.
  const porDefecto = useRef(valoresPorDefecto).current;
  const claves = useMemo(
    () => Object.keys(porDefecto) as (keyof T & string)[],
    [porDefecto],
  );

  const { diferidas = [], retraso = 400, reiniciar, ignorar = [] } = opciones;
  const opcionesRef = useRef({ diferidas, retraso, reiniciar });
  opcionesRef.current = { diferidas, retraso, reiniciar };

  /** Lo que dice la dirección ahora mismo. */
  const filtros = useMemo(() => {
    const leidos = {} as Ampliado<T>;
    for (const clave of claves) {
      const crudo = searchParams.get(clave);
      leidos[clave] = (
        crudo === null ? porDefecto[clave] : desdeTexto(crudo, porDefecto[clave])
      ) as Ampliado<T>[typeof clave];
    }
    return leidos;
  }, [searchParams, claves, porDefecto]);

  /** Lo que muestran los campos; para las claves diferidas va por delante. */
  const [borrador, setBorrador] = useState<Ampliado<T>>(filtros);

  const temporizadores = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  /** Lo último que escribimos nosotros, para no pisarnos al volver de la URL. */
  const ultimoEmpuje = useRef<Partial<Ampliado<T>>>({});

  // Al terminar, ningún temporizador tiene que escribir en una pantalla que ya
  // no está.
  useEffect(() => {
    const pendientes = temporizadores.current;
    return () => Object.values(pendientes).forEach(clearTimeout);
  }, []);

  /**
   * Si la dirección cambió por fuera -atrás, adelante, un link pegado- los
   * campos la siguen. Una clave diferida se saltea cuando el valor que llegó es
   * justo el que nosotros acabamos de escribir: ahí el borrador ya está más
   * adelante y sincronizarlo haría saltar el cursor hacia atrás mientras la
   * persona todavía escribe.
   */
  useEffect(() => {
    setBorrador((actual) => {
      let cambio = false;
      const siguiente = { ...actual };
      for (const clave of claves) {
        const esDiferida = opcionesRef.current.diferidas.includes(clave);
        if (esDiferida && ultimoEmpuje.current[clave] === filtros[clave]) continue;
        if (siguiente[clave] !== filtros[clave]) {
          siguiente[clave] = filtros[clave];
          cambio = true;
        }
      }
      return cambio ? siguiente : actual;
    });
  }, [filtros, claves]);

  /** Escribe una clave en la dirección; borra la que esté en su valor normal. */
  const escribir = useCallback(
    <K extends keyof T & string>(clave: K, valor: Ampliado<T>[K]) => {
      ultimoEmpuje.current[clave] = valor;
      setSearchParams(
        (anteriores) => {
          const siguientes = new URLSearchParams(anteriores);
          const poner = (k: string, v: ValorFiltro) => {
            if (v === porDefecto[k]) siguientes.delete(k);
            else siguientes.set(k, aTexto(v));
          };
          poner(clave, valor);
          // Cambiar un filtro devuelve a la primera página: los resultados son
          // otros y la página 4 de la búsqueda anterior no significa nada.
          const aReiniciar = opcionesRef.current.reiniciar;
          if (aReiniciar && clave !== aReiniciar) {
            poner(aReiniciar, porDefecto[aReiniciar]);
          }
          return siguientes;
        },
        // Siempre `replace`: cada tecla del buscador no es un lugar al que
        // volver. Atrás tiene que salir de la lista, no deshacer letra por
        // letra lo que se escribió.
        { replace: true },
      );
    },
    [setSearchParams, porDefecto],
  );

  const setFiltro = useCallback(
    <K extends keyof T & string>(clave: K, valor: Ampliado<T>[K]) => {
      setBorrador((actual) => ({ ...actual, [clave]: valor }));

      if (opcionesRef.current.diferidas.includes(clave)) {
        clearTimeout(temporizadores.current[clave]);
        temporizadores.current[clave] = setTimeout(
          () => escribir(clave, valor),
          opcionesRef.current.retraso,
        );
      } else {
        escribir(clave, valor);
      }
    },
    [escribir],
  );

  /** Deja la lista como recién abierta, sin tocar parámetros ajenos. */
  const limpiar = useCallback(() => {
    Object.values(temporizadores.current).forEach(clearTimeout);
    temporizadores.current = {};
    ultimoEmpuje.current = {};
    setBorrador(porDefecto as Ampliado<T>);
    setSearchParams(
      (anteriores) => {
        const siguientes = new URLSearchParams(anteriores);
        claves.forEach((clave) => siguientes.delete(clave));
        return siguientes;
      },
      { replace: true },
    );
  }, [setSearchParams, claves, porDefecto]);

  /** Si hay algo que limpiar. La página y el tamaño no son filtros. */
  const hayFiltros = useMemo(() => {
    const noCuentan = new Set<string>([...(reiniciar ? [reiniciar] : []), ...ignorar]);
    return claves.some(
      (clave) => !noCuentan.has(clave) && borrador[clave] !== porDefecto[clave],
    );
    // `borrador` y no `filtros`: el botón de limpiar tiene que aparecer apenas
    // se escribe, sin esperar a que la búsqueda llegue a la dirección.
  }, [borrador, claves, porDefecto, reiniciar, ignorar]);

  return { filtros, borrador, setFiltro, limpiar, hayFiltros };
}
