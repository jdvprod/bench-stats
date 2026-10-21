/** Gamecast: big score, set boxes, momentum, play-by-play, leaders and team comparison. */
import { useState } from "react";
import { currentMatch, get, matchesOf, playerName, replayOf, team } from "../../data/store";
import { aggregate, momentum, runOf, serverOf, Stat } from "../../sports/volleyball/engine";
import { blocks, fmtAvg, fmtHit, fmtPct, ratio, serveErrors, teamMetrics } from "../../sports/volleyball/metrics";
import { Card, fmtDate } from "../../ui/kit";
import { MomentumChart } from "../../ui/charts";
import { logText } from "../track/Tracker";
import { sideNames } from "../../app/Scoreboard";
import { ShareLive } from "../../cloud/CloudCard";

export function LivePage() {
  const t = team()!, cur = currentMatch();
  const games = matchesOf().filter((m) => m.kind === "match");
  const [pick, setPick] = useState<string>("");
  const m = (pick && get("matches", pick)) || (cur && cur.kind === "match" ? cur : games[0]);
  if (!m) return <div className="page"><Card><p className="empty">No matches yet. Start one on the Track tab and it shows up here live.</p></Card></div>;
  const R = replayOf(m)!, c = R.cur, names = sideNames(m, t.name);
  const A = aggregate(R.sets), M = teamMetrics(A), live = m.status === "live" && !R.matchOver;
  const run = runOf(c), srv = c ? serverOf(c) : null;
  const plays = R.log.filter((l) => l.kind === "stat" || l.kind === "set" || l.kind === "to" || l.kind === "sub").slice(-60).reverse();
  const leader = (f: (s: Stat) => number, label: string) => { const top = Object.entries(A.ps).map(([id, s]) => [id, f(s)] as [string, number]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1])[0]; return top ? <div className="k" key={label}><div className="label">{label}</div><b style={{ fontFamily: "var(--display)", fontSize: 26 }}>{+top[1].toFixed(1)}</b><div className="small">{playerName(top[0], "full")}</div></div> : null; };
  const them = A.team, oppAces = them.OA, oppKills = them.OK;
  const cmp: [string, string, string][] = [
    ["Kills", String(A.T.K), String(oppKills)], ["Aces", String(A.T.SA), String(oppAces)], ["Blocks", String(blocks(A.T)), "—"],
    ["Errors given", String(M.freePoints.ours), String(M.freePoints.theirs)], ["Hitting %", fmtHit(M.hitting), "—"], ["Side-out %", fmtPct(M.sideOut), fmtPct(ratio(A.psc.n - A.psc.w, A.psc.n))], ["Pass average", fmtAvg(M.passAvg), "—"], ["Serve errors", String(serveErrors(A.T)), "—"],
  ];

  return <div className="page">
    <div className="row between">
      <div className="row"><span className="tag" style={{ marginLeft: 0, background: live ? "var(--accent)" : "var(--surface-2)", color: live ? "var(--accent-ink)" : "var(--muted)" }}>{live ? "● Live" : "Final"}</span><span className="small muted">{fmtDate(m.date)}{m.event ? " · " + m.event : ""}{m.site ? " · " + m.site : ""}</span></div>
      <div className="row"><ShareLive matchId={m.id} />
      <select className="input" style={{ width: "auto", maxWidth: 260 }} value={m.id} onChange={(e) => setPick(e.target.value)} aria-label="Match">{games.slice(0, 40).map((g) => <option key={g.id} value={g.id}>{fmtDate(g.date)} vs {g.opp}</option>)}</select></div>
    </div>
    <section className="card" style={{ background: "var(--bar)", color: "var(--bar-ink)", borderColor: "transparent" }}>
      <div className="gc-score">
        <div><div className="nm" style={{ color: "var(--us-bright)" }}>{names.us}</div><div className="small" style={{ color: "var(--bar-muted)" }}>Sets {R.wonUs}</div></div>
        <div className="row" style={{ gap: 18, justifyContent: "center" }}><span className="big" style={{ color: "var(--us-bright)" }}>{c?.us ?? 0}</span><span style={{ color: "var(--bar-muted)", fontSize: 28 }}>–</span><span className="big" style={{ color: "var(--them-bright)" }}>{c?.them ?? 0}</span></div>
        <div><div className="nm" style={{ color: "var(--them-bright)" }}>{names.them}</div><div className="small" style={{ color: "var(--bar-muted)" }}>Sets {R.wonThem}</div></div>
      </div>
      <div className="row" style={{ justifyContent: "center", marginTop: 10, gap: 8 }}>
        {c && <span className="chip"><span className="k">Set</span>{c.n}</span>}
        {live && c && <span className="chip"><span className="k">Serving</span>{c.serve === "us" ? (srv ? playerName(srv) : names.us) : names.them}</span>}
        {run.n >= 3 && <span className={"chip run-" + run.side}>{run.n}-0 run {run.side === "us" ? names.us : names.them}</span>}
      </div>
    </section>
    <div className="grid2" style={{ alignItems: "start" }}>
      <div className="stack">
        <Card title="Box score"><div className="tbl"><table>
          <thead><tr><th className="l">Team</th>{R.sets.map((s) => <th key={s.n}>{s.n}</th>)}<th>Sets</th></tr></thead>
          <tbody>
            <tr><td className="l"><b style={{ color: "var(--us)" }}>{names.us}</b></td>{R.sets.map((s) => <td key={s.n} style={{ fontWeight: s.winner === "us" ? 800 : undefined }}>{s.us}</td>)}<td><b>{R.wonUs}</b></td></tr>
            <tr><td className="l"><b style={{ color: "var(--them)" }}>{names.them}</b></td>{R.sets.map((s) => <td key={s.n} style={{ fontWeight: s.winner === "them" ? 800 : undefined }}>{s.them}</td>)}<td><b>{R.wonThem}</b></td></tr>
          </tbody></table></div></Card>
        {c && c.rallies.length > 1 && <Card title={`Momentum · set ${c.n}`}><MomentumChart diffs={momentum(c)} /><p className="keys">Above the line = {names.us} leading.</p></Card>}
        <Card title="Leaders"><div className="kpis" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))" }}>
          {leader((s) => s.K, "Kills")}{leader((s) => s.SA, "Aces")}{leader((s) => s.D, "Digs")}{leader((s) => blocks(s), "Blocks")}{leader((s) => s.AST, "Assists")}
        </div></Card>
        <Card title="Team stats"><div className="tbl"><table>
          <thead><tr><th className="l" /><th style={{ color: "var(--us)" }}>{names.us}</th><th style={{ color: "var(--them)" }}>{names.them}</th></tr></thead>
          <tbody>{cmp.map(([l, a, b]) => <tr key={l}><td className="l">{l}</td><td>{a}</td><td>{b}</td></tr>)}</tbody></table></div></Card>
      </div>
      <Card title="Play by play" className="pbpcard">
        {plays.length ? <ul className="pbp">{plays.map((l) => {
          const score = l.kind === "stat" && l.w ? `${l.us}–${l.them}` : "";
          return <li key={l.id}><span className={"sc " + (l.kind === "stat" && l.w ? "pt-" + l.w : "")}>{score || (l.kind === "set" ? "Set " + l.set : "")}</span><span className={l.kind === "set" ? "small muted" : ""}>{logText(l, m, t.name)}</span></li>;
        })}</ul> : <p className="empty">Plays show up here as they're recorded.</p>}
      </Card>
    </div>
    <p className="small muted" style={{ textAlign: "center" }}>Put this screen on a TV or a second device for the bench and fans. It updates as plays are recorded.</p>
  </div>;
}
