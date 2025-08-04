// Google Maps Distance Matrix API integration
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Store locations for Cornerstone Landscape Supplies
const STORE_LOCATIONS = {
  Framingham: 'Framingham, MA, USA',
  Marlborough: 'Marlborough, MA, USA'
};

interface DistanceMatrixResponse {
  rows: Array<{
    elements: Array<{
      status: string;
      duration?: {
        text: string;
        value: number; // in seconds
      };
      distance?: {
        text: string;
        value: number; // in meters
      };
    }>;
  }>;
  status: string;
}

// Rate limiting to prevent API abuse
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 10; // Max 10 requests per minute
  private readonly timeWindow = 60000; // 1 minute in milliseconds

  canMakeRequest(): boolean {
    const now = Date.now();
    // Remove requests older than time window
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    
    if (this.requests.length >= this.maxRequests) {
      return false;
    }
    
    this.requests.push(now);
    return true;
  }

  getTimeUntilNextRequest(): number {
    if (this.requests.length === 0) return 0;
    const oldestRequest = Math.min(...this.requests);
    return Math.max(0, this.timeWindow - (Date.now() - oldestRequest));
  }
}

const rateLimiter = new RateLimiter();

export const calculateTravelTime = async (
  originStore: 'Framingham' | 'Marlborough',
  destinationAddress: string
): Promise<{
  success: boolean;
  travelTimeMinutes?: number;
  error?: string;
}> => {
  // Validate inputs
  if (!GOOGLE_MAPS_API_KEY) {
    console.error('Google Maps API key not configured');
    return {
      success: false,
      error: 'Google Maps API not configured'
    };
  }

  if (!destinationAddress || destinationAddress.trim().length < 5) {
    return {
      success: false,
      error: 'Please enter a valid delivery address'
    };
  }

  // Check rate limiting
  if (!rateLimiter.canMakeRequest()) {
    const waitTime = Math.ceil(rateLimiter.getTimeUntilNextRequest() / 1000);
    return {
      success: false,
      error: `Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`
    };
  }

  const origin = STORE_LOCATIONS[originStore];
  const destination = destinationAddress.trim();

  // Build API URL with proper encoding
  const params = new URLSearchParams({
    origins: origin,
    destinations: destination,
    units: 'imperial',
    mode: 'driving',
    traffic_model: 'best_guess',
    departure_time: 'now',
    key: GOOGLE_MAPS_API_KEY
  });

  const apiUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`;

  try {
    // Use a proxy to avoid CORS issues in development
    const proxyUrl = `/api/distance-matrix?${params}`;
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: DistanceMatrixResponse = await response.json();

    // Check API response status
    if (data.status !== 'OK') {
      console.error('Google Maps API error:', data.status);
      return {
        success: false,
        error: `Google Maps API error: ${data.status}`
      };
    }

    // Extract travel time from response
    const element = data.rows[0]?.elements[0];
    
    if (!element || element.status !== 'OK') {
      return {
        success: false,
        error: 'Could not calculate travel time for this address'
      };
    }

    if (!element.duration) {
      return {
        success: false,
        error: 'Travel time data not available'
      };
    }

    // Convert seconds to minutes and add buffer for round trip
    const oneWayMinutes = Math.ceil(element.duration.value / 60);
    const roundTripMinutes = oneWayMinutes * 2;
    
    // Add 20% buffer for traffic and loading/unloading time
    const bufferedTime = Math.ceil(roundTripMinutes * 1.2);

    return {
      success: true,
      travelTimeMinutes: bufferedTime
    };

  } catch (error) {
    console.error('Error calculating travel time:', error);
    
    // Fallback to estimated time based on distance from store
    const estimatedTime = getEstimatedTravelTime(originStore, destinationAddress);
    
    return {
      success: false,
      error: 'Unable to get real-time travel data. Using estimated time.',
      travelTimeMinutes: estimatedTime
    };
  }
};

// Fallback function for when API is unavailable
const getEstimatedTravelTime = (
  originStore: 'Framingham' | 'Marlborough',
  destinationAddress: string
): number => {
  // Simple estimation based on typical delivery ranges
  // This is a fallback when the API is unavailable
  
  const address = destinationAddress.toLowerCase();
  
  // Check for nearby towns (shorter delivery times)
  const nearbyTowns = [
    'framingham', 'marlborough', 'natick', 'ashland', 'hopkinton',
    'sudbury', 'wayland', 'weston', 'wellesley', 'needham'
  ];
  
  const isNearby = nearbyTowns.some(town => address.includes(town));
  
  if (isNearby) {
    return 45; // 45 minutes round trip for nearby deliveries
  }
  
  // Default to 75 minutes for farther deliveries
  return 75;
};

// Validate address format (basic validation)
export const validateAddress = (address: string): boolean => {
  if (!address || address.trim().length < 5) {
    return false;
  }
  
  // Basic address validation - should contain some numbers and letters
  const hasNumbers = /\d/.test(address);
  const hasLetters = /[a-zA-Z]/.test(address);
  
  return hasNumbers && hasLetters;
};