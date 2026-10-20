/**
 * AI calls. Today the coach adds an Anthropic API key in Settings and calls go straight from the
 * browser. When accounts are added, swap `endpoint` for a small server function that holds the key,
 * so users never need one.
 */
const KEY = "bs-ai-key";
const MODELS = { quick: "claude-haiku-5-5", default: "claude-sonnet-5-5", complex: "claude-opus-5-5" } as const;
export type Tier = keyof typeof MODELS;

export function getKey(): string { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } }
export function setKey(k: string) { try { if (k) localStorage.setItem(KEY, k); else localStorage.removeItem(KEY); } catch { /* ignore */ } }
export const aiAvailable = () => !!getKey();

export class AiError extends Error { constructor(public code: string, message: string) { super(message); } }
export const AI_ERRORS: Record<string, string> = {
  no_key: "Add an Anthropic API key in Settings to use AI features.",
  bad_key: "The API key didn't work. Check it in Settings.",
  rate_limited: "Too many requests right now. Wait a moment and try again.",
  offline: "Couldn't reach Claude. Check your internet connection.",
  cancelled: "Stopped.",
  invalid_json: "The answer came back in the wrong shape. Try again.",
  upstream: "Claude couldn't finish that. Try again.",
};

export async function ask(prompt: string, opts: { tier?: Tier; signal?: AbortSignal; maxTokens?: number } = {}): Promise<{ text: string; truncated: boolean }> {
  const key = getKey(); if (!key) throw new AiError("no_key", AI_ERRORS.no_key);
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: opts.signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: MODELS[opts.tier || "default"], max_tokens: opts.maxTokens || 1800, messages: [{ role: "user", content: prompt }] }),
    });
  } catch (e: any) {
    if (opts.signal?.aborted) throw new AiError("cancelled", AI_ERRORS.cancelled);
    throw new AiError("offline", AI_ERRORS.offline);
  }
  let body: any = null; try { body = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    const code = res.status === 401 || res.status === 403 ? "bad_key" : res.status === 429 ? "rate_limited" : "upstream";
    throw new AiError(code, (body && body.error && body.error.message) || AI_ERRORS[code]);
  }
  const text = (body.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  if (!text.trim()) throw new AiError("upstream", AI_ERRORS.upstream);
  return { text, truncated: body.stop_reason === "max_tokens" };
}

export async function askJson<T = unknown>(prompt: string, opts: { tier?: Tier; signal?: AbortSignal } = {}): Promise<T> {
  const { text } = await ask(prompt + "\n\nReply with only the JSON value, no other text.", { ...opts, maxTokens: 1500 });
  const tryParse = (s: string) => { try { return { ok: true, v: JSON.parse(s) }; } catch { return { ok: false, v: null }; } };
  let r = tryParse(text.trim());
  if (!r.ok) { const m = text.match(/```(?:json)?\s*([\s\S]*?)```/); if (m) r = tryParse(m[1]); }
  if (!r.ok) { const a = text.search(/[[{]/), b = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]")); if (a >= 0 && b > a) r = tryParse(text.slice(a, b + 1)); }
  if (!r.ok) throw new AiError("invalid_json", AI_ERRORS.invalid_json);
  return r.v as T;
}
