import { Router, Request, Response } from 'express';
import { fetchWeatherForecast } from '../repo/weather-repo.js';

const router = Router();

router.get('/api/weather/forecast', async (req: Request, res: Response) => {
  try {
    const { lat, lon } = req.query;

    // Check required parameters
    if (!lat || !lon) {
      return res.status(400).json({ 
        error: 'Missing required parameters: lat, lon' 
      });
    }

    // Parse and validate numbers
    const parsedLat = parseFloat(lat as string);
    const parsedLon = parseFloat(lon as string);

    if (isNaN(parsedLat) || isNaN(parsedLon)) {
      return res.status(400).json({ 
        error: 'Coordinates must be valid numbers' 
      });
    }

    // Validate coordinate ranges
    if (parsedLat < -90 || parsedLat > 90) {
      return res.status(400).json({ 
        error: 'Latitude must be between -90 and 90' 
      });
    }
    
    if (parsedLon < -180 || parsedLon > 180) {
      return res.status(400).json({ 
        error: 'Longitude must be between -180 and 180' 
      });
    }

    // Call repository function
    const forecast = await fetchWeatherForecast(parsedLat, parsedLon);

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
