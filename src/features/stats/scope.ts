/** Which games the Stats screen is adding up. */
import { currentMatch, get, matchesOf, replayOf, team } from "../../data/store";
import { Match } from "../../data/model";
import { Replay, SetState } from "../../sports/volleyball/engine";

export interface Scope { key: string; label: string; sets: SetState[]; items: { m: Match; R: Replay }[]; single: { m: Match; R: Replay; setN: number | null } | null; kind: "games" | "practice" | "match"; event?: string }

export function seasonMatches(season: string, kind: "games" | "practice") {
  return matchesOf().filter((m) => (season === "all" || m.seasonId === season) && (kind === "games" ? m.kind === "match" : m.kind !== "match")).reverse();
}

/** key: "season" | "practice" | "m:<id>" | "m:<id>:<set>" */
export function resolveScope(key: string, season: string): Scope {
  if (key.startsWith("m:")) {
    const [, id, s] = key.split(":");
    const m = get("matches", id === "current" ? currentMatch()?.id : id);
    const R = replayOf(m);
    if (m && R) {
      const setN = s ? +s : null;
      return { key, label: (m.kind === "match" ? "vs " + m.opp : m.opp) + (setN ? ` · Set ${setN}` : ""), sets: setN ? R.sets.filter((x) => x.n === setN) : R.sets, items: [{ m, R }], single: { m, R, setN }, kind: "match" };
    }
    key = "season";
  }
  if (key.startsWith("e:")) {
    const ev = decodeURIComponent(key.slice(2));
    const items = seasonMatches(season, "games").filter((m) => (m.event || "").trim() === ev).map((m) => ({ m, R: replayOf(m)! })).filter((x) => x.R);
    if (items.length) return { key, label: ev, sets: items.flatMap((x) => x.R.sets), items, single: null, kind: "games", event: ev };
    key = "season";
  }
  const kind = key === "practice" ? "practice" : "games";
  const items = seasonMatches(season, kind).map((m) => ({ m, R: replayOf(m)! })).filter((x) => x.R);
  return { key, label: kind === "games" ? "Season" : "Practice", sets: items.flatMap((x) => x.R.sets), items, single: null, kind };
}

export function defaultScope(): string { return currentMatch() ? "m:current" : "season"; }
export const activeSeason = () => team()?.activeSeasonId || "all";

/** Event names (tournaments, leagues) used by this season's matches, most recent first. */
export function seasonEvents(season: string): string[] {
  const seen = new Set<string>(), out: string[] = [];
  for (const m of seasonMatches(season, "games").slice().reverse()) { const e = (m.event || "").trim(); if (e && !seen.has(e)) { seen.add(e); out.push(e); } }
  return out;
}
