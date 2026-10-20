/** Split the roster into two scrimmage teams. Tap a player to move them: team 1 → team 2 → sitting out. */
import { activePlayers, player } from "../../data/store";
import { POSITION_ORDER } from "../../sports/volleyball/actions";

export interface SplitState { aName: string; bName: string; a: string[]; b: string[]; out: string[] }

export function balancedSplit(random: boolean): Pick<SplitState, "a" | "b" | "out"> {
  const groups: Record<string, string[]> = {};
  for (const p of activePlayers()) (groups[p.pos] ||= []).push(p.id);
  const A: string[] = [], B: string[] = [];
  for (const pos of Object.keys(groups).sort((x, y) => (POSITION_ORDER[x] ?? 9) - (POSITION_ORDER[y] ?? 9))) {
    const g = groups[pos];
    if (random) for (let i = g.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [g[i], g[j]] = [g[j], g[i]]; }
    for (const id of g) {
      const ca = A.filter((x) => player(x)?.pos === pos).length, cb = B.filter((x) => player(x)?.pos === pos).length;
      const toA = ca < cb || (ca === cb && (A.length < B.length || (A.length === B.length && (random ? Math.random() < 0.5 : true))));
      (toA ? A : B).push(id);
    }
  }
  return { a: A, b: B, out: [] };
}

export function SplitEditor({ s, onChange }: { s: SplitState; onChange: (s: SplitState) => void }) {
  const move = (id: string) => {
    const from = s.a.includes(id) ? "a" : s.b.includes(id) ? "b" : "out";
    const to = from === "a" ? "b" : from === "b" ? "out" : "a";
    onChange({ ...s, [from]: s[from].filter((x) => x !== id), [to]: s[to].concat(id) });
  };
  const posSummary = (ids: string[]) => {
    const c: Record<string, number> = {};
    ids.forEach((id) => { const p = player(id)?.pos; if (p) c[p] = (c[p] || 0) + 1; });
    return Object.keys(c).sort((a, b) => (POSITION_ORDER[a] ?? 9) - (POSITION_ORDER[b] ?? 9)).map((k) => c[k] + " " + k).join(" · ") || "empty";
  };
  const chip = (id: string, where: string) => { const p = player(id); if (!p) return null;
    return <button key={id} onClick={() => move(id)} title="Tap to move" style={{ borderColor: where === "a" ? "var(--us)" : where === "b" ? "var(--them)" : "var(--line)" }}>#{p.num} {p.first} <span className="small muted">{p.pos}</span></button>; };
  const col = (k: "a" | "b", name: string, color: string) => <div>
    <div className="row between"><b style={{ color }}>{name} ({s[k].length})</b><span className="small muted">{posSummary(s[k])}</span></div>
    <div className="pick" style={{ marginTop: 6 }}>{s[k].length ? s[k].map((id) => chip(id, k)) : <span className="empty">Tap players to add</span>}</div>
  </div>;
  return <div className="stack">
    <div className="two">
      <label className="field"><span className="label">Team 1 name</span><input value={s.aName} onChange={(e) => onChange({ ...s, aName: e.target.value || "Team 1" })} /></label>
      <label className="field"><span className="label">Team 2 name</span><input value={s.bName} onChange={(e) => onChange({ ...s, bName: e.target.value || "Team 2" })} /></label>
    </div>
    <div className="row">
      <button className="btn sm" onClick={() => onChange({ ...s, ...balancedSplit(false) })}>Auto-split by position</button>
      <button className="btn sm" onClick={() => onChange({ ...s, ...balancedSplit(true) })}>Shuffle</button>
      <span className="small muted">Tap a player to move them: {s.aName} → {s.bName} → sitting out.</span>
    </div>
    <div className="grid2">{col("a", s.aName, "var(--us)")}{col("b", s.bName, "var(--them)")}</div>
    {s.out.length > 0 && <div><b className="small muted">Sitting out ({s.out.length})</b><div className="pick" style={{ marginTop: 6 }}>{s.out.map((id) => chip(id, "out"))}</div></div>}
  </div>;
}
