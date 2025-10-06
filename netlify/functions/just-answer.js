// netlify/functions/just-answer.js
// Returns a short direct answer for a query

require("dotenv").config();
const fetch = require("node-fetch"); // for Netlify Node 18+ runtime, ensure node-fetch imported

// --- CONFIG ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// --- HANDLER ---
exports.handler = async (event) => {
  try {
    // Preflight
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS, body: "" };
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
    }

    // Ensure key exists
    if (!GEMINI_API_KEY) {
      console.error("⚠️ Missing GEMINI_API_KEY in environment");
      return {
        statusCode: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Server misconfiguration: GEMINI_API_KEY not set" }),
      };
    }

    // Parse incoming question
    let q = "";
    try {
      const body = JSON.parse(event.body || "{}");
      q = (body.q || "").toString().trim();
    } catch (_) {}
    if (!q) {
      return {
        statusCode: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing 'q' parameter" }),
      };
    }

    // Build request payload for Gemini
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Answer in 1–2 sentences, simple and factual. No links or sources. 
Question: ${q}`,
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.1, maxOutputTokens: 80 },
    };

    // Fetch from Gemini API
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!resp.ok) {
      const errTxt = await resp.text();
      throw new Error(`Gemini HTTP ${resp.status}: ${errTxt}`);
    }

    const data = await resp.json();
    const answer =
      (data?.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text || "")
        .join("\n")
        .trim();

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ answer: answer || "No clear answer." }),
    };
  } catch (err) {
    console.error("AI failure:", err);
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "AI failure", detail: String(err.message || err) }),
    };
  }
};
