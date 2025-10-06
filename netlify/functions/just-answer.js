// === just-answer.js ===
// Uses environment variables cleanly with a const .env-style block

const fetch = require("node-fetch");

const env = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  const { GEMINI_API_KEY } = env;
  if (!GEMINI_API_KEY) {
    return {
      statusCode: 501,
      headers: CORS,
      body: JSON.stringify({ error: "Missing GEMINI_API_KEY in .env" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const q = (body.q || "").trim();

    if (!q) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: "Missing question" }),
      };
    }

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: `Answer clearly in 1–3 sentences:\n${q}` }],
        },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 120 },
    };

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const data = await resp.json();
    const answer =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "No answer found.";

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ answer }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
