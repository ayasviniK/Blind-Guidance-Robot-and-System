import { useState, useEffect, useRef, useCallback } from "react";

// Backend API URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

interface VisionAssistantProps {
  streamUrl?: string;
  onError?: (error: Error) => void;
}

interface AnalysisResult {
  description: string;
  timestamp: number;
}

export default function VisionAssistant({
  streamUrl,
  onError,
}: VisionAssistantProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisInterval, setAnalysisInterval] = useState(10); // seconds
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [speechRate, setSpeechRate] = useState(1.2); // Faster for accessibility

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<number | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const defaultStreamUrl = streamUrl || import.meta.env.VITE_ROBOT_STREAM_URL;

  const VISION_PROMPT = `Describe this scene for a blind person who is walking. 
Be concise and focus on immediate obstacles, people, and potential hazards directly ahead.
Mention distances if possible (e.g., 'a person is about 10 feet away').
Start your description with what is most important for navigation.
Example: 'Person walking towards you, about 5 feet away.' 
Example: 'Stairs going down directly ahead.'
Example: 'Clear path ahead.'`;

  useEffect(() => {
    if ("speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  // Stop speaking when component unmounts
  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!audioEnabled || !synthRef.current) return;

      // Cancel any ongoing speech
      synthRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speechRate;
      utterance.volume = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      synthRef.current.speak(utterance);
    },
    [audioEnabled, speechRate]
  );

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const captureFrame = useCallback((): string | null => {
    const img = imgRef.current;
    const canvas = canvasRef.current;

    if (!img || !canvas) return null;

    const context = canvas.getContext("2d");
    if (!context) return null;

    // Set canvas size to match image dimensions
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    // Draw current image frame to canvas
    context.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Convert canvas to base64 image
    return canvas.toDataURL("image/jpeg", 0.8);
  }, []);

  const analyzeFrame = useCallback(async () => {
    if (isAnalyzing) return;

    setIsAnalyzing(true);

    try {
      console.log("🧠 Analyzing scene with backend Gemini Vision...");

      // Use backend analyze endpoint instead of frontend Gemini
      const response = await fetch(`${BACKEND_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: VISION_PROMPT,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Backend analysis failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      const description =
        data.description || data.analysis || "No description available";

      const result: AnalysisResult = {
        description,
        timestamp: Date.now(),
      };

      setLastAnalysis(result);
      console.log(`🤖 Backend Analysis: ${description}`);

      if (audioEnabled) {
        speak(description);
      }
    } catch (error) {
      console.error("Analysis error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Analysis failed";

      // Fallback message if backend is down
      const fallbackMessage =
        "Vision analysis temporarily unavailable. Proceed with caution.";

      if (audioEnabled) {
        speak(fallbackMessage);
      }

      if (onError) {
        onError(new Error(errorMessage));
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, audioEnabled, speak, onError, VISION_PROMPT]);

  const startAssistant = useCallback(() => {
    setIsEnabled(true);
    speak("Vision assistant started");

    // Run first analysis immediately
    setTimeout(() => analyzeFrame(), 1000);

    // Set up interval for periodic analysis
    intervalRef.current = window.setInterval(() => {
      analyzeFrame();
    }, analysisInterval * 1000);
  }, [analyzeFrame, analysisInterval, speak]);

  const stopAssistant = useCallback(() => {
    setIsEnabled(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    stopSpeaking();
    speak("Vision assistant stopped");
  }, [speak, stopSpeaking]);

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <svg
          className="w-6 h-6 text-purple-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
        Vision Assistant (Accessibility)
      </h2>

      {/* MJPEG Stream Image (Hidden) */}
      <img
        ref={imgRef}
        src={defaultStreamUrl}
        alt="Vision Assistant Stream"
        style={{ display: "none" }}
        crossOrigin="anonymous"
      />

      {/* Hidden Canvas for Frame Capture */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Controls */}
      <div className="space-y-4 mb-4">
        {/* Main Toggle */}
        <div className="flex gap-3">
          {!isEnabled ? (
            <button
              onClick={startAssistant}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-semibold"
            >
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
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Start Vision Assistant
            </button>
          ) : (
            <button
              onClick={stopAssistant}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-semibold"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
              Stop Assistant
            </button>
          )}

          {/* Manual Analysis Button */}
          <button
            onClick={analyzeFrame}
            disabled={!isEnabled || isAnalyzing}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-semibold"
            title="Analyze Now"
          >
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isAnalyzing ? "Analyzing..." : "Analyze Now"}
          </button>
        </div>

        {/* Audio Toggle */}
        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
          <span className="text-sm font-medium text-gray-700">
            Audio Feedback
          </span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={audioEnabled}
              onChange={(e) => setAudioEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {/* Analysis Interval */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-700">Analysis Interval</span>
            <span className="text-purple-600 font-semibold">
              {analysisInterval}s
            </span>
          </div>
          <input
            type="range"
            min="3"
            max="30"
            value={analysisInterval}
            onChange={(e) => setAnalysisInterval(parseInt(e.target.value))}
            disabled={isEnabled}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
          />
          <p className="text-xs text-gray-500">
            How often to analyze the scene (3-30 seconds)
          </p>
        </div>

        {/* Speech Rate */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-700">Speech Speed</span>
            <span className="text-purple-600 font-semibold">
              {speechRate.toFixed(1)}x
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={speechRate}
            onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      {/* Status Indicators */}
      <div className="flex items-center justify-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-full ${
              isEnabled ? "bg-green-500 animate-pulse" : "bg-gray-400"
            }`}
          ></span>
          <span className="text-gray-700">
            {isEnabled ? "Active" : "Inactive"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-full ${
              isAnalyzing ? "bg-blue-500 animate-pulse" : "bg-gray-400"
            }`}
          ></span>
          <span className="text-gray-700">
            {isAnalyzing ? "Analyzing" : "Idle"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-full ${
              isSpeaking ? "bg-purple-500 animate-pulse" : "bg-gray-400"
            }`}
          ></span>
          <span className="text-gray-700">
            {isSpeaking ? "Speaking" : "Silent"}
          </span>
        </div>
      </div>

      {/* Last Analysis Display */}
      {lastAnalysis && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-sm font-semibold text-purple-900">
              Last Analysis
            </h3>
            <span className="text-xs text-purple-600">
              {formatTimestamp(lastAnalysis.timestamp)}
            </span>
          </div>
          <p className="text-gray-800 text-base leading-relaxed">
            {lastAnalysis.description}
          </p>
          <button
            onClick={() => speak(lastAnalysis.description)}
            disabled={isSpeaking}
            className="mt-3 text-sm bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg transition-colors duration-200 flex items-center gap-2"
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
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
            </svg>
            Repeat Description
          </button>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>For Blind Users:</strong> This assistant analyzes the camera
          feed and describes obstacles, people, and hazards in your path. Audio
          descriptions are spoken automatically at the set interval.
        </p>
      </div>
    </div>
  );
}
