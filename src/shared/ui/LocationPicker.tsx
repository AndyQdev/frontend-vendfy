import { useEffect, useRef, useState } from 'react'
import { MapPin, Search } from 'lucide-react'

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
      <div className="relative rounded-lg overflow-hidden border border-gray-200">
        <div ref={mapRef} className="w-full h-[200px]" />
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
        Haz click en el mapa o arrastra el marcador para seleccionar ubicación
      </p>
    </div>
  )
}
