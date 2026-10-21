/** Situational numbers: how the team plays by score, after timeouts, in runs, at the start and end of sets. Built from the rally list. */
import { Rally, SetState } from "./engine";
import { Side } from "./actions";

export interface WN { w: number; n: number }
export interface SoPs { so: WN; ps: WN }
export interface Situations {
  rallies: number;
  phase: Record<"early" | "mid" | "late" | "clutch", SoPs>;
  state: Record<"ahead" | "tied" | "behind", SoPs>;
  afterTO: Record<Side, WN>;
  runs: Record<Side, { three: number; longest: number; stoppedAt2: number }>;
  serveRuns: Record<string, { longest: number; runs3: number }>;
  first5: { w: number; n: number }; behind5: { w: number; n: number };
  close: WN; big: WN;
  /** Points won right after we lose a rally to our own error vs to their earned point. */
  bounce: { afterOwnError: WN; afterTheirPoint: WN };
  sets: number;
}

const wn = (): WN => ({ w: 0, n: 0 });
const sp = (): SoPs => ({ so: wn(), ps: wn() });
const OUR_ERRORS = new Set(["AE", "SEN", "SEO", "SE", "BE", "BHE", "CE", "EE", "PE", "P0", "DE"]);

export function rate(x: WN): number | null { return x.n ? x.w / x.n : null; }

export function situations(sets: SetState[]): Situations {
  const S: Situations = {
    rallies: 0, phase: { early: sp(), mid: sp(), late: sp(), clutch: sp() }, state: { ahead: sp(), tied: sp(), behind: sp() },
    afterTO: { us: wn(), them: wn() }, runs: { us: { three: 0, longest: 0, stoppedAt2: 0 }, them: { three: 0, longest: 0, stoppedAt2: 0 } },
    serveRuns: {}, first5: wn(), behind5: wn(), close: wn(), big: wn(), bounce: { afterOwnError: wn(), afterTheirPoint: wn() }, sets: 0,
  };
  for (const set of sets) {
    const rs = set.rallies; if (!rs.length) continue;
    S.sets++;
    const t = set.target || 25, lateAt = t - 5, earlyBelow = Math.round(t * 0.4);
    let us = 0, them = 0, run: Side | null = null, len = 0, srvRun = 0, srvP: string | null = null, prev: Rally | null = null, first5: Side | null = null;
    const closeRun = () => {
      if (!run) return; const R = S.runs[run];
      R.longest = Math.max(R.longest, len); if (len >= 3) R.three++;
      if (len === 2 && run === "them") S.runs.them.stoppedAt2++;
      if (len === 2 && run === "us") S.runs.us.stoppedAt2++;
    };
    for (const r of rs) {
      if (r.us != null && r.them != null) { us = r.us; them = r.them; }
      S.rallies++;
      const won = r.w === "us" ? 1 : 0, key = r.server === "them" ? "so" : "ps", hi = Math.max(us, them), diff = us - them;
      const ph = hi >= lateAt ? "late" : hi < earlyBelow ? "early" : "mid";
      S.phase[ph][key].n++; S.phase[ph][key].w += won;
      if (ph === "late" && Math.abs(diff) <= 2) { S.phase.clutch[key].n++; S.phase.clutch[key].w += won; }
      const st = diff > 0 ? "ahead" : diff < 0 ? "behind" : "tied";
      S.state[st][key].n++; S.state[st][key].w += won;
      if (r.to) { S.afterTO[r.to].n++; S.afterTO[r.to].w += won; }
      if (prev && prev.w === "them") {
        const b = OUR_ERRORS.has(prev.end) ? S.bounce.afterOwnError : S.bounce.afterTheirPoint; b.n++; b.w += won;
      }
      // runs
      if (r.w === run) len++; else { closeRun(); run = r.w; len = 1; }
      // serving runs (our server, consecutive points on our serve)
      if (r.server === "us" && r.srvP) {
        if (r.srvP !== srvP) { srvP = r.srvP; srvRun = 0; }
        if (r.w === "us") { srvRun++; const v = S.serveRuns[srvP] || (S.serveRuns[srvP] = { longest: 0, runs3: 0 }); v.longest = Math.max(v.longest, srvRun); if (srvRun === 3) v.runs3++; }
        else { srvP = null; srvRun = 0; }
      } else { srvP = null; srvRun = 0; }
      if (r.w === "us") us++; else them++;
      if (!first5 && (us >= 5 || them >= 5)) first5 = us >= 5 ? "us" : "them";
      prev = r;
    }
    closeRun();
    if (set.over) {
      const w = set.winner === "us" ? 1 : 0;
      if (first5 === "us") { S.first5.n++; S.first5.w += w; } else if (first5 === "them") { S.behind5.n++; S.behind5.w += w; }
      const margin = Math.abs(set.us - set.them);
      if (margin <= 3) { S.close.n++; S.close.w += w; } else if (margin >= 8) { S.big.n++; S.big.w += w; }
    }
  }
  return S;
}

/** Plain-language takeaways, only where the sample is big enough to mean something. */
export function situationNotes(S: Situations): string[] {
  const out: string[] = [], pct = (x: number | null) => x == null ? "—" : Math.round(100 * x) + "%";
  const e = S.phase.early, l = S.phase.late, c = S.phase.clutch;
  const soE = rate(e.so), soL = rate(l.so);
  if (soE != null && soL != null && e.so.n >= 15 && l.so.n >= 10) {
    if (soE - soL >= 0.1) out.push(`Side-out drops from ${pct(soE)} early in sets to ${pct(soL)} at ${"20+"}. Rehearse late-set serve receive and your go-to side-out play.`);
    else if (soL - soE >= 0.1) out.push(`You side out better late (${pct(soL)}) than early (${pct(soE)}). Starts are the place to gain points.`);
  }
  const psC = rate(c.ps); if (psC != null && c.ps.n >= 8 && psC < 0.35) out.push(`Only ${pct(psC)} point-scoring in close late situations. Serve tough-but-in when it's tight; missed serves end runs.`);
  const to = rate(S.afterTO.us); if (to != null && S.afterTO.us.n >= 4) out.push(to >= 0.6 ? `You win ${pct(to)} of rallies right after your timeouts. Keep calling them early.` : `You win just ${pct(to)} of rallies coming out of your timeouts. Script the next play before the whistle.`);
  if (S.runs.them.three > S.runs.us.three && S.runs.them.three >= Math.max(3, S.sets * 1.5)) out.push(`Opponents put together ${S.runs.them.three} runs of 3+ points (${(S.runs.them.three / Math.max(1, S.sets)).toFixed(1)} a set). Call the timeout at 2 in a row when a server gets hot.`);
  const bo = rate(S.bounce.afterOwnError), bt = rate(S.bounce.afterTheirPoint);
  if (bo != null && bt != null && S.bounce.afterOwnError.n >= 10 && bt - bo >= 0.1) out.push(`After your own errors you side out ${pct(bo)}, vs ${pct(bt)} after their earned points. Errors are carrying over; a reset routine helps.`);
  if (S.behind5.n >= 3 && S.behind5.w === 0) out.push(`You haven't won a set when they reached 5 first (0 of ${S.behind5.n}). Starts matter: open with your strongest rotation.`);
  if (S.runs.us.three >= Math.max(3, S.sets * 2) && S.runs.us.three > S.runs.them.three) out.push(`You put together ${S.runs.us.three} runs of 3+ points to their ${S.runs.them.three}. Serving pressure is a strength.`);
  const cl = S.close; if (cl.n >= 3) out.push(cl.w / cl.n >= 0.6 ? `You've won ${cl.w} of ${cl.n} sets decided by 3 or less.` : cl.w / cl.n <= 0.4 ? `Close sets are slipping away: ${cl.w} of ${cl.n} won when decided by 3 or less.` : "");
  return out.filter(Boolean);
}
