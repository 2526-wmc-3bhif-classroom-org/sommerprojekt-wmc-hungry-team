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

  const get = async <T>(path: string, query: Record<string, QueryValue>) => {
    try {
      return await $fetch<T>(buildUrl(path), { query })
    } catch (error) {
      throw toApiError(error)
    }
  }

  const geocodePlace = async (place: string): Promise<GeocodeResponse> => {
    return get<GeocodeResponse>('/api/places/geocode', { place })
  }

  const fetchServiceStatus = async (): Promise<ServiceStatusResponse> => {
    try {
      return await $fetch<ServiceStatusResponse>(buildUrl('/api/bus/test'))
    } catch (error) {
      throw toApiError(error)
    }
  }

  return {
    get,
    geocodePlace,
    fetchServiceStatus,
  }
}
