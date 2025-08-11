// Jessica-SPZ — Fuse multiple crawl results into a single page JSON
// No npm deps. Pure Node/JS.
// netlify/functions/fuse.js (CommonJS, defensive)
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return resp(405, "Method Not Allowed");
    }

    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch (e) {
      console.error("Bad JSON:", e && e.message);
      return json(400, { error: "Invalid JSON body" });
    }

    var results  = Array.isArray(body.results) ? body.results : [];
    var mode     = body.mode || "auto";
    var defaults = (body.defaults && typeof body.defaults === "object")
      ? body.defaults
      : { sell: true, info: false };
    var session  = body.session || "";

    if (!results.length) {
      return json(400, { error: "No results provided" });
    }

    // Normalize
    var normalized = results.map(normalizeResult);
    // Debug first item only
    try { console.log("Fuse first result:", JSON.stringify(normalized[0]).slice(0, 500)); } catch {}

    var sourceLinks = normalized.map(function(n){ return n.url; }).filter(Boolean);

    // Derive products / articles safely
    var products = dedupeProducts([].concat.apply([], normalized.map(guessProductsFrom))).slice(0, 8);
    var articles = dedupeArticles(normalized.map(function(n){
      return {
        heading: safeCut(n.title || hostOf(n.url) || "Info", 100),
        content: n.description || ("Source: " + (n.url || ""))
      };
    })).slice(0, 8);

    var chosenMode = mode === "auto" ? decideMode({ products: products, defaults: defaults }) : mode;

    var primary = normalized[0] || {};
    var hero = {
      title: marketTitle(primary.title) || "Zetsu-Grade Fusion Page",
      subtitle: primary.description || "Auto-built from your links",
      image: pickHeroImage(normalized)
    };

    var cta = buildCTA(chosenMode, products, normalized);
    var slug = slugify(hero.title) || ("drop-" + Date.now().toString(36));

    var fused = {
      _by: "Jessica-SPZ",
      session: session,
      mode: chosenMode,
      slug: slug,
      hero: {
        title: hero.title,
        subtitle: hero.subtitle,
        image: hero.image,
        ctaText: cta.text,
        ctaLink: cta.link
      },
      products: products,
      articles: articles,
      media: [],
      sources: sourceLinks
    };

    return json(200, fused);
  } catch (err) {
    // Surface details to Netlify logs and return a readable reason
    console.error("Fuse fatal:", err && err.stack || err);
    return json(500, { error: "Fuse failed", reason: (err && err.message) || String(err) });
  }
};

/* ---------------- helpers ---------------- */
function resp(code, text){ return { statusCode: code, body: text }; }
function json(code, obj){ return { statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) }; }

function normalizeResult(r){
  r = r || {};
  var url = (r.url || "").trim();
  return {
    url: url,
    host: hostOf(url),
    title: safeText(r.title),
    description: safeText(r.description),
    image: (r.image || "").trim()
  };
}

function hostOf(u){ try { return new URL(u).host; } catch { return ""; } }
function safeText(s){ return (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : ""); }
function safeCut(s, max){ if(!s) return s; return s.length > max ? s.slice(0, max - 1) + "…" : s; }
function slugify(s){ if(!s) return ""; return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64); }

function pickHeroImage(list){
  for (var i=0;i<list.length;i++){
    var n = list[i];
    if (n.image && isLikelyImage(n.image)) return absolutize(n.url, n.image);
  }
  return "";
}
function isLikelyImage(src){
  return /^data:image\//.test(src) ||
         /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(src) ||
         /^https?:\/\//i.test(src) ||
         (src && (src.startsWith("/") || src.startsWith("//")));
}
function absolutize(base, src){
  if (!src) return src;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("//")) return "https:" + src;
  try {
    var u = new URL(base);
    if (src.startsWith("/")) return u.origin + src;
    return new URL(src, u.origin + u.pathname).toString();
  } catch { return src; }
}

/* product heuristics */
function guessProductsFrom(n){
  var out = [];
  var text = [n.title, n.description].filter(Boolean).join(" • ").toLowerCase();
  var host = (n.host || "").toLowerCase();
  var buySignals = /(buy|shop|store|product|merch|tee|shirt|hoodie|cap|hat|limited|drop|price|\$[0-9])/i;
  var retailHost = /(amazon|etsy|ebay|bestbuy|walmart|aliexpress|shopify|myshopify|bigcartel|gumroad|ko-fi)/i;

  if (buySignals.test(text) || retailHost.test(host)) {
    var price = extractPrice(n.title) || extractPrice(n.description) || "";
    var name = cleanProductName(n.title || host || "Product");
    var link = rewriteAffiliate(n.url);
    out.push({
      name: name,
      price: price,
      image: n.image ? absolutize(n.url, n.image) : "",
      link: link,
      description: n.description || ""
    });
  }
  return out;
}
function extractPrice(s){ if(!s) return ""; var m = String(s).match(/\$[\s]*([0-9]+(?:\.[0-9]{2})?)/); return m ? ("$" + m[1]) : ""; }
function cleanProductName(s){ if(!s) return "Product"; return s.replace(/\s*\|\s*.*$/,"").replace(/–|-|•/g," ").replace(/\s+/g," ").trim(); }
function dedupeProducts(list){
  var seen = Object.create(null), out = [];
  for (var i=0;i<list.length;i++){
    var p = list[i];
    var key = (String(p.name||"").toLowerCase() + "|" + (p.link||""));
    if (seen[key]) continue;
    seen[key] = 1; out.push(p);
  }
  return out;
}
function dedupeArticles(list){
  var seen = Object.create(null), out = [];
  for (var i=0;i<list.length;i++){
    var a = list[i];
    var key = String(a.heading||"").toLowerCase();
    if (seen[key]) continue;
    seen[key] = 1; out.push(a);
  }
  return out;
}

/* mode + CTA */
function decideMode(ctx){
  var products = ctx && ctx.products || [];
  var defaults = ctx && ctx.defaults || {};
  if (products.length && defaults.sell && defaults.info) return "hybrid";
  if (products.length && defaults.sell) return "sell";
  if (defaults.info) return "info";
  return products.length ? "sell" : "info";
}
function buildCTA(mode, products, normalized){
  if (mode === "sell" || (mode === "hybrid" && products.length)) {
    var top = products[0] || {};
    return { text: "Shop Now", link: top.link || (normalized[0] && normalized[0].url) || "#" };
  }
  return { text: "Learn More", link: (normalized[0] && normalized[0].url) || "#" };
}

/* affiliate */
function rewriteAffiliate(u){
  try {
    var url = new URL(u);
    if (/amazon\./i.test(url.host)) { url.searchParams.set("tag","spz-20"); return url.toString(); }
    if (/ebay\./i.test(url.host))   { url.searchParams.set("mkevt","spz");   return url.toString(); }
    if (/aliexpress\./i.test(url.host)) { url.searchParams.set("aff_fcid","spz"); return url.toString(); }
    if (/[.]?(bestbuy|walmart|etsy|gumroad|shopify|myshopify|bigcartel|ko-fi)\./i.test(url.host)) {
      url.searchParams.set("aff","spz"); return url.toString();
    }
    return url.toString();
  } catch { return u; }
}

/* light marketing */
function marketTitle(t){
  if (!t) return "";
  var s = t.replace(/\s*[\|\-–—]\s*[^|–—\-]+$/g, "").trim();
  return s.replace(/\s+/g, " ");
}
