import { useEffect, useRef, useState } from "react";
import type { CameraStreamProps } from "../types";

// Backend API URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export default function CameraFeed({ streamUrl, onError }: CameraStreamProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const defaultStreamUrl = streamUrl || `${BACKEND_URL}/stream`;

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    // Reset states
    setIsLoading(true);
    setError(null);

    const handleLoad = () => {
      setIsLoading(false);
      setError(null);
      console.log(
        "✅ MJPEG stream loaded successfully from backend:",
        defaultStreamUrl
      );
    };

    const handleError = (e: Event) => {
      console.error("❌ Stream error:", {
        url: defaultStreamUrl,
        event: e,
        target: e.target,
      });

      let errorMsg = "Failed to load MJPEG stream. ";

      if (!navigator.onLine) {
        errorMsg += "No internet connection.";
      } else if (defaultStreamUrl.includes(BACKEND_URL)) {
        errorMsg +=
          "Cannot reach backend server. Check if FastAPI backend is running.";
      } else {
        errorMsg += `Cannot reach ${defaultStreamUrl}. Check if ESP32 is powered on and accessible.`;
      }

      setError(errorMsg);
      setIsLoading(false);
      if (onError) {
        onError(new Error(errorMsg));
      }
    };

    img.addEventListener("load", handleLoad);
    img.addEventListener("error", handleError);

    // Set the image source to the MJPEG stream from backend
    if (defaultStreamUrl) {
      console.log(
        "🎥 Loading MJPEG stream from FastAPI backend:",
        defaultStreamUrl
      );
      console.log(
        "📡 Backend will proxy stream from ESP32 at 172.16.202.189:81/stream"
      );

      // Directly set the image source
      img.src = defaultStreamUrl;

      // Set a timeout warning
      const loadTimeout = setTimeout(() => {
        if (isLoading) {
          console.warn("⚠️ Stream taking longer than expected. Check:");
          console.warn("   1. FastAPI backend running: python backend/main.py");
          console.warn("   2. ESP32 powered on and accessible");
          console.warn("   3. Backend logs for connection errors");
        }
      }, 5000);

      const clearLoadTimeout = () => clearTimeout(loadTimeout);
      img.addEventListener("load", clearLoadTimeout, { once: true });
      img.addEventListener("error", clearLoadTimeout, { once: true });
    } else {
      setError(
        "No stream URL configured. Set VITE_ROBOT_STREAM_URL in .env file."
      );
      setIsLoading(false);
    }

    return () => {
      img.removeEventListener("load", handleLoad);
      img.removeEventListener("error", handleError);
    };
  }, [defaultStreamUrl, onError]);

  const toggleFullscreen = () => {
    const img = imgRef.current;
    if (!img) return;

    if (!document.fullscreenElement) {
      img
        .requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
        })
        .catch((err: unknown) => {
          console.error("Error attempting to enable fullscreen:", err);
        });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden shadow-lg">
      {/* MJPEG Stream Image */}
      <img
        ref={imgRef}
        className="w-full h-full object-cover"
        alt="Robot Camera Stream"
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-white text-sm">Loading camera feed...</p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 overflow-auto">
          <div className="text-center px-4 max-w-md">
            <svg
              className="w-12 h-12 text-red-500 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-white text-sm mb-3 font-semibold">{error}</p>

            <div className="bg-gray-800 rounded-lg p-4 text-left text-xs space-y-2">
              <p className="text-yellow-400 font-semibold mb-2">
                🔧 Troubleshooting:
              </p>
              <p className="text-gray-300">
                1. Check FastAPI backend is running:
              </p>
              <p className="text-blue-400 font-mono ml-3">
                cd backend && python main.py
              </p>
              <p className="text-gray-300 mt-2">
                2. Verify ESP32 is powered on
              </p>
              <p className="text-gray-300">
                3. Check same WiFi network (172.16.202.189)
              </p>
              <p className="text-gray-300 mt-2">
                4. Stream URL:{" "}
                <span className="text-blue-400 break-all">
                  {defaultStreamUrl}
                </span>
              </p>
              <button
                onClick={() => window.open(`${BACKEND_URL}/health`, "_blank")}
                className="mt-3 w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded transition-colors"
              >
                Check Backend Health
              </button>
              <button
                onClick={() => window.open(defaultStreamUrl, "_blank")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded transition-colors"
              >
                Test Stream URL
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-3 rounded transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      {!isLoading && !error && (
        <div className="absolute bottom-4 right-4 flex gap-2">
          <button
            onClick={toggleFullscreen}
            className="bg-gray-800 bg-opacity-75 hover:bg-opacity-100 text-white p-2 rounded-lg transition-all duration-200"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <svg
                className="w-5 h-5"
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
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Stream Info */}
      <div className="absolute top-4 left-4">
        <div className="bg-gray-800 bg-opacity-75 text-white px-3 py-1 rounded-full text-xs flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              error
                ? "bg-red-500"
                : isLoading
                ? "bg-yellow-500"
                : "bg-green-500 animate-pulse"
            }`}
          ></span>
          <span>
            {error ? "Offline" : isLoading ? "Connecting..." : "Live"}
          </span>
        </div>
      </div>
    </div>
  );
}
