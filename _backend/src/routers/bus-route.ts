import {Router, Request, Response} from 'express';
import {getUpcomingStops, testConnection} from '../repo/bus-repo';

const router = Router();

router.get('/api/bus/:stopId', async (req: Request, res: Response) => {
    try {
        let stopId = req.params.stopId;

        if (!stopId || !/^[a-zA-Z0-9_-]+$/.test(stopId)) {
            return res.status(400).json({error: 'Invalid stop ID'});
        }
        if (stopId.length > 64) {
            return res.status(400).json({error: 'Stop ID too long'});
        }

        const upcoming = await getUpcomingStops(stopId);

        if (upcoming.length > 0) {
            res.json(upcoming);
        } else {
            res.sendStatus(404);
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({error: 'Internal server error'});
    }
});

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

export default router;