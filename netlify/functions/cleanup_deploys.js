// Deletes old DRAFT deploys to keep storage clean.
// No NPM. Schedule via netlify.toml (below).
// Env: NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID, CLEANUP_MAX_DAYS(optional, default 7)

const API = "https://api.netlify.com/api/v1";
const { NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID } = process.env;
const MAX_DAYS = parseInt(process.env.CLEANUP_MAX_DAYS || "7", 10);

exports.handler = async () => {
  if (!NETLIFY_AUTH_TOKEN || !NETLIFY_SITE_ID) {
    return json(500, { error: "Missing env", need: ["NETLIFY_AUTH_TOKEN","NETLIFY_SITE_ID"] });
  }

  // list draft deploys
  const listRes = await fetch(`${API}/sites/${NETLIFY_SITE_ID}/deploys?state=draft&per_page=100`, {
    headers: { "Authorization": `Bearer ${NETLIFY_AUTH_TOKEN}` }
  });
  if (!listRes.ok) return json(listRes.status, { error: "List drafts failed", info: await listRes.text() });
  const drafts = await listRes.json();

  const cutoff = Date.now() - MAX_DAYS*24*60*60*1000;
  let deleted = 0;
  for (const d of drafts) {
    const created = Date.parse(d.created_at || d.createdAt || 0) || 0;
    if (created && created < cutoff) {
      const del = await fetch(`${API}/deploys/${d.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${NETLIFY_AUTH_TOKEN}` }
      });
      if (del.ok) deleted++;
    }
  }
  return json(200, { ok: true, deleted, kept: drafts.length - deleted, window_days: MAX_DAYS });
};

function json(code, obj){ return { statusCode: code, headers: { "Content-Type":"application/json" }, body: JSON.stringify(obj) }; }
