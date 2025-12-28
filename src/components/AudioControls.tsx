import { useState, useEffect, useRef } from "react";
import type { AudioControlsProps } from "../types";

export default function AudioControls({
  onCommand,
  audioData,
  disabled = false,
}: AudioControlsProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [volume, setVolume] = useState(audioData?.volume || 80);
  const [supportsSpeechRecognition, setSupportsSpeechRecognition] =
    useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    // Check if browser supports Speech Recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setSupportsSpeechRecognition(true);
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = async (event: any) => {
        const transcriptText = event.results[0][0].transcript;
        setTranscript(transcriptText);
        setIsListening(false);

        // Pass the command directly to the handler
        console.log("🎤 Speech recognized:", transcriptText);
        onCommand(transcriptText);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);

        let errorMessage = "";
        switch (event.error) {
          case "not-allowed":
            errorMessage =
              "Microphone access denied. Please allow microphone access in browser settings.";
            break;
          case "no-speech":
            errorMessage = "No speech detected. Please try again.";
            break;
          case "network":
            errorMessage = "Network error. Check your internet connection.";
            break;
          default:
            errorMessage = `Recognition error: ${event.error}`;
        }

        setError(errorMessage);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    // Check if browser supports Speech Synthesis
    if ("speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [onCommand]);

  useEffect(() => {
    if (audioData) {
      setVolume(audioData.volume);
      if (audioData.lastResponse) {
        speak(audioData.lastResponse);
      }
    }
  }, [audioData]);

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop()); // Clean up
      return true;
    } catch (err) {
      console.error("Microphone permission denied:", err);
      setError(
        "Microphone access is required for voice commands. Please allow microphone access."
      );
      return false;
    }
  };

  const startListening = async () => {
    console.log("🎤 Start listening button clicked");
    console.log("Support:", supportsSpeechRecognition);
    console.log("Recognition ref:", recognitionRef.current);
    console.log("Disabled:", disabled);

    if (!supportsSpeechRecognition || !recognitionRef.current || disabled) {
      const errorMsg = "Speech recognition is not supported in this browser";
      console.error(errorMsg);
      setError(errorMsg);
      return;
    }

    // Request microphone permission first
    console.log("🎤 Requesting microphone permission...");
    const hasPermission = await requestMicrophonePermission();
    console.log("🎤 Permission granted:", hasPermission);
    if (!hasPermission) return;

    setError(null);
    setTranscript("");
    setIsListening(true);

    try {
      console.log("🎤 Starting speech recognition...");
      recognitionRef.current.start();
    } catch (err) {
      console.error("Error starting recognition:", err);
      setIsListening(false);
      setError("Failed to start listening");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const speak = (text: string) => {
    if (!synthRef.current) return;

    // Cancel any ongoing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = volume / 100;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    // You could send this to Firebase to update the robot's volume
  };

  const testAudio = () => {
    speak("Audio test. This is the guiding robot audio system.");
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
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
        Audio Controls
      </h2>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Voice Command Section */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Voice Commands
        </h3>

        <div className="flex gap-3 mb-3">
          {!isListening ? (
            <button
              onClick={startListening}
              disabled={disabled || !supportsSpeechRecognition}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-semibold"
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
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              Start Listening
            </button>
          ) : (
            <button
              onClick={stopListening}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-semibold animate-pulse"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" />
              </svg>
              Listening...
            </button>
          )}
        </div>

        {/* Transcript Display */}
        {transcript && (
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <div className="text-xs text-gray-600 mb-1">Last Command:</div>
            <div className="text-sm text-gray-800 font-medium">
              {transcript}
            </div>
          </div>
        )}

        {/* Status Indicators */}
        {(audioData?.lastCommand || audioData?.lastResponse) && (
          <div className="bg-blue-50 rounded-lg p-3 space-y-2">
            {audioData.lastCommand && (
              <div>
                <div className="text-xs text-gray-600">Command:</div>
                <div className="text-sm text-gray-800">
                  {audioData.lastCommand}
                </div>
              </div>
            )}
            {audioData.lastResponse && (
              <div>
                <div className="text-xs text-gray-600">Response:</div>
                <div className="text-sm text-gray-800">
                  {audioData.lastResponse}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Text-to-Speech Section */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Text-to-Speech
        </h3>

        <div className="flex gap-2">
          <button
            onClick={testAudio}
            disabled={disabled || isSpeaking}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-sm font-semibold"
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
            Test Audio
          </button>

          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center text-sm font-semibold"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Volume Control */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center justify-between">
          <span>Volume</span>
          <span className="text-blue-600">{volume}%</span>
        </h3>

        <div className="flex items-center gap-3">
          <svg
            className="w-5 h-5 text-gray-600"
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

          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
            disabled={disabled}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
            style={{
              background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${volume}%, #E5E7EB ${volume}%, #E5E7EB 100%)`,
            }}
          />

          <svg
            className="w-6 h-6 text-gray-600"
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
        </div>
      </div>

      {/* Status */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <span
            className={`w-2 h-2 rounded-full ${
              isListening ? "bg-red-500 animate-pulse" : "bg-gray-400"
            }`}
          ></span>
          <span>Microphone</span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={`w-2 h-2 rounded-full ${
              isSpeaking ? "bg-green-500 animate-pulse" : "bg-gray-400"
            }`}
          ></span>
          <span>Speaker</span>
        </div>
      </div>

      {/* Help Text */}
      {!supportsSpeechRecognition && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-xs">
          ⚠️ Speech recognition is not supported in this browser. Try using
          Chrome, Edge, or Safari.
        </div>
      )}
    </div>
  );
}
