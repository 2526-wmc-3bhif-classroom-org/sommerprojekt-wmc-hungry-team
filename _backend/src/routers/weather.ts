import { Router, Request, Response } from 'express';
import { fetchWeatherForecast } from '../repo/weather-repo.js';
import { parseCoordinates } from '../utils/validation.js';

const router = Router();

router.get('/api/weather/forecast', async (req: Request, res: Response) => {
  try {
    const coords = parseCoordinates(req.query.lat as string, req.query.lon as string);
    if (!coords.valid) {
      return res.status(400).json({ error: coords.error });
    }

    const forecast = await fetchWeatherForecast(coords.lat, coords.lon);

    // Return success response
    res.json(forecast);

  } catch (e: any) {
    console.error('Weather endpoint error:', e);
    
    // Distinguish between service unavailable and internal error
    if (e.message?.includes('unavailable') || e.message?.includes('timeout')) {
      return res.status(503).json({ 
        error: 'Weather service temporarily unavailable',
        message: e.message
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: e.message 
    });
  }
});

export default router;
