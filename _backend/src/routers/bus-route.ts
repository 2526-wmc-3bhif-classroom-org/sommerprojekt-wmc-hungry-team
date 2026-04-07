import {Router, Request, Response} from 'express';
import {findRoutes, testNeo4jConnection} from '../repo/bus-repo-neo4j.js';

const router = Router();

console.log('bus router loaded');

// Test endpoint for Neo4j
router.get('/api/bus/test', async (req: Request, res: Response) => {
    try {
        let neo4jStatus = 'down';
        try {
            await testNeo4jConnection();
            neo4jStatus = 'up';
        } catch (e: any) {
            console.warn('Neo4j connection failed:', e.message);
        }

        res.json({
            status: neo4jStatus === 'up' ? 'ok' : 'error',
            backend: 'neo4j',
            neo4j: neo4jStatus,
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({error: 'Internal server error'});
    }
});

// Route finding endpoint
// GET /api/bus/route?lat_a=48.30&lon_a=14.28&lat_b=48.25&lon_b=14.32&departure_time=08:30:00&max_transfers=2
router.get('/api/bus/route', async (req: Request, res: Response) => {
    try {
        const { lat_a, lon_a, lat_b, lon_b, departure_time, max_transfers } = req.query;

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

        const routes = await findRoutes(
            parsedLatA, parsedLonA,
            parsedLatB, parsedLonB,
            departure_time as string,
            parsedMaxTransfers
        );

        res.set('X-Route-Backend', 'neo4j');
        
        if (routes.length > 0) {
            res.json(routes);
        } else {
            res.sendStatus(404);
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
