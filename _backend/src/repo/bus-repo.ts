import pool from '../config/db';

export const getUpcomingStops = async (stopId: string) => {
    const query = `
        SELECT r.route_short_name,
               r.route_long_name,
               st.arrival_time,
               t.trip_headsign
        FROM stop_times st
                 JOIN trips t ON st.trip_id = t.trip_id
                 JOIN routes r ON t.route_id = r.route_id
        WHERE st.stop_id = $1
          AND st.arrival_time >= CURRENT_TIME
        ORDER BY st.arrival_time ASC LIMIT 5;
    `;

    try {
        const res = await pool.query(query, [stopId]);
        return res.rows;
    } catch (err) {
        console.error('Database query error:', err);
        throw err;
    }
};