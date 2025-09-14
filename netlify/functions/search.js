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
    const googleKey = process.env.GOOGLE_API_KEY;
    const googleCx  = process.env.GOOGLE_CSE_ID;
    const newsKey   = process.env.NEWS_API_KEY;
    const braveKey  = process.env.BRAVE_API_KEY;

    // =========================
    // 2. Build requests
    // =========================
    const requests = [];

    // DuckDuckGo (free)
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`;
    requests.push(fetch(ddgUrl).then(r => r.json()).then(data => {
      const topics = (data.RelatedTopics || []).flatMap(i => i.Topics || [i]);
      return topics.map(i => ({
        title: i.Text || "",
        link: i.FirstURL || "",
        snippet: i.Text || "",
        source: "duckduckgo"
      }));
    }).catch(() => []));

    // Wikipedia (free)
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json`;
    requests.push(fetch(wikiUrl).then(r => r.json()).then(data => {
      return (data.query?.search || []).map(i => ({
        title: i.title,
        link: `https://en.wikipedia.org/wiki/${encodeURIComponent(i.title)}`,
        snippet: i.snippet,
        source: "wikipedia"
      }));
    }).catch(() => []));

    // Google CSE (run even if keys missing → just return empty)
    const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${googleKey || "MISSING"}&cx=${googleCx || "MISSING"}&q=${encodeURIComponent(query)}`;
    requests.push(fetch(googleUrl).then(r => r.json()).then(data => {
      return (data.items || []).map(i => ({
        title: i.title,
        link: i.link,
        snippet: i.snippet,
        source: "google"
      }));
    }).catch(() => []));

    // News API
    const newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&apiKey=${newsKey || "MISSING"}`;
    requests.push(fetch(newsUrl).then(r => r.json()).then(data => {
      return (data.articles || []).map(i => ({
        title: i.title,
        link: i.url,
        snippet: i.description || "",
        source: "news"
      }));
    }).catch(() => []));

    // Brave Search
    const braveUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`;
    requests.push(fetch(braveUrl, { headers: { "X-Subscription-Token": braveKey || "MISSING" } })
      .then(r => r.json()).then(data => {
        return (data.web?.results || []).map(i => ({
          title: i.title,
          link: i.url,
          snippet: i.description || "",
          source: "brave"
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
    // 4. Pick Warp Result (keyword scoring)
    // =========================
    let warp = null;
    if (items.length > 0) {
      const keywords = query.toLowerCase().split(/\s+/);
      function score(item) {
        const title = (item.title || "").toLowerCase();
        const snippet = (item.snippet || "").toLowerCase();
        let s = 0;
        keywords.forEach(k => {
          if (title.includes(k)) s += 3;
          if (snippet.includes(k)) s += 1;
        });
        return s;
      }
      items.sort((a, b) => score(b) - score(a));
      warp = items[0];
    }

    // =========================
    // 5. Return JSON
    // =========================
    return {
      statusCode: 200,
      body: JSON.stringify({ warp, items }),
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}

