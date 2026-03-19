// Bus route API types matching backend response

export interface BusRouteApiResponse {
  legs: number;
  route_short_name: string;
  route_long_name: string;
  route_type: number;
  boarded_at_stop_id: string;
  boarded_at_stop_name: string;
  alight_at_stop_id: string;
  alight_at_stop_name: string;
  departure_time: string; // HH:MM:SS
  arrival_time: string; // HH:MM:SS
  total_duration: string; // HH:MM:SS
  transfer_stop_id: string | null;
  transfer_stop_name: string | null;
  transfer_route_short_name: string | null;
  transfer_route_long_name: string | null;
  transfer_departure_time: string | null;
  transfer_arrival_time: string | null;
}

// Transformed data structures for display

export interface BusStop {
  id: string;
  name: string;
  time: string; // HH:MM format for display
  isTransfer: boolean;
}

export interface RouteLeg {
  routeName: string; // e.g., "B7"
  routeFullName: string; // e.g., "Express Line 7"
  routeType: RouteType;
  startStop: BusStop;
  endStop: BusStop;
  departureTime: string; // HH:MM
  arrivalTime: string; // HH:MM
  stops: BusStop[]; // All stops in this leg
}

export interface BusRoute {
  legs: RouteLeg[];
  totalDuration: string; // "1h 23m" format
  transferCount: number;
  finalArrival: string; // HH:MM
  startLocation: string;
  endLocation: string;
}

export enum RouteType {
  Tram = 0,
  Subway = 1,
  Rail = 2,
  Bus = 3,
  Ferry = 4,
  CableTram = 5,
  AerialLift = 6,
  Funicular = 7,
}

export function getRouteTypeLabel(type: RouteType): string {
  switch (type) {
    case RouteType.Tram:
      return 'Tram';
    case RouteType.Bus:
      return 'Bus';
    case RouteType.Subway:
      return 'U-Bahn';
    case RouteType.Rail:
      return 'Zug';
    case RouteType.Ferry:
      return 'Fähre';
    default:
      return 'Transit';
  }
}

// Helper function to format time from HH:MM:SS to HH:MM
export function formatTime(time: string): string {
  return time.substring(0, 5); // Remove seconds
}

// Helper function to format duration from HH:MM:SS to readable format
export function formatDuration(duration: string): string {
  const [hourStr, minuteStr] = duration.split(':');
  if (!hourStr || !minuteStr) return duration;

  const hours = parseInt(hourStr, 10);
  const minutes = parseInt(minuteStr, 10);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
