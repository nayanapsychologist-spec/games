// api/generate.js - Vercel Serverless Function (Node.js)

// Initialization section remains the same for production, but logs added for debugging
import { GoogleGenerativeAI } from '@google/genai';
import { GoogleGenAI } from '@google/genai/server'; // Use the server import for the API Key access

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// DEBUG LOG: Check if the key is present (only logs a success/fail message, not the key itself)
if (!GEMINI_API_KEY) {
    console.error("DEBUG-INIT-FAIL: GEMINI_API_KEY environment variable is NOT set. Cannot proceed with API calls.");
    // Keep the throw to prevent crashing later with a null key
    throw new Error("GEMINI_API_KEY environment variable is not set.");
} else {
    // We log the length instead of the key for security. API keys are long (e.g., 39 chars).
    console.log(`DEBUG-INIT-SUCCESS: GEMINI_API_KEY loaded. Length: ${GEMINI_API_KEY.length}`);
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
    // DEBUG LOG: Function execution started
    console.log("DEBUG-HANDLER-START: API function handler started.");
    
    // 1. Get the word from the client's query string (e.g., /api/generate?word=LIGHT)
    const word = request.query.word;

    if (!word) {
        // DEBUG LOG: Word missing error
        console.error("DEBUG-HANDLER-FAIL: Missing word parameter in query.");
        return response.status(400).json({ error: 'Missing word parameter.' });
    }
    
    const originalWord = word.toUpperCase();
    console.log(`DEBUG-WORD: Processing word: ${originalWord}`);

    try {
        // --- Step A: Generate Clues (Definition and Sentence) using Gemini ---
        console.log("DEBUG-STEP-A: Starting Gemini text generation...");
        
        const prompt = `For the word "${originalWord}", provide a concise definition and a sample sentence clue. Format the response as a single, valid JSON object with the keys "definition" and "sentenceClue". Do not include any text, headers, or markdown outside of the JSON object.`;

        const geminiResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'object',
                    properties: {
                        definition: { type: 'string', description: 'A concise, easy-to-understand definition of the word.' },
                        sentenceClue: { type: 'string', description: 'A simple sentence using the word as a clue.' },
                    },
                    required: ['definition', 'sentenceClue'],
                },
            },
        });
        
        console.log("DEBUG-STEP-A-SUCCESS: Gemini text generated.");

        // Parse the JSON response
        const clueData = JSON.parse(geminiResponse.text.trim());
        
        // --- Step B: Generate Image using Imagen ---
        console.log("DEBUG-STEP-B: Starting Imagen image generation...");
        
        const imagePrompt = `A simple, colorful, educational illustration of the word: ${originalWord}`;
        
        const imageResponse = await imageAi.models.generateImages({
            model: 'imagen-3.0-generate-002', 
            prompt: imagePrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '1:1', // Square image is often good for games
            },
        });

        console.log("DEBUG-STEP-B-SUCCESS: Imagen image generated.");

        // Extract the base64 image data
        const imageBase64 = imageResponse.generatedImages[0].image.imageBytes;
        const imageUrl = `data:image/jpeg;base64,${imageBase64}`;

        // --- Step C: Send combined response back to the client ---
        response.status(200).json({
            originalWord: originalWord,
            definition: clueData.definition,
            sentenceClue: clueData.sentenceClue,
            imageUrl: imageUrl, // Base64 Data URL
        });
        
        console.log("DEBUG-HANDLER-END: Response sent successfully (200).");

    } catch (error) {
        // DEBUG LOG: Catch-all error for API call failures
        console.error('DEBUG-CATCH-ERROR: API Processing Error occurred!', error.message);
        
        // Return a clear error message and status
        response.status(500).json({ 
            error: 'Failed to generate word data or image.', 
            details: error.message 
        });
    }
}
