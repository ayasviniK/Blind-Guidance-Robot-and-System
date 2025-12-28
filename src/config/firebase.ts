import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, push } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import type { RobotData, GPSData } from "../types";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const database = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Database references
export const robotRef = ref(database, "robot");
export const gpsRef = ref(database, "robot/gps");
export const navigationRef = ref(database, "robot/navigation");
export const audioRef = ref(database, "robot/audio");
export const commandsRef = ref(database, "robot/commands");

// Helper functions
export const sendCommand = async (
  command: string,
  data?: Record<string, unknown>
) => {
  const commandRef = push(commandsRef);
  await set(commandRef, {
    command,
    data,
    timestamp: Date.now(),
  });
};

export const subscribeToRobotData = (
  callback: (data: RobotData | null) => void
) => {
  return onValue(robotRef, (snapshot) => {
    const data = snapshot.val();
    callback(data);
  });
};

export const subscribeToGPS = (callback: (data: GPSData | null) => void) => {
  return onValue(gpsRef, (snapshot) => {
    const data = snapshot.val();
    callback(data);
  });
};

export default app;
