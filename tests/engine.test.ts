import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, mergeLogs, MatchEvent, replay, rotateLineup, serverOf, zoneOf } from "../src/sports/volleyball/engine";
import { hitting, passAvg, perfectPassPct, playerMetrics, serveEfficiency, teamMetrics } from "../src/sports/volleyball/metrics";
import { tendencies } from "../src/sports/volleyball/tendencies";
import { sampleMatch } from "../src/sports/volleyball/sample";
import { flags } from "../src/sports/volleyball/flags";

let n = 0;
const ev = (t: string, extra: object = {}): MatchEvent => ({ id: "e" + n++, ts: 1000 + n, t, ...extra } as any);
const LU = ["s", "oh1", "mb1", "opp", "oh2", "mb2"];

test("scores rallies, side-outs rotate our lineup", () => {
  const R = replay([ev("NS", { serve: "them", lu: LU, lib: "lib" }), ev("K", { p: "oh1" }), ev("SA", { p: "oh1" }), ev("OK")]);
  const c = R.cur!;
  assert.equal(c.us, 2); assert.equal(c.them, 1);
  assert.equal(c.rot, 2, "side-out moves to rotation 2");
  assert.deepEqual(c.lu, rotateLineup(LU, 1));
  assert.equal(c.serve, "them");
});

test("two block assists on one rally count as one point", () => {
  const R = replay([ev("NS", { serve: "us" }), ev("BA", { p: "mb1" }), ev("BA", { p: "opp" })]);
  assert.equal(R.cur!.us, 1);
  assert.equal(R.cur!.ps.mb1.BA, 1); assert.equal(R.cur!.ps.opp.BA, 1);
});

test("deleted events disappear from every device's log", () => {
  const a = ev("NS", { serve: "us" }), b = ev("K", { p: "x" }), c = ev("DEL", { ref: b.id });
  const merged = mergeLogs([[a, b], [c]]);
  assert.equal(merged.length, 1);
  assert.equal(replay(merged).cur!.us, 0);
});

test("libero serving for a player takes the serve stats", () => {
  const R = replay([ev("NS", { serve: "us", lu: LU, lib: "lib", libSrv: "s" })]);
  assert.equal(serverOf(R.cur), "lib");
});

test("score correction sets the score without touching stats", () => {
  const R = replay([ev("NS", { serve: "us" }), ev("K", { p: "a" }), ev("ADJ", { us: 5, them: 3 })]);
  assert.equal(R.cur!.us, 5); assert.equal(R.cur!.them, 3); assert.equal(R.cur!.ps.a.K, 1);
});

test("scrimmage credits the right team", () => {
  const scrim = { a: { name: "Blue", ids: ["a1"] }, b: { name: "White", ids: ["b1"] }, to: 25 };
  const R = replay([ev("NS", { serve: "us" }), ev("K", { p: "a1", s: "a" }), ev("K", { p: "b1", s: "b" }), ev("SEN", { p: "b1", s: "b" })], { scrim });
  assert.equal(R.cur!.us, 2); assert.equal(R.cur!.them, 1);
  assert.equal(R.cur!.side.b.K, 1);
});

test("set and match end rules: 25 win by 2, fifth set to 15", () => {
  const evs: MatchEvent[] = [ev("NS", { serve: "us" })];
  for (let i = 0; i < 25; i++) evs.push(ev("UP"));
  const R = replay(evs, { bestOf: 5 });
  assert.equal(R.sets[0].over, true); assert.equal(R.wonUs, 1);
  const five: MatchEvent[] = [];
  for (let s = 0; s < 5; s++) { five.push(ev("NS", { serve: "us" })); for (let i = 0; i < (s === 4 ? 15 : 25); i++) five.push(ev(s % 2 ? "TP" : "UP")); }
  const R5 = replay(five, { bestOf: 5 });
  assert.equal(R5.sets[4].target, 15); assert.equal(R5.matchOver, true); assert.equal(R5.wonUs, 3);
});

test("zones map both halves of the court", () => {
  assert.equal(zoneOf(1, 1), 1); assert.equal(zoneOf(8, 7), 4); assert.equal(zoneOf(1, 17), 5); assert.equal(zoneOf(8, 10), 2); assert.equal(zoneOf(-1, 5), "out");
});

test("advanced metrics", () => {
  const R = replay([
    ev("NS", { serve: "them", lu: LU }),
    ev("P3", { p: "oh1" }), ev("K", { p: "oh1" }), // side-out on a 3 pass, first-ball kill
    ev("SA", { p: "oh1" }), ev("SEN", { p: "oh2" }),
    ev("P1", { p: "oh2" }), ev("AE", { p: "opp" }),
  ]);
  const A = aggregate(R.sets), M = teamMetrics(A);
  assert.equal(M.soByPass.P3, 1); assert.equal(M.soByPass.P1, 0);
  assert.equal(M.firstBallSO, 0.5);
  assert.equal(passAvg(A.T), 2); assert.equal(perfectPassPct(A.T), 0.5);
  assert.equal(hitting(A.T), 0);
  assert.equal(serveEfficiency(A.T), 0);
  const pm = playerMetrics(A, "oh1");
  assert.equal(pm.plusMinus, 2 - 2, "oh1 on court for 2 won and 2 lost rallies");
  assert.equal(pm.netPoints, 2);
});

test("sample match replays cleanly and points add up", () => {
  const R = replay(sampleMatch(7, 0, { sets: 3, finished: true }), { bestOf: 5 });
  for (const s of R.sets) assert.equal(s.us + s.them, s.rallies.length);
  const A = aggregate(R.sets);
  assert.ok(A.T.K > 10); assert.ok(A.locs.length > 20);
  const t = tendencies(A.locs, "theirAttack");
  assert.ok(t.total > 0); assert.ok(t.recs.length > 0);
  const f = flags(R, { us: "Us", them: "Them", subLimit: 15, playerIds: Object.keys(A.ps), short: (id) => id });
  assert.ok(Array.isArray(f));
});

import { defaultFormations, overlapFaults } from "../src/sports/volleyball/formations";
test("default formations are legal at the serve", () => {
  const f = defaultFormations();
  for (let r = 0; r < 6; r++) { assert.equal(overlapFaults(f.receive[r], "receive").length, 0); assert.equal(overlapFaults(f.serve[r], "serve").length, 0); }
});
test("overlap check flags front/back and left/right faults, server exempt", () => {
  const s = defaultFormations().receive[0];
  s["5"] = [1.5, 10]; // left back in front of left front
  assert.ok(overlapFaults(s, "receive").some((x) => x.a === "4" && x.b === "5"));
  const v = defaultFormations().serve[0];
  v["1"] = [0.5, 18.9]; // server anywhere behind the line is fine
  assert.equal(overlapFaults(v, "serve").length, 0);
  const w = defaultFormations().receive[0];
  w["3"] = [8, 11.2]; // middle front right of right front
  assert.ok(overlapFaults(w, "receive").some((x) => x.a === "3" && x.b === "2"));
});

import { parseQuick } from "../src/sports/volleyball/quickcodes";
test("quick codes parse players, pass grades and their numbers", () => {
  const r = parseQuick("7k 12ace 4p3 ok11 oe, 3D u #9ba zz 7p3x");
  assert.deepEqual(r.items.map((i) => [i.code, i.num ?? "", i.op ?? ""]), [["K", "7", ""], ["SA", "12", ""], ["P3", "4", ""], ["OK", "", "11"], ["OE", "", ""], ["D", "3", ""], ["BA", "9", ""]]);
  assert.equal(r.undo, 1);
  assert.deepEqual(r.errors, ["zz", "7p3x"]);
  assert.equal(parseQuick("k5").errors.length, 1, "a number after a non-opponent code is rejected");
});

test("flags a rotation stuck on their serve and a shaky next server", () => {
  const R0 = replay([ev("NS", { serve: "them", lu: LU }), ev("OK"), ev("OA"), ev("TP")]);
  const f0 = flags(R0, { us: "Us", them: "Them", subLimit: 15, playerIds: LU, short: (id) => id });
  assert.ok(f0.some((f) => /Stuck in rotation 1/.test(f.title)), "3 straight on their serve");
});

test("attacks are split by our rotation for setter distribution", () => {
  const R = replay([ev("NS", { serve: "us", lu: LU }), ev("K", { p: "oh1" }), ev("TA", { p: "mb1" }), ev("AE", { p: "oh1" })]);
  const A = aggregate(R.sets);
  assert.deepEqual(A.atkRot[1].oh1, { K: 1, E: 1, TA: 2 }, "we kept serving, so every attack was in rotation 1");
  assert.equal(A.atkRot[1].mb1.TA, 1);
});
