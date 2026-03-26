/**
 * Geo-Location Validator
 * Uses Haversine formula to calculate distance between customer & worker.
 * Blocks verification if distance > 100 meters.
 */

export interface GeoValidationResult {
  isValid: boolean;
  distance: number; // in meters
  geoVerified: boolean;
  customerLat: number;
  customerLng: number;
  workerLat: number;
  workerLng: number;
  message?: string;
}

const EARTH_RADIUS_METERS = 6_371_000; // Earth's radius in meters
const MAX_DISTANCE_METERS = 100; // 100 meter threshold

/**
 * Haversine formula — returns distance between two coordinates in meters.
 */
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
};

/**
 * Validates that the customer is within 100 meters of the worker.
 */
export const validateProximity = (
  customerLat: number,
  customerLng: number,
  workerLat: number,
  workerLng: number
): GeoValidationResult => {
  const distance = calculateDistance(customerLat, customerLng, workerLat, workerLng);
  const isValid = distance <= MAX_DISTANCE_METERS;

  return {
    isValid,
    distance: Math.round(distance),
    geoVerified: isValid,
    customerLat,
    customerLng,
    workerLat,
    workerLng,
    message: isValid
      ? `Location verified (${Math.round(distance)}m)`
      : `Location mismatch (${Math.round(distance)}m away). Please verify at the work location.`,
  };
};

/**
 * Gets the current position of the user as a Promise.
 */
export const getCurrentPosition = (): Promise<{ lat: number; lng: number }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(new Error(`Location access denied: ${error.message}`));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
};

/**
 * Reverse geocodes coordinates to a human-readable city/area name.
 * Uses OpenStreetMap's Nominatim (free, open source).
 */
export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`
    );
    const data = await response.json();
    
    // Attempt to find the most relevant city/town name
    const address = data.address;
    const city = address.city || address.town || address.village || address.suburb || address.county;
    const state = address.state;
    
    if (city && state) return `${city}, ${state}`;
    if (city) return city;
    return data.display_name.split(",")[0] || "Unknown Location";
  } catch (err) {
    console.error("Reverse geocode failed:", err);
    return "Unknown Location";
  }
};
