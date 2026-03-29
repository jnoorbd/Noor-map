import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function searchPlaces(query: string, location?: { lat: number; lng: number }) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: query,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: location ? {
            latLng: {
              latitude: location.lat,
              longitude: location.lng
            }
          } : undefined
        }
      },
    });

    return {
      text: response.text,
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    console.error("Error searching places:", error);
    throw error;
  }
}

export async function getCoordinates(query: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find the precise latitude and longitude for: ${query}. Return only the coordinates in JSON format: {"lat": number, "lng": number, "name": "string"}.`,
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text || "{}") as { lat: number; lng: number; name: string };
  } catch (error) {
    console.error("Error getting coordinates:", error);
    return null;
  }
}
