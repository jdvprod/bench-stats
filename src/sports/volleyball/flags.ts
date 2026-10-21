/** Coach flags: plain-language alerts computed from the live match. */
import { aggregate, Replay, runOf, zoneOf } from "./engine";
const zoneKey = (x: number, y: number) => { const z = zoneOf(x, y); return z && z !== "out" ? String(z) : null; };
import { CtxLine } from "./engine";
import { fmtAvg, fmtHit, fmtPct, hitting, miscErrors, ratio, serveErrors, teamErrorsGiven } from "./metrics";

export interface Flag { lvl: "bad" | "warn" | "good"; title: string; detail: string }
export interface FlagContext { us: string; them: string; subLimit: number; playerIds: string[]; short: (id: string) => string }

export function flags(R: Replay, x: FlagContext): Flag[] {
  const out: Flag[] = [], cur = R.cur;
  if (!cur) return out;
  const setA = aggregate([cur]), mA = aggregate(R.sets), run = runOf(cur);
  if (run.n >= 3 && run.side === "them") {
    const left = 2 - cur.to.us;
    out.push({ lvl: "bad", title: `${x.them} on a ${run.n}–0 run.`, detail: left > 0 ? `Timeout available (${left} left).` : "No timeouts left. Reset on the court." });
  }
  if (run.n >= 3 && run.side === "us") out.push({ lvl: "good", title: `${x.us} on a ${run.n}–0 run.`, detail: "Keep the same rhythm." });
  if (x.subLimit && cur.subs >= x.subLimit - 2) out.push({ lvl: cur.subs >= x.subLimit ? "bad" : "warn", title: `${cur.subs} of ${x.subLimit} subs used this set.`, detail: "" });
  const se = serveErrors(setA.T);
  if (se >= 4) out.push({ lvl: "warn", title: `${se} serve errors this set`, detail: `(${setA.T.SEN} net, ${setA.T.SEO + setA.T.SE} out). Serving in is worth more than aces right now.` });
  if (setA.so.n >= 6 && setA.so.w / setA.so.n < 0.5) out.push({ lvl: "bad", title: `Side-out at ${fmtPct(ratio(setA.so.w, setA.so.n))} this set.`, detail: "Target 60%+." });
  if (mA.fbso.n >= 8 && mA.fbso.w / mA.fbso.n < 0.3) out.push({ lvl: "warn", title: `First-ball side-out ${fmtPct(ratio(mA.fbso.w, mA.fbso.n))}.`, detail: "We're not scoring off the first attack after serve receive." });

  const hot: Flag[] = [], cold: Flag[] = [];
  for (const id of x.playerIds) {
    const st = mA.ps[id]; if (!st) continue;
    const h = hitting(st);
    if (st.TA >= 6 && h != null && h < 0.1) cold.push({ lvl: "warn", title: `${x.short(id)} hitting ${fmtHit(h)}`, detail: `(${st.K}K ${st.AE}E on ${st.TA}). Shots or a different look may help.` });
    if (st.TA >= 5 && h != null && h >= 0.33) hot.push({ lvl: "good", title: `${x.short(id)} hitting ${fmtHit(h)}`, detail: `(${st.K}K on ${st.TA}). Keep feeding.` });
    if (st.R >= 5 && st.RS / st.R < 1.7) out.push({ lvl: "warn", title: `${x.short(id)} passing ${fmtAvg(st.RS / st.R)}`, detail: `on ${st.R} serves. Consider shifting serve receive.` });
    if (st.OVP >= 3) out.push({ lvl: "warn", title: `${x.short(id)} has ${st.OVP} overpasses.`, detail: "" });
  }
  const top = Object.entries(mA.opp).sort((a, b) => b[1].K - a[1].K)[0];
  if (top && top[1].K >= 4) {
    const z = Object.entries(top[1].z).filter((e) => e[0] !== "out").sort((a, b) => b[1] - a[1])[0];
    out.push({ lvl: "bad", title: `Their #${top[0]} has ${top[1].K} kills`, detail: (z ? `, ${z[1]} landing in our zone ${z[0]}.` : ".") + " Adjust the block or defense." });
  }
  out.push(...hot, ...cold);
  const p1 = mA.ctx.P1, p3 = mA.ctx.P3;
  const h = (c: CtxLine) => hitting({ K: c.K, AE: c.E, TA: c.TA });
  if (p1 && p1.team.TA >= 5 && p3 && p3.team.TA >= 5) {
    const d = (h(p3.team) || 0) - (h(p1.team) || 0);
    if (d >= 0.25) out.push({ lvl: "warn", title: `Hitting ${fmtHit(h(p3.team))} off 3 passes but ${fmtHit(h(p1.team))} off 1s.`, detail: "Passing is driving the offense." });
  }
  let worst: { r: number; net: number; w: number; l: number } | null = null;
  for (let r = 1; r <= 6; r++) { const v = mA.rot[r], net = v.w - v.l; if (v.w + v.l >= 5 && (!worst || net < worst.net)) worst = { r, net, w: v.w, l: v.l }; }
  if (worst && worst.net <= -3) out.push({ lvl: "warn", title: `Rotation ${worst.r} is ${worst.net} this match`, detail: `(${worst.w}–${worst.l}). Plan a sub or play before you get there.` });
  const mis = miscErrors(setA.T) + setA.team.CE + setA.team.EE + setA.team.PE;
  if (mis >= 3) out.push({ lvl: "warn", title: `${mis} communication / effort / positioning errors this set.`, detail: "Worth a reset in the next timeout." });
  const ours = teamErrorsGiven(setA);
  if (cur.them >= 6 && ours / cur.them >= 0.5) out.push({ lvl: "warn", title: `${ours} of their ${cur.them} points this set were our errors.`, detail: "" });
  // Stuck in a rotation: lost several straight on their serve without siding out
  let stuck = 0;
  for (let i = cur.rallies.length - 1; i >= 0; i--) { const r = cur.rallies[i]; if (r.rot !== cur.rot || r.server !== "them") break; if (r.w === "them") stuck++; else break; }
  if (stuck === 0 && cur.serve === "them") { for (let i = cur.rallies.length - 1; i >= 0; i--) { const r = cur.rallies[i]; if (r.rot !== cur.rot) break; if (r.w === "them") stuck++; else break; } }
  if (cur.serve === "them" && stuck >= 3) out.push({ lvl: "bad", title: `Stuck in rotation ${cur.rot}:`, detail: `${stuck} straight points on their serve. A timeout, a sub or a serve-receive change can break it.` });
  // Next server for us, and how they're serving today
  if (cur.lu && cur.serve === "them") {
    const next = cur.lu[1], st = mA.ps[next];
    if (st) { const att = st.SA + st.SI + serveErrors(st); if (att >= 4 && (st.SA + st.SI) / att < 0.8) out.push({ lvl: "warn", title: `Next server ${x.short(next)} is ${st.SA + st.SI} of ${att} today.`, detail: "A safe, in serve wins more than a missed tough one." }); }
  }
  // Setter distribution: a cold hitter getting most of the sets in a rotation while someone else is hot there
  for (let r = 1; r <= 6; r++) {
    const row = mA.atkRot?.[r]; if (!row) continue;
    const list = Object.entries(row).filter(([p]) => p !== "_"), n = list.reduce((a, [, v]) => a + v.TA, 0); if (n < 8) continue;
    const top = list.sort((a, b) => b[1].TA - a[1].TA)[0], th = hitting({ K: top[1].K, AE: top[1].E, TA: top[1].TA });
    const hot = list.filter(([p, v]) => p !== top[0] && v.TA >= 3).map(([p, v]) => [p, hitting({ K: v.K, AE: v.E, TA: v.TA })] as [string, number | null]).sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1))[0];
    if (top[1].TA / n >= 0.45 && th != null && th < 0.1 && hot && hot[1] != null && hot[1] >= 0.3)
      out.push({ lvl: "warn", title: `Rotation ${r}: ${x.short(top[0])} gets ${Math.round((100 * top[1].TA) / n)}% of attacks, hitting ${fmtHit(th)}.`, detail: `${x.short(hot[0])} is hitting ${fmtHit(hot[1])} there. Spread it around.` });
  }
  // Where our aces land: keep serving there
  const aceZ: Record<string, number> = {};
  for (const s2 of R.sets) for (const l of s2.locs) if (l.t === "SA") { const z = zoneKey(l.x, l.y); if (z) aceZ[z] = (aceZ[z] || 0) + 1; }
  const az = Object.entries(aceZ).sort((a, b) => b[1] - a[1])[0];
  if (az && az[1] >= 2) out.push({ lvl: "good", title: `${az[1]} aces into their zone ${az[0]}.`, detail: "Keep serving there until they adjust." });
  const order = { bad: 0, warn: 1, good: 2 };
  return out.sort((a, b) => order[a.lvl] - order[b.lvl]);
}
