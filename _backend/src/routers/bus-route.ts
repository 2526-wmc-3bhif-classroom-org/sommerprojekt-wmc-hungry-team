import {Router, Request, Response} from 'express';
import {findRoutes, testNeo4jConnection} from '../repo/bus-repo-neo4j.js';
import {parseCoordinatePair, validateTimeFormat, validateMaxTransfers} from '../utils/validation.js';

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

        const coords = parseCoordinatePair(lat_a as string, lon_a as string, lat_b as string, lon_b as string);
        if (!coords.valid) {
            return res.status(400).json({ error: coords.error });
        }

        const timeResult = validateTimeFormat(departure_time as string);
        if (!timeResult.valid) {
            return res.status(400).json({ error: timeResult.error });
        }

        const transfersResult = validateMaxTransfers(max_transfers as string);
        if (!transfersResult.valid) {
            return res.status(400).json({ error: transfersResult.error });
        }

        const routes = await findRoutes(
            coords.latA, coords.lonA,
            coords.latB, coords.lonB,
            timeResult.time,
            transfersResult.maxTransfers
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
