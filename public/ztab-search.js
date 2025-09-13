// netlify/functions/search.js
import fetch from "node-fetch";

export async function handler(event, context) {
  const query = event.queryStringParameters.q;

  if (!query) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing query parameter" }),
    };
  }

  try {
    const apiKey = process.env.GOOGLE_API_KEY;   // add in Netlify env
    const cx = process.env.GOOGLE_CSE_ID;        // add in Netlify env

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(
      query
    )}`;

    const response = await fetch(url);
    const data = await response.json();

    const results = (data.items || []).map((item) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ items: results }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
