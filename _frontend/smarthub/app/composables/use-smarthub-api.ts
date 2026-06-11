interface GeocodeResponse {
  place: string
  formattedAddress: string
  coordinates: {
    lat: number
    lon: number
  }
}

export interface AutocompleteResult {
  description: string
  place_id: string
}
interface ServiceStatusResponse {
  status: 'ok' | 'error'
  backend: string
  neo4j: 'up' | 'down'
  timestamp: string
}

type QueryValue = string | number

function toApiError(error: unknown): Error {
  // $fetch throws FetchError with .data containing the parsed JSON response body
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as Record<string, unknown>).data
    if (data && typeof data === 'object' && 'error' in data && typeof (data as Record<string, unknown>).error === 'string') {
      return new Error((data as Record<string, unknown>).error as string)
    }
  }

  if (error instanceof Error) {
    return error
  }

  return new Error('Unexpected API error')
}

export function useSmarthubApi() {
  const config = useRuntimeConfig()
  const apiBase = String(config.public.apiBaseUrl || '').replace(/\/$/, '')

  const buildUrl = (path: string) => `${apiBase}${path}`

  const request = async <T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options: { query?: Record<string, QueryValue>; body?: unknown; headers?: Record<string, string> } = {}
  ) => {
    try {
      return await $fetch<T>(buildUrl(path), {
        method,
        query: options.query,
        body: options.body,
        headers: options.headers,
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

  const put = async <T>(path: string, body: unknown) => {
    return request<T>('PUT', path, { body })
  }

  const del = async <T>(path: string) => {
    return request<T>('DELETE', path, {})
  }

  const geocodePlace = async (place: string): Promise<GeocodeResponse> => {
    return get<GeocodeResponse>('/api/places/geocode', { place })
  }

  const autocompletePlace = async (query: string): Promise<AutocompleteResult[]> => {
    return get<AutocompleteResult[]>('/api/places/autocomplete', { q: query })
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
      '/api/auth/me',
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      } as any
    )
  }

  const updateMe = async (updates: { name?: string; email?: string; password?: string }) => {
    return put<{ status: string }>('/api/auth/me', updates)
  }

  const fetchSettings = async () => {
    return request<Record<string, unknown>>('GET', '/api/settings', {})
  }

  const updateSettings = async (settings: Record<string, unknown>) => {
    return request<Record<string, unknown>>('PUT', '/api/settings', { body: settings })
  }

  const fetchRoutines = async () => {
    return request<any[]>('GET', '/api/routines', {})
  }

  const createRoutine = async (routine: Record<string, unknown>) => {
    return request<any>('POST', '/api/routines', { body: routine })
  }

  const updateRoutine = async (id: string, routine: Record<string, unknown>) => {
    return request<any>('PUT', `/api/routines/${id}`, { body: routine })
  }

  const deleteRoutine = async (id: string) => {
    return request<any>('DELETE', `/api/routines/${id}`, {})
  }

  return {
    get,
    post,
    put,
    del,
    geocodePlace,
    autocompletePlace,
    fetchServiceStatus,
    login,
    register,
    logout,
    fetchMe,
    updateMe,
    fetchSettings,
    updateSettings,
    fetchRoutines,
    createRoutine,
    updateRoutine,
    deleteRoutine,
  }
}
