/**
 * Shared validation utilities for API endpoints
 */

export interface CoordinateValidationResult {
  valid: true;
  lat: number;
  lon: number;
}

export interface ValidationError {
  valid: false;
  error: string;
}

/**
 * Parse and validate a single coordinate pair (lat, lon)
 */
export function parseCoordinates(
  lat: string | undefined,
  lon: string | undefined,
  prefix = ''
): CoordinateValidationResult | ValidationError {
  const latParam = prefix ? `${prefix}_lat` : 'lat';
  const lonParam = prefix ? `${prefix}_lon` : 'lon';

  if (!lat || !lon) {
    return { valid: false, error: `Missing required parameters: ${latParam}, ${lonParam}` };
  }

  const parsedLat = parseFloat(lat);
  const parsedLon = parseFloat(lon);

  if (isNaN(parsedLat) || isNaN(parsedLon)) {
    return { valid: false, error: 'Coordinates must be valid numbers' };
  }

  if (parsedLat < -90 || parsedLat > 90) {
    return { valid: false, error: 'Latitude must be between -90 and 90' };
  }

  if (parsedLon < -180 || parsedLon > 180) {
    return { valid: false, error: 'Longitude must be between -180 and 180' };
  }

  return { valid: true, lat: parsedLat, lon: parsedLon };
}

/**
 * Parse and validate two coordinate pairs (A and B)
 */
export function parseCoordinatePair(
  latA: string | undefined,
  lonA: string | undefined,
  latB: string | undefined,
  lonB: string | undefined
): { valid: true; latA: number; lonA: number; latB: number; lonB: number } | ValidationError {
  if (!latA || !lonA || !latB || !lonB) {
    return { valid: false, error: 'Missing required parameters: lat_a, lon_a, lat_b, lon_b' };
  }

  const parsedLatA = parseFloat(latA);
  const parsedLonA = parseFloat(lonA);
  const parsedLatB = parseFloat(latB);
  const parsedLonB = parseFloat(lonB);

  if ([parsedLatA, parsedLonA, parsedLatB, parsedLonB].some(isNaN)) {
    return { valid: false, error: 'Coordinates must be valid numbers' };
  }

  if (parsedLatA < -90 || parsedLatA > 90 || parsedLatB < -90 || parsedLatB > 90) {
    return { valid: false, error: 'Latitude must be between -90 and 90' };
  }

  if (parsedLonA < -180 || parsedLonA > 180 || parsedLonB < -180 || parsedLonB > 180) {
    return { valid: false, error: 'Longitude must be between -180 and 180' };
  }

  return { valid: true, latA: parsedLatA, lonA: parsedLonA, latB: parsedLatB, lonB: parsedLonB };
}

/**
 * Validate time string in HH:MM:SS format
 */
export function validateTimeFormat(time: string | undefined): { valid: true; time: string } | ValidationError {
  if (!time) {
    return { valid: false, error: 'Missing required parameter: departure_time' };
  }

  if (!/^\d{2}:\d{2}:\d{2}$/.test(time)) {
    return { valid: false, error: 'departure_time must be in HH:MM:SS format' };
  }

  return { valid: true, time };
}

/**
 * Validate max_transfers parameter (0-5)
 */
export function validateMaxTransfers(value: string | undefined): { valid: true; maxTransfers: number } | ValidationError {
  if (!value) {
    return { valid: false, error: 'Missing required parameter: max_transfers' };
  }

  const parsed = parseInt(value);

  if (isNaN(parsed) || parsed < 0 || parsed > 5) {
    return { valid: false, error: 'max_transfers must be an integer between 0 and 5' };
  }

  return { valid: true, maxTransfers: parsed };
}

/**
 * Validate non-empty string parameter
 */
export function validateRequiredString(
  value: string | undefined,
  paramName: string
): { valid: true; value: string } | ValidationError {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    return { valid: false, error: `Missing required parameter: ${paramName}` };
  }

  return { valid: true, value: value.trim() };
}

/**
 * Validate email format (basic)
 */
export function validateEmail(value: string | undefined): { valid: true; value: string } | ValidationError {
  if (!value || typeof value !== 'string') {
    return { valid: false, error: 'Missing required parameter: email' };
  }

  const trimmed = value.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true, value: trimmed };
}

/**
 * Validate password strength (minimum 8 characters)
 */
export function validatePassword(value: string | undefined): { valid: true; value: string } | ValidationError {
  if (!value || typeof value !== 'string') {
    return { valid: false, error: 'Missing required parameter: password' };
  }

  if (value.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  return { valid: true, value };
}

/**
 * Validate time string in HH:MM format
 */
export function validateTimeValue(value: string | undefined, paramName: string): { valid: true; value: string } | ValidationError {
  if (!value) {
    return { valid: false, error: `Missing required parameter: ${paramName}` };
  }

  if (!/^\d{2}:\d{2}$/.test(value)) {
    return { valid: false, error: `${paramName} must be in HH:MM format` };
  }

  return { valid: true, value };
}

/**
 * Validate days of week array (0-6)
 */
export function validateDaysOfWeek(values: unknown): { valid: true; value: number[] } | ValidationError {
  if (!Array.isArray(values)) {
    return { valid: false, error: 'days must be an array of numbers (0-6)' };
  }

  const parsed = values.map((day) => Number(day));
  if (parsed.some((day) => Number.isNaN(day) || day < 0 || day > 6)) {
    return { valid: false, error: 'days must contain integers between 0 and 6' };
  }

  const unique = Array.from(new Set(parsed));
  return { valid: true, value: unique };
}

/**
 * Map error messages to HTTP status codes
 */
export function getErrorStatus(error: Error): { status: number; error: string; message?: string } {
  const msg = error.message || '';
  
  if (msg.includes('not found')) {
    return { status: 404, error: 'Not found', message: msg };
  }
  if (msg.includes('unavailable') || msg.includes('timeout') || msg.includes('quota')) {
    return { status: 503, error: 'Service temporarily unavailable', message: msg };
  }
  if (msg.includes('authentication') || msg.includes('API key')) {
    return { status: 500, error: 'Service configuration error' };
  }
  
  return { status: 500, error: 'Internal server error', message: msg };
}
