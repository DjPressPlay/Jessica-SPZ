// netlify/functions/search.js

export async function handler(event) {
  const query = event.queryStringParameters.q;
  if (!query) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing query" }) };
  }

  try {
    // =========================
    // 1. Prepare API keys
    // =========================
    const googleKey    = process.env.GOOGLE_API_KEY;
    const googleCx     = process.env.GOOGLE_CSE_ID;
    const newsKey      = process.env.NEWS_API_KEY;
    const searchApiKey = process.env.SEARCHAPI_KEY;

    // =========================
    // 2. Build requests
    // =========================
    const requests = [];

    // DuckDuckGo (free)
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`;
    requests.push(
      fetch(ddgUrl).then(r => r.json()).then(data => {
        const topics = (data.RelatedTopics || []).flatMap(i => i.Topics || [i]);
        return topics.map(i => ({
          title: i.Text || "",
          link: i.FirstURL || "",
          snippet: i.Text || "",
          source: "duckduckgo"
        }));
      }).catch(() => [])
    );

    // Wikipedia (free)
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json`;
    requests.push(
      fetch(wikiUrl).then(r => r.json()).then(data => {
        return (data.query?.search || []).map(i => ({
          title: i.title,
          link: `https://en.wikipedia.org/wiki/${encodeURIComponent(i.title)}`,
          snippet: i.snippet,
          source: "wikipedia"
        }));
      }).catch(() => [])
    );

    // Google CSE
    const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${googleKey || "MISSING"}&cx=${googleCx || "MISSING"}&q=${encodeURIComponent(query)}`;
    requests.push(
      fetch(googleUrl).then(r => r.json()).then(data => {
        return (data.items || []).map(i => ({
          title: i.title,
          link: i.link,
          snippet: i.snippet,
          source: "google"
        }));
      }).catch(() => [])
    );

    // News API
    const newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&apiKey=${newsKey || "MISSING"}`;
    requests.push(
      fetch(newsUrl).then(r => r.json()).then(data => {
        return (data.articles || []).map(i => ({
          title: i.title,
          link: i.url,
          snippet: i.description || "",
          source: "news"
        }));
      }).catch(() => [])
    );

    // SearchApi.io
    const searchApiUrl = `https://www.searchapi.io/api/v1/search?q=${encodeURIComponent(query)}&engine=google`;
    requests.push(
      fetch(searchApiUrl, {
        headers: { "Authorization": `Bearer ${searchApiKey || "MISSING"}` }
      }).then(r => r.json()).then(data => {
        return (data.organic_results || []).map(i => ({
          title: i.title,
          link: i.link,
          snippet: i.snippet || "",
          source: "searchapi"
        }));
      }).catch(() => [])
    );

    // =========================
    // 3. Collect all results
    // =========================
    const allResults = await Promise.all(requests);
    let items = allResults.flat();

    // Deduplicate by link
    const seen = new Set();
    items = items.filter(i => {
      if (!i.link || seen.has(i.link)) return false;
      seen.add(i.link);
      return true;
    });

    // =========================
    // 4. Group by source, take top 5 each
    // =========================
    const grouped = {};
    items.forEach(item => {
      if (!grouped[item.source]) grouped[item.source] = [];
      if (grouped[item.source].length < 5) {
        grouped[item.source].push(item);
      }
    });

    // Highlights = top 1 from each source
    const highlights = [];
    const reduced = [];
    Object.entries(grouped).forEach(([src, list]) => {
      if (list.length > 0) {
        highlights.push(list[0]);
        reduced.push(...list.slice(1));
      }
    });

    // =========================
    // 5. Return JSON
    // =========================
    return {
      statusCode: 200,
      body: JSON.stringify({ highlights, items: reduced })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
