interface GeocodeResponse {
  place: string
  formattedAddress: string
  coordinates: {
    lat: number
    lon: number
  }
}

interface ServiceStatusResponse {
  status: 'ok' | 'error'
  backend: string
  neo4j: 'up' | 'down'
  timestamp: string
}

type QueryValue = string | number

function toApiError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }

  return new Error('Unerwarteter API-Fehler')
}

export function useSmarthubApi() {
  const config = useRuntimeConfig()
  const apiBase = String(config.public.apiBaseUrl || '').replace(/\/$/, '')

  const buildUrl = (path: string) => `${apiBase}${path}`

  const request = async <T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options: { query?: Record<string, QueryValue>; body?: unknown } = {}
  ) => {
    try {
      return await $fetch<T>(buildUrl(path), {
        method,
        query: options.query,
        body: options.body,
        credentials: 'include'
      })
    } catch (error) {
      throw toApiError(error)
    }
  }

  const get = async <T>(path: string, query: Record<string, QueryValue>) => {
    return request<T>('GET', path, { query })
  }

  const post = async <T>(path: string, body: unknown) => {
    return request<T>('POST', path, { body })
  }

  const geocodePlace = async (place: string): Promise<GeocodeResponse> => {
    return get<GeocodeResponse>('/api/places/geocode', { place })
  }

  const fetchServiceStatus = async (): Promise<ServiceStatusResponse> => {
    try {
      return await $fetch<ServiceStatusResponse>(buildUrl('/api/bus/test'), { credentials: 'include' })
    } catch (error) {
      throw toApiError(error)
    }
  }

  const login = async (email: string, password: string) => {
    return post<{ id: string; email: string; name: string }>('/api/auth/login', { email, password })
  }

  const register = async (name: string, email: string, password: string) => {
    return post<{ id: string; email: string; name: string }>('/api/auth/register', { name, email, password })
  }

  const logout = async () => {
    return post<{ status: string }>('/api/auth/logout', {})
  }

  const fetchMe = async () => {
    return request<{ user: { id: string; email: string; name: string }; googleConnected: boolean; googleEmail: string | null }>(
      'GET',
      '/api/auth/me'
    )
  }

  return {
    get,
    post,
    geocodePlace,
    fetchServiceStatus,
    login,
    register,
    logout,
    fetchMe,
  }
}
