// Publish a single HTML page via Netlify Deploy API as a DRAFT deploy.
// No NPM. Requires env: NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID

const API = "https://api.netlify.com/api/v1";
const { NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID } = process.env;

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return txt(405, "Method Not Allowed");

    if (!NETLIFY_AUTH_TOKEN || !NETLIFY_SITE_ID) {
      return json(500, { error: "Missing env", need: ["NETLIFY_AUTH_TOKEN", "NETLIFY_SITE_ID"] });
    }

    const body = safeJSON(event.body);
    if (!body || !body.fused || !body.fused.slug) {
      return json(400, { error: "Missing fused object or slug" });
    }

    const fused = body.fused;
    const slug  = safeSlug(fused.slug);
    const relPath = `pages/${slug}.html`; // path inside deploy
    const html = renderHTML(fused);
    const buf  = Buffer.from(html, "utf8");
    const sha1 = sha1hex(buf);

    // 1) Create draft deploy with file manifest (one file)
    const createRes = await fetch(`${API}/sites/${NETLIFY_SITE_ID}/deploys`, {
      method: "POST",
      headers: headersJson(),
      body: JSON.stringify({
        draft: true,
        title: `Jessica-SPZ ${slug}`,
        files: {
          ["/" + relPath]: { sha: sha1, size: buf.length }
        }
      })
    });
    if (!createRes.ok) {
      const t = await createRes.text().catch(()=> "");
      return json(createRes.status, { error: "Create deploy failed", info: t });
    }
    const deploy = await createRes.json();
    const deployId = deploy.id;
    const deployUrl = deploy.deploy_url; // like https://<id>--<site>.netlify.app

    // 2) Upload required files
    const required = Array.isArray(deploy.required) ? deploy.required : [];
    if (required.includes("/" + relPath)) {
      const upRes = await fetch(`${API}/deploys/${deployId}/files/${encodeURIComponent(relPath)}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${NETLIFY_AUTH_TOKEN}`,
          "Content-Type": "text/html; charset=utf-8"
        },
        body: buf
      });
      if (!upRes.ok) {
        const t = await upRes.text().catch(()=> "");
        return json(upRes.status, { error: "Upload failed", info: t });
      }
    }

    // 3) Return draft URL immediately (Netlify finalizes shortly)
    const pageUrl = `${deployUrl}/${relPath}`;
    return json(200, { ok: true, mode: "draft", slug, url: pageUrl, deploy_id: deployId });

  } catch (err) {
    return json(500, { error: "Publish via deploy failed", reason: err?.message || String(err) });
  }
};

/* helpers */
function txt(code, body){ return { statusCode: code, body }; }
function json(code, obj){ return { statusCode: code, headers: { "Content-Type":"application/json" }, body: JSON.stringify(obj) }; }
function safeJSON(s){ try { return JSON.parse(s || "{}"); } catch { return null; } }
function safeSlug(s){ return (s||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,64) || ("drop-"+Date.now().toString(36)); }
function esc(s){ return String(s||"").replace(/[&<>"]/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c])); }
function headersJson(){ return { "Authorization": `Bearer ${NETLIFY_AUTH_TOKEN}`, "Content-Type":"application/json" }; }
function sha1hex(buf){ const crypto = require("crypto"); return crypto.createHash("sha1").update(buf).digest("hex"); }

function renderHTML(data){
  const hero = data.hero || {};
  const products = Array.isArray(data.products)? data.products : [];
  const articles = Array.isArray(data.articles)? data.articles : [];
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(hero.title)||"SporeZ Drop"}</title>
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
</head><body>
<div class="wrap">
  <div class="hero">
    ${hero.image ? `<img src="${esc(hero.image)}" alt="">` : ""}
    <h1>${esc(hero.title)}</h1>
    <p>${esc(hero.subtitle)||""}</p>
    ${hero.ctaText ? `<p><a href="${esc(hero.ctaLink||"#")}" style="background:#00f0ff;color:#000;padding:8px 14px;border-radius:8px;text-decoration:none">${esc(hero.ctaText)}</a></p>` : ""}
  </div>
  ${products.length ? `<div class="products">
    ${products.map(p=>`
      <div class="prod">
        ${p.image?`<img src="${esc(p.image)}" alt="">`:``}
        <div class="name">${esc(p.name||"")}</div>
        <div class="price">${esc(p.price||"")}</div>
        ${p.description?`<div>${esc(p.description)}</div>`:""}
        ${p.link?`<div><a href="${esc(p.link)}" style="color:#70ffe0;text-decoration:none">View</a></div>`:""}
      </div>
    `).join("")}
  </div>`:""}
  ${articles.length? `<div class="articles">
    ${articles.map(a=>`
      <div class="article">
        <h3>${esc(a.heading||"")}</h3>
        <div>${esc(a.content||"")}</div>
      </div>
    `).join("")}
  </div>`:""}
</div></body></html>`;
}
