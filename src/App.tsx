import { useState, useEffect, useRef, useCallback } from "react";
import {
  MapPin,
  Activity,
  AlertTriangle,
  Navigation,
  Radio,
  Search,
  Target,
  Play,
  Square,
  MapPinned,
  Camera,
  Volume2,
} from "lucide-react";
import firebase from "firebase/compat/app";
import "firebase/compat/database";

// Import our new components
import CameraFeed from "./components/CameraFeed";
import NavigationControls from "./components/Navigation";
import VisionAssistant from "./components/VisionAssistant";
import AudioControls from "./components/AudioControls";

// Backend API URL - uses environment variable or defaults to localhost
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

// Comprehensive Google Maps API type declarations
declare global {
  interface Window {
    google: {
      maps: {
        Map: typeof Map;
        Marker: typeof Marker;
        LatLng: typeof LatLng;
        Size: typeof Size;
        Point: typeof Point;
        DirectionsService: typeof DirectionsService;
        DirectionsRenderer: typeof DirectionsRenderer;
        MapTypeId: {
          HYBRID: string;
          ROADMAP: string;
          SATELLITE: string;
          TERRAIN: string;
        };
        TravelMode: {
          BICYCLING: string;
          DRIVING: string;
          TRANSIT: string;
          WALKING: string;
        };
        Animation: {
          BOUNCE: number;
          DROP: number;
        };
        DirectionsStatus: {
          OK: string;
          NOT_FOUND: string;
          ZERO_RESULTS: string;
        };
      };
    };
  }
}

// Type definitions for Google Maps objects
interface GoogleMapsLatLngLiteral {
  lat: number;
  lng: number;
}

interface GoogleMapsMapOptions {
  center: GoogleMapsLatLngLiteral;
  zoom: number;
  mapTypeId?: string;
  zoomControl?: boolean;
  mapTypeControl?: boolean;
  scaleControl?: boolean;
  streetViewControl?: boolean;
  rotateControl?: boolean;
  fullscreenControl?: boolean;
}

interface GoogleMapsMarkerOptions {
  position: GoogleMapsLatLngLiteral;
  map?: any;
  title?: string;
  icon?: string | GoogleMapsIcon;
  animation?: number;
}

interface GoogleMapsIcon {
  url: string;
  scaledSize: any;
  anchor: any;
}

interface GoogleMapsDirectionsRequest {
  origin: string | GoogleMapsLatLngLiteral;
  destination: string | GoogleMapsLatLngLiteral;
  travelMode: string;
  avoidHighways?: boolean;
  avoidTolls?: boolean;
  optimizeWaypoints?: boolean;
}

interface GoogleMapsDirectionsResult {
  routes: GoogleMapsDirectionsRoute[];
}

interface GoogleMapsDirectionsRoute {
  legs: GoogleMapsDirectionsLeg[];
}

interface GoogleMapsDirectionsLeg {
  steps: GoogleMapsDirectionsStep[];
  distance?: { text: string; value: number };
  duration?: { text: string; value: number };
}

interface GoogleMapsDirectionsStep {
  instructions: string;
  start_location: { lat(): number; lng(): number };
  end_location: { lat(): number; lng(): number };
  distance: { text: string; value: number };
  duration: { text: string; value: number };
}

interface GoogleMapsDirectionsRendererOptions {
  suppressMarkers?: boolean;
  preserveViewport?: boolean;
  polylineOptions?: {
    strokeColor?: string;
    strokeWeight?: number;
  };
}

// Declare classes that will be available on window.google.maps
declare class Map {
  constructor(mapDiv: HTMLElement, opts?: GoogleMapsMapOptions);
  setCenter(latlng: GoogleMapsLatLngLiteral): void;
  setZoom(zoom: number): void;
  addListener(event: string, handler: () => void): void;
}

declare class Marker {
  constructor(opts?: GoogleMapsMarkerOptions);
  setPosition(position: GoogleMapsLatLngLiteral): void;
  setMap(map: Map | null): void;
  getMap(): Map | null;
  setIcon(icon: any): void;
  setTitle(title: string): void;
}

declare class LatLng {
  constructor(lat: number, lng: number);
  lat(): number;
  lng(): number;
}

declare class Size {
  constructor(width: number, height: number);
}

declare class Point {
  constructor(x: number, y: number);
}

declare class DirectionsService {
  route(
    request: GoogleMapsDirectionsRequest,
    callback: (
      result: GoogleMapsDirectionsResult | null,
      status: string
    ) => void
  ): void;
}

declare class DirectionsRenderer {
  constructor(opts?: GoogleMapsDirectionsRendererOptions);
  setMap(map: Map | null): void;
  setDirections(directions: GoogleMapsDirectionsResult): void;
}

const firebaseConfig = {
  apiKey: "AIzaSyD5FgSjod88Z0uVDWzJqZxkPHrOi9rB6ng",
  authDomain: "theguidingrobot.firebaseapp.com",
  databaseURL:
    "https://theguidingrobot-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "theguidingrobot",
  storageBucket: "theguidingrobot.firebasestorage.app",
  messagingSenderId: "699741370113",
  appId: "1:699741370113:web:75f4a49afa314b13320d00",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

interface GPSData {
  lat: number;
  lng: number;
}

interface SensorData {
  front: number;
  left: number;
  right: number;
}

interface StatusData {
  state: string;
  sev: number;
}

interface TripData {
  active: boolean;
  startLat: number;
  startLng: number;
  destLat: number;
  destLng: number;
  startTime: number;
}

interface Waypoint {
  lat: number;
  lng: number;
  instruction?: string;
  distance?: number;
}

function App() {
  const [gpsData, setGpsData] = useState<GPSData>({ lat: 0, lng: 0 });
  const [sensorData, setSensorData] = useState<SensorData>({
    front: 0,
    left: 0,
    right: 0,
  });
  const [statusData, setStatusData] = useState<StatusData>({
    state: "initializing",
    sev: 0,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [destination, setDestination] = useState("");
  const [showRoute, setShowRoute] = useState(false);
  const [destinationCoords, setDestinationCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // 🏠 Home location - Set your home GPS coordinates here
  const [homeLocation] = useState<{ lat: number; lng: number }>({
    lat: 7.238723, // Replace with your home latitude
    lng: 80.568565, // Replace with your home longitude
  });

  const [tripActive, setTripActive] = useState(false);
  const [inputMode] = useState<"address" | "coords">("address");
  const [coordLat] = useState("");
  const [coordLng] = useState("");
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [routeDistance, setRouteDistance] = useState<string>("");
  const [routeDuration, setRouteDuration] = useState<string>("");

  // 🎯 NEW: Real-time navigation tracking
  const [remainingDistance, setRemainingDistance] = useState<number>(0);
  const [currentLocationName, setCurrentLocationName] = useState<string>("");
  const [estimatedArrival, setEstimatedArrival] = useState<string>("");
  const [loadingRoute, setLoadingRoute] = useState(false);

  // New state for expanded view - combine camera and vision assistant
  const [activeView, setActiveView] = useState<"map" | "camera" | "navigation">(
    "map"
  );

  // State to control map auto-centering behavior
  const [mapAutoCenterEnabled, setMapAutoCenterEnabled] = useState(true);
  const [hasUserInteractedWithMap, setHasUserInteractedWithMap] =
    useState(false);
  const [hasInitialCenteringDone, setHasInitialCenteringDone] = useState(false);

  // Navigation mode state
  const [isNavigationMode, setIsNavigationMode] = useState(false);
  const [isTripStarted, setIsTripStarted] = useState(false);
  const [previousGpsPosition, setPreviousGpsPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [currentHeading, setCurrentHeading] = useState<number>(0);
  const [currentZoomLevel, setCurrentZoomLevel] = useState<number>(15);

  // Vision analysis during navigation
  const [visionAnalysisInterval, setVisionAnalysisInterval] = useState<
    number | null
  >(null);
  const [isZooming, setIsZooming] = useState(false);

  // Voice guidance for blind navigation
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);

  // 🤖 NEW: Robot autonomous navigation state
  const [isRobotNavigating, setIsRobotNavigating] = useState(false);
  const [robotDistance, setRobotDistance] = useState<number | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<Map | null>(null);
  const currentLocationMarkerRef = useRef<Marker | null>(null);
  const lastGpsUpdateRef = useRef<number>(0);
  const lastBackendGpsUpdateRef = useRef<number>(0); // For throttling backend GPS updates
  const routeOriginRef = useRef<{ lat: number; lng: number } | null>(null);
  // Note: destinationMarkerRef removed - not currently used
  const directionsServiceRef = useRef<DirectionsService | null>(null);
  const directionsRendererRef = useRef<DirectionsRenderer | null>(null);

  // 🎯 Calculate remaining distance to destination
  const calculateDistance = useCallback(
    (lat1: number, lng1: number, lat2: number, lng2: number): number => {
      const R = 6371000; // Earth's radius in meters
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c; // Distance in meters
    },
    []
  );

  // 🎯 Format distance for display
  const formatDistance = useCallback((meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    } else {
      return `${(meters / 1000).toFixed(1)}km`;
    }
  }, []);

  // 🎯 Get location name from coordinates (simplified version)
  const getLocationName = useCallback(
    async (lat: number, lng: number): Promise<string> => {
      try {
        // For now, return coordinates - in real app you'd use reverse geocoding
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      } catch {
        return "Current Location";
      }
    },
    []
  );

  // Initialize speech synthesis for blind navigation
  useEffect(() => {
    if (window.speechSynthesis) {
      // Initialize speech synthesis
      window.speechSynthesis;
      // Enable voice by default for accessibility
      setIsVoiceEnabled(true);

      // Wait for voices to load
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          console.log("🔊 Speech synthesis ready for blind navigation");
          speak(
            "Voice navigation system activated. Audio guidance is now available."
          );
        }
      };

      if (window.speechSynthesis.getVoices().length > 0) {
        loadVoices();
      } else {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  useEffect(() => {
    const db = firebase.database();

    const gpsRef = db.ref("devices/esp32A/gps");
    const sensorRef = db.ref("devices/esp32B/sensors");
    const statusRef = db.ref("devices/esp32B/status");

    gpsRef.on("value", (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGpsData(data);
        setIsConnected(true);

        // 🎯 FIXED: Always update backend with current location (for navigation and location awareness)
        updateBackendGPS(data.lat, data.lng);
      }
    });

    sensorRef.on("value", (snapshot) => {
      const data = snapshot.val();
      if (data) setSensorData(data);
    });

    statusRef.on("value", (snapshot) => {
      const data = snapshot.val();
      if (data) setStatusData(data);
    });

    return () => {
      gpsRef.off();
      sensorRef.off();
      statusRef.off();
    };
  }, []);

  // 🎯 Update remaining distance and location name when GPS or destination changes
  useEffect(() => {
    const updateNavigationInfo = async () => {
      if (
        tripActive &&
        destinationCoords &&
        gpsData.lat !== 0 &&
        gpsData.lng !== 0
      ) {
        // Calculate remaining distance
        const distance = calculateDistance(
          gpsData.lat,
          gpsData.lng,
          destinationCoords.lat,
          destinationCoords.lng
        );
        setRemainingDistance(distance);

        // 🎯 Auto-end trip and clear destination when very close (within 10 meters)
        if (distance <= 10) {
          console.log(
            "🎯 Destination reached! Auto-ending trip and clearing destination..."
          );
          try {
            await endTrip();
            speak(
              "Destination reached! Trip completed and destination cleared."
            );
          } catch (error) {
            console.error("Error auto-ending trip:", error);
          }
        }

        // Get current location name
        const locationName = await getLocationName(gpsData.lat, gpsData.lng);
        setCurrentLocationName(locationName);

        // Estimate arrival time (assuming walking speed of 5 km/h = 1.4 m/s)
        const walkingSpeed = 1.4; // meters per second
        const timeInSeconds = Math.round(distance / walkingSpeed);
        const minutes = Math.floor(timeInSeconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
          setEstimatedArrival(`${hours}h ${minutes % 60}m`);
        } else if (minutes > 0) {
          setEstimatedArrival(`${minutes}m`);
        } else {
          setEstimatedArrival(`${timeInSeconds}s`);
        }
      }
    };

    updateNavigationInfo();
  }, [
    tripActive,
    destinationCoords,
    gpsData,
    calculateDistance,
    getLocationName,
  ]);

  // 🎯 NEW: Update backend navigation with real-time GPS
  const updateBackendGPS = async (lat: number, lng: number) => {
    // Throttle backend GPS updates to once every 20 seconds
    const now = Date.now();
    const timeSinceLastUpdate = now - lastBackendGpsUpdateRef.current;

    if (timeSinceLastUpdate < 20000) {
      // 20 seconds
      // Skip this update
      return;
    }

    lastBackendGpsUpdateRef.current = now;

    try {
      const response = await fetch(`${BACKEND_URL}/navigation/update-gps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });

      if (!response.ok) {
        console.log(
          "Backend navigation not available (server may not be running)"
        );
        return;
      }

      const result = await response.json();

      // Log different messages based on navigation state
      if (tripActive && result.navigation_active) {
        console.log("🧭 Navigation GPS updated (20s interval):", {
          lat,
          lng,
          navigation_active: true,
        });
      } else {
        console.log("📍 Location updated (20s interval):", { lat, lng });
      }
    } catch (error) {
      console.log(
        "Backend navigation not available:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  };

  const getStatusColor = (state: string) => {
    switch (state) {
      case "obstacle":
        return "from-red-500 to-red-700";
      case "forward":
        return "from-emerald-500 to-emerald-700";
      default:
        return "from-amber-500 to-amber-700";
    }
  };

  const getSeverityColor = (sev: number) => {
    if (sev < 85) return "from-emerald-400 to-emerald-600";
    if (sev < 170) return "from-amber-400 to-amber-600";
    return "from-red-400 to-red-600";
  };

  const getSensorColor = (value: number) => {
    if (value > 100) return "text-emerald-400";
    if (value > 50) return "text-amber-400";
    return "text-red-400";
  };

  const waitForGoogleMaps = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) {
        resolve();
        return;
      }

      // Wait up to 10 seconds for Google Maps to load
      let attempts = 0;
      const maxAttempts = 100;
      const interval = setInterval(() => {
        attempts++;
        if (window.google && window.google.maps) {
          clearInterval(interval);
          resolve();
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error("Google Maps SDK failed to load"));
        }
      }, 100);
    });
  };

  // Calculate bearing/heading between two GPS coordinates (in degrees)
  const calculateHeading = (
    from: { lat: number; lng: number },
    to: { lat: number; lng: number }
  ): number => {
    const toRadians = (deg: number) => deg * (Math.PI / 180);
    const toDegrees = (rad: number) => rad * (180 / Math.PI);

    const dLng = toRadians(to.lng - from.lng);
    const lat1 = toRadians(from.lat);
    const lat2 = toRadians(to.lat);

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

    const bearing = toDegrees(Math.atan2(y, x));
    return (bearing + 360) % 360; // Normalize to 0-360 degrees
  };

  // Voice guidance functions for blind navigation
  const speak = (message: string) => {
    if (!isVoiceEnabled || !window.speechSynthesis) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to use a clear voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (voice) =>
        voice.name.includes("Alex") ||
        voice.name.includes("Daniel") ||
        voice.lang === "en-US"
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
    console.log(`🔊 Speaking: ${message}`);
  };

  const bearingToDirection = (bearing: number): string => {
    const directions = [
      "North",
      "North-East",
      "East",
      "South-East",
      "South",
      "South-West",
      "West",
      "North-West",
    ];
    const idx = Math.round(bearing / 45) % 8;
    return directions[idx];
  };

  const getDirections = async (
    start: GPSData,
    dest: { lat: number; lng: number }
  ) => {
    try {
      await waitForGoogleMaps();
    } catch (error) {
      console.error("Google Maps SDK not available:", error);
      // Create basic waypoints without Google Directions API
      const basicWaypoints: Waypoint[] = [
        {
          lat: dest.lat,
          lng: dest.lng,
          instruction: `Navigate to destination at ${dest.lat.toFixed(
            6
          )}, ${dest.lng.toFixed(6)}`,
          distance: 0,
        },
      ];
      setWaypoints(basicWaypoints);
      setRouteDistance("Unknown");
      setRouteDuration("Unknown");
      return basicWaypoints;
    }

    return new Promise<Waypoint[]>((resolve, reject) => {
      setLoadingRoute(true);

      const directionsService = new window.google.maps.DirectionsService();

      directionsService.route(
        {
          origin: { lat: start.lat, lng: start.lng },
          destination: { lat: dest.lat, lng: dest.lng },
          travelMode: window.google.maps.TravelMode.WALKING, // Changed to walking for better navigation
          avoidHighways: true, // Avoid highways for safety
          avoidTolls: true, // Avoid toll roads
          optimizeWaypoints: true, // Use most efficient route with main roads
        },
        (result: GoogleMapsDirectionsResult | null, status: string) => {
          setLoadingRoute(false);

          if (status === window.google.maps.DirectionsStatus.OK && result) {
            const leg = result.routes[0].legs[0];

            setRouteDistance(leg.distance?.text || "");
            setRouteDuration(leg.duration?.text || "");

            const steps: Waypoint[] = leg.steps.map(
              (step: GoogleMapsDirectionsStep) => ({
                lat: step.end_location.lat(),
                lng: step.end_location.lng(),
                instruction: step.instructions?.replace(/<[^>]*>/g, ""),
                distance: step.distance?.value,
              })
            );

            setWaypoints(steps);
            console.log("Extracted waypoints:", steps.length, "points");
            resolve(steps);
          } else {
            console.warn("❌ Google Directions API failed:", status);

            // Fallback: Create basic waypoint for direct navigation
            const fallbackWaypoints: Waypoint[] = [
              {
                lat: dest.lat,
                lng: dest.lng,
                instruction: `Navigate directly to destination`,
                distance: 0,
              },
            ];

            setWaypoints(fallbackWaypoints);
            setRouteDistance("Direct route");
            setRouteDuration("Unknown");

            console.log(
              "🔄 Using fallback navigation without Google Directions"
            );

            // Show user-friendly message based on error type
            if (status === "REQUEST_DENIED") {
              console.warn(
                "📋 Google Maps Directions API access denied. Enable billing and APIs in Google Cloud Console."
              );
              alert(
                "Google Maps access limited. Using basic navigation to destination coordinates."
              );
            } else {
              alert(
                `Unable to calculate route (${status}). Using direct navigation to destination.`
              );
            }

            resolve(fallbackWaypoints);
          }
        }
      );
    });
  };

  const handleNavigate = async () => {
    if (inputMode === "coords") {
      const lat = parseFloat(coordLat);
      const lng = parseFloat(coordLng);

      if (isNaN(lat) || isNaN(lng)) {
        alert("Please enter valid GPS coordinates");
        return;
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        alert("Coordinates out of range. Lat: -90 to 90, Lng: -180 to 180");
        return;
      }

      setDestinationCoords({ lat, lng });
      setShowRoute(true);

      try {
        await getDirections(gpsData, { lat, lng });
        console.log("Route calculated with", waypoints.length, "waypoints");
      } catch (error) {
        console.error("Error calculating route:", error);
        alert(
          "Failed to calculate route. Please check your coordinates and try again."
        );
      }
      return;
    }

    if (!destination.trim()) return;

    try {
      console.log("🔍 Geocoding destination:", destination);

      // Improve search query by adding location context for Sri Lankan temples
      const searchQuery =
        destination.toLowerCase().includes("temple") &&
        !destination.includes("sri lanka")
          ? `${destination}, Sri Lanka`
          : destination;

      console.log("🔍 Enhanced search query:", searchQuery);

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          searchQuery
        )}&key=AIzaSyBotokFOtODouLDbapraJJfH3qxNY0p0g8&region=LK`
      );
      const data = await response.json();
      console.log("📍 Geocoding response:", data);

      if (data.results && data.results.length > 0) {
        // Show multiple results for user to see what was found
        console.log("🏛️ Found locations:");
        data.results.forEach((result, index) => {
          console.log(
            `${index + 1}. ${result.formatted_address} (${
              result.geometry.location.lat
            }, ${result.geometry.location.lng})`
          );
        });

        const bestResult = data.results[0];
        const location = bestResult.geometry.location;

        console.log("✅ Selected coordinates:", {
          lat: location.lat,
          lng: location.lng,
        });
        console.log("📍 Selected place:", bestResult.formatted_address);
        console.log("🏷️ Place types:", bestResult.types);

        // Show confirmation to user about what location was found
        const confirmMessage = `Found: ${bestResult.formatted_address}\nProceed with navigation to this location?`;
        if (!confirm(confirmMessage)) {
          return;
        }

        // Clear previous route first
        setShowRoute(false);
        setDestinationCoords(null);
        setIsTripStarted(false); // Reset trip navigation mode

        // Stop backend navigation to clear any previous audio queue
        try {
          await fetch(`${BACKEND_URL}/navigation/stop`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });
          console.log("✅ Previous navigation stopped");
        } catch (error) {
          console.log("Backend navigation stop skipped");
        }

        // Note: Map refresh now handled by Google Maps JavaScript API

        // Then set new destination after a brief delay
        setTimeout(() => {
          setDestinationCoords({ lat: location.lat, lng: location.lng });
          setShowRoute(true);
          console.log("🗺️ Updated destination coordinates and showing route");

          // Voice announcement for destination setting
          speak(
            `Destination set. Tap navigate to calculate your route, then start trip for voice-guided navigation.`
          );

          // Note: Map updates now handled automatically by Google Maps JavaScript API
          console.log(
            "🔄 Destination set, Google Maps API will handle updates automatically"
          );
        }, 300);

        try {
          await getDirections(gpsData, {
            lat: location.lat,
            lng: location.lng,
          });
          console.log(
            "🛤️ Route calculated with",
            waypoints.length,
            "waypoints"
          );
        } catch (dirError) {
          console.error("❌ Error calculating directions:", dirError);
          alert("Failed to calculate route directions. Please try again.");
        }
      } else {
        console.log("❌ No results found for:", searchQuery);
        alert(
          `Address not found for "${destination}". Please try a more specific address or check spelling.`
        );
      }
    } catch (error) {
      console.error("Error geocoding:", error);
      alert(
        "Failed to find address. Please check your internet connection and try again."
      );
    }
  };

  // Vision analysis during navigation
  const startVisionAnalysis = () => {
    console.log("🎥 Starting vision analysis during navigation...");

    // Run vision analysis every 10 seconds during navigation
    const interval = setInterval(async () => {
      try {
        console.log("🧠 Triggering vision analysis...");
        const response = await fetch(`${BACKEND_URL}/analyze-and-speak`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (response.ok) {
          const result = await response.json();
          console.log(
            "✅ Vision analysis completed:",
            result.description?.substring(0, 100)
          );
        } else {
          console.log("⚠️ Vision analysis failed");
        }
      } catch (error) {
        console.log("⚠️ Vision analysis error - backend may not be running");
      }
    }, 10000); // Every 10 seconds

    setVisionAnalysisInterval(interval);
  };

  const stopVisionAnalysis = () => {
    if (visionAnalysisInterval) {
      console.log("🎥 Stopping vision analysis");
      clearInterval(visionAnalysisInterval);
      setVisionAnalysisInterval(null);
    }
  };

  const startTrip = async () => {
    if (!destinationCoords) {
      alert("Please set a destination first");
      return;
    }

    // If waypoints aren't loaded yet, try to calculate them first
    if (waypoints.length === 0) {
      console.log("Waypoints not loaded, calculating route...");
      setLoadingRoute(true);

      try {
        await getDirections(gpsData, destinationCoords);

        // Check again after calculation
        if (waypoints.length === 0) {
          alert(
            "Failed to calculate route. Please try again or check your destination."
          );
          setLoadingRoute(false);
          return;
        }
      } catch (error) {
        console.error("Error calculating route:", error);
        alert(
          "Failed to calculate route. Please check your internet connection and try again."
        );
        setLoadingRoute(false);
        return;
      }
    }

    const db = firebase.database();
    const tripData: TripData = {
      active: true,
      startLat: gpsData.lat,
      startLng: gpsData.lng,
      destLat: destinationCoords.lat,
      destLng: destinationCoords.lng,
      startTime: Date.now(),
    };

    try {
      await db.ref("devices/esp32A/trip").set(tripData);

      await db.ref("devices/esp32A/waypoints").set(waypoints);

      await db.ref("devices/esp32A/routeInfo").set({
        totalWaypoints: waypoints.length,
        distance: routeDistance,
        duration: routeDuration,
        currentWaypointIndex: 0,
      });

      setTripActive(true);
      setIsTripStarted(true); // Activate navigation mode zoom
      console.log("Trip started with", waypoints.length, "waypoints");

      // Voice announcement for blind navigation
      speak(
        `Navigation started. Your journey has ${waypoints.length} waypoints. I will guide you step by step to your destination.`
      );
      console.log("Route info:", {
        distance: routeDistance,
        duration: routeDuration,
      });

      // 🎯 NEW: Start backend voice navigation system
      try {
        console.log("🧭 Starting backend voice navigation...");

        // Convert waypoints to route instructions
        const routeInstructions = waypoints
          .slice(0, 10) // Limit to first 10 instructions
          .map((wp) => wp.instruction)
          .filter((inst) => inst && inst.length > 0);

        // 🎯 NEW: Send current GPS location first so navigation knows where we're starting from
        if (gpsData && gpsData.lat && gpsData.lng) {
          try {
            await fetch(`${BACKEND_URL}/navigation/update-gps`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lat: gpsData.lat, lng: gpsData.lng }),
            });
            console.log(
              "📍 Current location sent to backend:",
              gpsData.lat,
              gpsData.lng
            );
          } catch (error) {
            console.log("⚠️ Could not send current location to backend");
          }
        }

        const navigationResponse = await fetch(
          `${BACKEND_URL}/navigation/start`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              lat: destinationCoords.lat,
              lng: destinationCoords.lng,
              route_instructions: routeInstructions,
              current_location: gpsData
                ? { lat: gpsData.lat, lng: gpsData.lng }
                : null,
            }),
          }
        );

        if (navigationResponse.ok) {
          const navResult = await navigationResponse.json();
          console.log("✅ Voice navigation started:", navResult);

          // 🎥 NEW: Start periodic vision analysis during navigation
          startVisionAnalysis();
        } else {
          console.log(
            "🔧 Voice navigation backend not responding (may not be running)"
          );
        }

        // 🤖 NEW: Start robot navigation automatically when trip starts
        console.log("🤖 Starting robot autonomous navigation...");
        const robotResponse = await fetch(`${BACKEND_URL}/robot/navigate-to`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lat: destinationCoords.lat,
            lng: destinationCoords.lng,
          }),
        });

        if (robotResponse.ok) {
          const robotResult = await robotResponse.json();
          console.log("✅ Robot navigation started:", robotResult);
          setIsRobotNavigating(true);

          speak(
            "Robot autonomous navigation activated. The robot will navigate using GPS."
          );

          // Start monitoring robot status
          const statusInterval = setInterval(async () => {
            try {
              const statusResponse = await fetch(`${BACKEND_URL}/robot/status`);
              if (statusResponse.ok) {
                const status = await statusResponse.json();

                if (status.distance_to_destination !== undefined) {
                  setRobotDistance(status.distance_to_destination);
                }

                // Stop monitoring if navigation completed
                if (!status.is_navigating) {
                  clearInterval(statusInterval);
                  setIsRobotNavigating(false);
                  speak("Robot has arrived at the destination!");
                }
              }
            } catch (error) {
              console.log("⚠️ Could not get robot status");
            }
          }, 5000); // Check every 5 seconds
        } else {
          const robotErrorData = await robotResponse.json();
          console.log("⚠️ Robot navigation not started:", robotErrorData);
        }
      } catch (navError) {
        console.log(
          "🔧 Backend server not running. Start with: cd backend && source venv/bin/activate && python main.py"
        );
        console.log(
          "ℹ️ Trip will work without voice guidance - backend is optional"
        );
      }
    } catch (error) {
      console.error("Error starting trip:", error);
      alert("Failed to start trip");
    }
  };

  const endTrip = async () => {
    console.log("🔴 END TRIP FUNCTION CALLED!"); // DEBUG
    const db = firebase.database();
    try {
      await db.ref("devices/esp32A/trip/active").set(false);
      await db.ref("devices/esp32A/waypoints").remove();
      await db.ref("devices/esp32A/routeInfo").remove();
      setTripActive(false);
      setIsTripStarted(false); // Deactivate navigation mode zoom

      // 🆕 Auto-clear destination and route when trip ends
      setDestination("");
      setDestinationCoords(null);
      setShowRoute(false);
      setWaypoints([]);
      setRouteDistance("");
      setRouteDuration("");
      setRemainingDistance(0);
      console.log("Trip ended, route cleared, and destination removed");

      // Voice announcement for trip completion
      speak(
        "Trip completed successfully. Navigation has ended. Destination cleared. Thank you for using the voice-guided navigation system."
      );

      // 🎥 NEW: Stop vision analysis
      stopVisionAnalysis();

      // 🎯 NEW: Stop backend voice navigation
      try {
        console.log("🎯 Calling /navigation/stop endpoint..."); // DEBUG
        const navResponse = await fetch(`${BACKEND_URL}/navigation/stop`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (navResponse.ok) {
          console.log("✅ Voice navigation stopped");
        } else {
          console.log("⚠️ Voice navigation backend not available");
        }
      } catch (navError) {
        console.log(
          "⚠️ Voice navigation backend not available:",
          navError instanceof Error ? navError.message : "Unknown error"
        );
      }

      // 🤖 NEW: ALWAYS stop robot navigation and update Firebase to "stopped"
      try {
        console.log("🤖 CALLING /robot/stop endpoint..."); // DEBUG
        const robotResponse = await fetch(`${BACKEND_URL}/robot/stop`, {
          method: "POST",
        });

        console.log("🤖 Robot stop response status:", robotResponse.status); // DEBUG

        if (robotResponse.ok) {
          const resultData = await robotResponse.json();
          console.log("✅ Robot navigation stopped - Response:", resultData);
          console.log("✅ Firebase should now show 'stopped'");
          setIsRobotNavigating(false);
          setRobotDistance(null);
          speak("Robot navigation stopped.");
        } else {
          const errorText = await robotResponse.text();
          console.log("⚠️ Robot stop endpoint returned error:", errorText);
        }
      } catch (robotError) {
        console.log(
          "⚠️ Could not connect to robot navigation backend:",
          robotError
        );
      }
    } catch (error) {
      console.error("❌ Error ending trip:", error);
    }
  };

  // 🤖 NEW: Start autonomous robot navigation
  const startRobotNavigation = async () => {
    if (!destinationCoords) {
      alert("Please set a destination first");
      return;
    }

    try {
      console.log("🤖 Starting autonomous robot navigation...");

      const response = await fetch(`${BACKEND_URL}/robot/navigate-to`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lat: destinationCoords.lat,
          lng: destinationCoords.lng,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Robot navigation started:", result);
        setIsRobotNavigating(true);

        speak(
          "Autonomous robot navigation activated. The robot will now navigate to your destination using GPS and obstacle avoidance sensors."
        );

        // Start monitoring robot status
        const statusInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(`${BACKEND_URL}/robot/status`);
            if (statusResponse.ok) {
              const status = await statusResponse.json();

              if (status.distance_to_destination !== undefined) {
                setRobotDistance(status.distance_to_destination);
              }

              // Stop monitoring if navigation completed
              if (!status.is_navigating) {
                clearInterval(statusInterval);
                setIsRobotNavigating(false);
                speak("Robot has arrived at the destination!");
              }
            }
          } catch (error) {
            console.log("⚠️ Could not get robot status");
          }
        }, 5000); // Check every 5 seconds
      } else {
        const errorData = await response.json();
        console.error("❌ Robot navigation failed:", errorData);
        alert(
          `Failed to start robot navigation: ${
            errorData.error || "Unknown error"
          }`
        );
      }
    } catch (error) {
      console.error("❌ Error starting robot navigation:", error);
      alert(
        "Could not connect to robot navigation system. Make sure the backend server is running."
      );
    }
  };

  // 🤖 NEW: Stop autonomous robot navigation
  const stopRobotNavigation = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/robot/stop`, {
        method: "POST",
      });

      if (response.ok) {
        console.log("✅ Robot navigation stopped");
        setIsRobotNavigating(false);
        setRobotDistance(null);
        speak("Robot navigation stopped");
      }
    } catch (error) {
      console.error("❌ Error stopping robot:", error);
    }
  };

  // Handle location-based voice commands
  const handleLocationCommand = async (locationQuery: string) => {
    console.log("🗺️ Processing location command:", locationQuery);
    speak(`Searching for ${locationQuery}`);

    try {
      // Use the existing handleNavigate function which already handles geocoding
      setDestination(locationQuery);

      // Trigger the navigation process by simulating the form submission
      await handleNavigate();
    } catch (error) {
      console.error("Error processing location command:", error);
      speak(
        `Sorry, I could not find ${locationQuery}. Please try a different location.`
      );
    }
  };

  // Handle voice commands for navigation control
  const handleVoiceCommand = async (command: string) => {
    console.log("🎤 Voice command received:", command);
    const lowerCommand = command.toLowerCase();

    try {
      // 🏠 HOME NAVIGATION - Take me home
      if (
        lowerCommand.includes("home") ||
        (lowerCommand.includes("take") &&
          lowerCommand.includes("me") &&
          lowerCommand.includes("home"))
      ) {
        console.log("🏠 Home navigation triggered");
        setDestination("Home");
        setDestinationCoords(homeLocation);
        setShowRoute(true);

        speak("Setting destination to home. Calculating route.");

        // Get directions to home
        try {
          await getDirections(gpsData, homeLocation);
          console.log("🛤️ Route to home calculated");

          // Auto-start trip
          setTimeout(async () => {
            await startTrip();
            speak("Navigation to home started");
          }, 1000);
        } catch (error) {
          console.error("❌ Error calculating route to home:", error);
          speak("Failed to calculate route to home");
        }
      }
      // Start navigation commands - more variations
      else if (
        (lowerCommand.includes("start") ||
          lowerCommand.includes("begin") ||
          lowerCommand.includes("commence")) &&
        (lowerCommand.includes("navigation") ||
          lowerCommand.includes("navigating") ||
          lowerCommand.includes("trip") ||
          lowerCommand.includes("journey") ||
          lowerCommand.includes("route") ||
          lowerCommand.includes("go") ||
          lowerCommand.includes("take me"))
      ) {
        if (destinationCoords) {
          await startTrip();
          speak("Navigation started to your destination");
        } else {
          speak("Please set a destination first");
        }
      }
      // Stop navigation commands - more variations
      else if (
        (lowerCommand.includes("stop") ||
          lowerCommand.includes("end") ||
          lowerCommand.includes("cancel") ||
          lowerCommand.includes("terminate")) &&
        (lowerCommand.includes("navigation") ||
          lowerCommand.includes("navigating") ||
          lowerCommand.includes("trip") ||
          lowerCommand.includes("journey") ||
          lowerCommand.includes("route"))
      ) {
        await endTrip();
        speak("Navigation stopped");
      }
      // Start robot autonomous navigation - more variations
      else if (
        lowerCommand.includes("robot") &&
        (lowerCommand.includes("start") ||
          lowerCommand.includes("go") ||
          lowerCommand.includes("move") ||
          lowerCommand.includes("begin") ||
          lowerCommand.includes("navigate"))
      ) {
        if (destinationCoords) {
          await startRobotNavigation();
          speak("Robot autonomous navigation started");
        } else {
          speak("Please set a destination first for robot navigation");
        }
      }
      // Stop robot navigation - more variations
      else if (
        lowerCommand.includes("robot") &&
        (lowerCommand.includes("stop") ||
          lowerCommand.includes("halt") ||
          lowerCommand.includes("pause"))
      ) {
        await stopRobotNavigation();
        speak("Robot navigation stopped");
      }
      // Status check - more variations
      else if (
        lowerCommand.includes("status") ||
        lowerCommand.includes("where") ||
        lowerCommand.includes("location") ||
        lowerCommand.includes("position") ||
        lowerCommand.includes("current")
      ) {
        const locationName = await getLocationName(gpsData.lat, gpsData.lng);
        if (tripActive && remainingDistance) {
          speak(
            `You are at ${locationName}. Your destination is ${remainingDistance.toFixed(
              0
            )} meters away`
          );
        } else {
          speak(`You are at ${locationName}`);
        }
      }
      // Distance to destination - more variations
      else if (
        lowerCommand.includes("far") ||
        lowerCommand.includes("distance") ||
        lowerCommand.includes("how much") ||
        lowerCommand.includes("away")
      ) {
        if (remainingDistance) {
          speak(
            `The destination is ${remainingDistance.toFixed(0)} meters away`
          );
        } else {
          speak("No active destination set");
        }
      }
      // Recenter map - more variations
      else if (
        lowerCommand.includes("center") ||
        lowerCommand.includes("recenter") ||
        (lowerCommand.includes("show") && lowerCommand.includes("me"))
      ) {
        recenterMap();
        speak("Map centered on your current location");
      }
      // Help command - more variations
      else if (
        lowerCommand.includes("help") ||
        lowerCommand.includes("what can") ||
        lowerCommand.includes("commands") ||
        lowerCommand.includes("what do")
      ) {
        speak(
          "You can say: a location name, go to any place, start navigation, stop navigation, start robot, stop robot, where am I, how far is destination, or center map"
        );
      }
      // Simple greetings
      else if (
        lowerCommand.includes("hello") ||
        lowerCommand.includes("hi") ||
        lowerCommand.includes("hey")
      ) {
        speak(
          "Hello! I'm ready to help you navigate. What would you like to do?"
        );
      }
      // Unknown command - try to parse as location
      else {
        console.log("🗺️ Attempting to parse as location:", command);

        // Check if command contains location keywords
        if (
          lowerCommand.includes("go to") ||
          lowerCommand.includes("take me to") ||
          lowerCommand.includes("navigate to") ||
          lowerCommand.includes("find") ||
          lowerCommand.includes("directions to")
        ) {
          // Extract location from command
          let locationQuery = command;

          // Remove common prefixes
          locationQuery = locationQuery.replace(
            /^(go to|take me to|navigate to|find|directions to)\s*/i,
            ""
          );

          if (locationQuery.trim()) {
            await handleLocationCommand(locationQuery.trim());
          } else {
            speak("Please specify a location");
          }
        }
        // If no specific keywords, try the entire command as a location
        else if (command.trim().length > 2) {
          await handleLocationCommand(command.trim());
        } else {
          console.log("❓ Unrecognized command:", command);
          speak(
            "I didn't understand that command. You can say a location name, or say help to hear available commands"
          );
        }
      }
    } catch (error) {
      console.error("Error handling voice command:", error);
      speak("Sorry, there was an error processing your command");
    }
  };

  // Function to manually recenter map on current location
  const recenterMap = () => {
    if (googleMapRef.current && gpsData.lat !== 0 && gpsData.lng !== 0) {
      googleMapRef.current.setCenter({ lat: gpsData.lat, lng: gpsData.lng });
      googleMapRef.current.setZoom(17);
      setMapAutoCenterEnabled(true); // Re-enable auto-centering
      setHasUserInteractedWithMap(false); // Reset interaction flag
      console.log("🎯 Map manually recentered to current location");
    }
  };

  // ✅ Safe, embed-friendly Google Maps URL builder with markers
  // Note: getMapUrl function removed - now using Google Maps JavaScript API directly

  console.log("� REMOVED:", { lat: gpsData.lat, lng: gpsData.lng });

  // Control iframe updates with route changes
  // Note: mapKey removed - no longer needed with Google Maps JavaScript API
  // Note: prevGpsRef removed - Google Maps API handles GPS change detection automatically

  // Note: hasSignificantGpsChange function removed - Google Maps API handles live updates automatically

  // Note: Iframe-related GPS updates removed - now using Google Maps JavaScript API directly

  // Note: Iframe useEffect blocks removed - now using Google Maps JavaScript API directly

  // Initialize Google Maps when component mounts (only once)
  useEffect(() => {
    const initMap = () => {
      if (!mapContainerRef.current) return;

      // Default center (Colombo, Sri Lanka) - will be updated when GPS data loads
      const defaultCenter = { lat: 6.9271, lng: 79.8612 };

      const mapOptions: GoogleMapsMapOptions = {
        center: defaultCenter,
        zoom: 17,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        zoomControl: true,
        streetViewControl: true,
        fullscreenControl: false,
        mapTypeControl: false,
      };

      // Create the map only once
      googleMapRef.current = new window.google.maps.Map(
        mapContainerRef.current,
        mapOptions
      );

      // Add event listeners to detect user interaction with the map
      if (googleMapRef.current) {
        googleMapRef.current.addListener("dragstart", () => {
          setHasUserInteractedWithMap(true);
          setMapAutoCenterEnabled(false);
          console.log("🖱️ User started dragging map - auto-center disabled");
        });

        googleMapRef.current.addListener("zoom_changed", () => {
          setHasUserInteractedWithMap(true);
          console.log("🔍 User changed zoom level");
        });
      }

      // Initialize directions service and renderer
      directionsServiceRef.current = new window.google.maps.DirectionsService();
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer(
        {
          suppressMarkers: false,
          preserveViewport: true, // Prevent auto-zoom to show full route
          polylineOptions: {
            strokeColor: "#4285F4",
            strokeWeight: 4,
          },
        }
      );
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(googleMapRef.current);
      }

      console.log("🗺️ Interactive Google Maps initialized (one-time setup)");
    };

    // Only initialize once when component mounts
    if (window.google && window.google.maps) {
      initMap();
    } else {
      const checkGoogleMaps = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkGoogleMaps);
          initMap();
        }
      }, 100);
    }
  }, []); // Empty dependency array - initialize only once

  // Center map to GPS location only once when first GPS data loads
  useEffect(() => {
    if (
      googleMapRef.current &&
      gpsData.lat !== 0 &&
      gpsData.lng !== 0 &&
      !hasInitialCenteringDone
    ) {
      const position = { lat: gpsData.lat, lng: gpsData.lng };

      // Center the map to the GPS location when we get valid coordinates (only once)
      googleMapRef.current.setCenter(position);
      console.log("🎯 Map initially centered to GPS location (one-time setup)");

      // Mark initial centering as done and enable auto-center
      setHasInitialCenteringDone(true);
      setMapAutoCenterEnabled(true);
    }
  }, [gpsData.lat, gpsData.lng, hasInitialCenteringDone]); // Run when GPS coordinates change or centering state changes

  // Update current location marker when GPS changes (with debouncing for performance)
  useEffect(() => {
    if (!googleMapRef.current || gpsData.lat === 0 || gpsData.lng === 0) return;

    // Debounce GPS updates - only update marker every 500ms for smooth performance
    const now = Date.now();
    if (
      now - lastGpsUpdateRef.current < 500 &&
      currentLocationMarkerRef.current
    ) {
      // Still update position for real-time tracking, but skip heavy operations
      const position = { lat: gpsData.lat, lng: gpsData.lng };
      currentLocationMarkerRef.current.setPosition(position);

      // Only center if needed (no icon updates to reduce load)
      if (isNavigationMode || mapAutoCenterEnabled) {
        googleMapRef.current.setCenter(position);
      }
      return;
    }

    lastGpsUpdateRef.current = now;
    const position = { lat: gpsData.lat, lng: gpsData.lng };

    // Update navigation mode state - only activate when trip is started, not just route shown
    const shouldBeInNavigationMode = showRoute && isTripStarted;
    if (isNavigationMode !== shouldBeInNavigationMode) {
      setIsNavigationMode(shouldBeInNavigationMode);
    }

    // Calculate heading if we have previous position, are in navigation mode, and moved significantly
    if (previousGpsPosition && isNavigationMode) {
      const distanceMoved = Math.sqrt(
        Math.pow(position.lat - previousGpsPosition.lat, 2) +
          Math.pow(position.lng - previousGpsPosition.lng, 2)
      );

      // Only update heading if we've moved at least 0.00001 degrees (~1 meter)
      if (distanceMoved > 0.00001) {
        const newHeading = calculateHeading(previousGpsPosition, position);
        setCurrentHeading(newHeading);
      }
    }

    // Store current position as previous for next calculation
    setPreviousGpsPosition(position);

    // Voice guidance for blind navigation when trip is active
    if (isTripStarted && previousGpsPosition) {
      // Calculate distance moved
      const distanceMoved =
        Math.sqrt(
          Math.pow(position.lat - previousGpsPosition.lat, 2) +
            Math.pow(position.lng - previousGpsPosition.lng, 2)
        ) * 111000; // Rough conversion to meters

      // Announce significant movement and direction
      if (distanceMoved > 10) {
        // Moved more than 10 meters
        const bearing = calculateHeading(previousGpsPosition, position);
        const direction = bearingToDirection(bearing);

        // Only announce occasionally to avoid spam
        if (Math.random() < 0.1) {
          // 10% chance
          speak(`Moving ${direction}. Continue following your route.`);
        }
      }
    }

    // Choose marker icon based on navigation mode
    const markerIcon = isNavigationMode
      ? {
          url:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(`
        <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
          <g transform="rotate(${currentHeading} 16 16)">
            <circle cx="16" cy="16" r="14" fill="#4285F4" stroke="white" stroke-width="3"/>
            <polygon points="16,6 20,18 16,15 12,18" fill="white"/>
          </g>
        </svg>
      `),
          scaledSize: new window.google.maps.Size(32, 32),
          anchor: new window.google.maps.Point(16, 16),
        }
      : {
          url:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(`
        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="#4285F4" stroke="white" stroke-width="3"/>
          <circle cx="12" cy="12" r="4" fill="white"/>
          <circle cx="12" cy="12" r="2" fill="#4285F4"/>
        </svg>
      `),
          scaledSize: new window.google.maps.Size(24, 24),
          anchor: new window.google.maps.Point(12, 12),
        };

    // Create marker only if it doesn't exist
    if (!currentLocationMarkerRef.current) {
      currentLocationMarkerRef.current = new window.google.maps.Marker({
        position: position,
        map: googleMapRef.current,
        title: isNavigationMode
          ? "🧭 Navigation Mode"
          : "📍 Your Live Location",
        icon: markerIcon,
        animation: window.google.maps.Animation.DROP,
      });
      console.log(
        isNavigationMode
          ? "🧭 Navigation marker created"
          : "🔵 Live location marker created"
      );
    } else {
      // Ensure marker is still attached to the current map and update position
      if (currentLocationMarkerRef.current.getMap() !== googleMapRef.current) {
        currentLocationMarkerRef.current.setMap(googleMapRef.current);
        console.log("🔵 Live location marker re-attached to map");
      }
      currentLocationMarkerRef.current.setPosition(position);
      currentLocationMarkerRef.current.setIcon(markerIcon);
      currentLocationMarkerRef.current.setTitle(
        isNavigationMode ? "🧭 Navigation Mode" : "� Your Live Location"
      );
      console.log(
        isNavigationMode
          ? "🧭 Navigation marker updated"
          : "🔵 Live location marker updated"
      );
    }

    // Only center the map, don't change zoom here (zoom handled separately)
    if (isNavigationMode || mapAutoCenterEnabled) {
      googleMapRef.current.setCenter(position);
      console.log(
        isNavigationMode
          ? "🧭 Navigation mode: Map centered"
          : "🎯 Map auto-centered to current location"
      );
    }
  }, [
    gpsData,
    showRoute,
    mapAutoCenterEnabled,
    isNavigationMode,
    previousGpsPosition,
    currentHeading,
    isTripStarted,
  ]);

  // Handle navigation mode zoom transitions (separate from GPS updates for smoother performance)
  useEffect(() => {
    if (!googleMapRef.current || isZooming) return;

    const targetZoom = isNavigationMode ? 18 : 15;

    if (currentZoomLevel !== targetZoom) {
      setIsZooming(true);

      // Smooth zoom transition
      const smoothZoom = (currentZoom: number, targetZoom: number) => {
        const step = targetZoom > currentZoom ? 0.5 : -0.5;
        const newZoom =
          Math.abs(targetZoom - currentZoom) < 1
            ? targetZoom
            : currentZoom + step;

        googleMapRef.current?.setZoom(newZoom);
        setCurrentZoomLevel(newZoom);

        if (newZoom !== targetZoom) {
          setTimeout(() => smoothZoom(newZoom, targetZoom), 100);
        } else {
          setIsZooming(false);
          console.log(`🎯 Smooth zoom completed to level ${targetZoom}`);
        }
      };

      smoothZoom(currentZoomLevel, targetZoom);
    }
  }, [isNavigationMode, currentZoomLevel, isZooming]);

  // Handle destination and route rendering (only when route is first shown or destination changes)
  useEffect(() => {
    if (
      !googleMapRef.current ||
      !directionsServiceRef.current ||
      !directionsRendererRef.current
    )
      return;

    if (showRoute && destinationCoords) {
      // Use current GPS position for route calculation only when route is first requested
      const currentOrigin = { lat: gpsData.lat, lng: gpsData.lng };

      // Store the origin for this route to avoid recalculating
      if (
        !routeOriginRef.current ||
        Math.abs(routeOriginRef.current.lat - currentOrigin.lat) > 0.0001 ||
        Math.abs(routeOriginRef.current.lng - currentOrigin.lng) > 0.0001
      ) {
        routeOriginRef.current = currentOrigin;

        const request: GoogleMapsDirectionsRequest = {
          origin: currentOrigin,
          destination: {
            lat: destinationCoords.lat,
            lng: destinationCoords.lng,
          },
          travelMode: window.google.maps.TravelMode.WALKING,
          avoidHighways: true, // Avoid highways for safety
          avoidTolls: true, // Avoid toll roads
          optimizeWaypoints: true, // Optimize route efficiency
        };

        directionsServiceRef.current.route(
          request,
          (result: GoogleMapsDirectionsResult | null, status: string) => {
            if (status === "OK" && result) {
              directionsRendererRef.current!.setDirections(result);

              // Keep map centered on current position instead of showing full route
              setTimeout(() => {
                if (
                  googleMapRef.current &&
                  gpsData.lat !== 0 &&
                  gpsData.lng !== 0
                ) {
                  googleMapRef.current.setCenter({
                    lat: gpsData.lat,
                    lng: gpsData.lng,
                  });
                  console.log(
                    "🎯 Map re-centered on current position after route display"
                  );
                }
              }, 100); // Small delay to ensure route is rendered first

              console.log(
                "🛤️ Route calculated with main road preference - viewport preserved"
              );

              // Voice announcement for route calculation
              if (result && result.routes[0] && result.routes[0].legs[0]) {
                const leg = result.routes[0].legs[0];
                const distance = leg.distance?.text || "unknown distance";
                const duration = leg.duration?.text || "unknown time";
                speak(
                  `Route calculated. Your destination is ${distance} away, approximately ${duration} walking time. Tap start trip to begin voice-guided navigation.`
                );
              }
            } else {
              console.error("❌ Directions request failed:", status);
              speak(
                "Sorry, I couldn't calculate a route to your destination. Please try again or choose a different location."
              );
            }
          }
        );
      }
    } else {
      // Clear directions and reset origin when no route
      directionsRendererRef.current.setDirections({
        routes: [],
      } as GoogleMapsDirectionsResult);
      routeOriginRef.current = null;
    }
  }, [showRoute, destinationCoords, gpsData.lat, gpsData.lng]); // Only recalculate when route state or significant position change

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-20 bg-slate-900 flex flex-col items-center py-8 gap-8 shadow-2xl z-50">
        <div className="flex-1 flex flex-col gap-4">
          {/* Map View */}
          <div
            onClick={() => setActiveView("map")}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 cursor-pointer group ${
              activeView === "map"
                ? "bg-blue-500 shadow-lg"
                : "bg-blue-500/10 hover:bg-blue-500/20"
            }`}
          >
            <MapPin
              className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                activeView === "map" ? "text-white" : "text-blue-500"
              }`}
            />
          </div>

          {/* Camera View */}
          <div
            onClick={() => setActiveView("camera")}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 cursor-pointer group ${
              activeView === "camera"
                ? "bg-green-500 shadow-lg"
                : "bg-slate-800 hover:bg-slate-700"
            }`}
          >
            <Camera
              className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                activeView === "camera" ? "text-white" : "text-slate-400"
              }`}
            />
          </div>

          {/* Navigation Controls View */}
          <div
            onClick={() => setActiveView("navigation")}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 cursor-pointer group ${
              activeView === "navigation"
                ? "bg-blue-500 shadow-lg"
                : "bg-slate-800 hover:bg-slate-700"
            }`}
          >
            <Navigation
              className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                activeView === "navigation" ? "text-white" : "text-slate-400"
              }`}
            />
          </div>

          {/* System Status */}
          <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center hover:bg-slate-700 transition-all duration-300 cursor-pointer group">
            <Activity className="w-5 h-5 text-slate-400 group-hover:scale-110 transition-transform" />
          </div>

          {/* Radio/Connection */}
          <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center hover:bg-slate-700 transition-all duration-300 cursor-pointer group">
            <Radio className="w-5 h-5 text-slate-400 group-hover:scale-110 transition-transform" />
          </div>
        </div>

        <div
          className={`w-3 h-3 rounded-full ${
            isConnected ? "bg-emerald-400" : "bg-red-400"
          } animate-pulse shadow-lg`}
        ></div>
      </div>

      {/* Main Content */}
      <div className="ml-20">
        {/* Top Bar */}
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-40 backdrop-blur-sm bg-white/95">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              The Guiding Robot
            </h1>
            <p className="text-xs text-slate-500">
              Real-time monitoring and control
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-emerald-500" : "bg-slate-400"
                }`}
              ></div>
              <span className="text-sm font-medium text-slate-700">
                {isConnected ? "Live" : "Offline"}
              </span>
            </div>
            <div className="text-sm text-slate-600 capitalize font-medium">
              {activeView === "map"
                ? "GPS Navigation"
                : activeView === "camera"
                ? "Live Camera Feed"
                : "Vision Assistant"}
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="p-8 grid grid-cols-12 gap-6">
          {/* Large Main View - Takes up most space */}
          <div className="col-span-12 lg:col-span-8 h-[calc(100vh-12rem)] bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden group hover:shadow-xl transition-all duration-500">
            <div className="h-full relative">
              {/* Map View */}
              {activeView === "map" && (
                <div className="h-full flex flex-col">
                  {/* Map Container - Specific height to leave room for sensor panel */}
                  <div className="h-[calc(100%-4rem)] relative">
                    {/* Interactive Google Map */}
                    <div
                      ref={mapContainerRef}
                      className="w-full h-full"
                      style={{ border: 0 }}
                    ></div>

                    {/* Map Legend */}
                    <div className="absolute bottom-6 left-6 flex items-center gap-3">
                      {showRoute && destinationCoords && (
                        <div className="bg-red-500 text-white px-4 py-2 rounded-xl shadow-lg font-semibold text-sm flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          Destination
                        </div>
                      )}
                      {tripActive && (
                        <div className="bg-purple-500 text-white px-4 py-2 rounded-xl shadow-lg font-semibold text-sm animate-pulse">
                          Trip In Progress
                        </div>
                      )}
                    </div>

                    {/* Recenter Button - Show when user has interacted with map */}
                    {hasUserInteractedWithMap &&
                      !mapAutoCenterEnabled &&
                      gpsData.lat !== 0 &&
                      gpsData.lng !== 0 && (
                        <div className="absolute bottom-6 right-6">
                          <button
                            onClick={recenterMap}
                            className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center"
                            title="Center map on your current location"
                          >
                            <Target className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                  </div>

                  {/* 🎯 Sensor Panel - Fixed at bottom */}
                  <div className="h-16 bg-white border-t border-slate-200 p-3 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-slate-600" />
                      <span className="text-sm font-semibold text-slate-800">
                        Ultrasonic Sensors
                      </span>
                    </div>
                    <div className="flex gap-3">
                      {[
                        { label: "F", value: sensorData.front, dir: "Front" },
                        { label: "L", value: sensorData.left, dir: "Left" },
                        { label: "R", value: sensorData.right, dir: "Right" },
                      ].map((sensor) => (
                        <div
                          key={sensor.label}
                          className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5"
                        >
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center text-white text-xs font-bold ${
                              sensor.value > 100
                                ? "bg-emerald-500"
                                : sensor.value > 50
                                ? "bg-amber-500"
                                : "bg-red-500"
                            }`}
                          >
                            {sensor.label}
                          </div>
                          <div className="flex flex-col leading-none">
                            <span
                              className={`text-sm font-bold ${getSensorColor(
                                sensor.value
                              )}`}
                            >
                              {sensor.value}
                            </span>
                            <span className="text-xs text-slate-500">cm</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Compact GPS Info Bar - Above Map */}
              {activeView === "map" && (
                <div className="absolute top-0 left-0 right-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-200">
                  <div className="px-6 py-3">
                    {/* Navigation Controls - Clean & Spaced Out */}
                    <div className="flex flex-wrap items-center gap-3 w-full">
                      {/* Destination Input - Wider */}
                      <div className="flex items-center gap-2 bg-white rounded-lg px-4 py-2 border-2 border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all flex-1 min-w-[280px] max-w-md shadow-sm">
                        <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
                        <input
                          type="text"
                          value={destination}
                          onChange={(e) => setDestination(e.target.value)}
                          onKeyPress={(e) =>
                            e.key === "Enter" && handleNavigate()
                          }
                          placeholder="Enter destination..."
                          className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder-slate-400 min-w-0 font-medium"
                        />
                      </div>

                      {/* Go Button - More Prominent */}
                      <button
                        onClick={handleNavigate}
                        disabled={loadingRoute}
                        className="px-5 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all text-sm flex items-center gap-2 disabled:opacity-50 flex-shrink-0 shadow-sm hover:shadow-md"
                      >
                        {loadingRoute ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <Navigation className="w-4 h-4" />
                            Go
                          </>
                        )}
                      </button>
                      {/* Combined Start/Stop Button - Starts both navigation and robot */}
                      {showRoute &&
                        destinationCoords &&
                        waypoints.length > 0 && (
                          <>
                            {!tripActive && !isRobotNavigating ? (
                              <button
                                onClick={startTrip}
                                disabled={loadingRoute}
                                className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-blue-500 text-white rounded-lg font-bold hover:from-emerald-600 hover:to-blue-600 transition-all text-sm flex items-center gap-2 disabled:opacity-50 flex-shrink-0 shadow-md hover:shadow-lg"
                                title="Start navigation with voice guidance and robot auto-navigation"
                              >
                                <Play className="w-5 h-5" />
                                Start Navigation
                              </button>
                            ) : (
                              <button
                                onClick={endTrip}
                                className="px-6 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-all text-sm flex items-center gap-2 flex-shrink-0 shadow-md hover:shadow-lg animate-pulse"
                                title="Stop all navigation and robot movement"
                              >
                                <Square className="w-5 h-5" />
                                Stop Navigation
                              </button>
                            )}
                          </>
                        )}

                      {/* Clear Route Button - Shows when navigation stopped */}
                      {destination && !tripActive && !isRobotNavigating && (
                        <button
                          onClick={async () => {
                            console.log("🧹 Clearing route and destination...");

                            setDestination("");
                            setDestinationCoords(null);
                            setShowRoute(false);
                            setWaypoints([]);
                            setRouteDistance("");
                            setRouteDuration("");
                            setRemainingDistance(0);

                            speak("Route cleared.");

                            // Stop backend navigation to clear audio queue
                            try {
                              await fetch(`${BACKEND_URL}/navigation/stop`, {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                              });
                              console.log("✅ Backend navigation cleared");
                            } catch (error) {
                              console.log("Backend navigation stop skipped");
                            }

                            // Also stop robot navigation if running
                            try {
                              await fetch(`${BACKEND_URL}/robot/stop`, {
                                method: "POST",
                              });
                              console.log("✅ Robot navigation cleared");
                            } catch (error) {
                              console.log("Robot stop skipped");
                            }

                            console.log("✅ Route completely cleared");
                          }}
                          className="px-5 py-2 bg-slate-500 text-white rounded-lg font-semibold hover:bg-slate-600 transition-all text-sm flex items-center gap-2 flex-shrink-0 shadow-sm hover:shadow-md"
                          title="Clear route and destination"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                          Clear Route
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Camera View - Extended Full Width */}
              {activeView === "camera" && (
                <div className="h-full relative">
                  {/* Full Width Camera Feed */}
                  <CameraFeed />
                  <div className="absolute bottom-6 left-6 flex items-center gap-3">
                    <div className="bg-green-500 text-white px-4 py-2 rounded-xl shadow-lg font-semibold text-sm flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      Live Camera Feed
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Controls View */}
              {activeView === "navigation" && (
                <div className="h-full flex flex-col">
                  {/* Navigation Controls - Takes most of the height */}
                  <div className="flex-1 p-6 flex items-center justify-center">
                    <div className="max-w-md w-full">
                      <NavigationControls
                        onCommand={(direction) => {
                          console.log("Navigation command:", direction);
                          // Send command to Firebase for robot control
                          const db = firebase.database();
                          db.ref("devices/esp32A/navigation").set({
                            command: direction,
                            timestamp: Date.now(),
                          });
                        }}
                      />
                    </div>
                  </div>

                  {/* 🎯 Sensor Panel - Fixed height below navigation controls */}
                  <div className="h-16 bg-white border-t border-slate-200 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-slate-600" />
                      <span className="text-sm font-semibold text-slate-800">
                        Ultrasonic Sensors
                      </span>
                    </div>
                    <div className="flex gap-3">
                      {[
                        { label: "F", value: sensorData.front, dir: "Front" },
                        { label: "L", value: sensorData.left, dir: "Left" },
                        { label: "R", value: sensorData.right, dir: "Right" },
                      ].map((sensor) => (
                        <div
                          key={sensor.label}
                          className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5"
                        >
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center text-white text-xs font-bold ${
                              sensor.value > 100
                                ? "bg-emerald-500"
                                : sensor.value > 50
                                ? "bg-amber-500"
                                : "bg-red-500"
                            }`}
                          >
                            {sensor.label}
                          </div>
                          <div className="flex flex-col leading-none">
                            <span
                              className={`text-sm font-bold ${getSensorColor(
                                sensor.value
                              )}`}
                            >
                              {sensor.value}
                            </span>
                            <span className="text-xs text-slate-500">cm</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Context-Sensitive Content */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Map View Sidebar - System Status & GPS Info */}
            {activeView === "map" && (
              <>
                {/* System Status Card */}
                <div className="bg-white rounded-3xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-500">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Radio className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">
                        System Status
                      </h3>
                      <p className="text-xs text-slate-500">ESP32 B Control</p>
                    </div>
                  </div>

                  <div
                    className={`relative rounded-2xl p-6 mb-6 bg-gradient-to-br ${getStatusColor(
                      statusData.state
                    )} text-white overflow-hidden`}
                  >
                    <div className="absolute inset-0 bg-black/10"></div>
                    <div className="relative z-10">
                      <div className="text-xs font-bold mb-2 uppercase opacity-90">
                        Current State
                      </div>
                      <div className="text-3xl font-bold capitalize mb-3">
                        {tripActive &&
                        (statusData.state === "forward" ||
                          statusData.state === "moving")
                          ? "Navigating"
                          : tripActive
                          ? statusData.state
                          : statusData.state === "forward" ||
                            statusData.state === "moving"
                          ? "Stopped"
                          : statusData.state}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Level {statusData.sev}/255</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 font-medium">
                        Severity
                      </span>
                      <span className="font-bold text-slate-900">
                        {((statusData.sev / 255) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${getSeverityColor(
                          statusData.sev
                        )} transition-all duration-700 rounded-full`}
                        style={{
                          width: `${Math.min(
                            (statusData.sev / 255) * 100,
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* 🎯 REDESIGNED: Compact GPS & Status Panel */}
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 hover:shadow-xl transition-all duration-500">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-sm text-slate-900">
                        GPS & Status
                      </h3>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${
                        isConnected ? "bg-green-50" : "bg-red-50"
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          isConnected
                            ? "bg-green-500 animate-pulse"
                            : "bg-red-500"
                        }`}
                      ></div>
                      <span
                        className={`text-xs font-medium ${
                          isConnected ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {isConnected ? "Live" : "Offline"}
                      </span>
                    </div>
                  </div>

                  {/* GPS Coordinates - Horizontal Layout */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-2 border border-blue-100">
                      <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-0.5">
                        Latitude
                      </div>
                      <div className="text-sm font-bold text-blue-900 font-mono">
                        {gpsData.lat.toFixed(6)}°
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-2 border border-blue-100">
                      <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-0.5">
                        Longitude
                      </div>
                      <div className="text-sm font-bold text-blue-900 font-mono">
                        {gpsData.lng.toFixed(6)}°
                      </div>
                    </div>
                  </div>

                  {/* Quick Status Grid - 2x2 */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {/* Auto-Center */}
                    <div className="bg-slate-50 rounded-lg p-2 flex items-center gap-2">
                      <Target
                        className={`w-3.5 h-3.5 ${
                          mapAutoCenterEnabled
                            ? "text-green-600"
                            : "text-slate-400"
                        }`}
                      />
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-medium">
                          Auto-Center
                        </div>
                        <div
                          className={`text-xs font-bold ${
                            mapAutoCenterEnabled
                              ? "text-green-600"
                              : "text-slate-600"
                          }`}
                        >
                          {mapAutoCenterEnabled ? "ON" : "OFF"}
                        </div>
                      </div>
                    </div>

                    {/* Trip Status */}
                    <div className="bg-slate-50 rounded-lg p-2 flex items-center gap-2">
                      <Navigation
                        className={`w-3.5 h-3.5 ${
                          isTripStarted ? "text-purple-600" : "text-slate-400"
                        }`}
                      />
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-medium">
                          Trip
                        </div>
                        <div
                          className={`text-xs font-bold ${
                            isTripStarted ? "text-purple-600" : "text-slate-600"
                          }`}
                        >
                          {isTripStarted ? "ACTIVE" : "Idle"}
                        </div>
                      </div>
                    </div>

                    {/* Voice Guidance */}
                    <div
                      onClick={() => {
                        setIsVoiceEnabled(!isVoiceEnabled);
                        speak(
                          isVoiceEnabled
                            ? "Voice guidance disabled"
                            : "Voice guidance enabled"
                        );
                      }}
                      className={`rounded-lg p-2 flex items-center gap-2 cursor-pointer transition-all ${
                        isVoiceEnabled
                          ? "bg-emerald-50 hover:bg-emerald-100"
                          : "bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <Volume2
                        className={`w-3.5 h-3.5 ${
                          isVoiceEnabled ? "text-emerald-600" : "text-slate-400"
                        }`}
                      />
                      <div className="flex-1">
                        <div className="text-[10px] text-slate-500 uppercase font-medium">
                          Voice
                        </div>
                        <div
                          className={`text-xs font-bold ${
                            isVoiceEnabled
                              ? "text-emerald-600"
                              : "text-slate-600"
                          }`}
                        >
                          {isVoiceEnabled ? "ON" : "OFF"}
                        </div>
                      </div>
                    </div>

                    {/* Current Location Name */}
                    <div className="bg-slate-50 rounded-lg p-2 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-slate-500 uppercase font-medium">
                          Location
                        </div>
                        <div className="text-xs font-bold text-slate-600 truncate">
                          {currentLocationName || "Loading..."}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 🎯 REDESIGNED: Ultra-Compact Navigation Card */}
                {tripActive && destinationCoords ? (
                  <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                    {/* Navigation Header - Compact */}
                    <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Navigation className="w-4 h-4 animate-pulse" />
                          <span className="font-bold text-sm">
                            Navigation Active
                          </span>
                        </div>
                        {isTripStarted && isNavigationMode && (
                          <div className="text-xs font-mono bg-white/20 px-2 py-0.5 rounded">
                            {currentHeading.toFixed(0)}°
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Distance & ETA - Ultra Compact */}
                    <div className="grid grid-cols-2 gap-2 p-3 bg-gradient-to-br from-slate-50 to-white">
                      <div className="text-center">
                        <div className="text-[10px] text-slate-500 uppercase font-medium mb-0.5">
                          Distance
                        </div>
                        <div className="text-lg font-bold text-purple-600">
                          {formatDistance(remainingDistance)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-slate-500 uppercase font-medium mb-0.5">
                          ETA
                        </div>
                        <div className="text-lg font-bold text-blue-600">
                          {estimatedArrival}
                        </div>
                      </div>
                    </div>

                    {/* Locations - Horizontal Layout */}
                    <div className="p-3 pt-0 space-y-2">
                      {/* Current */}
                      <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-blue-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-blue-600 font-medium uppercase">
                              Current
                            </div>
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {currentLocationName || "Getting..."}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Destination */}
                      <div className="bg-green-50 rounded-lg p-2 border border-green-100">
                        <div className="flex items-center gap-2">
                          <Target className="w-3 h-3 text-green-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-green-600 font-medium uppercase">
                              Destination
                            </div>
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {destination}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // No active navigation - Minimal
                  <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4">
                    <div className="text-center py-2">
                      <Navigation className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                      <div className="text-xs font-semibold text-slate-600">
                        No Active Navigation
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Set destination to begin
                      </div>
                    </div>
                  </div>
                )}

                {/* 🤖 NEW: Robot Status Card */}
                {isRobotNavigating && (
                  <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-500 overflow-hidden">
                    {/* Robot Header */}
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center animate-pulse">
                            <span className="text-purple-600 font-bold text-xs">
                              🤖
                            </span>
                          </div>
                          <span className="font-bold text-sm">
                            Robot Autonomous Mode
                          </span>
                        </div>
                        <div className="text-xs bg-white/20 px-2 py-0.5 rounded">
                          ACTIVE
                        </div>
                      </div>
                    </div>

                    {/* Robot Status */}
                    <div className="p-4 space-y-3">
                      {/* Distance Display */}
                      {robotDistance !== null && (
                        <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Navigation className="w-4 h-4 text-purple-600" />
                              <span className="text-sm font-semibold text-slate-700">
                                Distance to Target
                              </span>
                            </div>
                            <div className="text-lg font-bold text-purple-600">
                              {robotDistance.toFixed(1)}m
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Robot Status Info */}
                      <div className="text-xs text-slate-600 space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span>GPS navigation active</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span>Obstacle avoidance enabled</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                          <span>Autonomous control</span>
                        </div>
                      </div>

                      {/* Stop Button */}
                      <button
                        onClick={stopRobotNavigation}
                        className="w-full px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-all text-sm flex items-center justify-center gap-2"
                      >
                        <Square className="w-4 h-4" />
                        Emergency Stop
                      </button>
                    </div>
                  </div>
                )}

                {/* 🎤 Voice Commands Card */}
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-3">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4" />
                      <span className="font-bold text-sm">Voice Commands</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <AudioControls
                      onCommand={handleVoiceCommand}
                      audioData={{
                        isListening: false,
                        isSpeaking: false,
                        volume: 80,
                        lastResponse: "",
                      }}
                      disabled={false}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Camera View Sidebar - Vision Assistant Controls */}
            {activeView === "camera" && (
              <div className="bg-white rounded-3xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-500">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Camera className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">
                      Vision Assistant
                    </h3>
                    <p className="text-xs text-slate-500">
                      AI-Powered Scene Analysis
                    </p>
                  </div>
                </div>

                {/* Vision Assistant Component - Extended */}
                <div className="h-[calc(100vh-20rem)] overflow-auto">
                  <VisionAssistant />
                </div>
              </div>
            )}

            {/* Navigation View Sidebar - Navigation Info */}
            {activeView === "navigation" && (
              <>
                {/* 🎯 Navigation Information Panel */}
                {tripActive && destinationCoords ? (
                  <div className="space-y-4">
                    {/* Navigation Status Header */}
                    <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-3xl shadow-lg p-6 hover:shadow-xl transition-all duration-500">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                          <Navigation className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">
                            Navigation Active
                          </h3>
                          <p className="text-xs opacity-90">
                            Real-time guidance
                          </p>
                        </div>
                      </div>

                      {/* Remaining Distance & Time */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/20 backdrop-blur rounded-xl p-4">
                          <div className="text-xs opacity-90 mb-1">
                            Distance
                          </div>
                          <div className="text-2xl font-bold">
                            {formatDistance(remainingDistance)}
                          </div>
                        </div>
                        <div className="bg-white/20 backdrop-blur rounded-xl p-4">
                          <div className="text-xs opacity-90 mb-1">ETA</div>
                          <div className="text-2xl font-bold">
                            {estimatedArrival}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Current Location Card */}
                    <div className="bg-white rounded-3xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-500">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                          <MapPin className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900">
                            Current Location
                          </h3>
                          <p className="text-xs text-slate-500">
                            Live GPS position
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-blue-600 font-medium mb-2">
                        {currentLocationName || "Getting location..."}
                      </div>
                      <div className="text-xs text-slate-500">
                        {gpsData.lat.toFixed(4)}, {gpsData.lng.toFixed(4)}
                      </div>
                    </div>

                    {/* Destination Card */}
                    <div className="bg-white rounded-3xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-500">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                          <Target className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900">
                            Destination
                          </h3>
                          <p className="text-xs text-slate-500">
                            Target location
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-green-600 font-medium mb-2">
                        {destination}
                      </div>
                      <div className="text-xs text-slate-500">
                        {destinationCoords.lat.toFixed(4)},{" "}
                        {destinationCoords.lng.toFixed(4)}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Show when no active navigation in navigation view
                  <div className="bg-white rounded-3xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-500">
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Navigation className="w-8 h-8 text-slate-400" />
                      </div>
                      <div className="text-xl font-semibold text-slate-600 mb-2">
                        No Active Navigation
                      </div>
                      <div className="text-sm text-slate-500 mb-6">
                        Set a destination and start a trip to begin navigation
                      </div>
                      <button
                        onClick={() => setActiveView("map")}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-xl transition-colors"
                      >
                        Go to Map
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
