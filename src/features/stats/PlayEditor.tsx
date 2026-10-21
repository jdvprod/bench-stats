/** Fix a match after it's played: change who made a play or what it was, delete it, or add a missed play. Works on every coach's entries. */
import { useState } from "react";
import { activePlayers, appendEvents, deleteEvent, eventsOf, insertBefore, playerName, replaceEvent, team, toast } from "../../data/store";
import { Match } from "../../data/model";
import { ACTIONS, ActionCode, GROUPS } from "../../sports/volleyball/actions";
import { Replay, LogEntry, MatchEvent } from "../../sports/volleyball/engine";
import { Card } from "../../ui/kit";
import { logText } from "../track/Tracker";


export function PlayEditor({ m, R }: { m: Match; R: Replay }) {
  const t = team()!, [set, setSet] = useState(R.sets[R.sets.length - 1]?.n || 1), [open, setOpen] = useState<string | null>(null), [mode, setMode] = useState<"edit" | "add">("edit");
  const [addCode, setAddCode] = useState<ActionCode>("K"), [addP, setAddP] = useState("");
  const evs = new Map(eventsOf(m.id).map((e) => [e.id, e]));
  const rows = R.log.filter((l) => l.set === set && (l.kind === "stat" || l.kind === "sub" || l.kind === "to"));
  const players = activePlayers();
  const needsPlayer = (k: ActionCode) => !(ACTIONS[k] as any).team;
  const close = () => { setOpen(null); setMode("edit"); };
  const fix = (l: LogEntry, p: Record<string, any>, msg: string) => { const e = evs.get(l.id); if (!e) return; replaceEvent(m.id, e, p); toast(msg); close(); };
  return <Card title="Fix plays" actions={<div className="row">{R.sets.map((s) => <button key={s.n} className="btn sm" aria-pressed={set === s.n} onClick={() => { setSet(s.n); close(); }}>Set {s.n}</button>)}</div>}>
    <p className="small muted" style={{ marginTop: 0 }}>Tap a play to change who made it or what it was, delete it, or add a play you missed before it. The score and every stat update. Changes sync to the other coaches.</p>
    <ul className="log pe">{rows.map((l) => {
      const e = evs.get(l.id) as (MatchEvent & { p?: string; ns?: boolean }) | undefined, isOpen = open === l.id;
      return <li key={l.id} className={isOpen ? "editing" : ""}>
        <button className="log-edit" onClick={() => { setOpen(isOpen ? null : l.id); setMode("edit"); }} aria-expanded={isOpen}>{logText(l, m, t.name)}{e?.ns ? <span className="tag" style={{ marginLeft: 6 }}>stats only</span> : null}</button>
        <span className={"sc " + (l.kind === "stat" && l.w ? l.w : "")}>{l.kind === "stat" && l.w ? `${l.us}–${l.them}` : ""}</span>
        {isOpen && e && <div className="log-fix">
          <div className="row">
            <button className="btn sm" aria-pressed={mode === "edit"} onClick={() => setMode("edit")}>Change</button>
            <button className="btn sm" aria-pressed={mode === "add"} onClick={() => setMode("add")}>Add a play before this</button>
            <button className="btn sm ghost" onClick={() => { deleteEvent(m.id, l.id); toast("Play deleted"); close(); }}>Delete</button>
          </div>
          {mode === "edit" && l.kind === "stat" && <>
            {needsPlayer(l.t) && <><span className="small muted">Who made it?</span>
              <div className="pick">{players.map((p) => <button key={p.id} aria-pressed={p.id === l.p} onClick={() => fix(l, { p: p.id }, `Changed to ${playerName(p.id)}`)}>#{p.num} {p.first}</button>)}</div></>}
            <span className="small muted">What happened?</span>
            <select className="input" style={{ width: "auto" }} value={l.t} onChange={(ev) => { const k = ev.target.value as ActionCode; fix(l, { t: k, p: needsPlayer(k) ? e.p : undefined }, "Changed to " + (ACTIONS[k] as any).long); }} aria-label="Play type">
              {GROUPS.map(([g, ks]) => <optgroup key={g} label={g}>{ks.map((k) => <option key={k} value={k}>{(ACTIONS[k] as any).long}</option>)}</optgroup>)}
              <optgroup label="Points"><option value="UP">Point (us)</option></optgroup>
            </select>
          </>}
          {mode === "add" && <div className="row">
            <select className="input" style={{ width: "auto" }} value={addCode} onChange={(ev) => setAddCode(ev.target.value as ActionCode)} aria-label="Missed play">
              {GROUPS.map(([g, ks]) => <optgroup key={g} label={g}>{ks.map((k) => <option key={k} value={k}>{(ACTIONS[k] as any).long}</option>)}</optgroup>)}
              <optgroup label="Points"><option value="UP">Point (us)</option></optgroup>
            </select>
            {needsPlayer(addCode) && <select className="input" style={{ width: "auto" }} value={addP} onChange={(ev) => setAddP(ev.target.value)} aria-label="Player">
              <option value="">Player…</option>{players.map((p) => <option key={p.id} value={p.id}>#{p.num} {p.first}</option>)}</select>}
            <button className="btn sm primary" disabled={needsPlayer(addCode) && !addP && !(ACTIONS[addCode] as any).optionalPlayer} onClick={() => { insertBefore(m.id, e, { t: addCode, ...(addP && needsPlayer(addCode) ? { p: addP } : {}) } as any); toast("Play added"); close(); }}>Add</button>
          </div>}
        </div>}
      </li>; })}</ul>
    {!rows.length && <p className="empty">No plays in this set.</p>}
    <div className="row" style={{ marginTop: 8 }}><span className="small muted grow">Missed something at the end of the set?</span>
      <button className="btn sm" onClick={() => { appendEvents(m.id, [{ t: "UP" } as any]); toast("Point added at the end"); }} disabled={set !== R.sets[R.sets.length - 1]?.n || R.matchOver}>+ Our point at the end</button></div>
  </Card>;
}
