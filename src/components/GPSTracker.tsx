import { useState, useEffect } from "react";
import type { GPSTrackerProps } from "../types";

export default function GPSTracker({
  gpsData,
  onDestinationSet,
}: GPSTrackerProps) {
  const [destination, setDestination] = useState("");
  const [isSettingDestination, setIsSettingDestination] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  useEffect(() => {
    if (gpsData?.timestamp) {
      const date = new Date(gpsData.timestamp);
      setLastUpdate(date.toLocaleTimeString());
    }
  }, [gpsData]);

  const handleSetDestination = () => {
    if (destination.trim() && onDestinationSet) {
      onDestinationSet(destination.trim());
      setDestination("");
      setIsSettingDestination(false);
    }
  };

  const formatCoordinate = (
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

  const openInMaps = () => {
    if (gpsData?.latitude && gpsData?.longitude) {
      const url = `https://www.google.com/maps?q=${gpsData.latitude},${gpsData.longitude}`;
      window.open(url, "_blank");
    }
  };

  const copyCoordinates = () => {
    if (gpsData?.latitude && gpsData?.longitude) {
      const coords = `${gpsData.latitude}, ${gpsData.longitude}`;
      navigator.clipboard.writeText(coords);
      // You could add a toast notification here
    }
  };

  const getAccuracyColor = (accuracy: number | undefined) => {
    if (!accuracy) return "text-gray-500";
    if (accuracy < 10) return "text-green-600";
    if (accuracy < 50) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <svg
          className="w-6 h-6 text-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        GPS Tracker
      </h2>

      {/* GPS Data Display */}
      <div className="space-y-3 mb-4">
        {/* Coordinates */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <div className="text-xs text-gray-600 mb-1">Latitude</div>
              <div className="font-mono text-lg font-semibold text-gray-800">
                {formatCoordinate(gpsData?.latitude, true)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Longitude</div>
              <div className="font-mono text-lg font-semibold text-gray-800">
                {formatCoordinate(gpsData?.longitude, false)}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="grid grid-cols-2 gap-3">
          {gpsData?.altitude !== undefined && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Altitude</div>
              <div className="font-semibold text-gray-800">
                {gpsData.altitude.toFixed(1)} m
              </div>
            </div>
          )}

          {gpsData?.speed !== undefined && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Speed</div>
              <div className="font-semibold text-gray-800">
                {gpsData.speed.toFixed(1)} km/h
              </div>
            </div>
          )}

          {gpsData?.accuracy !== undefined && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Accuracy</div>
              <div
                className={`font-semibold ${getAccuracyColor(
                  gpsData.accuracy
                )}`}
              >
                ±{gpsData.accuracy.toFixed(1)} m
              </div>
            </div>
          )}

          {gpsData?.heading !== undefined && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Heading</div>
              <div className="font-semibold text-gray-800">
                {gpsData.heading.toFixed(0)}°
              </div>
            </div>
          )}
        </div>

        {/* Last Update */}
        {lastUpdate && (
          <div className="text-xs text-gray-500 text-center">
            Last updated: {lastUpdate}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={openInMaps}
          disabled={!gpsData?.latitude || !gpsData?.longitude}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-sm font-semibold"
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
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          Open in Maps
        </button>

        <button
          onClick={copyCoordinates}
          disabled={!gpsData?.latitude || !gpsData?.longitude}
          className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center text-sm font-semibold"
          title="Copy Coordinates"
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
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </button>
      </div>

      {/* Set Destination */}
      <div className="border-t pt-4">
        {!isSettingDestination ? (
          <button
            onClick={() => setIsSettingDestination(true)}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-sm font-semibold"
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
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Set Destination
          </button>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSetDestination()}
              placeholder="Enter destination address or place"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleSetDestination}
                disabled={!destination.trim()}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg transition-colors duration-200 text-sm font-semibold"
              >
                Confirm
              </button>
              <button
                onClick={() => {
                  setIsSettingDestination(false);
                  setDestination("");
                }}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors duration-200 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Connection Status */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs">
        <span
          className={`w-2 h-2 rounded-full ${
            gpsData ? "bg-green-500 animate-pulse" : "bg-red-500"
          }`}
        ></span>
        <span className="text-gray-600">
          {gpsData ? "GPS Connected" : "GPS Disconnected"}
        </span>
      </div>
    </div>
  );
}
