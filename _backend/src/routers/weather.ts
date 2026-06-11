import { Router, Request, Response } from 'express';
import { fetchWeatherForecast } from '../repo/weather-repo.js';
import { geocodePlace } from '../repo/places-repo.js';
import { parseCoordinates } from '../utils/validation.js';

const router = Router();

router.get('/api/weather/forecast', async (req: Request, res: Response) => {
  try {
    let lat: number;
    let lon: number;
    let formattedAddress: string | undefined;

    if (req.query.place) {
      const geocode = await geocodePlace(req.query.place as string);
      lat = geocode.coordinates.lat;
      lon = geocode.coordinates.lon;
      formattedAddress = geocode.formattedAddress;
    } else {
      const coords = parseCoordinates(req.query.lat as string, req.query.lon as string);
      if (!coords.valid) {
        return res.status(400).json({ error: coords.error });
      }
      lat = coords.lat;
      lon = coords.lon;
    }

    const forecast = await fetchWeatherForecast(lat, lon);

    // Return success response with formattedAddress
    res.json({
      ...forecast,
      formattedAddress
    });

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
