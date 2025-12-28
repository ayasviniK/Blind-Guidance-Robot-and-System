import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.warn(
    "Gemini API key is not set. Please add VITE_GEMINI_API_KEY to your .env file."
  );
}

// Initialize the Gemini AI client
const genAI = new GoogleGenerativeAI(API_KEY || "");

// Get the generative model
export const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// Helper function to generate text
export const generateText = async (prompt: string): Promise<string> => {
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating text with Gemini:", error);
    throw error;
  }
};

// Helper function to analyze image with Gemini Vision
export const analyzeImage = async (
  imageData: string,
  prompt: string
): Promise<string> => {
  try {
    // Use gemini-pro-vision model for image analysis
    const visionModel = genAI.getGenerativeModel({
      model: "gemini-pro-vision",
    });

    // Convert base64 image data to the format Gemini expects
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: "image/jpeg",
      },
    };

    const result = await visionModel.generateContent([prompt, imagePart]);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error analyzing image with Gemini Vision:", error);
    // Fallback to text-only analysis
    return generateText(
      prompt +
        "\n\nNote: Unable to analyze image. Provide general navigation guidance."
    );
  }
};

// Helper function to generate navigation instructions
export const generateNavigationInstructions = async (
  currentLocation: { lat: number; lng: number },
  destination: string
): Promise<string> => {
  const prompt = `Given the current GPS location (latitude: ${currentLocation.lat}, longitude: ${currentLocation.lng}), 
  provide clear navigation instructions to reach the destination: ${destination}. 
  Keep the instructions concise and suitable for audio playback.`;

  return await generateText(prompt);
};

// Helper function to analyze audio command
export const analyzeAudioCommand = async (
  transcription: string
): Promise<{ intent: string; parameters: Record<string, unknown> }> => {
  const prompt = `Analyze the following voice command for a guiding robot: "${transcription}". 
  Extract the intent (navigate, stop, status, etc.) and any relevant parameters (destination, direction, etc.). 
  Respond in JSON format with 'intent' and 'parameters' fields.`;

  const response = await generateText(prompt);

  try {
    // Try to parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { intent: "unknown", parameters: {} };
  } catch (error) {
    console.error("Error parsing Gemini response:", error);
    return { intent: "unknown", parameters: {} };
  }
};

// Helper function to get contextual help
export const getContextualHelp = async (context: string): Promise<string> => {
  const prompt = `Provide helpful guidance for a user controlling a guiding robot in the following context: ${context}. 
  Keep the response brief and actionable.`;

  return await generateText(prompt);
};

export default genAI;
