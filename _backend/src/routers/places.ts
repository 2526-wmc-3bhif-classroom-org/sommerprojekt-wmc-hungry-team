import { Router, Request, Response } from 'express';
import { geocodePlace } from '../repo/places-repo.js';

const router = Router();

router.get('/api/places/geocode', async (req: Request, res: Response) => {
  try {
    const { place } = req.query;

    // Validate required parameter
    if (!place || typeof place !== 'string' || place.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Missing required parameter: place' 
      });
    }

    // Call repository function
    const result = await geocodePlace(place as string);

    // Return success response
    res.json(result);

  } catch (e: any) {
    console.error('Geocoding endpoint error:', e);
    
    // Specific error handling for common cases
    if (e.message?.includes('not found')) {
      return res.status(404).json({ 
        error: 'Place not found',
        message: 'Could not find coordinates for the given place name'
      });
    }
    
    if (e.message?.includes('quota')) {
      return res.status(503).json({ 
        error: 'Geocoding service temporarily unavailable',
        message: 'API quota exceeded'
      });
    }
    
    if (e.message?.includes('authentication')) {
      return res.status(500).json({ 
        error: 'Service configuration error' 
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: e.message 
    });
  }
});

export default router;
