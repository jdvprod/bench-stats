/** Labs: newer features you can try without them changing the main screens. */
import { setPrefs, state, team } from "../../data/store";
import { Card, Switch } from "../../ui/kit";
import { go } from "../../app/router";

export function LabsPage() {
  const p = state.prefs, t = team()!;
  const item = (title: string, desc: string, control: JSX.Element, note?: string) => <Card>
    <div className="row between" style={{ alignItems: "flex-start" }}>
      <div className="grow" style={{ flexBasis: 260, minWidth: 0 }}><h2 style={{ margin: 0 }}>{title}</h2><p className="muted" style={{ marginTop: 4 }}>{desc}</p>{note && <p className="small muted" style={{ marginTop: 6 }}>{note}</p>}</div>
      <div>{control}</div>
    </div>
  </Card>;
  return <div className="page" style={{ maxWidth: 860 }}>
    <div className="pagehead"><h1>Labs</h1></div>
    <p className="muted">Newer features to try. They stay out of the main screens until you turn them on, so nothing changes unless you want it to.</p>
    {item("Formations", "Drag players into serve-receive, serving and base-defense spots for all six rotations. Flags overlap (rotation) faults at the serve, shows where each player moves after the serve, and saves named sets like \"5-1 three-passer\".",
      <button className="btn primary" onClick={() => go("formations")}>Open formations</button>,
      t.formations ? "You have formations saved for this team." : t.defLineup ? "Uses your starting lineup from the Lineup tab." : "Set a starting lineup on the Lineup tab first.")}
    {item("Type-in stat codes", "Adds a box to the Track screen for typing stats on a keyboard: 7k is #7 kill, 12ace is #12 ace, 4p3 is a 3 pass, ok11 is their #11 kill. Handy on a laptop or Surface.",
      <Switch checked={!!p.quick} onChange={(v) => setPrefs({ quick: v })} label="Type-in stat codes" />, "Shows on laptops and tablets, not phones.")}
    {item("Focus mode", "Adds a Focus button to the Track screen. It hides the side panels and makes the buttons bigger, for an assistant tracking on a phone.",
      <Switch checked={!!p.labsFocus} onChange={(v) => setPrefs({ labsFocus: v, focus: v ? p.focus : false })} label="Focus mode button" />)}
    <p className="small muted">These settings are saved on this device.</p>
  </div>;
}
