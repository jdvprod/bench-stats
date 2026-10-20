import { useState } from "react";
import { createTeam, toast } from "../../data/store";
import { addStarterDrills, createSampleTeam } from "../../data/seed";
import { importBackup } from "../../data/backup";
import { TEAM_COLORS } from "../../app/theme";
import { go } from "../../app/router";

export function NewTeamForm({ onDone }: { onDone?: () => void }) {
  const [name, setName] = useState(""), [level, setLevel] = useState("Varsity"), [color, setColor] = useState(TEAM_COLORS[0][0]);
  return <div className="stack">
    <div className="two">
      <label className="field"><span className="label">Team name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Clovis North Broncos" /></label>
      <label className="field"><span className="label">Level</span><input list="levels" value={level} onChange={(e) => setLevel(e.target.value)} /><datalist id="levels">{["Varsity", "JV", "Frosh/Soph", "Middle school", "14U Club", "15U Club", "16U Club", "17U Club", "18U Club", "College"].map((l) => <option key={l} value={l} />)}</datalist></label>
    </div>
    <div><div className="label">Team color</div><div className="row" style={{ marginTop: 6 }}>{TEAM_COLORS.map(([c, n]) => <button key={c} className="swatch" style={{ background: c }} aria-pressed={color === c} aria-label={n} title={n} onClick={() => setColor(c)} />)}<input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Custom color" style={{ width: 40, height: 34, border: 0, background: "none" }} /></div></div>
    <div className="row"><button className="btn primary" disabled={!name.trim()} onClick={() => { const t = createTeam({ name: name.trim(), level, color }); addStarterDrills(t.id); toast("Team created"); onDone?.(); go("team"); }}>Create team</button></div>
  </div>;
}

export function Welcome() {
  const [msg, setMsg] = useState("");
  const onFile = (f?: File | null) => { if (!f) return; const r = new FileReader(); r.onload = () => { const res = importBackup(String(r.result || "")); setMsg(res.message); if (res.ok) go("team"); }; r.readAsText(f); };
  return <div className="page" style={{ maxWidth: 720, margin: "0 auto", paddingTop: 32 }}>
    <div className="row" style={{ gap: 12 }}><div className="jersey" style={{ width: 56, height: 56, fontSize: 28, borderRadius: 12 }}>BS</div><div><h1>Bench Stats</h1><p className="muted">Volleyball stats, lineups and practice planning for coaches.</p></div></div>
    <section className="card"><div className="hd"><h3>Create your team</h3></div><NewTeamForm /></section>
    <section className="card"><div className="hd"><h3>Or</h3></div>
      <div className="stack">
        <div className="row"><button className="btn" onClick={() => { createSampleTeam(); go("track"); }}>Explore with a sample team</button><span className="small muted">Four finished matches and one live match, so every screen is filled in. Delete it any time.</span></div>
        <div className="row"><label className="btn" style={{ cursor: "pointer" }}>Import a backup<input type="file" accept=".json,application/json" hidden onChange={(e) => onFile(e.target.files?.[0])} /></label><span className="small muted">From the first version of Bench Stats (Team → Backup &amp; restore → Save a backup) or from this one.</span></div>
        {msg && <p className="hint">{msg}</p>}
      </div>
    </section>
  </div>;
}
