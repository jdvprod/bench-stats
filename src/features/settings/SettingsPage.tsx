import { useState } from "react";
import { all, setPrefs, setSettings, state, team, toast } from "../../data/store";
import { Card, Seg, SetRow, Switch } from "../../ui/kit";
import { ask, AiError, getKey, setKey } from "../../ai/client";
import { cloudAvailable, currentUser, setConfig, signOut } from "../../cloud/client";
import { go } from "../../app/router";

export function SettingsPage() {
  const t = team()!, s = t.settings, p = state.prefs;
  const [key, setK] = useState(getKey()), [show, setShow] = useState(false), [testing, setTesting] = useState(false), [msg, setMsg] = useState("");
  const test = async () => {
    setKey(key.trim()); setTesting(true); setMsg("");
    try { await ask("Reply with the single word: ready", { tier: "quick", maxTokens: 10 }); setMsg("Connected. AI features are on."); }
    catch (e) { setMsg(e instanceof AiError ? e.message : "Couldn't connect."); }
    setTesting(false);
  };
  const counts = { teams: all("teams").length, players: all("players").length, matches: all("matches").length, events: all("logs").reduce((n, l) => n + l.events.length, 0) };
  return <div className="page" style={{ maxWidth: 820 }}>
    <div className="pagehead"><h1>Settings</h1></div>
    <Card title="Look">
      <SetRow title="Theme" sub="System follows your device's light or dark mode."><Seg value={p.theme} onChange={(v) => setPrefs({ theme: v })} options={[["system", "System"], ["light", "Light"], ["dark", "Dark"]]} label="Theme" /></SetRow>
      <SetRow title="Text and button size" sub="Large is easier to hit on a tablet courtside."><Seg value={p.size} onChange={(v) => setPrefs({ size: v })} options={[["normal", "Normal"], ["large", "Large"]]} label="Size" /></SetRow>
      <SetRow title="Team color" sub="Change it on the Team tab."><button className="btn sm" onClick={() => go("team")}>Team tab</button></SetRow>
    </Card>
    <Card title={`Tracking · ${t.name}`}>
      <SetRow title="Ask where the ball landed" sub="After kills, aces, serves and passes, tap the court. Feeds the tendency court."><Switch checked={s.askLoc} onChange={(v) => setSettings({ askLoc: v })} label="Ask where the ball landed" /></SetRow>
      <SetRow title="Also ask after digs" sub="Shows where you dig their attacks. One more tap per dig."><Switch checked={s.askLocDigs} disabled={!s.askLoc} onChange={(v) => setSettings({ askLocDigs: v })} label="Ask after digs" /></SetRow>
      <SetRow title="Ask for their jersey number" sub="After their kills, aces and errors, so you can scout their players."><Switch checked={s.askOpp} onChange={(v) => setSettings({ askOpp: v })} label="Ask for their number" /></SetRow>
      <SetRow title="Subs allowed per set" sub="0 means no limit. High school is usually 15, club 12 or 15."><input className="input" style={{ width: 80 }} type="number" min={0} max={30} value={s.subLimit} onChange={(e) => setSettings({ subLimit: Math.max(0, +e.target.value || 0) })} aria-label="Subs per set" /></SetRow>
      <SetRow title="Default match format"><Seg value={s.bestOf} onChange={(v) => setSettings({ bestOf: v })} options={[[3, "Best of 3"], [5, "Best of 5"]]} label="Format" /></SetRow>
      <SetRow title="Zone numbers on drawing boards"><Switch checked={!s.hideZones} onChange={(v) => setSettings({ hideZones: !v })} label="Show zone numbers" /></SetRow>
    </Card>
    <Card title="Labs">
      <SetRow title="Try new features" sub="Formations, type-in stat codes and focus mode. Turn on only what you want."><button className="btn sm" onClick={() => go("labs")}>Open Labs</button></SetRow>
    </Card>
    <Card title="AI features">
      <div className="stack">
        <p className="small muted">Timeout talking points, match reports, scouting, lineup suggestions, practice plans and player report cards use Claude. Paste an Anthropic API key from console.anthropic.com. It stays on this device only. Typical cost is a few cents per report.</p>
        <div className="row">
          <input className="input grow" type={show ? "text" : "password"} value={key} onChange={(e) => setK(e.target.value)} placeholder="sk-ant-…" autoComplete="off" aria-label="API key" style={{ minWidth: 200 }} />
          <button className="btn sm" onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button>
        </div>
        <div className="row">
          <button className="btn primary" disabled={!key.trim() || testing} onClick={test}>{testing ? "Testing…" : "Save and test"}</button>
          {getKey() && <button className="btn" onClick={() => { setKey(""); setK(""); setMsg("Key removed."); }}>Remove key</button>}
        </div>
        {msg && <p className="hint">{msg}</p>}
      </div>
    </Card>
    <CloudSettings />
    <Card title="Your data">
      <p className="small">Saved on this device: {counts.teams} teams, {counts.players} players, {counts.matches} matches and practices, {counts.events.toLocaleString()} recorded plays.</p>
      <p className="small muted" style={{ marginTop: 6 }}>{state.persistent ? "Your browser has agreed to keep this data." : "Your browser may clear this data if space runs low."} Save a backup from Team → Backup to move data to another device or keep a copy.</p>
      <div className="row" style={{ marginTop: 8 }}><button className="btn sm" onClick={() => go("team")}>Backup & restore</button><button className="btn sm" onClick={() => { location.reload(); toast("Reloaded"); }}>Reload app</button></div>
    </Card>
    <p className="small muted" style={{ textAlign: "center" }}>Benchboard 2.0</p>
  </div>;
}

function CloudSettings() {
  const own = (() => { try { return JSON.parse(localStorage.getItem("bs-cloud-config") || "null"); } catch { return null; } })();
  const [url, setUrl] = useState(own?.url || ""), [key, setKeyV] = useState(own?.key || ""), [open, setOpen] = useState(!!own);
  const user = currentUser();
  return <Card title="Cloud">
    <SetRow title="Account" sub={cloudAvailable() ? (user ? "Signed in as " + user.email + ". Sync and sharing are on the Team tab." : "Sign in on the Team tab to sync teams and share them with other coaches.") : "Cloud sync isn't set up in this version."}>
      {user ? <button className="btn sm" onClick={() => { signOut(); toast("Signed out"); }}>Sign out</button> : <button className="btn sm" onClick={() => go("team")}>Team tab</button>}
    </SetRow>
    {!open ? <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => setOpen(true)}>Use my own Supabase project</button> : <div className="stack" style={{ marginTop: 8 }}>
      <p className="small muted">For developers and testing. Paste the Project URL and anon public key from Supabase → Project Settings → API. Leave empty to use the app's built-in project.</p>
      <div className="two">
        <label className="field"><span className="label">Project URL</span><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" /></label>
        <label className="field"><span className="label">Anon public key</span><input value={key} onChange={(e) => setKeyV(e.target.value)} placeholder="eyJ…" /></label>
      </div>
      <div className="row"><button className="btn sm primary" onClick={() => { setConfig(url.trim() && key.trim() ? { url: url.trim(), key: key.trim() } : null); toast("Saved. Reloading…"); setTimeout(() => location.reload(), 600); }}>Save</button></div>
    </div>}
  </Card>;
}
