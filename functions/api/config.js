// v3.46 : réglages de l'admin compagnies gardés sur Cloudflare KV, avec l'historique des publications.
// Liaisons du projet Pages : KV « CFG_KV » (namespace timing-config) et secret « ADMIN_CODE ».
//   GET                         → dernière version publiée { at, cfg } (lecture libre, c'est ce que lit l'app)
//   GET  ?history=1  + X-Admin-Code → { hist:[{ id, at, dev, sum }] }, la plus récente d'abord = celle en ligne
//   POST { cfg, dev, sum } + X-Admin-Code → publie une nouvelle version
//   POST { rollback:id }   + X-Admin-Code → remet en ligne une version de l'historique
const KEEP = 30;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-Admin-Code",
};
const json = (o, status = 200) => new Response(JSON.stringify(o), {
  status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

function codeOk(request, env) {
  const a = String(request.headers.get("X-Admin-Code") || ""), b = String(env.ADMIN_CODE || "");
  if (!b || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
  const kv = env.CFG_KV;
  if (!kv) return json({ error: "nokv" }, 503);
  const url = new URL(request.url);

  if (request.method === "GET" && !url.searchParams.has("history")) {
    const t = await kv.get("latest");
    return t ? new Response(t, { headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } })
             : json({ at: 0, cfg: null });
  }

  if (!env.ADMIN_CODE) return json({ error: "nocode" }, 503);
  if (!codeOk(request, env)) { await new Promise(r => setTimeout(r, 800)); return json({ error: "badcode" }, 401); }
  const hist = (await kv.get("hist", "json")) || [];

  if (request.method === "GET") return json({ hist });
  if (request.method !== "POST") return json({ error: "method" }, 405);

  let body; try { body = await request.json(); } catch (e) { return json({ error: "body" }, 400); }
  const at = Date.now(), id = String(at);
  let cfg, sum, dev = String(body.dev || "").slice(0, 40);
  if (body.rollback) {
    const old = hist.find(h => h.id === String(body.rollback));
    const t = old && await kv.get("v:" + old.id);
    if (!t) return json({ error: "notfound" }, 404);
    cfg = JSON.parse(t);
    sum = "Retour à la version du " + (body.label || old.id);
  } else {
    cfg = body.cfg;
    if (!cfg || cfg.v !== 1) return json({ error: "cfg" }, 400);
    sum = String(body.sum || "").slice(0, 200);
  }
  cfg.at = at;                                // la plus récente gagne sur les copies locales de l'app
  const text = JSON.stringify(cfg);
  if (text.length > 500000) return json({ error: "size" }, 413);
  hist.unshift({ id, at, dev, sum });
  const drop = hist.splice(KEEP);
  await kv.put("v:" + id, text);
  await kv.put("latest", JSON.stringify({ at, cfg }));
  await kv.put("hist", JSON.stringify(hist));
  await Promise.all(drop.map(h => kv.delete("v:" + h.id)));
  return json({ at, cfg, hist });
}
