import { fetchJson } from '../utils/http.js';

// Type definition
export interface PlaceResult {
  place: string;
  formattedAddress: string;
  coordinates: {
    lat: number;
    lon: number;
  };
}

// Main function to geocode a place name
export async function geocodePlace(placeName: string): Promise<PlaceResult> {
  // Get API key from environment
  const apiKey = process.env.GOOGLE_KEY;
  
  if (!apiKey) {
    throw new Error('GOOGLE_KEY not configured');
  }
  
  try {
    // Build Google Geocoding API URL
    const params = new URLSearchParams({
      address: placeName,
      key: apiKey,
      region: 'at' // Bias results to Austria
    });
    
    const url = `https://maps.googleapis.com/maps/api/geocode/json?${params}`;
    
    // Fetch data from Google API
    const data = await fetchJson(url);
    
    // Handle API status codes
    if (data.status !== 'OK') {
      const errorMap: Record<string, string> = {
        ZERO_RESULTS: 'Place not found',
        OVER_QUERY_LIMIT: 'API quota exceeded',
        REQUEST_DENIED: 'Google API authentication failed',
        INVALID_REQUEST: 'Invalid place name'
      };
      
      const errorMessage = errorMap[data.status] || 'Geocoding failed';
      throw new Error(errorMessage);
    }
    
    // Extract first result
    const result = data.results[0];
    
    if (!result || !result.geometry || !result.geometry.location) {
      throw new Error('Invalid geocoding response');
    }
    
    return {
      place: placeName,
      formattedAddress: result.formatted_address,
      coordinates: {
        lat: result.geometry.location.lat,
        lon: result.geometry.location.lng // Convert lng to lon for consistency
      }
    };
    
  } catch (error: any) {
    console.error('Geocoding API error:', error);
    
    // Re-throw with preserved error message
    if (error.message) {
      throw error;
    }
    
    throw new Error('Geocoding service unavailable');
  }
}
