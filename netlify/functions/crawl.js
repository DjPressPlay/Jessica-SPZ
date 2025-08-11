export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { links = [], session = "" } = JSON.parse(event.body || "{}");
    if (!Array.isArray(links) || !links.length) {
      return { statusCode: 400, body: JSON.stringify({ error: "No links provided" }) };
    }

    const results = [];
    for (let url of links) {
      let safeUrl = url.trim();
      if (!/^https?:\/\//i.test(safeUrl)) safeUrl = "https://" + safeUrl;

      try {
        const res = await fetch(safeUrl, { redirect: "follow" });
        const html = await res.text();

        // basic parsing
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : "";

        const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
        const description = metaDescMatch ? metaDescMatch[1].trim() : "";

        // first image
        const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
        let image = imgMatch ? imgMatch[1] : "";
        if (image && image.startsWith("//")) image = "https:" + image;
        else if (image && image.startsWith("/")) {
          try {
            const u = new URL(safeUrl);
            image = u.origin + image;
          } catch {}
        }

        results.push({
          url: safeUrl,
          title,
          description,
          image,
          rawHTMLLength: html.length
        });
      } catch (err) {
        results.push({
          url: safeUrl,
          error: err.message
        });
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session, results })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message })
    };
  }
}
