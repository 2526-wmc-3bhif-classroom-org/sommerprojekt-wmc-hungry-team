export interface ApiRouteLeg {
  board_stop_id: string
  board_stop_name: string
  alight_stop_id: string
  alight_stop_name: string
  departure_time: string
  arrival_time: string
  route_short_name: string
  route_long_name: string
  route_type: number
}

export interface BusRouteApiResponse {
  legs: ApiRouteLeg[]
  total_duration_minutes: number
  departure_time: string
  arrival_time: string
  num_transfers: number
}

export function formatTime(time: string): string {
  return time.slice(0, 5)
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} Min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`
}
