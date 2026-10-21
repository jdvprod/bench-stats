// Supabase Edge Function: AI for signed-in coaches, so nobody needs their own Anthropic key.
// Deploy: supabase functions deploy ai   (or paste into Dashboard → Edge Functions → New function "ai")
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Optional: AI_DAILY_LIMIT (default 40 requests per coach per day).
// Supabase verifies the caller's JWT before this runs, and provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

const MODELS = new Set(["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"]);
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { error: "POST only" });
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json(503, { error: "AI isn't set up on the server yet." });

  // who is calling (the JWT was already verified by Supabase; we read the user id from it)
  const auth = req.headers.get("authorization") || "";
  let uid = "";
  try { uid = JSON.parse(atob(auth.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub || ""; } catch { /* no user */ }
  if (!uid) return json(403, { error: "Sign in to use AI features." });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "Bad request." }); }
  const model = MODELS.has(body?.model) ? body.model : "claude-sonnet-5-5";
  const prompt = String(body?.prompt || "").slice(0, 60000);
  if (!prompt) return json(400, { error: "Nothing to ask." });
  const maxTokens = Math.min(2000, Math.max(100, +body?.max_tokens || 1800));

  // daily limit per coach
  const url = Deno.env.get("SUPABASE_URL")!, service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const limit = +(Deno.env.get("AI_DAILY_LIMIT") || 40);
  const h = { apikey: service, authorization: "Bearer " + service, "content-type": "application/json" };
  const used = await fetch(`${url}/rest/v1/rpc/ai_bump`, { method: "POST", headers: h, body: JSON.stringify({ uid }) }).then((r) => r.ok ? r.json() : 0).catch(() => 0);
  if (+used > limit) return json(429, { error: `You've used today's ${limit} AI requests. They reset tomorrow.` });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  }).catch(() => null);
  if (!res) return json(502, { error: "Couldn't reach Claude." });
  const out = await res.json().catch(() => null);
  if (!res.ok) return json(res.status === 429 ? 429 : 502, { error: out?.error?.message || "Claude couldn't finish that." });
  return json(200, { content: out.content, stop_reason: out.stop_reason });
});
