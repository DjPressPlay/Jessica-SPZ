// netlify/functions/search-with-images.js
import { handler as crawlHandler } from "./crawl.js";

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

    // DuckDuckGo → no native images
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`;
    requests.push(
      fetch(ddgUrl).then(r => r.json()).then(data => {
        const topics = (data.RelatedTopics || []).flatMap(i => i.Topics || [i]);
        return topics.map(i => ({
          title: i.Text || "",
          link: i.FirstURL || "",
          snippet: i.Text || "",
          source: "duckduckgo",
          timestamp: new Date().toISOString()
        }));
      }).catch(() => [])
    );

    // Wikipedia → no images in search, but page summary API has thumbnails
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json`;
    requests.push(
      fetch(wikiUrl).then(r => r.json()).then(async data => {
        const results = data.query?.search || [];
        const enriched = await Promise.all(results.map(async (i) => {
          let thumb;
          try {
            const summaryRes = await fetch(
              `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(i.title)}`
            );
            const summary = await summaryRes.json();
            thumb = summary.thumbnail?.source;
          } catch {}
          return {
            title: i.title,
            link: `https://en.wikipedia.org/wiki/${encodeURIComponent(i.title)}`,
            snippet: i.snippet,
            source: "wikipedia",
            timestamp: new Date().toISOString(),
            ...(thumb ? { image: thumb } : {})
          };
        }));
        return enriched;
      }).catch(() => [])
    );

    // Google CSE → cse_image or og:image
    const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${googleKey || "MISSING"}&cx=${googleCx || "MISSING"}&q=${encodeURIComponent(query)}`;
    requests.push(
      fetch(googleUrl).then(r => r.json()).then(data => {
        return (data.items || []).map(i => {
          const pm = i.pagemap || {};
          const metatagImg = pm.metatags?.[0]?.["og:image"];
          const cseImg = pm.cse_image?.[0]?.src;
          return {
            title: i.title,
            link: i.link,
            snippet: i.snippet,
            source: "google",
            timestamp: new Date().toISOString(),
            ...(cseImg || metatagImg ? { image: cseImg || metatagImg } : {})
          };
        });
      }).catch(() => [])
    );

    // News API → urlToImage, publishedAt
    const newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&apiKey=${newsKey || "MISSING"}`;
    requests.push(
      fetch(newsUrl).then(r => r.json()).then(data => {
        return (data.articles || []).map(i => ({
          title: i.title,
          link: i.url,
          snippet: i.description || "",
          source: "news",
          timestamp: i.publishedAt || new Date().toISOString(),
          ...(i.urlToImage ? { image: i.urlToImage } : {})
        }));
      }).catch(() => [])
    );

    // SearchApi.io → thumbnail/snippet_thumbnail, publishedAt if present
    const searchApiUrl = `https://www.searchapi.io/api/v1/search?q=${encodeURIComponent(query)}&engine=google`;
    requests.push(
      fetch(searchApiUrl, {
        headers: { "Authorization": `Bearer ${searchApiKey || "MISSING"}` }
      }).then(r => r.json()).then(async data => {
        const results = data.organic_results || [];
        const enriched = await Promise.all(results.map(async (i) => {
          let img = i.thumbnail || i.snippet_thumbnail;
          if (!img && i.link?.includes("wikipedia.org")) {
            try {
              const title = decodeURIComponent(i.link.split("/wiki/")[1] || "");
              const summaryRes = await fetch(
                `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`
              );
              const summary = await summaryRes.json();
              img = summary.thumbnail?.source;
            } catch {}
          }
          return {
            title: i.title,
            link: i.link,
            snippet: i.snippet || "",
            source: "searchapi",
            timestamp: i.publishedAt || new Date().toISOString(),
            ...(img ? { image: img } : {})
          };
        }));
        return enriched;
      }).catch(() => [])
    );

    // =========================
    // 3. Collect, dedupe, sort
    // =========================
    const allResults = await Promise.all(requests);
    let items = allResults.flat();

    const seen = new Set();
    items = items.filter(i => {
      if (!i.link || seen.has(i.link)) return false;
      seen.add(i.link);
      return true;
    });

    // Sort newest → oldest
    items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // =========================
    // 4. Group + Split highlights
    // =========================
    const grouped = {};
    items.forEach(item => {
      if (!grouped[item.source]) grouped[item.source] = [];
      if (grouped[item.source].length < 5) grouped[item.source].push(item);
    });

    const highlights = [];
    let reduced = [];
    Object.entries(grouped).forEach(([src, list]) => {
      if (list.length > 0) {
        highlights.push(list[0]);
        reduced.push(...list.slice(1));
      }
    });

    reduced = reduced.slice(0, 20); // cap

    // =========================
    // 5. Crawl fallback for missing images
    // =========================
    const linksToCrawl = [
      ...highlights.filter(i => !i.image).map(i => i.link),
      ...reduced.filter(i => !i.image).map(i => i.link)
    ];

    let imageMap = {};
    if (linksToCrawl.length > 0) {
      const crawlRes = await crawlHandler({
        httpMethod: "POST",
        body: JSON.stringify({ links: linksToCrawl })
      });
      const crawlData = JSON.parse(crawlRes.body)?.results || [];
      crawlData.forEach(entry => {
        if (entry.url) imageMap[entry.url] = entry.image || "";
      });
    }

    // =========================
    // 6. Merge final images
    // =========================
    const addImage = (list) =>
      list.map(i => ({
        ...i,
        ...(i.image ? {} : (imageMap[i.link] ? { image: imageMap[i.link] } : {}))
      }));

    const highlightsWithImages = addImage(highlights);
    const reducedWithImages = addImage(reduced);

    // =========================
    // 7. Return JSON
    // =========================
    return {
      statusCode: 200,
      body: JSON.stringify({
        highlights: highlightsWithImages,
        items: reducedWithImages
      })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
