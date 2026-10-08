import { useEffect, useRef, useState } from 'react'
import { Loader2, LocateFixed, MapPin, Maximize2, Minimize2, Search } from 'lucide-react'

// Declaración de tipos para Google Maps
declare global {
  interface Window {
    google: any
  }
}

interface LocationPickerProps {
  address: string
  onAddressChange: (address: string) => void
  coordinates: { lat: number; lng: number }
  onLocationChange: (location: { lat: number; lng: number }) => void
  theme?: 'classic' | 'modern' | 'elegante' | 'minimal' | 'darkmode' | 'creative' | 'interior'
}

const THEME_STYLES = {
  classic: {
    input: 'border-amber-200 focus:border-amber-500 focus:ring-amber-500',
    marker: 'text-amber-600',
  },
  modern: {
    input: 'border-slate-200 focus:border-blue-500 focus:ring-blue-500',
    marker: 'text-blue-600',
  },
  elegante: {
    input: 'border-rose-200 focus:border-rose-500 focus:ring-rose-500',
    marker: 'text-rose-600',
  },
  minimal: {
    input: 'border-gray-200 focus:border-gray-900 focus:ring-gray-900',
    marker: 'text-gray-900',
  },
  darkmode: {
    input: 'border-slate-700 bg-slate-800 text-white focus:border-emerald-500 focus:ring-emerald-500',
    marker: 'text-emerald-500',
  },
  creative: {
    input: 'border-purple-200 focus:border-purple-500 focus:ring-purple-500',
    marker: 'text-purple-600',
  },
  interior: {
    input: 'border-stone-200 focus:border-stone-500 focus:ring-stone-500',
    marker: 'text-stone-700',
  },
}

export function LocationPicker({
  address,
  onAddressChange,
  coordinates,
  onLocationChange,
  theme = 'classic',
}: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const autocompleteRef = useRef<any>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isMapLoaded, setIsMapLoaded] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false)
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null)
  // Pantalla completa real del navegador, o -donde no existe- el mapa agrandado
  // en su lugar. Son dos estados porque no son lo mismo: uno lo decide el
  // navegador (y se sale con Esc), el otro lo decidimos nosotros.
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const [ampliado, setAmpliado] = useState(false)
  const contenedorMapaRef = useRef<HTMLDivElement>(null)

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  const styles = THEME_STYLES[theme]

  // Cargar Google Maps Script
  useEffect(() => {
    if (!apiKey) {
      console.error('Google Maps API key no configurada. Agrega VITE_GOOGLE_MAPS_API_KEY a tu .env.local')
      return
    }

    if (window.google?.maps) {
      setIsMapLoaded(true)
      return
    }

    const existingScript = document.querySelector(
      'script[src*="maps.googleapis.com"]'
    )
    
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (window.google?.maps) {
          setIsMapLoaded(true)
        }
      })
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.google?.maps) {
        setIsMapLoaded(true)
      }
    }
    script.onerror = () => {
      console.error('Error cargando Google Maps. Verifica tu API key.')
    }
    document.head.appendChild(script)
  }, [apiKey])

  // Inicializar mapa cuando esté listo
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || mapInstanceRef.current || !window.google?.maps) {
      return
    }

    // Usar coordenadas si están disponibles, sino pedir ubicación del usuario
    const initialPosition = coordinates.lat !== 0 && coordinates.lng !== 0
      ? coordinates
      : { lat: -16.5, lng: -68.15 } // La Paz, Bolivia por defecto

    try {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: initialPosition,
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })

      markerRef.current = new window.google.maps.Marker({
        map: mapInstanceRef.current,
        position: initialPosition,
        draggable: true,
      })

      // Función para actualizar ubicación y obtener dirección
      const updateLocation = (location: { lat: number; lng: number }) => {
        onLocationChange(location)
        
        // Geocodificación inversa para obtener la dirección
        const geocoder = new window.google.maps.Geocoder()
        geocoder.geocode({ location }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            onAddressChange(results[0].formatted_address)
          }
        })
      }

      // Actualizar coordenadas cuando se arrastra el marcador
      markerRef.current.addListener('dragend', () => {
        const position = markerRef.current?.getPosition()
        if (position) {
          const newLocation = {
            lat: position.lat(),
            lng: position.lng(),
          }
          updateLocation(newLocation)
        }
      })

      // Permitir hacer click en el mapa para mover el marcador
      mapInstanceRef.current.addListener('click', (e: any) => {
        if (e.latLng) {
          const newLocation = {
            lat: e.latLng.lat(),
            lng: e.latLng.lng(),
          }
          markerRef.current?.setPosition(e.latLng)
          updateLocation(newLocation)
        }
      })

      // Si no hay coordenadas iniciales, intentar obtener ubicación del usuario
      if (coordinates.lat === 0 && coordinates.lng === 0) {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const userLoc = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              }
              setUserLocation(userLoc) // Guardar para usar en autocomplete
              mapInstanceRef.current?.setCenter(userLoc)
              markerRef.current?.setPosition(userLoc)
              onLocationChange(userLoc)
            },
            () => {
              console.log('Error: No se pudo obtener la ubicación')
              // Usar ubicación por defecto
              setUserLocation(initialPosition)
            }
          )
        } else {
          setUserLocation(initialPosition)
        }
      } else {
        setUserLocation(coordinates)
      }    } catch (error) {
      console.error('Error inicializando Google Maps:', error)    }
  }, [isMapLoaded, coordinates, onLocationChange, onAddressChange])

  // Inicializar Autocomplete con location bias
  useEffect(() => {
    if (!isMapLoaded || !inputRef.current || autocompleteRef.current || !window.google?.maps?.places || !userLocation) {
      return
    }

    try {
      // CLAVE: Crear un círculo de 50km alrededor de la ubicación del usuario
      const circle = new window.google.maps.Circle({
        center: userLocation,
        radius: 50000, // 50km en metros
      })

      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        // Sesgar resultados hacia la ubicación del usuario
        bounds: circle.getBounds(),
        strictBounds: false, // false = permite resultados fuera pero prioriza dentro
        // NO restringir por país para permitir búsquedas globales si el usuario lo necesita
      })

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace()
        if (place && place.geometry && place.geometry.location) {
          const newLocation = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          }
          
          onLocationChange(newLocation)
          onAddressChange(place.formatted_address || '')
          
          mapInstanceRef.current?.setCenter(newLocation)
          markerRef.current?.setPosition(newLocation)
        }
      })
    } catch (error) {
      console.error('Error inicializando Autocomplete:', error)
    }
  }, [isMapLoaded, userLocation, onAddressChange, onLocationChange])

  // El navegador avisa cuando se entra o se sale (Esc incluido), y puede ser
  // por algo que no pasó por nuestro botón.
  useEffect(() => {
    const alCambiar = () =>
      setPantallaCompleta(document.fullscreenElement === contenedorMapaRef.current)
    document.addEventListener('fullscreenchange', alCambiar)
    return () => document.removeEventListener('fullscreenchange', alCambiar)
  }, [])

  // El mapa no se entera solo de que su contenedor cambió de tamaño: sin esto
  // queda dibujado en el recuadro viejo, con el resto en gris.
  useEffect(() => {
    const mapa = mapInstanceRef.current
    if (!mapa || !window.google?.maps) return
    const t = setTimeout(
      () => window.google.maps.event.trigger(mapa, 'resize'),
      150
    )
    return () => clearTimeout(t)
  }, [pantallaCompleta, ampliado])

  /**
   * Pantalla completa del bloque del mapa.
   *
   * Se usa la API del navegador sobre el contenedor y no un `position: fixed`:
   * el mapa vive dentro de un diálogo o un cajón, que llevan `transform`, y un
   * elemento fijo dentro de un ancestro con transform se posiciona respecto de
   * ESE ancestro, no de la pantalla. Quedaría "completo" dentro del cajón.
   *
   * El iPhone no deja poner un div en pantalla completa; ahí el mapa se
   * agranda en su lugar, que alivia lo mismo (el recuadro chico) sin la API.
   */
  const alternarPantallaCompleta = async () => {
    const contenedor = contenedorMapaRef.current
    if (!contenedor) return

    if (pantallaCompleta) {
      try {
        await document.exitFullscreen()
      } catch {
        /* ya había salido */
      }
      return
    }
    if (ampliado) {
      setAmpliado(false)
      return
    }

    if (contenedor.requestFullscreen && document.fullscreenEnabled) {
      try {
        await contenedor.requestFullscreen()
        return
      } catch {
        /* el navegador lo rechazó: se cae al agrandado */
      }
    }
    setAmpliado(true)
  }

  /**
   * Ir a donde estoy ahora.
   *
   * La ubicación solo se pedía una vez, al abrir el mapa. Si en ese momento no
   * había permiso, fallaba y nadie volvía a preguntar: aunque se lo dieras
   * después, el mapa se quedaba donde estaba. Con el botón se pide cuando la
   * persona lo pide.
   *
   * A diferencia del centrado automático del arranque, acá sí se fija la
   * ubicación y la dirección: tocar el botón es decir "es acá".
   *
   * Se pide la ubicación APROXIMADA y no la de alta precisión. Con alta
   * precisión el navegador espera un GPS, y una PC no tiene: la consulta se
   * queda esperando un receptor que no existe. La aproximada sale del wifi o de
   * la IP en segundos y, para elegir una dirección, alcanza: el marcador se
   * arrastra.
   *
   * Un intento, y corto. Antes había un reintento con GPS que sumaba hasta 27
   * segundos de spinner; Google Maps, con el mismo permiso, se rinde en 5.
   */
  const irAMiUbicacion = () => {
    setErrorUbicacion(null)

    // Fuera de https y de localhost el navegador ni siquiera ofrece el permiso:
    // desde http://192.168.x.x el botón nunca puede funcionar, y callarlo haría
    // creer que es un fallo del mapa.
    if (!window.isSecureContext) {
      setErrorUbicacion(
        'El navegador solo da la ubicación en páginas seguras (https o localhost).'
      )
      return
    }
    if (!navigator.geolocation) {
      setErrorUbicacion('Este navegador no permite obtener la ubicación.')
      return
    }

    setBuscandoUbicacion(true)

    const sinUbicacion =
      'No se pudo obtener tu ubicación actual. Buscá la dirección o mové el marcador a mano.'

    // Un tope propio, aparte del `timeout` del navegador: hay casos en que el
    // navegador no llama a ninguna de las dos funciones y el spinner giraría
    // para siempre. No invalida el intento: si el permiso estaba esperando la
    // respuesta de la persona y llega una posición más tarde, se aplica igual.
    const reloj = setTimeout(() => {
      setBuscandoUbicacion(false)
      setErrorUbicacion(sinUbicacion)
    }, 9000)

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        clearTimeout(reloj)
        setErrorUbicacion(null)

        const ubicacion = {
          lat: posicion.coords.latitude,
          lng: posicion.coords.longitude,
        }
        mapInstanceRef.current?.setCenter(ubicacion)
        mapInstanceRef.current?.setZoom(17)
        markerRef.current?.setPosition(ubicacion)
        onLocationChange(ubicacion)

        // La dirección que corresponde a ese punto, igual que al arrastrar el
        // marcador.
        new window.google.maps.Geocoder().geocode(
          { location: ubicacion },
          (resultados: any, estado: any) => {
            if (estado === 'OK' && resultados && resultados[0]) {
              onAddressChange(resultados[0].formatted_address)
            }
          }
        )
        setBuscandoUbicacion(false)
      },
      (error) => {
        clearTimeout(reloj)
        setBuscandoUbicacion(false)
        // El texto del navegador distingue casos que el código no: "User denied
        // Geolocation" es el sitio; los de "location provider" son el sistema.
        console.warn('Geolocalización:', error.code, error.message)

        if (error.code !== 1) {
          setErrorUbicacion(sinUbicacion)
          return
        }

        // "Denegado" tiene dos causas con arreglos distintos, y decirle que
        // mire el candado a quien ya aceptó el permiso solo lo confunde. Se
        // pregunta cuál es: si el navegador SÍ tiene el permiso, lo bloquea el
        // sistema operativo, que es lo que pasa en Windows con los servicios de
        // ubicación apagados.
        const bloqueoDelSitio =
          'El permiso de ubicación está bloqueado para este sitio. Habilitalo en los permisos del sitio de tu navegador y volvé a tocar el botón.'
        if (!navigator.permissions?.query) {
          setErrorUbicacion(bloqueoDelSitio)
          return
        }
        navigator.permissions
          .query({ name: 'geolocation' })
          .then((estado) =>
            setErrorUbicacion(
              estado.state === 'granted'
                ? 'El navegador tiene el permiso para este sitio, pero el dispositivo bloquea la ubicación. Revisá que los servicios de ubicación estén activados en la configuración del dispositivo.'
                : bloqueoDelSitio
            )
          )
          .catch(() => setErrorUbicacion(bloqueoDelSitio))
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 30000 }
    )
  }

  return (
    <div className="space-y-3">
      {/* Buscador de dirección */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="Buscar dirección..."
          className={`w-full pl-10 pr-4 py-2.5 rounded-lg border ${styles.input} focus:outline-none focus:ring-2 transition-colors text-base md:text-sm`}
        />
      </div>

      {/* Mapa */}
      <div
        ref={contenedorMapaRef}
        className={`relative overflow-hidden border border-gray-200 ${
          pantallaCompleta ? 'bg-white' : 'rounded-lg'
        }`}
      >
        <div
          ref={mapRef}
          className={
            pantallaCompleta
              ? 'h-full w-full'
              : ampliado
                ? 'h-[70dvh] min-h-[320px] w-full'
                : 'h-[200px] w-full'
          }
        />
        {isMapLoaded && (
          <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
            <button
              type="button"
              onClick={alternarPantallaCompleta}
              title={
                pantallaCompleta || ampliado
                  ? 'Salir de pantalla completa'
                  : 'Ver el mapa en pantalla completa'
              }
              aria-label={
                pantallaCompleta || ampliado
                  ? 'Salir de pantalla completa'
                  : 'Ver el mapa en pantalla completa'
              }
              className="grid h-11 w-11 place-items-center rounded-full bg-white text-gray-700 shadow-md ring-1 ring-black/10 transition-colors hover:bg-gray-50 md:h-10 md:w-10"
            >
              {pantallaCompleta || ampliado ? (
                <Minimize2 className="h-5 w-5" />
              ) : (
                <Maximize2 className="h-5 w-5" />
              )}
            </button>
            <button
              type="button"
              onClick={irAMiUbicacion}
              disabled={buscandoUbicacion}
              title="Usar mi ubicación actual"
              aria-label="Usar mi ubicación actual"
              className="grid h-11 w-11 place-items-center rounded-full bg-white text-gray-700 shadow-md ring-1 ring-black/10 transition-colors hover:bg-gray-50 disabled:opacity-60 md:h-10 md:w-10"
            >
              {buscandoUbicacion ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <LocateFixed className="h-5 w-5" />
              )}
            </button>
          </div>
        )}

        {/* Dentro del bloque y no debajo: en pantalla completa solo se ve lo que
            está adentro, y un aviso afuera no lo vería nadie. */}
        {errorUbicacion && (
          <p
            role="alert"
            onClick={() => setErrorUbicacion(null)}
            title="Tocá para cerrar"
            className="absolute inset-x-3 bottom-3 z-10 cursor-pointer rounded-md bg-white/95 px-3 py-2 text-xs text-red-600 shadow"
          >
            {errorUbicacion}
          </p>
        )}
        {!apiKey && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-50">
            <div className="text-center p-4">
              <MapPin className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-600 font-medium">API Key no configurada</p>
              <p className="text-xs text-red-500 mt-1">Agrega VITE_GOOGLE_MAPS_API_KEY a .env.local</p>
            </div>
          </div>
        )}
        {apiKey && !isMapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MapPin className={`w-8 h-8 ${styles.marker} mx-auto mb-2 animate-pulse`} />
              <p className="text-sm text-gray-500">Cargando mapa...</p>
            </div>
          </div>
        )}
      </div>

      {/* Info de ayuda */}
      <p className="text-xs text-gray-500 flex items-center gap-1">
        <MapPin className="w-3 h-3" />
        Haz click en el mapa, arrastra el marcador o usa el botón de ubicación
      </p>
    </div>
  )
}
