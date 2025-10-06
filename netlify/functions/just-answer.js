// =======================================================
// ✅ Jessica "Just Answer" Function
// Fetches a short Gemini AI answer for a given query (q)
// =======================================================

// 1️⃣ Load environment variables from .env file
//    (expects GEMINI_API_KEY=your_key_here)
require('dotenv').config();

// 2️⃣ Pull the key from environment
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 3️⃣ Allow browser requests (CORS headers)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// =======================================================
// 🔹 Netlify Handler
// Handles POST from front-end → talks to Gemini API
// =======================================================
exports.handler = async (event) => {

  // --- Handle preflight (browser OPTIONS request)
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  // --- Require valid API key
  if (!GEMINI_API_KEY) {
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing GEMINI_API_KEY in .env" }),
    };
  }

  try {
    // --- Parse request body (expects { q: "your question" })
    const { q } = JSON.parse(event.body || "{}");
    if (!q?.trim()) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: "Missing 'q' parameter" }),
      };
    }

    // --- Gemini API payload
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: `Answer clearly in 1–3 sentences:\n${q}` }
          ],
        },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 120 },
    };

    // --- Send request to Gemini
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    // --- Parse result
    const data = await resp.json();
    const answer =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "No answer found.";

    // --- Return answer to front-end
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ answer }),
    };

  } catch (err) {
    // --- Handle errors (bad JSON, network fail, etc.)
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
