// /api/generate.js
import { GoogleGenerativeAI } from "@google/generative-ai";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("DEBUG-INIT-FAIL: GEMINI_API_KEY not set");
  throw new Error("Missing GEMINI_API_KEY environment variable");
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
export default async function handler(req, res) {
  console.log("DEBUG-HANDLER-START");
  const word = req.query.word;
  if (!word) {
    return res.status(400).json({ error: "Missing 'word' parameter" });
  }
  const originalWord = word.toUpperCase();
  console.log(`DEBUG-WORD: ${originalWord}`);
  try {
    const prompt = `For the word "${originalWord}", provide a concise definition and a sample sentence clue. Return a JSON object with "definition" and "sentenceClue" keys only. Example: {"definition": "meaning", "sentenceClue": "sentence with clue"}`;
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    if (!result || !result.response) {
      throw new Error("No response from AI model");
    }
    const text = result.response.text().trim();
    let data;
    try {
      data = JSON.parse(text);
      if (!data.definition || !data.sentenceClue) {
        throw new Error("Missing required fields in AI response");
      }
    } catch (parseError) {
      console.error("DEBUG-PARSE-ERROR:", parseError.message, "Raw text:", text);
      return res.status(500).json({ error: "Invalid response format from AI", raw: text });
    }
    res.status(200).json({
      originalWord,
      definition: data.definition,
      sentenceClue: data.sentenceClue,
    });
  } catch (error) {
    console.error("DEBUG-ERROR:", error.message);
    res.status(500).json({ error: "Failed to generate word data", details: error.message });
  }
}
