// Jessica-SPZ — Fuse multiple crawl results into a single page JSON
// No npm deps. Pure Node/JS.

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const {
      results = [],     // array from /api/crawl
      mode = "auto",    // "auto" | "sell" | "info" | "hybrid"
      defaults = { sell: true, info: false },
      session = ""
    } = JSON.parse(event.body || "{}");

    if (!Array.isArray(results) || results.length === 0) {
      return json(400, { error: "No results provided" });
    }

    // Normalize and score inputs
    const normalized = results.map(r => normalizeResult(r));
    const sourceLinks = normalized.map(n => n.url).filter(Boolean);

    // Heuristic product detection (cheap + safe)
    const products = dedupeProducts(
      normalized.flatMap(n => guessProductsFrom(n))
    ).slice(0, 8);

    // Info sections from titles/descriptions
    const articles = dedupeArticles(
      normalized.map(n => ({
        heading: safeCut(n.title || hostOf(n.url) || "Info", 100),
        content: n.description || (`Source: ${n.url}`)
      }))
    ).slice(0, 8);

    // Decide mode if auto
    const chosenMode = mode === "auto"
      ? decideMode({ products, defaults })
      : mode;

    // Hero selection
    const primary = normalized[0] || {};
    const hero = {
      title: marketTitle(primary.title) || "Zetsu-Grade Fusion Page",
      subtitle: primary.description || "Auto-built from your links",
      image: pickHeroImage(normalized),
    };

    // CTA logic
    const cta = buildCTA(chosenMode, products, normalized);

    // Slug suggestion (publish step can override)
    const slug = slugify(hero.title) || ("drop-" + Date.now().toString(36));

    const fused = {
      _by: "Jessica-SPZ",
      session,
      mode: chosenMode,
      slug,
      hero: {
        title: hero.title,
        subtitle: hero.subtitle,
        image: hero.image,
        ctaText: cta.text,
        ctaLink: cta.link
      },
      products,
      articles,
      media: [],             // (future: image/video scrape)
      sources: sourceLinks   // keep for traceability
    };

    return json(200, fused);
  } catch (err) {
    return json(500, { error: err.message });
  }
}

/* ------------------ helpers ------------------ */

function json(status, obj) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj)
  };
}

function normalizeResult(r = {}) {
  const url = (r.url || "").trim();
  return {
    url,
    host: hostOf(url),
    title: safeText(r.title),
    description: safeText(r.description),
    image: (r.image || "").trim()
  };
}

function hostOf(u) {
  try { return new URL(u).host; } catch { return ""; }
}

function safeText(s) {
  if (!s || typeof s !== "string") return "";
  // strip excessive whitespace
  return s.replace(/\s+/g, " ").trim();
}

function safeCut(s, max) {
  if (!s) return s;
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function slugify(s) {
  if (!s) return "";
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function pickHeroImage(list) {
  for (const n of list) {
    if (n.image && isLikelyImage(n.image)) return absolutize(n.url, n.image);
  }
  return ""; // preview hides when empty
}

function isLikelyImage(src) {
  return /^data:image\//.test(src) ||
         /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(src) ||
         /^https?:\/\//i.test(src) ||
         src.startsWith("/") || src.startsWith("//");
}

function absolutize(base, src) {
  if (!src) return src;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("//")) return "https:" + src;
  try {
    const u = new URL(base);
    if (src.startsWith("/")) return u.origin + src;
    return new URL(src, u.origin + u.pathname).toString();
  } catch { return src; }
}
