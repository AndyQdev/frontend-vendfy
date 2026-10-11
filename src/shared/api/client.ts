type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface ApiResponse<T> {
  stats?: any;
  statusCode: number;
  data?: T;
  message?: string;
  countData?: number;
}

// Clase personalizada para errores de API con más contexto
export class ApiError extends Error {
  statusCode: number;
  error?: string;
  
  constructor(message: string, statusCode: number, error?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.error = error;
  }
}

export async function apiFetch<T>(
  url: string,
  {
    method = "GET",
    body,
    headers = {},
    signal,
    keepalive,
  }: {
    method?: Method;
    body?: any;
    headers?: Record<string, string>;
    /** Para cancelar un pedido que quedó viejo (una búsqueda, una sugerencia). */
    signal?: AbortSignal;
    /** Que el pedido llegue aunque la página se esté cerrando (hasta 64 KB). */
    keepalive?: boolean;
  } = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem("authToken");
  
  // Detectar si el body es FormData
  const isFormData = body instanceof FormData;
  
  const config: RequestInit = {
    method,
    signal,
    keepalive,
    headers: {
      // Solo agregar Content-Type si NO es FormData
      ...(!isFormData && { "Content-Type": "application/json" }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
  };

  if (body && ["POST", "PUT", "PATCH"].includes(method)) {
    // Si es FormData, enviarlo directamente; si no, convertir a JSON
    config.body = isFormData ? body : JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_URL}${url}`, config);
    
    if (!response.ok) {
      // Intentar parsear el error del backend
      const errorData = await response.json().catch(() => ({
        message: "Error del servidor",
        statusCode: response.status
      }));
      
      // Lanzar ApiError con el mensaje del backend
      throw new ApiError(
        errorData.message || `HTTP error! status: ${response.status}`,
        errorData.statusCode || response.status,
        errorData.error
      );
    }

    return await response.json();
  } catch (error) {
    // Si ya es un ApiError, re-lanzarlo
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Si es un error de red u otro tipo, envolverlo
    console.error("API Error:", error);
    throw new ApiError(
      error instanceof Error ? error.message : "Error de conexión",
      0
    );
  }
}
