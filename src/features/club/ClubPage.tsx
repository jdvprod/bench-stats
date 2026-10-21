/** All teams at a glance, for a club director or a coach with several teams: record, last result, next match, sync. */
import { all, matchesOf, replayOf, setPrefs, todayISO } from "../../data/store";
import { aggregate } from "../../sports/volleyball/engine";
import { fmtAvg, fmtHit, fmtPct, teamMetrics } from "../../sports/volleyball/metrics";
import { fmtDate } from "../../ui/kit";
import { go } from "../../app/router";
import { isLinked } from "../../cloud/sync";

export function ClubPage() {
  const teams = all("teams").filter((t) => !t.sample).sort((a, b) => a.name.localeCompare(b.name) || (a.level || "").localeCompare(b.level || ""));
  const today = todayISO();
  const rows = teams.map((t) => {
    const games = matchesOf(t.id).filter((m) => m.kind === "match" && (!t.activeSeasonId || m.seasonId === t.activeSeasonId)).map((m) => ({ m, R: replayOf(m)! })).filter((x) => x.R);
    const done = games.filter((x) => x.R.matchOver), W = done.filter((x) => x.R.wonUs > x.R.wonThem).length;
    const M = teamMetrics(aggregate(games.flatMap((x) => x.R.sets)));
    const last = games.find((x) => x.R.matchOver), live = games.find((x) => x.m.status === "live");
    const next = (t.schedule || []).filter((x) => x.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
    return { t, W, L: done.length - W, M, last, live, next, n: games.length };
  });
  const open = (id: string, page = "track") => { setPrefs({ teamId: id }); go(page); };
  const tot = rows.reduce((a, r) => ({ W: a.W + r.W, L: a.L + r.L }), { W: 0, L: 0 });
  return <div className="page">
    <div className="pagehead"><h1>All teams</h1><span className="muted">{rows.length} teams · {tot.W}–{tot.L} combined</span></div>
    {!rows.length ? <p className="empty">Add a team to see it here.</p> : <div className="club-grid">{rows.map(({ t, W, L, M, last, live, next, n }) => <section key={t.id} className="card club-card">
      <div className="row between"><div><h3 style={{ margin: 0 }}>{t.name}</h3><span className="small muted">{t.level || "Team"}{isLinked(t.id) ? " · synced" : ""}</span></div><b className="club-rec">{W}–{L}</b></div>
      {live && <p className="small"><span className="tag" style={{ marginLeft: 0, background: "var(--accent)", color: "var(--accent-ink)" }}>● Live</span> vs {live.m.opp} · {live.R.cur ? `${live.R.cur.us}–${live.R.cur.them}, set ${live.R.cur.n}` : ""}</p>}
      <div className="club-k"><div><span className="label">Hitting</span><b>{fmtHit(M.hitting)}</b></div><div><span className="label">Side-out</span><b>{fmtPct(M.sideOut)}</b></div><div><span className="label">Pass</span><b>{fmtAvg(M.passAvg)}</b></div><div><span className="label">Serve in</span><b>{fmtPct(M.serveIn)}</b></div></div>
      <p className="small" style={{ margin: 0 }}>{last ? <>Last: <b className={last.R.wonUs > last.R.wonThem ? "pt-us" : "pt-them"}>{last.R.wonUs > last.R.wonThem ? "W" : "L"} {last.R.wonUs}–{last.R.wonThem}</b> vs {last.m.opp}, {fmtDate(last.m.date)}</> : n ? "No finished matches yet." : "No matches yet."}</p>
      <p className="small muted" style={{ margin: 0 }}>{next ? `Next: ${next.site === "away" ? "at" : "vs"} ${next.opp}, ${next.date === today ? "today" : fmtDate(next.date)}` : "Nothing scheduled."}</p>
      <div className="row"><button className="btn sm primary" onClick={() => open(t.id)}>Open</button><button className="btn sm" onClick={() => open(t.id, "stats")}>Stats</button><button className="btn sm" onClick={() => open(t.id, "matchup")}>Schedule</button></div>
    </section>)}</div>}
  </div>;
}
