// Returns a short direct answer for a query.
require('dotenv').config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return {
      statusCode: 501,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
    };
  }

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

  try {
    const payload = {
      contents: [{
        role: "user",
        parts: [{
          text:
`Answer succinctly in 1–3 sentences. No links, no sources, no preface.
Question: ${q}`
        }]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 100 }
    };

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || `Gemini HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const answer =
      (data?.candidates?.[0]?.content?.parts || [])
        .map(p => p.text || "")
        .join("\n")
        .trim();

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "AI failure", detail: String(err.message || err) }),
    };
  }
};
