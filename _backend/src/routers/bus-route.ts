import {Router, Request, Response} from 'express';
import {getRouteByCoords, testConnection} from '../repo/bus-repo.js';
import {findRoutes as findRoutesNeo4j, testNeo4jConnection} from '../repo/bus-repo-neo4j.js';

const router = Router();

console.log('bus router loaded');

// Test endpoint for both databases
router.get('/api/bus/test', async (req: Request, res: Response) => {
    try {
        // Try Neo4j first
        let neo4jStatus = 'down';
        try {
            await testNeo4jConnection();
            neo4jStatus = 'up';
        } catch (e) {
            console.warn('Neo4j connection failed:', e.message);
        }

        // Try PostgreSQL
        let pgStatus = 'down';
        let pgData = null;
        try {
            pgData = await testConnection();
            pgStatus = pgData && pgData.length > 0 ? 'up' : 'down';
        } catch (e) {
            console.warn('PostgreSQL connection failed:', e.message);
        }

        res.json({
            status: 'ok',
            backends: {
                neo4j: neo4jStatus,
                postgresql: pgStatus
            },
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({error: 'Internal server error'});
    }
})

// example use
// GET /api/bus/route?lat_a=48.30&lon_a=14.28&lat_b=48.25&lon_b=14.32&departure_time=08:30:00&max_transfers=2
router.get('/api/bus/route', async (req: Request, res: Response) => {
    try {
        const { lat_a, lon_a, lat_b, lon_b, departure_time, max_transfers, use_postgres } = req.query;

        // Check all params are present
        if (!lat_a || !lon_a || !lat_b || !lon_b || !departure_time || !max_transfers) {
            return res.status(400).json({ error: 'Missing required parameters: lat_a, lon_a, lat_b, lon_b, departure_time, max_transfers' });
        }

        // Validate coordinates are valid numbers
        const parsedLatA = parseFloat(lat_a as string);
        const parsedLonA = parseFloat(lon_a as string);
        const parsedLatB = parseFloat(lat_b as string);
        const parsedLonB = parseFloat(lon_b as string);

        if ([parsedLatA, parsedLonA, parsedLatB, parsedLonB].some(isNaN)) {
            return res.status(400).json({ error: 'Coordinates must be valid numbers' });
        }

        // Validate coordinate ranges
        if (parsedLatA < -90 || parsedLatA > 90 || parsedLatB < -90 || parsedLatB > 90) {
            return res.status(400).json({ error: 'Latitude must be between -90 and 90' });
        }
        if (parsedLonA < -180 || parsedLonA > 180 || parsedLonB < -180 || parsedLonB > 180) {
            return res.status(400).json({ error: 'Longitude must be between -180 and 180' });
        }

        // Validate departure_time format HH:MM:SS
        if (!/^\d{2}:\d{2}:\d{2}$/.test(departure_time as string)) {
            return res.status(400).json({ error: 'departure_time must be in HH:MM:SS format' });
        }

        // Validate max_transfers is a positive integer
        const parsedMaxTransfers = parseInt(max_transfers as string);
        if (isNaN(parsedMaxTransfers) || parsedMaxTransfers < 0 || parsedMaxTransfers > 5) {
            return res.status(400).json({ error: 'max_transfers must be an integer between 0 and 5' });
        }

        let route;
        let backend = 'neo4j';

        // Try Neo4j first unless explicitly requested to use PostgreSQL
        if (use_postgres === 'true') {
            backend = 'postgresql';
            route = await getRouteByCoords(
                parsedLonA, parsedLatA,
                parsedLonB, parsedLatB,
                departure_time as string,
                parsedMaxTransfers
            );
        } else {
            try {
                route = await findRoutesNeo4j(
                    parsedLatA, parsedLonA,
                    parsedLatB, parsedLonB,
                    departure_time as string,
                    parsedMaxTransfers
                );
            } catch (neoError) {
                console.warn('Neo4j routing failed, falling back to PostgreSQL:', neoError.message);
                backend = 'postgresql';
                route = await getRouteByCoords(
                    parsedLonA, parsedLatA,
                    parsedLonB, parsedLatB,
                    departure_time as string,
                    parsedMaxTransfers
                );
            }
        }

        if (route.length > 0) {
            res.set('X-Route-Backend', backend);
            res.json(route);
        } else {
            res.set('X-Route-Backend', backend);
            res.sendStatus(404);
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;