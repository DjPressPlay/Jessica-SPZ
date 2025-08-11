// Jessica-SPZ Frontend Logic — Pure JS
// Jessica-SPZ Frontend Logic — Pure JS

const sid = document.getElementById("sid");
const logEl = document.getElementById("log");
const jsonEl = document.getElementById("json");
const heroImg = document.getElementById("heroImg");
const heroTitle = document.getElementById("heroTitle");
const heroSub = document.getElementById("heroSub");
const heroCta = document.getElementById("heroCta");
const productsEl = document.getElementById("products");
const infoEl = document.getElementById("info");
const footerEl = document.getElementById("footer");

let fusedData = {};
let sessionId = "sess-" + Date.now().toString(36);
if (sid) sid.textContent = sessionId;

function log(msg) {
  if (!logEl) return;
  logEl.textContent += "\n" + msg;
  logEl.scrollTop = logEl.scrollHeight;
}

function setJSON(data) {
  if (!jsonEl) return;
  jsonEl.textContent = JSON.stringify(data, null, 2);
}

async function runCrawlAndFuse() {
  log("Starting Crawl…");
  const links = (document.getElementById("links")?.value || "")
    .split("\n").map(l => l.trim()).filter(Boolean);

  if (!links.length) {
    alert("Please paste at least one link.");
    return;
  }

  const mode = document.querySelector("input[name=mode]:checked")?.value || "auto";
  const defaults = {
    sell: document.getElementById("defSell")?.checked ?? true,
    info: document.getElementById("defInfo")?.checked ?? false
  };

  try {
    // Crawl
    const crawlRes = await fetch("/api/crawl", {
      method: "POST",
      body: JSON.stringify({ links, session: sessionId }),
      headers: { "Content-Type": "application/json" }
    });
    if (!crawlRes.ok) {
      const t = await crawlRes.text().catch(()=> "");
      log(`⛔ Crawl failed: ${crawlRes.status} ${t}`);
      return;
    }
    const crawlData = await crawlRes.json();
    log("Crawl complete. Results: " + (crawlData.results?.length || 0));

    // Fuse
    log("Fusing content…");
    const fuseRes = await fetch("/api/fuse", {
      method: "POST",
      body: JSON.stringify({
        results: crawlData.results || [],
        mode,
        defaults,
        session: sessionId
      }),
      headers: { "Content-Type": "application/json" }
    });
    if (!fuseRes.ok) {
      const t = await fuseRes.text().catch(()=> "");
      log(`⛔ Fuse failed: ${fuseRes.status} ${t}`);
      return;
    }
    fusedData = await fuseRes.json();
    setJSON(fusedData);
    log("Fusion complete. Mode: " + (fusedData.mode || "n/a"));

    // Render preview panel
    renderPreview(fusedData);
  } catch (err) {
    log("⛔ Error: " + err.message);
  }
}

function renderPreview(data) {
  const hero = data?.hero || {};
  if (heroImg) {
    heroImg.src = hero.image || "";
    heroImg.style.display = hero.image ? "block" : "none";
  }
  if (heroTitle) heroTitle.textContent = hero.title || "No Title";
  if (heroSub) heroSub.textContent = hero.subtitle || "";
  if (heroCta) {
    heroCta.innerHTML = hero.ctaText
      ? `<a href="${hero.ctaLink || "#"}" target="_blank" style="background:#00f0ff;color:#000;padding:6px 12px;border-radius:6px;text-decoration:none">${hero.ctaText}</a>`
      : "";
  }

  // Products
  if (productsEl) {
    productsEl.innerHTML = "";
    (data.products || []).forEach(p => {
      const el = document.createElement("div");
      el.className = "prod";
      el.innerHTML = `
        ${p.image ? `<img src="${p.image}" alt="">` : ""}
        <div class="name">${p.name || ""}</div>
        <div class="price">${p.price || ""}</div>
        ${p.description ? `<div style="color:#9db3c9;font-size:12px">${p.description}</div>` : ""}
        ${p.link ? `<a href="${p.link}" target="_blank">View</a>` : ""}
      `;
      productsEl.appendChild(el);
    });
  }

  // Info
  if (infoEl) {
    infoEl.innerHTML = "";
    (data.articles || []).forEach(a => {
      const div = document.createElement("div");
      div.className = "article";
      div.innerHTML = `<h3>${a.heading || ""}</h3><div>${a.content || ""}</div>`;
      infoEl.appendChild(div);
    });
  }

  if (footerEl) footerEl.textContent = `SporeZ • Jessica-SPZ • ${data.slug || ""}`;
}

// Open a real preview page (no deploy needed)
function openLivePreview(data) {
  if (!data || !data.hero) {
    alert("Run Crawl + Fuse first.");
    return;
  }
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  const b64 = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(""));
  const url = `/preview.html#j=${b64}`;
  window.open(url, "_blank");
}

async function publishPage() {
  if (!fusedData || !fusedData.hero) {
    alert("Run Crawl + Fuse first.");
    return;
  }
  const slugInput = document.getElementById("slug")?.value.trim();
  if (slugInput) fusedData.slug = slugInput;

  try {
    // Use Deploy API version (no GitHub)
    const res = await fetch("/api/publish_via_deploy", {
      method: "POST",
      body: JSON.stringify({ fused: fusedData, session: sessionId }),
      headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) {
      const t = await res.text().catch(()=> "");
      log(`⛔ Publish error: ${res.status} ${t}`);
      return;
    }
    const out = await res.json();
    log("Published at: " + (out.url || "(no url)"));
    if (out.url) window.open(out.url, "_blank");
  } catch (err) {
    log("⛔ Publish error: " + err.message);
  }
}

// Button bindings
document.getElementById("btn-run")?.addEventListener("click", runCrawlAndFuse);
document.getElementById("btn-preview")?.addEventListener("click", () => openLivePreview(fusedData));
document.getElementById("btn-publish")?.addEventListener("click", publishPage);
