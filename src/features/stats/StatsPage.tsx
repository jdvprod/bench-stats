import { useState } from "react";
import { patch, player, playerName, replayOf, seasonsOf, team, teamPlayers, toast } from "../../data/store";
import { aggregate, Agg, Stat } from "../../sports/volleyball/engine";
import { AttackContext, CONTEXT_LABEL } from "../../sports/volleyball/actions";
import { blocks, fmtAvg, fmtHit, fmtNum, fmtPct, fmtRatio, fmtSigned, hitting, passAvg, perfectPassPct, playerMetrics, ratio, serveAttempts, serveEfficiency, serveErrors, serveInPct, teamMetrics, netPoints } from "../../sports/volleyball/metrics";
import { flags } from "../../sports/volleyball/flags";
import { Card, copyText, download, fmtDate, Kpi, Seg } from "../../ui/kit";
import { Diverge, LineChart, StackBar } from "../../ui/charts";
import { AiCard } from "../../ui/ai";
import { reportPrompt, snapshot, statLine } from "../../ai/prompts";
import { setUi, ui } from "../../app/ui";
import { go } from "../../app/router";
import { activeSeason, defaultScope, resolveScope, Scope, seasonMatches } from "./scope";
import { buildXlsx } from "../../lib/xlsx";
import { logText } from "../track/Tracker";
import { matchReportHtml } from "./matchReport";
import { seasonAwards, seasonReportHtml } from "./seasonReport";

type View = "overview" | "players" | "offense" | "servepass" | "rotations" | "opponent";

export function StatsPage() {
  const t = team()!;
  if (!ui.statsSeason) ui.statsSeason = activeSeason();
  if (!ui.statsScope || ui.statsScope === "match") ui.statsScope = defaultScope();
  const [view, setView] = useState<View>("overview");
  const S = resolveScope(ui.statsScope, ui.statsSeason);
  const A = aggregate(S.sets);
  const games = seasonMatches(ui.statsSeason, "games"), practices = seasonMatches(ui.statsSeason, "practice");
  const single = S.single;
  const isScrim = !!single?.m.scrim;

  return <div className="page">
    <div className="pagehead"><h1>Stats</h1>
      <div className="row">
        <button className="btn sm" onClick={() => exportSheet(S, A)}>Download spreadsheet</button>
        {!single && S.kind === "games" && S.items.length > 0 && <button className="btn sm" onClick={() => { const se = seasonsOf().find((x) => x.id === ui.statsSeason); download(`${t.name} ${se?.name || "season"} report.html`.replace(/[^\w\- .]+/g, ""), seasonReportHtml(S.items, se), "text/html"); toast("Season report saved. Open it to print or share."); }}>Season report</button>}
        {single && !isScrim && <button className="btn sm" onClick={() => { download(`${t.name} vs ${single.m.opp} ${single.m.date} report.html`.replace(/[^\w\- .]+/g, ""), matchReportHtml(single.m, single.R), "text/html"); toast("Match report saved. Open it to print or share."); }}>Match report</button>}
        {single && <button className="btn sm" onClick={() => copyText(snapshot(single.m)).then((ok) => toast(ok ? "Summary copied" : "Couldn't copy here"))}>Copy summary</button>}
      </div>
    </div>
    <div className="card" style={{ padding: 12 }}>
      <div className="row">
        <select className="input" style={{ width: "auto" }} value={ui.statsSeason} onChange={(e) => setUi({ statsSeason: e.target.value, statsScope: "season" })} aria-label="Season">
          <option value="all">All seasons</option>{seasonsOf().map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Seg value={S.single ? "match" : S.key} onChange={(v) => setUi({ statsScope: v === "match" ? (games[games.length - 1] ? "m:" + games[games.length - 1].id : "season") : v })} options={[["season", `Season (${games.length})`], ["practice", `Practice (${practices.length})`], ["match", "One match"]]} label="Scope" />
        {S.single && <select className="input" style={{ width: "auto", maxWidth: 260 }} value={single!.m.id} onChange={(e) => setUi({ statsScope: "m:" + e.target.value })} aria-label="Match">
          {[...games, ...practices].reverse().map((m) => <option key={m.id} value={m.id}>{fmtDate(m.date)} · {m.kind === "match" ? "vs " + m.opp : m.opp}</option>)}
        </select>}
        {S.single && single!.R.sets.length > 1 && <Seg value={single!.setN || 0} onChange={(n) => setUi({ statsScope: "m:" + single!.m.id + (n ? ":" + n : "") })} options={[[0, "All sets"], ...single!.R.sets.map((s) => [s.n, (isScrim ? "G" : "S") + s.n] as [number, string])]} label="Set" />}
      </div>
    </div>
    {!S.sets.length ? <Card><p className="empty">No stats recorded yet for this selection.</p></Card> : isScrim ? <ScrimStats S={S} A={A} /> : <>
      <Seg value={view} onChange={setView} options={[["overview", "Overview"], ["players", "Players"], ["offense", "Offense"], ["servepass", "Serve & pass"], ["rotations", "Rotations"], ["opponent", "Opponent"]]} label="Section" />
      {view === "overview" && <Overview S={S} A={A} />}
      {view === "players" && <Players A={A} />}
      {view === "offense" && <Offense A={A} />}
      {view === "servepass" && <ServePass A={A} />}
      {view === "rotations" && <Rotations A={A} S={S} />}
      {view === "opponent" && <Opponent A={A} />}
    </>}
  </div>;
}

/* ---------- overview ---------- */
function Overview({ S, A }: { S: Scope; A: Agg }) {
  const t = team()!, M = teamMetrics(A), T = A.T, single = S.single;
  const su = A.src.us, st = A.src.them, g = (k: string) => su[k] || 0, h = (k: string) => st[k] || 0;
  // season baseline for comparison when looking at one match or set
  const B = single && single.m.kind === "match" ? (() => { const ms = seasonMatches(ui.statsSeason, "games").filter((x) => x.id !== single.m.id); const sets = ms.flatMap((x) => replayOf(x)?.sets || []); return sets.length ? teamMetrics(aggregate(sets)) : null; })() : null;
  const fl = single && !single.setN ? flags(single.R, { us: t.name, them: single.m.opp, subLimit: t.settings.subLimit, playerIds: teamPlayers().map((p) => p.id), short: (id) => playerName(id) }) : [];
  return <div className="stack">
    {single && <AiCard key={single.m.id} title={single.m.kind === "match" ? "Match report" : "Practice report"} desc="What decided it, standouts, concerns and practice priorities, written from the stats. Saved with the match." button="Write the report" prompt={() => reportPrompt(single.m)} saved={single.m.report} savedAt={single.m.reportAt} onSave={(text) => patch("matches", single.m.id, { report: text, reportAt: Date.now() })} filename={`${t.name} vs ${single.m.opp} report`} />}
    <div className="kpis">
      <Kpi label="Hitting %" value={fmtHit(M.hitting)} delta={dv(M.hitting, B?.hitting, fmtHit, true)} sub={`${T.K} kills · ${T.AE} errors · ${T.TA} att`} />
      <Kpi label="Side-out" value={fmtPct(M.sideOut)} delta={dv(M.sideOut, B?.sideOut, fmtPct, true)} sub={`${A.so.w} of ${A.so.n} on their serve`} />
      <Kpi label="First-ball side-out" value={fmtPct(M.firstBallSO)} delta={dv(M.firstBallSO, B?.firstBallSO, fmtPct, true)} sub="kill on the first attack after receive" />
      <Kpi label="Point-scoring" value={fmtPct(M.pointScoring)} delta={dv(M.pointScoring, B?.pointScoring, fmtPct, true)} sub={`${A.psc.w} of ${A.psc.n} on our serve`} />
      <Kpi label="Pass average" value={fmtAvg(M.passAvg)} delta={dv(M.passAvg, B?.passAvg, (v) => fmtAvg(v), true)} sub={`${fmtPct(M.perfectPass)} perfect · ${T.P0} aced`} />
      <Kpi label="Serving" value={fmtPct(M.serveIn)} delta={dv(M.serveIn, B?.serveIn, fmtPct, true)} sub={`in · ${T.SA} aces · ${serveErrors(T)} errors · eff ${fmtHit(M.serveEff)}`} />
      <Kpi label="In-system %" value={fmtPct(M.inSystemPct)} delta={dv(M.inSystemPct, B?.inSystemPct, fmtPct, true)} sub="attacks off a 2 or 3 pass" />
      <Kpi label="Dig success" value={fmtPct(M.digSuccess)} delta={dv(M.digSuccess, B?.digSuccess, fmtPct, true)} sub={`${T.D} digs · ${T.DE} dig errors`} />
      <Kpi label="Free points" value={<><span style={{ color: "var(--us)" }}>{M.freePoints.theirs}</span>–<span style={{ color: "var(--them)" }}>{M.freePoints.ours}</span></>} sub="their errors vs ours" />
      {M.perSet && <Kpi label="Per set" value={fmtNum(M.perSet.K)} delta={dv(M.perSet.K, B?.perSet?.K, (v) => fmtNum(v), true)} sub={`kills · ${fmtNum(M.perSet.SA)} aces · ${fmtNum(M.perSet.BLK)} blocks · ${fmtNum(M.perSet.D)} digs`} />}
    </div>
    {B && <p className="keys" style={{ marginTop: -4 }}>▲ / ▼ compare this {single?.setN ? "set" : "match"} with your season average.</p>}
    {!single && S.items.length >= 2 && <Trends S={S} />}
    {!single && S.items.length >= 1 && <div className="grid2" style={{ alignItems: "start" }}><Leaders A={A} /><div className="stack"><Awards S={S} /><Highs S={S} /></div></div>}
    <div className="grid2">
      <Card title="Where points came from"><div className="stack">
        <div><div className="row between small"><b style={{ color: "var(--us)" }}>{t.name}</b><b className="num">{A.us}</b></div>
          <StackBar segs={[{ label: "Kills", n: g("K"), color: "var(--us)" }, { label: "Aces", n: g("SA"), color: "var(--us)", opacity: 0.7 }, { label: "Blocks", n: g("BLK"), color: "var(--us)", opacity: 0.5 }, { label: "Their errors", n: g("OE"), color: "var(--muted)", opacity: 0.45 }, { label: "Other", n: g("UP"), color: "var(--muted)", opacity: 0.25 }]} /></div>
        <div><div className="row between small"><b>{single ? single.m.opp : "Opponents"}</b><b className="num">{A.them}</b></div>
          <StackBar segs={[{ label: "Their kills", n: h("OK"), color: "var(--ink)" }, { label: "Their aces", n: h("OA"), color: "var(--ink)", opacity: 0.75 }, { label: "Their other", n: h("TP"), color: "var(--ink)", opacity: 0.55 }, { label: "Our attack err", n: h("AE"), color: "var(--them)" }, { label: "Serve err", n: h("SE"), color: "var(--them)", opacity: 0.85 }, { label: "Pass 0", n: h("P0"), color: "var(--them)", opacity: 0.7 }, { label: "Dig err", n: h("DE"), color: "var(--them)", opacity: 0.58 }, { label: "Setting err", n: h("BHE"), color: "var(--them)", opacity: 0.48 }, { label: "Block/net", n: h("BE"), color: "var(--them)", opacity: 0.4 }, { label: "Comm/effort/position", n: h("MISC"), color: "var(--them)", opacity: 0.32 }, { label: "Bad calls", n: h("REF"), color: "var(--them)", opacity: 0.22 }]} /></div>
      </div></Card>
      {single ? <Card title="Sets & flags"><div className="stack">
        <div className="row">{single.R.sets.map((s) => <span key={s.n} className="tag" style={{ fontSize: 13, background: "var(--surface-2)", color: s.winner === "us" ? "var(--us)" : s.winner === "them" ? "var(--them)" : "var(--ink)" }}>Set {s.n} · {s.us}–{s.them}</span>)}</div>
        {fl.length ? <ul className="flags">{fl.map((f, i) => <li key={i} className={"flag " + f.lvl}><span><b>{f.title}</b> {f.detail}</span></li>)}</ul> : <p className="empty">No flags.</p>}
        {A.tags.length > 0 && <><div className="label">Film tags</div><ul className="log">{A.tags.map((tg) => <li key={tg.id} style={{ gridTemplateColumns: "60px 1fr auto" }}><b className="num">{filmTime(tg.ts, single.m.filmStart || single.R.firstTs || tg.ts)}</b><span>{tg.note}{tg.p ? " · " + playerName(tg.p) : ""}</span><span className="small muted">Set {tg.set} · {tg.score}</span></li>)}</ul></>}
      </div></Card>
        : <Card title="Results"><ul className="log">{S.items.slice().reverse().map(({ m, R }) => <li key={m.id} className="click" onClick={() => setUi({ statsScope: "m:" + m.id })} style={{ gridTemplateColumns: "1fr auto auto", cursor: "pointer" }}><span>{fmtDate(m.date)} · {m.kind === "match" ? "vs " + m.opp : m.opp}</span><span className="small muted">{R.sets.map((s) => s.us + "-" + s.them).join(", ")}</span><b className={"sc " + (R.wonUs > R.wonThem ? "us" : R.wonThem > R.wonUs ? "them" : "")}>{m.kind === "drills" ? "" : `${R.wonUs}–${R.wonThem}`}</b></li>)}</ul></Card>}
    </div>
  </div>;
}

const filmTime = (ts: number, base: number) => { let s = Math.max(0, Math.round((ts - base) / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); s %= 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0"); };

/* ---------- players ---------- */
function Players({ A }: { A: Agg }) {
  const [mode, setMode] = useState<"totals" | "perset" | "advanced" | "compare">("totals");
  const ids = teamPlayers().filter((p) => A.ps[p.id] || A.pm[p.id]).map((p) => p.id);
  const cls = (s: Stat) => ({ hc: s.TA >= 5 ? ((hitting(s) || 0) >= 0.3 ? "hi" : (hitting(s) || 0) < 0.1 ? "lo" : "") : "", pc: s.R >= 4 ? (s.RS / s.R >= 2.3 ? "hi" : s.RS / s.R < 1.7 ? "lo" : "") : "" });
  return <Card title="Players" actions={<Seg value={mode} onChange={setMode} options={[["totals", "Totals"], ["perset", "Per set"], ["advanced", "Advanced"], ["compare", "Compare"]]} />}>
    {mode === "compare" ? <Compare A={A} ids={ids} /> : <>
    <div className="tbl"><table>
      {mode === "totals" && <><thead>
        <tr><th /><th /><th colSpan={4} className="gh">Hitting</th><th colSpan={3} className="gh">Setting</th><th colSpan={5} className="gh">Serve</th><th colSpan={3} className="gh">Receive</th><th colSpan={2} className="gh">Defense</th><th colSpan={3} className="gh">Block</th><th colSpan={3} className="gh">Misc errors</th></tr>
        <tr><th className="l">#</th><th className="l">Player</th><th>K</th><th>TA</th><th>E</th><th>Hit %</th><th>Att</th><th>Ast</th><th>E</th><th>Att</th><th>Ace</th><th>In</th><th>Net</th><th>Out</th><th>Avg</th><th>Rec</th><th>0s</th><th>Dig</th><th>Dig E</th><th>Solo</th><th>Ast</th><th>E</th><th>Comm</th><th>Eff</th><th>Pos</th></tr></thead>
        <tbody>{ids.map((id) => { const s = A.ps[id] || ({} as Stat), c = cls(s), p = player(id)!; return <tr key={id} className="click" onClick={() => go("player", id)}><td className="l">{p.num}</td><td className="l">{p.first} {p.last} <span className="label">{p.pos}</span></td>{totals(s, c.hc, c.pc)}</tr>; })}</tbody>
        <tfoot><tr><td /><td className="l">Team</td>{totals(A.T, "", "")}</tr></tfoot></>}
      {mode === "perset" && <><thead><tr><th className="l">#</th><th className="l">Player</th><th>Sets</th><th>Kills/S</th><th>Aces/S</th><th>Blocks/S</th><th>Digs/S</th><th>Assists/S</th><th>Rec/S</th><th>Errors/S</th><th>Net pts/S</th></tr></thead>
        <tbody>{ids.map((id) => { const s = A.ps[id], pm = playerMetrics(A, id), p = player(id)!, n = pm.sets || 1; return <tr key={id} className="click" onClick={() => go("player", id)}><td className="l">{p.num}</td><td className="l">{p.first} {p.last}</td><td>{pm.sets}</td><td>{fmtNum(pm.kps, 2)}</td><td>{fmtNum(pm.acesPs, 2)}</td><td>{fmtNum(pm.bps, 2)}</td><td>{fmtNum(pm.dps, 2)}</td><td>{fmtNum(pm.aps, 2)}</td><td>{s ? fmtNum(s.R / n, 2) : "—"}</td><td>{s ? fmtNum((s.AE + serveErrors(s) + s.P0 + s.BE + s.BHE + s.DE) / n, 2) : "—"}</td><td><b>{fmtNum(pm.netPerSet, 2)}</b></td></tr>; })}</tbody></>}
      {mode === "advanced" && <><thead><tr><th className="l">#</th><th className="l">Player</th><th>Kill %</th><th>Hit %</th><th>Perfect pass %</th><th>Good pass %</th><th>Serve in %</th><th>Serve eff</th><th>Ace : error</th><th>+/−</th><th>Net points</th></tr></thead>
        <tbody>{ids.map((id) => { const s = A.ps[id] || ({} as Stat), pm = playerMetrics(A, id), p = player(id)!; return <tr key={id} className="click" onClick={() => go("player", id)}><td className="l">{p.num}</td><td className="l">{p.first} {p.last}</td><td>{fmtPct(pm.killPct)}</td><td>{fmtHit(pm.hitting)}</td><td>{fmtPct(pm.perfectPass)}</td><td>{fmtPct(s.R ? (s.R3 + s.R2) / s.R : null)}</td><td>{fmtPct(pm.serveIn)}</td><td>{fmtHit(pm.serveEff)}</td><td>{fmtRatio(pm.aceErr)}</td><td><b style={{ color: (pm.plusMinus || 0) > 0 ? "var(--good)" : (pm.plusMinus || 0) < 0 ? "var(--muted)" : undefined }}>{fmtSigned(pm.plusMinus)}</b></td><td>{fmtSigned(pm.netPoints)}</td></tr>; })}</tbody></>}
    </table></div>
    <p className="keys" style={{ marginTop: 8 }}>{mode === "totals" ? "Hit % = (kills − errors) ÷ attempts. Pass on a 0–3 scale. Green and red mark standouts once there are enough attempts. Tap a player for her page." : mode === "perset" ? "Per set uses the sets each player recorded a stat or was on court in. Net points = kills, aces and blocks minus errors." : "+/− counts rallies won minus lost while she was on court (needs a lineup). Serve eff = (aces − errors) ÷ serves. Ace : error above 1.0 is strong."}</p></>}
  </Card>;
}
function totals(s: Stat, hc: string, pc: string) {
  const v = [s.K, s.TA, s.AE, <b className={hc}>{fmtHit(hitting(s))}</b>, s.SATT, s.AST, s.BHE, serveAttempts(s), s.SA, s.SI, s.SEN, s.SEO + s.SE, <b className={pc}>{fmtAvg(passAvg(s))}</b>, s.R, s.P0, s.D, s.DE, s.BS, s.BA, s.BE, s.CE, s.EE, s.PE];
  return v.map((x, i) => <td key={i}>{x ?? 0}</td>);
}

/* ---------- offense ---------- */
function Offense({ A }: { A: Agg }) {
  const M = teamMetrics(A);
  const ctxRows = (Object.keys(CONTEXT_LABEL) as AttackContext[]).filter((k) => A.ctx[k]?.team.TA);
  const hitters = teamPlayers().filter((p) => A.ps[p.id]?.TA);
  const pctx = (id: string, keys: AttackContext[]) => { const o = { K: 0, E: 0, TA: 0 }; for (const k of keys) { const c = A.ctx[k]?.p[id]; if (c) { o.K += c.K; o.E += c.E; o.TA += c.TA; } } return o; };
  return <div className="stack">
    <div className="kpis">
      <Kpi label="In-system hitting" value={fmtHit(M.hitInSystem)} sub="off a 2 or 3 pass" />
      <Kpi label="Out-of-system hitting" value={fmtHit(M.hitOutOfSystem)} sub="off a 1 pass" />
      <Kpi label="Transition hitting" value={fmtHit(M.hitTransition)} sub="off a dig or free ball" />
      <Kpi label="Kill %" value={fmtPct(M.killPct)} sub={`error % ${fmtPct(M.errPct)}`} />
    </div>
    <Card title="Attack by first contact"><div className="tbl"><table>
      <thead><tr><th className="l">Before the set</th><th>TA</th><th>K</th><th>E</th><th>Hit %</th><th className="l">Who got the set</th></tr></thead>
      <tbody>{ctxRows.map((k) => { const C = A.ctx[k]!, t = C.team; return <tr key={k}><td className="l">{CONTEXT_LABEL[k]}</td><td>{t.TA}</td><td>{t.K}</td><td>{t.E}</td><td><b>{fmtHit(hitting({ K: t.K, AE: t.E, TA: t.TA }))}</b></td><td className="l">{Object.entries(C.p).filter((x) => x[0] !== "_").sort((a, b) => b[1].TA - a[1].TA).slice(0, 3).map(([id, v]) => `${playerName(id)} ${Math.round((100 * v.TA) / t.TA)}%`).join(", ") || "—"}</td></tr>; })}</tbody>
    </table></div><p className="keys" style={{ marginTop: 8 }}>Built from the order of your entries: a pass or dig followed by an attack. Shows how pass quality drives the offense and where the setter goes.</p></Card>
    <Card title="Hitters by situation"><div className="tbl"><table>
      <thead><tr><th className="l">Hitter</th><th>TA</th><th>Hit %</th><th>In-system</th><th>Out-of-system</th><th>Transition</th><th>Share of sets</th></tr></thead>
      <tbody>{hitters.map((p) => { const s = A.ps[p.id]; const i = pctx(p.id, ["P3", "P2"]), o = pctx(p.id, ["P1"]), tr = pctx(p.id, ["DIG", "FREE"]); return <tr key={p.id}><td className="l">{playerName(p.id)}</td><td>{s.TA}</td><td><b>{fmtHit(hitting(s))}</b></td><td>{fmtHit(hitting({ K: i.K, AE: i.E, TA: i.TA }))} <span className="muted small">({i.TA})</span></td><td>{fmtHit(hitting({ K: o.K, AE: o.E, TA: o.TA }))} <span className="muted small">({o.TA})</span></td><td>{fmtHit(hitting({ K: tr.K, AE: tr.E, TA: tr.TA }))} <span className="muted small">({tr.TA})</span></td><td>{fmtPct(ratio(s.TA, A.T.TA))}</td></tr>; })}</tbody>
    </table></div></Card>
  </div>;
}

/* ---------- serve & pass ---------- */
function ServePass({ A }: { A: Agg }) {
  const M = teamMetrics(A), T = A.T;
  const passers = teamPlayers().filter((p) => A.ps[p.id]?.R).sort((a, b) => A.ps[b.id].R - A.ps[a.id].R);
  const servers = teamPlayers().filter((p) => (A.ps[p.id] && serveAttempts(A.ps[p.id])) || A.srv[p.id]);
  return <div className="stack">
    <Card title="Side-out by pass quality"><div className="tbl"><table>
      <thead><tr><th className="l">Our pass</th><th>Rallies</th><th>Won</th><th>Side-out %</th></tr></thead>
      <tbody>{(["P3", "P2", "P1", "P0"] as const).map((k) => <tr key={k}><td className="l">{k === "P0" ? "0 (aced / shanked)" : k[1] + " pass"}</td><td>{A.soByPass[k].n}</td><td>{A.soByPass[k].w}</td><td><b>{fmtPct(M.soByPass[k])}</b></td></tr>)}<tr><td className="l muted">Not recorded</td><td>{A.soByPass.none.n}</td><td>{A.soByPass.none.w}</td><td>{fmtPct(ratio(A.soByPass.none.w, A.soByPass.none.n))}</td></tr></tbody>
    </table></div><p className="keys" style={{ marginTop: 8 }}>The gap between 3-pass and 1-pass side-out is what better passing is worth to you.</p></Card>
    <div className="grid2">
      <Card title="Passers"><div className="tbl"><table>
        <thead><tr><th className="l">Passer</th><th>Rec</th><th>Avg</th><th>3s</th><th>Perfect %</th><th>0s</th></tr></thead>
        <tbody>{passers.map((p) => { const s = A.ps[p.id]; return <tr key={p.id}><td className="l">{playerName(p.id)}</td><td>{s.R}</td><td><b>{fmtAvg(passAvg(s))}</b></td><td>{s.R3}</td><td>{fmtPct(perfectPassPct(s))}</td><td>{s.P0}</td></tr>; })}</tbody>
        <tfoot><tr><td className="l">Team</td><td>{T.R}</td><td>{fmtAvg(passAvg(T))}</td><td>{T.R3}</td><td>{fmtPct(perfectPassPct(T))}</td><td>{T.P0}</td></tr></tfoot>
      </table></div></Card>
      <Card title="Servers"><div className="tbl"><table>
        <thead><tr><th className="l">Server</th><th>Att</th><th>Ace</th><th>Err</th><th>In %</th><th>Eff</th><th>Rallies won</th><th>Best run</th></tr></thead>
        <tbody>{servers.map((p) => { const s = A.ps[p.id] || ({ SA: 0, SI: 0, SE: 0, SEN: 0, SEO: 0 } as Stat), r = A.srv[p.id]; return <tr key={p.id}><td className="l">{playerName(p.id)}</td><td>{serveAttempts(s)}</td><td>{s.SA}</td><td>{serveErrors(s)}</td><td>{fmtPct(serveInPct(s))}</td><td>{fmtHit(serveEfficiency(s))}</td><td>{r ? `${r.w}/${r.n} (${fmtPct(ratio(r.w, r.n))})` : "—"}</td><td>{r?.best || "—"}</td></tr>; })}</tbody>
      </table></div><p className="keys" style={{ marginTop: 8 }}>Rallies won and best run need a lineup so the app knows who is serving.</p></Card>
    </div>
  </div>;
}

/* ---------- rotations ---------- */
function Rotations({ A, S }: { A: Agg; S: Scope }) {
  let mx = 1; for (let r = 1; r <= 6; r++) mx = Math.max(mx, Math.abs(A.rot[r].w - A.rot[r].l));
  const startLu = S.single?.R.sets.find((s) => s.startLu)?.startLu || team()!.defLineup?.lu || null;
  return <Card title="Rotations">
    <div className="tbl"><table>
      <thead><tr><th className="l">Rotation</th><th className="l">Server</th><th>Won–lost</th><th style={{ width: "30%" }} /><th>Net</th><th>Side-out</th><th>Point-scoring</th></tr></thead>
      <tbody>{[1, 2, 3, 4, 5, 6].map((r) => { const x = A.rot[r], net = x.w - x.l; return <tr key={r}><td className="l"><b>R{r}</b></td><td className="l">{startLu ? playerName(startLu[(r - 1) % 6]) : "—"}</td><td>{x.w}–{x.l}</td><td><Diverge v={net} max={mx} /></td><td><b style={{ color: net > 0 ? "var(--us)" : net < 0 ? "var(--them)" : undefined }}>{fmtSigned(net)}</b></td><td>{fmtPct(ratio(x.rw, x.rn))} <span className="muted small">{x.rw}/{x.rn}</span></td><td>{fmtPct(ratio(x.sw, x.sn))} <span className="muted small">{x.sw}/{x.sn}</span></td></tr>; })}</tbody>
    </table></div>
    <p className="keys" style={{ marginTop: 8 }}>R1 is the starting rotation; it advances each time you side out. Side-out = rallies won on their serve. Point-scoring = rallies won on your serve. Plan and preview rotations on the Lineup tab.</p>
  </Card>;
}

/* ---------- opponent ---------- */
function Opponent({ A }: { A: Agg }) {
  const rows = Object.entries(A.opp).sort((a, b) => b[1].K + b[1].A - (a[1].K + a[1].A));
  return <Card title="Their players" actions={<div className="row"><button className="btn sm" onClick={() => go("matchup")}>Matchups</button><button className="btn sm" onClick={() => go("court")}>Tendency court</button></div>}>
    {rows.length ? <div className="tbl"><table>
      <thead><tr><th className="l">#</th><th>Kills</th><th>Aces</th><th>Errors</th><th>Other pts</th><th className="l">Kills land most</th></tr></thead>
      <tbody>{rows.map(([n, o]) => { const z = Object.entries(o.z).filter((x) => x[0] !== "out").sort((a, b) => b[1] - a[1])[0]; return <tr key={n}><td className="l">#{n}</td><td>{o.K}</td><td>{o.A}</td><td>{o.E}</td><td>{o.P}</td><td className="l">{z ? `Zone ${z[0]} (${z[1]})` : "—"}</td></tr>; })}</tbody>
    </table></div> : <p className="empty">Tap their jersey number after their kills, aces and errors to track their players.</p>}
  </Card>;
}

/* ---------- scrimmage ---------- */
function ScrimStats({ S, A }: { S: Scope; A: Agg }) {
  const m = S.single!.m, Sc = m.scrim!, rall = S.sets.flatMap((s) => s.rallies);
  const so = (k: "a" | "b") => { const r = rall.filter((x) => x.server === (k === "a" ? "them" : "us")); return fmtPct(ratio(r.filter((x) => x.w === (k === "a" ? "us" : "them")).length, r.length)); };
  const pts = { a: S.sets.reduce((n, s) => n + s.us, 0), b: S.sets.reduce((n, s) => n + s.them, 0) };
  const rows: [string, (k: "a" | "b") => any][] = [["Points", (k) => pts[k]], ["Kills", (k) => A.side[k].K], ["Hitting %", (k) => fmtHit(hitting(A.side[k]))], ["Aces", (k) => A.side[k].SA], ["Serve in %", (k) => fmtPct(serveInPct(A.side[k]))], ["Serve errors", (k) => serveErrors(A.side[k])], ["Pass avg", (k) => fmtAvg(passAvg(A.side[k]))], ["Side-out", so], ["Digs", (k) => A.side[k].D], ["Blocks", (k) => blocks(A.side[k])], ["Net points", (k) => fmtSigned(netPoints(A.side[k]))]];
  const table = (k: "a" | "b") => { const ids = Object.keys(A.ps).filter((id) => A.pside[id] === k && player(id));
    return <Card key={k} title={<span style={{ color: k === "a" ? "var(--us)" : "var(--them)" }}>{Sc[k].name}</span>}><div className="tbl"><table>
      <thead><tr><th className="l">Player</th><th>K</th><th>E</th><th>TA</th><th>Hit %</th><th>Ace</th><th>SE</th><th>Pass</th><th>Dig</th><th>Blk</th><th>Ast</th><th>Net pts</th></tr></thead>
      <tbody>{ids.map((id) => { const s = A.ps[id]; return <tr key={id}><td className="l">{playerName(id)}</td><td>{s.K}</td><td>{s.AE}</td><td>{s.TA}</td><td>{fmtHit(hitting(s))}</td><td>{s.SA}</td><td>{serveErrors(s)}</td><td>{fmtAvg(passAvg(s))}</td><td>{s.D}</td><td>{blocks(s)}</td><td>{s.AST}</td><td>{fmtSigned(netPoints(s))}</td></tr>; })}</tbody>
    </table></div></Card>; };
  return <div className="stack">
    <AiCard key={m.id} title="Practice report" desc="Standouts, needs-work and drills for next practice, written from the scrimmage stats." button="Write the report" prompt={() => reportPrompt(m)} saved={m.report} savedAt={m.reportAt} onSave={(text) => patch("matches", m.id, { report: text, reportAt: Date.now() })} />
    <div className="grid2">
      <Card title="Head to head"><div className="tbl"><table><thead><tr><th className="l" /><th style={{ color: "var(--us)" }}>{Sc.a.name}</th><th style={{ color: "var(--them)" }}>{Sc.b.name}</th></tr></thead><tbody>{rows.map(([l, f]) => <tr key={l}><td className="l">{l}</td><td>{f("a")}</td><td>{f("b")}</td></tr>)}</tbody></table></div></Card>
      <Card title="Games"><div className="row">{S.sets.map((s) => <span key={s.n} className="tag" style={{ fontSize: 13 }}>Game {s.n} · {s.us}–{s.them}</span>)}</div></Card>
    </div>
    {table("a")}{table("b")}
  </div>;
}

/* ---------- export ---------- */
async function exportSheet(S: Scope, A: Agg) {
  const t = team()!, M = teamMetrics(A), T = A.T;
  const head = ["#", "Player", "Pos", "Sets", "Kills", "Attack att", "Attack err", "Hit %", "Set att", "Assists", "Set err", "Serve att", "Aces", "Serve in", "Serve err net", "Serve err out", "Serve eff", "Pass avg", "Receptions", "Perfect passes", "Pass 0s", "Digs", "Dig err", "Solo blocks", "Block assists", "Block/net err", "Comm err", "Effort err", "Position err", "+/-", "Net points"];
  const r3 = (v: number | null) => (v == null ? "" : +v.toFixed(3));
  const row = (num: string, name: string, pos: string, s: Stat, id?: string) => { const pm = id ? playerMetrics(A, id) : null; return [num, name, pos, pm ? pm.sets : A.sets, s.K, s.TA, s.AE, r3(hitting(s)), s.SATT, s.AST, s.BHE, serveAttempts(s), s.SA, s.SI, s.SEN, s.SEO + s.SE, r3(serveEfficiency(s)), r3(passAvg(s)), s.R, s.R3, s.P0, s.D, s.DE, s.BS, s.BA, s.BE, s.CE, s.EE, s.PE, pm?.plusMinus ?? "", netPoints(s)]; };
  const players = [head, ...teamPlayers().filter((p) => A.ps[p.id]).map((p) => row(p.num, `${p.first} ${p.last}`, p.pos, A.ps[p.id], p.id)), row("", "Team", "", T)];
  const summary: any[][] = [[`${t.name} · ${S.label}`], [], ["Metric", "Value"], ["Points won", A.us], ["Points lost", A.them], ["Hitting %", r3(M.hitting)], ["Kill %", r3(M.killPct)], ["Side-out %", r3(M.sideOut)], ["First-ball side-out %", r3(M.firstBallSO)], ["Point-scoring %", r3(M.pointScoring)], ["Pass average", r3(M.passAvg)], ["Perfect pass %", r3(M.perfectPass)], ["Serve in %", r3(M.serveIn)], ["Serve efficiency", r3(M.serveEff)], ["In-system %", r3(M.inSystemPct)], ["In-system hitting", r3(M.hitInSystem)], ["Out-of-system hitting", r3(M.hitOutOfSystem)], ["Transition hitting", r3(M.hitTransition)], ["Dig success", r3(M.digSuccess)], ["Side-out after 3 pass", r3(M.soByPass.P3)], ["Side-out after 2 pass", r3(M.soByPass.P2)], ["Side-out after 1 pass", r3(M.soByPass.P1)], ["Their errors", A.team.OE], ["Points we gave away", M.freePoints.ours], [], ["Date", "Opponent", "Result", "Set scores"], ...S.items.map(({ m, R }) => [m.date, m.opp, `${R.wonUs}-${R.wonThem}`, R.sets.map((s) => s.us + "-" + s.them).join(", ")])];
  const rot = [["Rotation", "Won", "Lost", "Side-out won", "Side-out chances", "Serve points won", "Serve chances"], ...[1, 2, 3, 4, 5, 6].map((r) => [r, A.rot[r].w, A.rot[r].l, A.rot[r].rw, A.rot[r].rn, A.rot[r].sw, A.rot[r].sn])];
  const ctx = [["First contact", "Attempts", "Kills", "Errors", "Hit %"], ...(Object.keys(CONTEXT_LABEL) as AttackContext[]).filter((k) => A.ctx[k]).map((k) => { const c = A.ctx[k]!.team; return [CONTEXT_LABEL[k], c.TA, c.K, c.E, r3(hitting({ K: c.K, AE: c.E, TA: c.TA }))]; })];
  const opp = [["Their #", "Kills", "Aces", "Errors", "Other points"], ...Object.entries(A.opp).map(([n, o]) => [n, o.K, o.A, o.E, o.P])];
  const sheets: [string, any[][]][] = [["Summary", summary], ["Players", players], ["Rotations", rot], ["Attack by pass", ctx], ["Opponent", opp]];
  if (S.single) sheets.push(["Play by play", [["Set", "Score", "Play"], ...S.single.R.log.map((l) => [l.set, l.kind === "stat" && l.w ? `${l.us}-${l.them}` : "", logText(l, S.single!.m, t.name)])]]);
  const blob = await buildXlsx(sheets);
  download(`${t.name} ${S.label} ${new Date().toISOString().slice(0, 10)}.xlsx`.replace(/[^\w\- .·]+/g, ""), blob);
  toast("Spreadsheet saved");
}

export { statLine };

/** "▲ .041 vs season" */
function dv(v: number | null, base: number | null | undefined, f: (v: number | null) => string, up: boolean): { text: string; better: boolean | null } | null {
  if (v == null || base == null) return null;
  const d = v - base; if (f(v) === f(base)) return { text: "Same as season", better: null };
  const better = (d > 0) === up;
  return { text: `${better ? "▲" : "▼"} season ${f(base)}`, better };
}

/* Season trends: one point per match. */
const TRENDS: [string, string, (M: ReturnType<typeof teamMetrics>) => number | null, (v: number) => string][] = [
  ["hit", "Hitting %", (M) => M.hitting, (v) => fmtHit(v)],
  ["so", "Side-out", (M) => M.sideOut, (v) => fmtPct(v)],
  ["ps", "Point-scoring", (M) => M.pointScoring, (v) => fmtPct(v)],
  ["pass", "Pass avg", (M) => M.passAvg, (v) => fmtAvg(v)],
  ["srv", "Serve in", (M) => M.serveIn, (v) => fmtPct(v)],
  ["err", "Errors/set", (M) => M.perSet?.errors ?? null, (v) => fmtNum(v, 1)],
];
function Trends({ S }: { S: Scope }) {
  const [k, setK] = useState("hit");
  const def = TRENDS.find((x) => x[0] === k)!;
  const pts = S.items.slice().sort((a, b) => a.m.date.localeCompare(b.m.date)).map(({ m, R }) => ({ label: m.date.slice(5).replace("-", "/"), sub: m.opp, v: def[2](teamMetrics(aggregate(R.sets))) }));
  return <Card title="Trend by match" actions={<Seg value={k} onChange={setK} options={TRENDS.map((x) => [x[0], x[1]] as [string, string])} />}>
    <LineChart points={pts} format={def[3]} />
  </Card>;
}

/* Team leaders for the selected range. */
function Leaders({ A }: { A: Agg }) {
  const ids = Object.keys(A.ps).filter((id) => player(id));
  const cats: [string, (s: Stat) => number | null, (v: number) => string, ((s: Stat) => boolean)?][] = [
    ["Kills", (s) => s.K, (v) => String(v)],
    ["Hitting % (30+ att)", (s) => hitting(s), (v) => fmtHit(v), (s) => s.TA >= 30],
    ["Aces", (s) => s.SA, (v) => String(v)],
    ["Pass avg (20+ rec)", (s) => passAvg(s), (v) => fmtAvg(v), (s) => s.R >= 20],
    ["Digs", (s) => s.D, (v) => String(v)],
    ["Blocks", (s) => blocks(s), (v) => fmtNum(v)],
    ["Assists", (s) => s.AST, (v) => String(v)],
  ];
  return <Card title="Leaders">
    <div className="leaders">{cats.map(([label, f, fmt, ok]) => {
      const top = ids.filter((id) => !ok || ok(A.ps[id])).map((id) => [id, f(A.ps[id])] as [string, number | null]).filter((x) => x[1] != null && (x[1] as number) > 0).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 3);
      return <div key={label} className="ld"><div className="label">{label}</div>
        {top.length ? top.map(([id, v], i) => <button key={id} className={"ld-row" + (i === 0 ? " first" : "")} onClick={() => go("player", id)}><span>{playerName(id)}</span><b>{fmt(v as number)}</b></button>) : <p className="small muted">—</p>}</div>; })}</div>
  </Card>;
}

/* Best single-match performances. */
function Highs({ S }: { S: Scope }) {
  const cats: [string, (s: Stat) => number][] = [["Kills", (s) => s.K], ["Aces", (s) => s.SA], ["Digs", (s) => s.D], ["Assists", (s) => s.AST], ["Blocks", (s) => blocks(s)]];
  const per = S.items.map(({ m, R }) => ({ m, A: aggregate(R.sets) }));
  return <Card title="Single-match highs">
    <ul className="log">{cats.map(([label, f]) => {
      let best: { id: string; v: number; m: typeof per[0]["m"] } | null = null;
      for (const { m, A } of per) for (const [id, st] of Object.entries(A.ps)) { const v = f(st); if (player(id) && v > 0 && (!best || v > best.v)) best = { id, v, m }; }
      return <li key={label} style={{ gridTemplateColumns: "92px 1fr auto" }}><span className="muted">{label}</span><span>{best ? <>{playerName(best.id)} <span className="muted small">vs {best.m.opp}, {fmtDate(best.m.date)}</span></> : "—"}</span><b className="num">{best ? fmtNum(best.v) : ""}</b></li>; })}</ul>
  </Card>;
}

/* Side-by-side for lineup decisions: up to three players, best value in each row highlighted. */
function Compare({ A, ids }: { A: Agg; ids: string[] }) {
  const [pick, setPick] = useState<string[]>(() => ids.slice().sort((a, b) => (A.ps[b]?.TA || 0) - (A.ps[a]?.TA || 0)).slice(0, 2));
  const toggle = (id: string) => setPick(pick.includes(id) ? pick.filter((x) => x !== id) : pick.length >= 3 ? pick.slice(1).concat(id) : pick.concat(id));
  const rows: [string, (id: string) => number | null, (v: number | null) => string, boolean][] = [
    ["Sets played", (id) => playerMetrics(A, id).sets, (v) => fmtNum(v), true],
    ["Kills per set", (id) => playerMetrics(A, id).kps, (v) => fmtNum(v, 2), true],
    ["Hitting %", (id) => (A.ps[id]?.TA ? hitting(A.ps[id]) : null), fmtHit, true],
    ["Kill %", (id) => playerMetrics(A, id).killPct, fmtPct, true],
    ["Attack error %", (id) => (A.ps[id]?.TA ? A.ps[id].AE / A.ps[id].TA : null), fmtPct, false],
    ["Aces per set", (id) => playerMetrics(A, id).acesPs, (v) => fmtNum(v, 2), true],
    ["Serve in %", (id) => playerMetrics(A, id).serveIn, fmtPct, true],
    ["Serve efficiency", (id) => playerMetrics(A, id).serveEff, fmtHit, true],
    ["Pass average", (id) => playerMetrics(A, id).passAvg, (v) => fmtAvg(v), true],
    ["Perfect pass %", (id) => playerMetrics(A, id).perfectPass, fmtPct, true],
    ["Digs per set", (id) => playerMetrics(A, id).dps, (v) => fmtNum(v, 2), true],
    ["Blocks per set", (id) => playerMetrics(A, id).bps, (v) => fmtNum(v, 2), true],
    ["Assists per set", (id) => playerMetrics(A, id).aps, (v) => fmtNum(v, 2), true],
    ["+/− on court", (id) => playerMetrics(A, id).plusMinus, fmtSigned, true],
    ["Net points per set", (id) => playerMetrics(A, id).netPerSet, (v) => fmtNum(v, 2), true],
  ];
  return <div className="stack">
    <div className="pick">{ids.map((id) => <button key={id} aria-pressed={pick.includes(id)} onClick={() => toggle(id)}>{playerName(id)}</button>)}</div>
    {pick.length >= 2 ? <div className="tbl"><table>
      <thead><tr><th className="l" />{pick.map((id) => <th key={id} className="cmp-h"><button className="btn sm ghost" onClick={() => go("player", id)}>{playerName(id)}</button><div className="small muted">{player(id)?.pos}</div></th>)}</tr></thead>
      <tbody>{rows.map(([label, f, fmt, up]) => {
        const vals = pick.map((id) => f(id)), have = vals.filter((v): v is number => v != null);
        const best = have.length >= 2 ? (up ? Math.max(...have) : Math.min(...have)) : null;
        const tie = best != null && have.filter((v) => fmt(v) === fmt(best)).length > 1;
        return <tr key={label}><td className="l">{label}</td>{vals.map((v, i) => <td key={i} className={!tie && v != null && best != null && fmt(v) === fmt(best) ? "cmp-best" : ""}>{fmt(v)}</td>)}</tr>; })}</tbody>
    </table></div> : <p className="empty">Pick two or three players to compare.</p>}
    <p className="keys">Blue marks the best number in each row. Per-set numbers use the sets each player actually played.</p>
  </div>;
}

function Awards({ S }: { S: Scope }) {
  const aw = S.kind === "games" ? seasonAwards(S.items) : [];
  if (!aw.length) return null;
  return <Card title="Season awards so far">
    <ul className="log">{aw.map((a) => <li key={a.title} className="click" style={{ gridTemplateColumns: "1fr auto", cursor: "pointer" }} onClick={() => go("player", a.id)}><span><span className="small muted">{a.title}</span><br /><b>{playerName(a.id, "full")}</b></span><span className="small muted" style={{ textAlign: "right", maxWidth: 220 }}>{a.why}</span></li>)}</ul>
  </Card>;
}
