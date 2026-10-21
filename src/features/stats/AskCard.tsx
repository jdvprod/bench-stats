/** "Ask your stats": plain-language questions about the current Stats selection, answered from the numbers. */
import { useRef, useState } from "react";
import { aiAvailable, AiError, AI_ERRORS, ask } from "../../ai/client";
import { askPrompt } from "../../ai/prompts";
import { RichText } from "../../ui/kit";
import { Scope } from "./scope";

const EXAMPLES = ["Who should pass in rotation 2?", "Which rotation should we start in?", "Who's our best server under pressure?", "What changed in our losses?"];

export function AskCard({ S }: { S: Scope }) {
  const [q, setQ] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [hist, setHist] = useState<{ q: string; a: string }[]>([]);
  const ctl = useRef<AbortController | null>(null);
  const run = async (question: string) => {
    const qq = question.trim(); if (!qq) return;
    if (!aiAvailable()) { setErr(AI_ERRORS.no_key); return; }
    setBusy(true); setErr(""); ctl.current = new AbortController();
    try { const r = await ask(askPrompt(S.items, S.label, qq, hist), { tier: "default", signal: ctl.current.signal, maxTokens: 700 }); setHist((h) => h.concat({ q: qq, a: r.text })); setQ(""); }
    catch (e) { setErr(e instanceof AiError ? e.message : AI_ERRORS.upstream); }
    setBusy(false);
  };
  return <section className="card ask">
    <div className="row between"><h3 style={{ margin: 0 }}>Ask your stats</h3>{hist.length > 0 && <button className="btn sm ghost" onClick={() => setHist([])}>Clear</button>}</div>
    {hist.map((h, i) => <div key={i} className="ask-turn"><p className="ask-q">{h.q}</p><RichText text={h.a} /></div>)}
    <form className="row" onSubmit={(e) => { e.preventDefault(); run(q); }}>
      <input className="input grow" style={{ flexBasis: 240 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Ask about ${S.label.toLowerCase()}…`} aria-label="Question about your stats" disabled={busy} />
      {busy ? <button type="button" className="btn" onClick={() => ctl.current?.abort()}>Stop</button> : <button className="btn primary" disabled={!q.trim()}>Ask</button>}
    </form>
    {!hist.length && !busy && <div className="pick" style={{ marginTop: 8 }}>{EXAMPLES.map((x) => <button key={x} onClick={() => run(x)}>{x}</button>)}</div>}
    {busy && <p className="small muted">Reading your numbers…</p>}
    {err && <p className="hint warn">{err}</p>}
  </section>;
}
