// api/generate.js - This code runs securely on the Vercel server.

// Vercel's Node.js environment requires a dynamic import for 'node-fetch'
// unless configured otherwise, but we'll stick to a common syntax pattern.
import fetch from 'node-fetch';

// IMPORTANT: These variables will be populated securely from
// the Environment Variables you set in your Vercel project dashboard.
const GEMINI_API_URL = process.env.GEMINI_API_URL;
const IMAGEN_API_URL = process.env.IMAGEN_API_URL;
const API_KEY = process.env.GOOGLE_API_KEY; 

// The 'handler' function is the entry point for Vercel's Serverless Function.
export default async function handler(req, res) {
    // 1. Get the 'word' parameter from the frontend request (e.g., /api/generate?word=LIGHT)
    const word = req.query.word ? req.query.word.toUpperCase() : null;

    if (!word) {
        return res.status(400).json({ error: "Missing 'word' parameter in the request URL." });
    }
    
    // Set standard headers, including the secret API key from the environment.
    const headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': AIzaSyAIEokfox_fO7HQn4TQs7ZSrueZCcv_Ye4, // The key is safely used on the server side
    };

    try {
        // --- A. Fetch Text Clues (Definition, Sentence, and Image Prompt) using Gemini ---
        const cluePayload = {
            contents: [{ parts: [{ text: `Generate a very simple, single-sentence definition and a fun, helpful clue sentence using the word "${word}" for a young child. Also provide a simple, descriptive prompt for generating a clear, colorful illustration of this word. Return the response strictly as a JSON object with keys: definition, sentenceClue, and imagePrompt.` }] }],
            systemInstruction: { parts: [{ text: "You are a helpful language tutor for children. Do not add any extra text or markdown outside of the requested JSON object." }] },
            generationConfig: {
                // Instruct Gemini to return only a valid JSON object
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        "definition": { "type": "STRING" },
                        "sentenceClue": { "type": "STRING" },
                        "imagePrompt": { "type": "STRING" }
                    }
                }
            }
        };

        const clueResponse = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(cluePayload)
        }).then(r => r.json());

        const clueText = clueResponse.candidates?.[0]?.content?.parts?.[0]?.text;
        // Safely parse the JSON output from Gemini
        let parsedClue = JSON.parse(clueText);


        // --- B. Fetch Image (using Imagen) ---
        // Augment the prompt provided by Gemini for better visual quality
        const imagePrompt = `Simple, colorful, illustration for children, clear representation of: ${parsedClue.imagePrompt}`;
        
        const imagePayload = {
            instances: [{ prompt: imagePrompt, aspectRatio: "1:1" }],
            parameters: { "sampleCount": 1 }
        };

        const imageResponse = await fetch(IMAGEN_API_URL, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(imagePayload)
        }).then(r => r.json());

        // Imagen returns a base64 encoded string of the image data
        const base64Data = imageResponse.predictions?.[0]?.bytesBase64Encoded;
        let imageUrl = `https://placehold.co/600x400/D97706/FFFFFF?text=Image+Failed`;

        if (base64Data) {
            // Create a Data URL that the frontend can use directly in an <img> tag
            imageUrl = `data:image/png;base64,${base64Data}`;
        }
        
        // --- C. Send Combined Data Back to Frontend ---
        res.status(200).json({
            definition: parsedClue.definition,
            sentenceClue: parsedClue.sentenceClue,
            imageUrl: imageUrl, // Base64 Data URL for the image
        });

    } catch (error) {
        console.error("API proxy error:", error);
        res.status(500).json({ error: "Failed to fetch data from Google APIs. Check server logs." });
    }
}
