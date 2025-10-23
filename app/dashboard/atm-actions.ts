"use server";

interface AtmLocation {
  place_id: string;
  name: string;
  vicinity: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  distance?: number;
}

interface GeocodeResult {
  lat: number;
  lng: number;
  formatted_address: string;
}

interface GooglePlacesResponse {
  status: string;
  results: Array<{
    place_id: string;
    name: string;
    vicinity: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
    rating?: number;
    user_ratings_total?: number;
  }>;
}

interface GoogleGeocodeResponse {
  status: string;
  results: Array<{
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
    formatted_address: string;
  }>;
}

/**
 * Search for nearby Chase ATMs using Google Places API
 */
export async function searchNearbyATMs(
  lat: number,
  lng: number,
): Promise<AtmLocation[]> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error("Google Maps API key not configured");
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
        `location=${lat},${lng}&` +
        `radius=5000&` +
        `keyword=Chase ATM&` +
        `type=atm&` +
        `key=${apiKey}`,
    );

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status}`);
    }

    const data = (await response.json()) as GooglePlacesResponse;

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(`Google Places API error: ${data.status}`);
    }

    // Calculate distance for each result
    const results = data.results.map((place) => ({
      ...place,
      distance: calculateDistance(
        lat,
        lng,
        place.geometry.location.lat,
        place.geometry.location.lng,
      ),
    }));

    // Sort by distance (closest first)
    return results.sort(
      (a: AtmLocation, b: AtmLocation) => (a.distance || 0) - (b.distance || 0),
    );
  } catch (error) {
    console.error("Error searching for ATMs:", error);
    throw new Error("Failed to search for nearby ATMs");
  }
}

/**
 * Geocode an address to get latitude and longitude
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error("Google Maps API key not configured");
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?` +
        `address=${encodeURIComponent(address)}&` +
        `key=${apiKey}`,
    );

    if (!response.ok) {
      throw new Error(`Google Geocoding API error: ${response.status}`);
    }

    const data = (await response.json()) as GoogleGeocodeResponse;

    if (data.status !== "OK" || !data.results.length) {
      throw new Error(`Geocoding failed: ${data.status}`);
    }

    const result = data.results[0];
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted_address: result.formatted_address,
    };
  } catch (error) {
    console.error("Error geocoding address:", error);
    throw new Error("Failed to geocode address");
  }
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
