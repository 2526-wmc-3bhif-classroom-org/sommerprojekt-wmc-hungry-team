import {Router, Request, Response} from 'express';
import {getRouteByCoords, testConnection} from '../repo/bus-repo';

const router = Router();

console.log('bus router loaded');

router.get('/api/bus/test', async (req: Request, res: Response) => {
    try {
        const upcoming = await testConnection();

        if (upcoming.length > 0) {
            res.json(upcoming);
        } else {
            res.sendStatus(404);
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({error: 'Internal server error'});
    }
})

// example use
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

        const route = await getRouteByCoords(
            parsedLonA, parsedLatA,
            parsedLonB, parsedLatB,
            departure_time as string,
            parsedMaxTransfers
        );

        if (route.length > 0) {
            res.json(route);
        } else {
            res.sendStatus(404);
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;