// api/generate.js - Vercel Serverless Function (Node.js)
import { GoogleGenerativeAI } from '@google/genai';
import { GoogleGenAI } from '@google/genai/server'; // Use the server import for the API Key access

// The API key is securely accessed from Vercel Environment Variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set.");
}

// Initialize the GoogleGenAI client (for Gemini text generation)
const ai = new GoogleGenerativeAI(GEMINI_API_KEY);

// Initialize the GoogleGenAI client for Imagen (image generation)
const imageAi = new GoogleGenAI(GEMINI_API_KEY);

/**
 * Vercel Serverless Function to securely handle API calls to Gemini and Imagen.
 * The client-side code calls this endpoint, keeping the API key secret. 
 */
export default async function handler(request, response) {
  // 1. Get the word from the client's query string (e.g., /api/generate?word=LIGHT)
  const word = request.query.word;

  if (!word) {
    return response.status(400).json({ error: 'Missing word parameter.' });
  }
  
  const originalWord = word.toUpperCase();

  try {
    // --- Step A: Generate Clues (Definition and Sentence) using Gemini ---
    const prompt = `For the word "${originalWord}", provide a concise definition and a sample sentence clue. Format the response as a single, valid JSON object with the keys "definition" and "sentenceClue". Do not include any text, headers, or markdown outside of the JSON object.`;

    const geminiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              definition: {
                type: 'string',
                description: 'A concise, easy-to-understand definition of the word.',
              },
              sentenceClue: {
                type: 'string',
                description: 'A simple sentence using the word as a clue.',
              },
            },
            required: ['definition', 'sentenceClue'],
          },
        },
      });

    // Parse the JSON response
    const clueData = JSON.parse(geminiResponse.text.trim());
    
    // --- Step B: Generate Image using Imagen ---
    const imagePrompt = `A simple, colorful, educational illustration of the word: ${originalWord}`;
    
    const imageResponse = await imageAi.models.generateImages({
      model: 'imagen-3.0-generate-002', 
      prompt: imagePrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1', // Square image is often good for games
        // Higher quality can be slower/costlier
        // quality: 'standard', 
      },
    });

    // Extract the base64 image data
    const imageBase64 = imageResponse.generatedImages[0].image.imageBytes;
    const imageUrl = `data:image/jpeg;base64,${imageBase64}`;

    // --- Step C: Send combined response back to the client ---
    response.status(200).json({
      originalWord: originalWord,
      definition: clueData.definition,
      sentenceClue: clueData.sentenceClue,
      imageUrl: imageUrl, // Base64 data URL
    });

  } catch (error) {
    console.error('API Processing Error:', error);
    // Return a clear error message and status
    response.status(500).json({ 
      error: 'Failed to generate word data or image.', 
      details: error.message 
    });
  }
}
