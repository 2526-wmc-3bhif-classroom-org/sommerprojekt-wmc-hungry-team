import { Pool } from 'pg';

let pool: Pool | null = null;

const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT || '5432'),
    });
  }
  return pool;
};

export const testConnection = async () => {
  const query = `SELECT * FROM agency`;
  try {
    const res = await getPool().query(query);
    return res.rows;
  } catch (err) {
    console.error('Database query error:', err);
    throw err;
  }
}

export const getRouteByCoords = async (lon_a: number, lat_a: number, lon_b: number, lat_b: number, departure_time: string, max_transfers: number) => {
  const query = `
    WITH
      origin AS (
        SELECT stop_id, stop_name
        FROM stops
        ORDER BY stop_loc <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
      LIMIT 1
      ),
      destination AS (
    SELECT stop_id, stop_name
    FROM stops
    ORDER BY stop_loc <-> ST_SetSRID(ST_MakePoint($3, $4), 4326)
      LIMIT 1
      ),
      origin_trips AS (
    SELECT
      st.trip_id,
      st.stop_sequence AS origin_seq,
      st.departure_time AS origin_departure
    FROM stop_times st
      JOIN origin o ON st.stop_id = o.stop_id
      JOIN trips t ON t.trip_id = st.trip_id
      JOIN calendar c ON c.service_id = t.service_id
    WHERE st.departure_time >= $5::interval
      AND c.start_date <= CURRENT_DATE
      AND c.end_date >= CURRENT_DATE
      AND CASE to_char(CURRENT_DATE, 'Day')
      WHEN 'Monday   ' THEN c.monday
      WHEN 'Tuesday  ' THEN c.tuesday
      WHEN 'Wednesday' THEN c.wednesday
      WHEN 'Thursday ' THEN c.thursday
      WHEN 'Friday   ' THEN c.friday
      WHEN 'Saturday ' THEN c.saturday
      WHEN 'Sunday   ' THEN c.sunday
      END = 'available'
      ),
      dest_trips AS (
    SELECT
      st.trip_id,
      st.stop_sequence AS dest_seq,
      st.arrival_time AS dest_arrival
    FROM stop_times st
      JOIN destination d ON st.stop_id = d.stop_id
      JOIN trips t ON t.trip_id = st.trip_id
      JOIN calendar c ON c.service_id = t.service_id
    WHERE c.start_date <= CURRENT_DATE
      AND c.end_date >= CURRENT_DATE
      AND CASE to_char(CURRENT_DATE, 'Day')
      WHEN 'Monday   ' THEN c.monday
      WHEN 'Tuesday  ' THEN c.tuesday
      WHEN 'Wednesday' THEN c.wednesday
      WHEN 'Thursday ' THEN c.thursday
      WHEN 'Friday   ' THEN c.friday
      WHEN 'Saturday ' THEN c.saturday
      WHEN 'Sunday   ' THEN c.sunday
      END = 'available'
      ),
      direct AS (
    SELECT
      1 AS legs,
      ot.trip_id,
      r.route_short_name,
      r.route_long_name,
      r.route_type,
      o.stop_id AS boarded_at_stop_id,
      o.stop_name AS boarded_at_stop_name,
      d.stop_id AS alight_at_stop_id,
      d.stop_name AS alight_at_stop_name,
      ot.origin_departure AS departure_time,
      dt.dest_arrival AS arrival_time,
      (dt.dest_arrival - ot.origin_departure) AS total_duration,
      NULL::text AS transfer_stop_id,
      NULL::text AS transfer_stop_name,
      NULL::text AS transfer_route_short_name,
      NULL::text AS transfer_route_long_name,
      NULL::interval AS transfer_departure_time,
      NULL::interval AS transfer_arrival_time
    FROM origin_trips ot
      JOIN dest_trips dt ON ot.trip_id = dt.trip_id
      AND dt.dest_seq > ot.origin_seq
      JOIN trips t ON t.trip_id = ot.trip_id
      JOIN routes r ON r.route_id = t.route_id
      CROSS JOIN origin o
      CROSS JOIN destination d
      ),
      one_transfer AS (
    SELECT
      2 AS legs,
      ot.trip_id,
      r1.route_short_name,
      r1.route_long_name,
      r1.route_type,
      o.stop_id AS boarded_at_stop_id,
      o.stop_name AS boarded_at_stop_name,
      d.stop_id AS alight_at_stop_id,
      d.stop_name AS alight_at_stop_name,
      ot.origin_departure AS departure_time,
      dt.dest_arrival AS arrival_time,
      (dt.dest_arrival - ot.origin_departure) AS total_duration,
      s_transfer.stop_id AS transfer_stop_id,
      s_transfer.stop_name AS transfer_stop_name,
      r2.route_short_name AS transfer_route_short_name,
      r2.route_long_name AS transfer_route_long_name,
      st_transfer_dep.departure_time AS transfer_departure_time,
      st_transfer_arr.arrival_time AS transfer_arrival_time
    FROM origin_trips ot
      JOIN stop_times st_transfer_arr
    ON st_transfer_arr.trip_id = ot.trip_id
      AND st_transfer_arr.stop_sequence > ot.origin_seq
      JOIN stops s_transfer
      ON s_transfer.stop_id = st_transfer_arr.stop_id
      JOIN stop_times st_transfer_dep
      ON st_transfer_dep.stop_id = st_transfer_arr.stop_id
      AND st_transfer_dep.departure_time >= st_transfer_arr.arrival_time + interval '3 minutes'
      AND st_transfer_dep.trip_id <> ot.trip_id
      JOIN dest_trips dt
      ON dt.trip_id = st_transfer_dep.trip_id
      AND dt.dest_seq > st_transfer_dep.stop_sequence
      JOIN trips t1 ON t1.trip_id = ot.trip_id
      JOIN routes r1 ON r1.route_id = t1.route_id
      JOIN trips t2 ON t2.trip_id = st_transfer_dep.trip_id
      JOIN routes r2 ON r2.route_id = t2.route_id
      CROSS JOIN origin o
      CROSS JOIN destination d
    WHERE $6 >= 1
      ),
      completed_journeys AS (
    SELECT * FROM direct
    UNION ALL
    SELECT * FROM one_transfer
      )
    SELECT
      legs,
      route_short_name,
      route_long_name,
      route_type,
      boarded_at_stop_id,
      boarded_at_stop_name,
      alight_at_stop_id,
      alight_at_stop_name,
      LPAD(EXTRACT(HOUR FROM departure_time)::text, 2, '0') || ':' ||
      LPAD(EXTRACT(MINUTE FROM departure_time)::text, 2, '0') || ':' ||
      LPAD(FLOOR(EXTRACT(SECOND FROM departure_time))::int::text, 2, '0') AS departure_time,
      LPAD(EXTRACT(HOUR FROM arrival_time)::text, 2, '0') || ':' ||
      LPAD(EXTRACT(MINUTE FROM arrival_time)::text, 2, '0') || ':' ||
      LPAD(FLOOR(EXTRACT(SECOND FROM arrival_time))::int::text, 2, '0') AS arrival_time,
      LPAD(EXTRACT(HOUR FROM total_duration)::text, 2, '0') || ':' ||
      LPAD(EXTRACT(MINUTE FROM total_duration)::text, 2, '0') || ':' ||
      LPAD(FLOOR(EXTRACT(SECOND FROM total_duration))::int::text, 2, '0') AS total_duration,
      transfer_stop_id,
      transfer_stop_name,
      transfer_route_short_name,
      transfer_route_long_name,
      LPAD(EXTRACT(HOUR FROM transfer_departure_time)::text, 2, '0') || ':' ||
      LPAD(EXTRACT(MINUTE FROM transfer_departure_time)::text, 2, '0') || ':' ||
      LPAD(FLOOR(EXTRACT(SECOND FROM transfer_departure_time))::int::text, 2, '0') AS transfer_departure_time,
      LPAD(EXTRACT(HOUR FROM transfer_arrival_time)::text, 2, '0') || ':' ||
      LPAD(EXTRACT(MINUTE FROM transfer_arrival_time)::text, 2, '0') || ':' ||
      LPAD(FLOOR(EXTRACT(SECOND FROM transfer_arrival_time))::int::text, 2, '0') AS transfer_arrival_time
    FROM completed_journeys
    ORDER BY legs ASC, total_duration ASC, departure_time ASC
      LIMIT 5;
  `;

  try {
    const client = await getPool().connect();
    try {
      await client.query('SET statement_timeout = 10000');
      const res = await client.query(query, [lon_a, lat_a, lon_b, lat_b, departure_time, max_transfers]);
      return res.rows;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database query error:', err);
    throw err;
  }
};