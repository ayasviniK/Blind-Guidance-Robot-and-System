// Robot Data Types
export interface RobotData {
  gps?: GPSData;
  navigation?: NavigationData;
  audio?: AudioData;
  status?: RobotStatus;
  commands?: Command[];
}

// GPS Data
export interface GPSData {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp: number;
}

// Navigation Data
export interface NavigationData {
  currentDirection: Direction;
  speed: number;
  status: "moving" | "stopped" | "paused";
  destination?: string;
  distanceToDestination?: number;
}

export type Direction = "forward" | "backward" | "left" | "right" | "stop";

// Audio Data
export interface AudioData {
  isListening: boolean;
  isSpeaking: boolean;
  lastCommand?: string;
  lastResponse?: string;
  volume: number;
}

// Robot Status
export interface RobotStatus {
  battery: number;
  connectivity: "online" | "offline";
  temperature?: number;
  errors?: string[];
}

// Command
export interface Command {
  id?: string;
  command: string;
  data?: Record<string, unknown>;
  timestamp: number;
  status?: "pending" | "executed" | "failed";
}

// Gemini AI Response
export interface GeminiResponse {
  intent: string;
  parameters: Record<string, unknown>;
  confidence?: number;
}

// Camera Stream
export interface CameraStreamProps {
  streamUrl?: string;
  onError?: (error: Error) => void;
}

// Component Props
export interface NavigationProps {
  onCommand: (direction: Direction) => void;
  currentStatus?: NavigationData;
  disabled?: boolean;
}

export interface GPSTrackerProps {
  gpsData?: GPSData;
  onDestinationSet?: (destination: string) => void;
}

export interface AudioControlsProps {
  onCommand: (command: string) => void;
  audioData?: AudioData;
  disabled?: boolean;
}
