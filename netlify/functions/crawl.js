// netlify/functions/crawl.js
// CommonJS export for Netlify Functions. No npm deps.
// Safer scraping: prefers OG/Twitter image, skips trackers/pixels, validates URLs.

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return resText(405, "Method Not Allowed");
    }

    const body = safeJSON(event.body);
    if (!body) return resJSON(400, { error: "Invalid JSON body" });

    const links = Array.isArray(body.links) ? body.links : [];
    const session = body.session || "";
    if (!links.length) {
      return resJSON(400, { error: "No links provided" });
    }

    const results = [];
    for (let url of links) {
      let safeUrl = (url || "").trim();
      if (!/^https?:\/\//i.test(safeUrl)) safeUrl = "https://" + safeUrl;

      try {
        const r = await fetch(safeUrl, {
          redirect: "follow",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; Jessica-SPZ/1.0; +https://sporez.netlify.app)",
            "Accept":
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
        });
        if (!r.ok) throw new Error(`Fetch ${r.status}`);
        const html = await r.text();

        const title = extractTitle(html) || "";
        const description = extractDescription(html) || "";
        const image = extractHeroImage(html, safeUrl) || "";

        results.push({
          url: safeUrl,
          title,
          description,
          image,
          rawHTMLLength: html.length,
        });
      } catch (err) {
        results.push({ url: safeUrl, error: String(err && err.message || err) });
      }
    }

    return resJSON(200, { session, results });
  } catch (err) {
    return resJSON(500, { error: String(err && err.message || err) });
  }
};

/* ---------------- helpers ---------------- */

function resText(statusCode, body) {
  return { statusCode, body };
}
function resJSON(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}
function safeJSON(s) {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return null;
  }
}

function extractTitle(html = "") {
  let m =
    html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
    ) ||
    html.match(
      /<meta[^>]+name=["']og:title["'][^>]+content=["']([^"']+)["']/i
    );
  if (m) return m[1].trim();
  m = html.match(/<title>(.*?)<\/title>/i);
  return m ? m[1].trim() : "";
}

function extractDescription(html = "") {
  let m =
    html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
    ) ||
    html.match(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
    ) ||
    html.match(
      /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i
    );
  return m ? m[1].trim() : "";
}

function extractHeroImage(html = "", baseUrl = "") {
  // 1) Prefer OG/Twitter/link rel=image_src
  const metas = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  ];
  for (const re of metas) {
    const m = html.match(re);
    if (m) {
      const u = absolutize(baseUrl, m[1].trim());
      if (isValidImage(u) && !isTrackerDomain(u)) return u;
    }
  }

  // 2) Fallback to IMG tags, skipping pixels/trackers
  const imgs = [];
  const reImg = /<img\b[^>]*>/gi;
  let m;
  while ((m = reImg.exec(html))) {
    const tag = m[0];
    const src = getAttr(tag, "src") || getAttr(tag, "data-src") || "";
    if (!src) continue;
    const w = parseInt(getAttr(tag, "width") || "0", 10);
    const h = parseInt(getAttr(tag, "height") || "0", 10);
    const url = absolutize(baseUrl, src.trim());
    imgs.push({ url, w, h, tag });
  }
  for (const im of imgs) {
    if (!isValidImage(im.url)) continue;
    if (looksLikePixel(im)) continue;
    if (isTrackerDomain(im.url)) continue;
    return im.url;
  }
  return "";
}

function getAttr(tag, name) {
  const re = new RegExp(name + `=["']([^"']+)["']`, "i");
  const m = tag.match(re);
  return m ? m[1] : "";
}

function isValidImage(u = "") {
  // must be http(s) + have proper hostname; extension optional
  try {
    const x = new URL(u);
    if (!/^https?:$/i.test(x.protocol)) return false;
    if (!/\.[a-z]{2,}$/i.test(x.hostname)) return false;
    if (/^data:image\//i.test(u)) return true;
    if (/\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(u)) return true;
    // allow CDN images without extension
    return true;
  } catch {
    return false;
  }
}

function looksLikePixel(im) {
  const u = String(im.url || "").toLowerCase();
  if (/1x1|pixel|spacer|transparent/.test(u)) return true;
  if (im.w && im.h && im.w <= 2 && im.h <= 2) return true;
  // common query params used by pixels
  if (/[?&](width|height)=1\b/.test(u)) return true;
  return false;
}

function isTrackerDomain(u = "") {
  return /(fls-na\.amazon|amazon-adsystem|doubleclick\.net|googletagmanager|google-analytics|stats\.|segment\.io|mixpanel|adservice\.)/i.test(
    u
  );
}

function absolutize(base, src) {
  if (!src) return src;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("//")) return "https:" + src;
  try {
    const b = new URL(base);
    if (src.startsWith("/")) return b.origin + src;
    return new URL(src, b.origin + b.pathname).toString();
  } catch {
    return src;
  }
}
