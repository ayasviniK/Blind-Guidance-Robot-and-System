// Utility functions for the Guiding Robot application

/**
 * Format GPS coordinates for display
 */
export const formatCoordinate = (
  value: number | undefined,
  isLatitude: boolean
): string => {
  if (value === undefined) return "N/A";
  const direction = isLatitude
    ? value >= 0
      ? "N"
      : "S"
    : value >= 0
    ? "E"
    : "W";
  return `${Math.abs(value).toFixed(6)}° ${direction}`;
};

/**
 * Calculate distance between two GPS coordinates (Haversine formula)
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Radius of the Earth in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Convert degrees to radians
 */
const toRad = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

/**
 * Format timestamp to readable time
 */
export const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
};

/**
 * Format timestamp to readable date and time
 */
export const formatDateTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

/**
 * Get battery color based on level
 */
export const getBatteryColor = (level: number): string => {
  if (level > 50) return "green";
  if (level > 20) return "yellow";
  return "red";
};

/**
 * Get accuracy color based on GPS accuracy
 */
export const getAccuracyColor = (accuracy: number | undefined): string => {
  if (!accuracy) return "gray";
  if (accuracy < 10) return "green";
  if (accuracy < 50) return "yellow";
  return "red";
};

/**
 * Validate environment variables
 */
export const validateEnvVars = (): { valid: boolean; missing: string[] } => {
  const required = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID",
    "VITE_FIREBASE_DATABASE_URL",
    "VITE_GEMINI_API_KEY",
  ];

  const missing = required.filter((key) => !import.meta.env[key]);

  return {
    valid: missing.length === 0,
    missing,
  };
};

/**
 * Debounce function for performance optimization
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Check if browser supports required features
 */
export const checkBrowserSupport = (): {
  speechRecognition: boolean;
  speechSynthesis: boolean;
  geolocation: boolean;
} => {
  return {
    speechRecognition:
      "webkitSpeechRecognition" in window || "SpeechRecognition" in window,
    speechSynthesis: "speechSynthesis" in window,
    geolocation: "geolocation" in navigator,
  };
};

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
    return false;
  }
};

/**
 * Generate Google Maps URL from coordinates
 */
export const getGoogleMapsUrl = (lat: number, lng: number): string => {
  return `https://www.google.com/maps?q=${lat},${lng}`;
};

/**
 * Sanitize user input
 */
export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, "");
};
