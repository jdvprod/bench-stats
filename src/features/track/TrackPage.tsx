import { useState } from "react";
import { activePlayers, currentMatch, matchesOf, newMatch, opponentsOf, team, todayISO } from "../../data/store";
import { Card, fmtDate, Seg } from "../../ui/kit";
import { Tracker } from "./Tracker";
import { go } from "../../app/router";
import { setUi } from "../../app/ui";

export function TrackPage() {
  const m = currentMatch();
  if (m && m.kind !== "match") return <div className="page">
    <div className="banner accent"><p><b>A practice is in progress:</b> {m.opp}. Track it from the Practice tab, or start a match below.</p><button className="btn primary" onClick={() => go("practice")}>Go to practice</button></div>
    <StartMatch />
  </div>;
  if (m) return <div className="page"><Tracker m={m} /></div>;
  return <div className="page"><StartMatch /></div>;
}

export function StartMatch() {
  const t = team()!, opps = opponentsOf();
  const [opp, setOpp] = useState(""), [date, setDate] = useState(todayISO()), [site, setSite] = useState<"home" | "away" | "neutral">("home");
  const [event, setEvent] = useState(""), [bestOf, setBestOf] = useState(t.settings.bestOf);
  const recent = matchesOf().filter((x) => x.kind === "match" && x.status === "done").slice(0, 3);
  const start = (serve: "us" | "them") => {
    newMatch({ kind: "match", opp: opp.trim() || "Opponent", date, site, event: event.trim(), bestOf, serve });
    setUi({ sel: null, panel: null, follow: null });
  };
  return <div className="grid2" style={{ alignItems: "start" }}>
    <Card title="Start a match">
      <div className="stack">
        {!activePlayers().length && <div className="banner warn"><p>Add your roster first so you can record stats for each player.</p><button className="btn sm" onClick={() => go("team")}>Add players</button></div>}
        <label className="field"><span className="label">Opponent</span><input list="opp-list" value={opp} onChange={(e) => setOpp(e.target.value)} placeholder="e.g. Buchanan" /><datalist id="opp-list">{opps.map((o) => <option key={o.id} value={o.name} />)}</datalist></label>
        <div className="two">
          <label className="field"><span className="label">Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="field"><span className="label">Tournament or league (optional)</span><input value={event} onChange={(e) => setEvent(e.target.value)} /></label>
        </div>
        <div className="row"><Seg value={site} onChange={setSite} options={[["home", "Home"], ["away", "Away"], ["neutral", "Neutral"]]} label="Site" /><Seg value={bestOf} onChange={setBestOf} options={[[3, "Best of 3"], [5, "Best of 5"]]} label="Format" /></div>
        <p className="small muted">{t.defLineup ? "Your default lineup starts the first set. Change it on the Lineup tab." : "Tip: set a default lineup on the Lineup tab to track rotations and servers automatically."}</p>
        <div className="row"><button className="btn primary" onClick={() => start("us")}>Start · we serve first</button><button className="btn" onClick={() => start("them")}>Start · they serve first</button></div>
      </div>
    </Card>
    <div className="stack">
      <Card title="Recent matches">{recent.length ? <ul className="log">{recent.map((x) => <li key={x.id}><span>{fmtDate(x.date)} vs {x.opp}</span><span /><span /></li>)}</ul> : <p className="empty">Matches you track show up here and on the Stats tab.</p>}</Card>
      <Card title="Before the match"><div className="stack small">
        <p>Check the scouting report for this opponent on the Team tab, and review where their kills land on the Court tab.</p>
        <div className="row"><button className="btn sm" onClick={() => go("court")}>Opponent tendencies</button><button className="btn sm" onClick={() => go("lineup")}>Lineup &amp; rotations</button></div>
      </div></Card>
    </div>
  </div>;
}
