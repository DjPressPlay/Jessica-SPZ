//publish.js//

const GITHUB_API = "https://api.github.com";

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return txt(405, "Method Not Allowed");
    }

    const body = safeJSON(event.body);
    if (!body) return json(400, { error: "Invalid JSON body" });

    const fused = body.fused || {};
    if (!fused || !fused.slug) return json(400, { error: "Missing fused object or slug" });

    const token  = process.env.GITHUB_TOKEN;
    const repo   = process.env.GITHUB_REPO;     // e.g. "Artworqq/jessica-spz"
    const branch = process.env.GITHUB_BRANCH || "main";
    if (!token || !repo) {
      return json(500, { error: "Missing env vars", need: ["GITHUB_TOKEN","GITHUB_REPO","(optional) GITHUB_BRANCH"] });
    }

    const slug = safeSlug(fused.slug);
    const relPath = `public/pages/${slug}.html`;        // keep slashes as slashes
    const cleanPath = relPath.replace(/^\/+/, "");      // no leading slash

    const html = renderHTML(fused);
    const base64 = Buffer.from(html, "utf8").toString("base64");

    // Get existing (to retrieve sha if file exists)
    const existing = await ghGetContents(repo, cleanPath, branch, token);
    const sha = existing && existing.sha ? existing.sha : undefined;

    // Create or update the file
    const commit = await ghPutContents(repo, cleanPath, branch, base64, sha, token, `Publish page ${slug}`);

    // Netlify redeploys on Git push. Return the path we just wrote.
    return json(200, {
      ok: true,
      slug,
      url: `/pages/${slug}.html`,
      committed_path: cleanPath,
      commit_url: commit?.commit?.html_url || commit?.content?.html_url || null
    });

  } catch (err) {
    // Bubble up a useful message to your UI
    return json(500, { error: "Publish failed", reason: err && err.message ? err.message : String(err) });
  }
};

/* ---------- helpers ---------- */

function txt(status, text){ return { statusCode: status, body: text }; }
function json(status, obj){ return { statusCode: status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) }; }
function safeJSON(s){ try { return JSON.parse(s || "{}"); } catch { return null; } }

function safeSlug(s){
  const x = (s||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,64);
  return x || ("drop-" + Date.now().toString(36));
}

function esc(s){ return String(s||"").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;", '"':"&quot;" }[c])); }

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

/* ---------- GitHub API (NO path encoding of slashes) ---------- */

async function ghGetContents(repo, path, branch, token){
  const url = `${GITHUB_API}/repos/${repo}/contents/${stripLeadSlash(path)}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: ghHeaders(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${res.status} ${await safeText(res)}`);
  return res.json();
}

async function ghPutContents(repo, path, branch, base64Content, sha, token, message){
  const url = `${GITHUB_API}/repos/${repo}/contents/${stripLeadSlash(path)}`;
  const body = { message, content: base64Content, branch };
  if (sha) body.sha = sha;
  const res = await fetch(url, { method:"PUT", headers: ghHeaders(token), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`GitHub PUT ${res.status} ${await safeText(res)}`);
  return res.json();
}

function ghHeaders(token){
  return {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "User-Agent": "Jessica-SPZ"
  };
}
function stripLeadSlash(s){ return String(s||"").replace(/^\/+/, ""); }
async function safeText(res){ try { return await res.text(); } catch { return ""; } }
