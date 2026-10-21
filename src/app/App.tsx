import { useEffect } from "react";
import { all, currentMatch, setPrefs, state, team, useVersion } from "../data/store";
import { useRoute } from "./router";
import { applyTheme } from "./theme";
import { Scoreboard } from "./Scoreboard";
import { Icon } from "../ui/icons";
import { Toast } from "../ui/kit";
import { TrackPage } from "../features/track/TrackPage";
import { LineupPage } from "../features/lineup/LineupPage";
import { FormationsPage } from "../features/formations/FormationsPage";
import { LabsPage } from "../features/labs/LabsPage";
import { PracticePage } from "../features/practice/PracticePage";
import { StatsPage } from "../features/stats/StatsPage";
import { CourtPage } from "../features/court/CourtPage";
import { TeamPage } from "../features/team/TeamPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { PlayerPage } from "../features/player/PlayerPage";
import { LivePage } from "../features/live/LivePage";
import { Welcome } from "../features/team/Welcome";
import { WatchPage } from "../cloud/WatchPage";
import { JoinPage } from "../cloud/CloudCard";

const HOST_THEME = typeof document !== "undefined" ? document.documentElement.getAttribute("data-theme") : null;
const NAV: [string, string, string?][] = [["track", "Track"], ["lineup", "Lineup"], ["practice", "Practice"], ["stats", "Stats"], ["court", "Court"], ["team", "Team"], ["live", "Live", "wide-only"], ["labs", "Labs", "wide-only"]];

export function App() {
  useVersion();
  const route = useRoute(), t = team();
  useEffect(() => { applyTheme(t?.color || "#2A78AE", state.prefs.theme, state.prefs.size, HOST_THEME); }, [t?.color, state.prefs.theme, state.prefs.size]);
  if (route.page === "watch" && route.id) return <><WatchPage code={route.id} /><Toast /></>;
  if (!state.ready) return <div className="content"><p className="empty" style={{ padding: 24 }}>Loading…</p></div>;
  if (!t) return <><div className="content">{route.page === "join" && route.id ? <JoinPage code={route.id} /> : <Welcome />}</div><Toast /></>;

  const page = route.page;
  const showBoard = !!currentMatch() && ["track", "practice", "lineup", "formations", "stats", "court"].includes(page) && !(page === "practice" && currentMatch()?.kind === "match");
  const teams = all("teams").sort((a, b) => a.createdAt - b.createdAt);
  const switcher = (cls: string) => (
    <select className={cls} value={t.id} aria-label="Team" onChange={(e) => { if (e.target.value === "__new") location.hash = "#/team/new"; else setPrefs({ teamId: e.target.value }); }}>
      {teams.map((x) => <option key={x.id} value={x.id}>{x.name}{x.level ? " · " + x.level : ""}</option>)}
      <option value="__new">+ Add a team</option>
    </select>
  );
  let body;
  switch (page) {
    case "lineup": body = <LineupPage />; break;
    case "formations": body = <FormationsPage />; break;
    case "labs": body = <LabsPage />; break;
    case "join": body = <JoinPage code={route.id || ""} />; break;
    case "practice": body = <PracticePage />; break;
    case "stats": body = <StatsPage />; break;
    case "court": body = <CourtPage />; break;
    case "team": body = <TeamPage sub={route.id} />; break;
    case "settings": body = <SettingsPage />; break;
    case "player": body = <PlayerPage id={route.id!} />; break;
    case "live": body = <LivePage />; break;
    default: body = <TrackPage />;
  }
  return <>
    <nav className="nav" aria-label="Sections">
      <div className="brand"><i><Icon name="brand" /></i><b>Benchboard</b></div>
      <div className="teamswitch">{switcher("")}</div>
      {NAV.map(([k, l, cls]) => <a key={k} className={"tab " + (cls || "")} href={"#/" + k} aria-current={page === k || (k === "stats" && page === "player") || (k === "labs" && page === "formations") ? "page" : undefined}><Icon name={k} /><span>{l}</span></a>)}
      <a className="tab end" href="#/settings" aria-current={page === "settings" ? "page" : undefined}><Icon name="settings" /><span>Settings</span></a>
    </nav>
    <div className="content">
      <div className="mobilebar"><b>Benchboard</b>{switcher("")}</div>
      {showBoard && page !== "live" && <Scoreboard />}
      {!state.persistent && <div className="banner warn" style={{ marginTop: 12 }}><p>This browser isn't letting Benchboard save. Stats will be lost when you close it. Try a regular (not private) window.</p></div>}
      {body}
    </div>
    <Toast />
  </>;
}
