/** Player portal: season numbers, trends, match log, goals, AI report card and a shareable report. */
import { useState } from "react";
import { matchesOf, patch, player, replayOf, team, toast, uid } from "../../data/store";
import { Goal, GoalMetric, Match } from "../../data/model";
import { aggregate, Agg, SetState, Stat } from "../../sports/volleyball/engine";
import { blocks, fmtAvg, fmtHit, fmtNum, fmtPct, fmtSigned, hitting, passAvg, playerMetrics, PlayerMetrics, serveAttempts, serveErrors } from "../../sports/volleyball/metrics";
import { Card, download, fmtDate, Kpi, Seg } from "../../ui/kit";
import { LineChart } from "../../ui/charts";
import { AiCard } from "../../ui/ai";
import { reportCardPrompt } from "../../ai/prompts";
import { go } from "../../app/router";

export const GOALS: Record<GoalMetric, { label: string; key: keyof PlayerMetrics; fmt: (v: number | null) => string; step: number; lowerBetter?: boolean }> = {
  hitting: { label: "Hitting %", key: "hitting", fmt: fmtHit, step: 0.01 },
  passAvg: { label: "Pass average", key: "passAvg", fmt: (v) => fmtAvg(v), step: 0.05 },
  perfectPass: { label: "Perfect pass %", key: "perfectPass", fmt: fmtPct, step: 0.01 },
  serveIn: { label: "Serve in %", key: "serveIn", fmt: fmtPct, step: 0.01 },
  serveEff: { label: "Serve efficiency", key: "serveEff", fmt: fmtHit, step: 0.01 },
  killsPerSet: { label: "Kills per set", key: "kps", fmt: (v) => fmtNum(v, 2), step: 0.1 },
  digsPerSet: { label: "Digs per set", key: "dps", fmt: (v) => fmtNum(v, 2), step: 0.1 },
  acesPerSet: { label: "Aces per set", key: "acesPs", fmt: (v) => fmtNum(v, 2), step: 0.05 },
  blocksPerSet: { label: "Blocks per set", key: "bps", fmt: (v) => fmtNum(v, 2), step: 0.05 },
  assistsPerSet: { label: "Assists per set", key: "aps", fmt: (v) => fmtNum(v, 2), step: 0.5 },
};
const TREND: [GoalMetric | "net", string][] = [["hitting", "Hitting %"], ["passAvg", "Passing"], ["serveIn", "Serve in %"], ["killsPerSet", "Kills/set"], ["digsPerSet", "Digs/set"], ["net", "Net pts/set"]];

interface Row { m: Match; sets: SetState[]; A: Agg; s: Stat; pm: PlayerMetrics }

function rowsFor(id: string): Row[] {
  const t = team()!;
  const out: Row[] = [];
  for (const m of matchesOf().filter((x) => x.kind === "match" && (!t.activeSeasonId || x.seasonId === t.activeSeasonId)).reverse()) {
    const R = replayOf(m); if (!R) continue; const A = aggregate(R.sets); if (!A.ps[id] && !A.pm[id]) continue;
    out.push({ m, sets: R.sets, A, s: A.ps[id], pm: playerMetrics(A, id) });
  }
  return out;
}

export function PlayerPage({ id }: { id: string }) {
  const p = player(id), t = team()!;
  const [pickMetric, setMetric] = useState<GoalMetric | "net" | null>(null);
  if (!p) return <div className="page"><Card><p className="empty">Player not found.</p><button className="btn" onClick={() => go("team")}>Back to roster</button></Card></div>;
  const rows = rowsFor(id);
  const A = aggregate(rows.flatMap((r) => r.sets)), s = A.ps[id], pm = playerMetrics(A, id);
  const has = (k: keyof Stat) => !!s && s[k] > 0;
  const valOf = (r: Row, k: GoalMetric | "net") => (k === "net" ? r.pm.netPerSet : (r.pm[GOALS[k].key] as number | null));
  // default to the first stat this player actually has a trend for (a setter has no hitting trend)
  const metric = pickMetric || (TREND.map((x) => x[0]).find((k) => k !== "net" && rows.filter((r) => valOf(r, k) != null && (k !== "hitting" || (r.s?.TA || 0) > 0)).length >= 2 && rows.some((r) => (valOf(r, k) || 0) !== 0)) ?? "net");
  const trend = rows.map((r) => ({ label: r.m.date.slice(5).replace("-", "/"), sub: r.m.opp, v: metric === "net" ? r.pm.netPerSet : (r.pm[GOALS[metric].key] as number | null) }));
  const fmt = metric === "net" ? (v: number) => fmtNum(v, 1) : (v: number) => GOALS[metric].fmt(v);

  return <div className="page">
    <div className="row"><button className="btn sm" onClick={() => history.length > 1 ? history.back() : go("stats")}>← Back</button></div>
    <section className="card"><div className="hero">
      <div className="jersey">{p.num}</div>
      <div className="grow"><h1 style={{ margin: 0 }}>{p.first} {p.last}</h1>
        <p className="muted">{[p.pos, p.height, p.grad ? "Class of " + p.grad : "", t.name].filter(Boolean).join(" · ")}</p>
        <p className="small muted">{rows.length} matches · {pm.sets} sets this season{pm.plusMinus != null ? ` · ${fmtSigned(pm.plusMinus)} on court` : ""}</p></div>
      <button className="btn" onClick={() => shareReport(id, rows, A)}>Download player report</button>
    </div></section>
    {!s ? <Card><p className="empty">No stats yet this season.</p></Card> : <>
      <div className="kpis">
        {has("TA") && <Kpi label="Hitting" value={fmtHit(hitting(s))} sub={`${s.K} K · ${s.AE} E · ${s.TA} TA · ${fmtNum(pm.kps, 2)} K/set`} />}
        {has("R") && <Kpi label="Passing" value={fmtAvg(passAvg(s))} sub={`${s.R} rec · ${fmtPct(pm.perfectPass)} perfect · ${s.P0} aced`} />}
        {serveAttempts(s) > 0 && <Kpi label="Serving" value={fmtPct(pm.serveIn)} sub={`${s.SA} aces · ${serveErrors(s)} err · eff ${fmtHit(pm.serveEff)}`} />}
        {has("D") && <Kpi label="Digs" value={s.D} sub={`${fmtNum(pm.dps, 2)} per set · ${s.DE} errors`} />}
        {(s.BS + s.BA) > 0 && <Kpi label="Blocks" value={fmtNum(blocks(s))} sub={`${s.BS} solo · ${s.BA} assist · ${fmtNum(pm.bps, 2)}/set`} />}
        {has("AST") && <Kpi label="Assists" value={s.AST} sub={`${fmtNum(pm.aps, 2)} per set · ${s.BHE} errors`} />}
        <Kpi label="Net points" value={fmtSigned(pm.netPoints)} sub={`${fmtNum(pm.netPerSet, 2)} per set`} />
      </div>
      <div className="grid2" style={{ alignItems: "start" }}>
        <Card title="Trend" actions={<Seg value={metric} onChange={setMetric} options={TREND} />}>
          {trend.filter((x) => x.v != null).length >= 2 ? <LineChart points={trend} format={fmt} /> : <p className="empty">Needs two or more matches with this stat.</p>}
        </Card>
        <Goals id={id} A={A} />
      </div>
      <Card title="Match by match"><div className="tbl"><table>
        <thead><tr><th className="l">Date</th><th className="l">Opponent</th><th>Sets</th><th>K</th><th>E</th><th>TA</th><th>Hit %</th><th>Ace</th><th>SE</th><th>Pass</th><th>Dig</th><th>Blk</th><th>Ast</th><th>+/−</th></tr></thead>
        <tbody>{rows.slice().reverse().map((r) => { const x = r.s || ({} as Stat); return <tr key={r.m.id}><td className="l">{fmtDate(r.m.date)}</td><td className="l">{r.m.opp}</td><td>{r.pm.sets}</td><td>{x.K ?? 0}</td><td>{x.AE ?? 0}</td><td>{x.TA ?? 0}</td><td>{r.s ? fmtHit(hitting(x)) : "—"}</td><td>{x.SA ?? 0}</td><td>{r.s ? serveErrors(x) : 0}</td><td>{r.s ? fmtAvg(passAvg(x)) : "—"}</td><td>{x.D ?? 0}</td><td>{r.s ? fmtNum(blocks(x)) : 0}</td><td>{x.AST ?? 0}</td><td>{fmtSigned(r.pm.plusMinus)}</td></tr>; })}</tbody>
      </table></div></Card>
      <AiCard key={id} title="Report card" desc="Strengths, growth areas and one measurable goal, written for the player from her numbers." button="Write report card" prompt={() => reportCardPrompt(id)} filename={`${p.first} ${p.last} report card`} />
    </>}
    <Card title="Coach notes"><textarea className="input" rows={3} value={p.notes} onChange={(e) => patch("players", id, { notes: e.target.value })} placeholder="Private notes: what she's working on, recruiting contacts, injuries…" /></Card>
  </div>;
}

function Goals({ id, A }: { id: string; A: Agg }) {
  const p = player(id)!, pm = playerMetrics(A, id);
  const [metric, setMetric] = useState<GoalMetric>("hitting"), [target, setTarget] = useState("");
  const add = () => { const v = parseFloat(target); if (!isFinite(v)) return toast("Enter a target number."); const pctLike = ["serveIn", "perfectPass"].includes(metric) && v > 1 ? v / 100 : v; patch("players", id, { goals: p.goals.concat({ id: uid("g"), metric, target: pctLike }) }); setTarget(""); };
  return <Card title="Goals">
    <div className="stack">
      {p.goals.length ? p.goals.map((g: Goal) => { const G = GOALS[g.metric], v = pm[G.key] as number | null, prog = v == null ? 0 : Math.max(0, Math.min(1, g.target > 0 ? v / g.target : v >= g.target ? 1 : 0)), hit = v != null && v >= g.target;
        return <div key={g.id} className="goal">
          <div className="row between"><span><b>{G.label}</b> · goal {G.fmt(g.target)}</span><span className={hit ? "hi" : ""}>{G.fmt(v)}{hit ? " ✓" : ""} <button className="btn sm" aria-label="Remove goal" onClick={() => patch("players", id, { goals: p.goals.filter((x) => x.id !== g.id) })}>✕</button></span></div>
          <div className="meter"><i style={{ width: prog * 100 + "%", background: hit ? "var(--good)" : undefined }} /></div>
        </div>; }) : <p className="small muted">Set a measurable target, like a .250 hitting % or a 2.2 pass average. Progress updates after every match.</p>}
      <div className="row">
        <select className="input" style={{ width: "auto" }} value={metric} onChange={(e) => setMetric(e.target.value as GoalMetric)} aria-label="Goal stat">{(Object.keys(GOALS) as GoalMetric[]).map((k) => <option key={k} value={k}>{GOALS[k].label}</option>)}</select>
        <input className="input" style={{ width: 100 }} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={metric === "hitting" ? ".250" : metric === "passAvg" ? "2.2" : ["serveIn", "perfectPass"].includes(metric) ? "90" : "3"} aria-label="Target" />
        <button className="btn sm primary" onClick={add}>Add goal</button>
      </div>
    </div>
  </Card>;
}

/** A self-contained HTML page the player or parents can open on any phone. */
function shareReport(id: string, rows: Row[], A: Agg) {
  const p = player(id)!, t = team()!, s = A.ps[id], pm = playerMetrics(A, id);
  const esc = (x: any) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const kpi = (l: string, v: string, sub: string) => `<div class="k"><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div><div class="s">${esc(sub)}</div></div>`;
  const ks = s ? [kpi("Hitting", fmtHit(hitting(s)), `${s.K} kills · ${s.TA} attempts`), kpi("Kills / set", fmtNum(pm.kps, 2), `${pm.sets} sets`), kpi("Passing", fmtAvg(passAvg(s)), `${s.R} receptions`), kpi("Serve in", fmtPct(pm.serveIn), `${s.SA} aces`), kpi("Digs", String(s.D), `${fmtNum(pm.dps, 2)} per set`), kpi("Blocks", fmtNum(blocks(s)), `${s.BS} solo`), kpi("Assists", String(s.AST), `${fmtNum(pm.aps, 2)} per set`)].join("") : "<p>No stats yet.</p>";
  const goals = p.goals.map((g) => { const G = GOALS[g.metric], v = pm[G.key] as number | null; return `<li>${esc(G.label)}: ${esc(G.fmt(v))} of ${esc(G.fmt(g.target))} goal${v != null && v >= g.target ? " ✓" : ""}</li>`; }).join("");
  const log = rows.slice().reverse().map((r) => { const x = r.s; return `<tr><td>${esc(r.m.date)}</td><td>${esc(r.m.opp)}</td><td>${x ? x.K : 0}</td><td>${x ? fmtHit(hitting(x)) : "—"}</td><td>${x ? x.SA : 0}</td><td>${x ? fmtAvg(passAvg(x)) : "—"}</td><td>${x ? x.D : 0}</td><td>${x ? fmtNum(blocks(x)) : 0}</td><td>${x ? x.AST : 0}</td></tr>`; }).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.first + " " + p.last)} · ${esc(t.name)}</title>
<style>:root{--c:#2B79B0;--ink:#141a21;--mut:#5d6873;--bg:#f4f6f8;--card:#fff;--line:#e2e6ea}@media(prefers-color-scheme:dark){:root{--ink:#e9edf1;--mut:#9aa6b2;--bg:#0f141a;--card:#18202a;--line:#2a3440}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:760px;margin:0 auto;padding:20px 16px}
.hero{display:flex;gap:16px;align-items:center;background:#141a21;color:#fff;border-radius:14px;padding:18px;border-bottom:5px solid var(--c)}.n{font-size:54px;font-weight:800;color:var(--c);min-width:80px;text-align:center}
h1{margin:0;font-size:26px}.sub{color:#aeb8c2}.ks{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin:16px 0}.k{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.l{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--mut);font-weight:700}.v{font-size:28px;font-weight:800}.s{font-size:12px;color:var(--mut)}section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:12px 0;overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:13.5px}th,td{padding:6px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}th:nth-child(-n+2),td:nth-child(-n+2){text-align:left}th{font-size:11px;color:var(--mut);text-transform:uppercase}footer{color:var(--mut);font-size:12px;text-align:center;margin-top:18px}</style></head>
<body><main><div class="hero"><div class="n">${esc(p.num)}</div><div><h1>${esc(p.first + " " + p.last)}</h1><div class="sub">${esc([p.pos, p.height, p.grad ? "Class of " + p.grad : ""].filter(Boolean).join(" · "))}</div><div class="sub">${esc(t.name)}${t.level ? " · " + esc(t.level) : ""}</div></div></div>
<div class="ks">${ks}</div>${goals ? `<section><h3 style="margin:0 0 6px">Goals</h3><ul>${goals}</ul></section>` : ""}
<section><h3 style="margin:0 0 6px">Match by match</h3><table><thead><tr><th>Date</th><th>Opponent</th><th>K</th><th>Hit %</th><th>Ace</th><th>Pass</th><th>Dig</th><th>Blk</th><th>Ast</th></tr></thead><tbody>${log}</tbody></table></section>
<footer>Made with Benchboard · ${new Date().toLocaleDateString()}</footer></main></body></html>`;
  download(`${p.first} ${p.last} - ${t.name}.html`, html, "text/html");
  toast("Report saved. Text or email the file to share it.");
}
