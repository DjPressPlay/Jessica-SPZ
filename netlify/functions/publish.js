import fs from "fs";
import path from "path";

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { fused = {}, session = "" } = JSON.parse(event.body || "{}");
    if (!fused || !fused.slug) {
      return json(400, { error: "Missing fused object or slug" });
    }

    const slug = safeSlug(fused.slug);
    const outDir = path.join(process.cwd(), "public", "pages");
    const outFile = path.join(outDir, slug + ".html");

    // Ensure directory exists
    fs.mkdirSync(outDir, { recursive: true });

    // Create HTML page
    const html = renderHTML(fused);

    // Save file
    fs.writeFileSync(outFile, html, "utf8");

    const url = `/pages/${slug}.html`;
    return json(200, { ok: true, slug, url });
  } catch (err) {
    return json(500, { error: err.message });
  }
}

/* ---------------- helpers ---------------- */

function json(status, obj) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj)
  };
}

function safeSlug(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || ("drop-" + Date.now().toString(36));
}

function renderHTML(data) {
  const hero = data.hero || {};
  const products = Array.isArray(data.products) ? data.products : [];
  const articles = Array.isArray(data.articles) ? data.articles : [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(hero.title) || "SporeZ Drop"}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0;padding:0;background:#0b1219;color:#fff;font-family:sans-serif}
.wrap{max-width:900px;margin:auto;padding:20px}
.hero{text-align:center}
.hero img{max-width:100%;border-radius:14px}
.products{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-top:20px}
.prod{background:#0f1620;padding:10px;border-radius:10px;text-align:center}
.prod img{width:100%;height:120px;object-fit:cover;border-radius:8px}
.prod .name{font-weight:bold;margin:5px 0}
.prod .price{color:#66ff99;font-weight:bold}
.articles{margin-top:20px}
.article{background:#0f1620;padding:10px;border-radius:10px;margin-bottom:10px}
.article h3{margin:0 0 5px}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    ${hero.image ? `<img src="${esc(hero.image)}" alt="">` : ""}
    <h1>${esc(hero.title)}</h1>
    <p>${esc(hero.subtitle)}</p>
    ${hero.ctaText ? `<p><a href="${esc(hero.ctaLink)}" style="background:#00f0ff;color:#000;padding:8px 14px;border-radius:8px;text-decoration:none">${esc(hero.ctaText)}</a></p>` : ""}
  </div>

  ${products.length ? `<div class="products">
    ${products.map(p => `
      <div class="prod">
        ${p.image ? `<img src="${esc(p.image)}" alt="">` : ""}
        <div class="name">${esc(p.name)}</div>
        <div class="price">${esc(p.price)}</div>
        ${p.description ? `<div>${esc(p.description)}</div>` : ""}
        <div><a href="${esc(p.link)}" style="color:#70ffe0;text-decoration:none">View</a></div>
      </div>
    `).join("")}
  </div>` : ""}

  ${articles.length ? `<div class="articles">
    ${articles.map(a => `
      <div class="article">
        <h3>${esc(a.heading)}</h3>
        <div>${esc(a.content)}</div>
      </div>
    `).join("")}
  </div>` : ""}
</div>
</body>
</html>`;
}

function esc(s) {
  return String(s || "").replace(/[&<>"]/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]
  ));
}
