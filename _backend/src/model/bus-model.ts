// src/models/stop-times.model.ts
export interface UpcomingStopRow {
    route_short_name: string;
    route_long_name: string;
    arrival_time: string; // "14:30:00" from Postgres
    trip_headsign: string;
}