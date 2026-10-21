/**
 * Type-in stat codes for keyboards (laptop or Surface on the bench).
 * "7k" = #7 kill, "12ace" = #12 ace, "4p3" = #4 passed a 3, "ok11" = their #11 kill, "oe" = their error.
 * Several entries can go on one line: "7k 12ace ok11".
 */
import { ActionCode } from "./actions";

export const CODE_MAP: Record<string, ActionCode> = {
  k: "K", kill: "K", a: "TA", att: "TA", ta: "TA", e: "AE", ae: "AE", err: "AE",
  set: "SATT", st: "SATT", ast: "AST", as: "AST", bh: "BHE", bhe: "BHE", ste: "BHE",
  ace: "SA", sa: "SA", in: "SI", si: "SI", sn: "SEN", sen: "SEN", so: "SEO", seo: "SEO", se: "SE",
  p3: "P3", p2: "P2", p1: "P1", p0: "P0", r3: "P3", r2: "P2", r1: "P1", r0: "P0",
  d: "D", dig: "D", de: "DE", b: "BS", bs: "BS", ba: "BA", be: "BE", bn: "BE",
  ce: "CE", ee: "EE", pe: "PE", fb: "FBR", fbr: "FBR", ovp: "OVP", ov: "OVP", fbs: "FBS",
  oe: "OE", ok: "OK", oa: "OA", tp: "TP", up: "UP", ref: "REF",
};
/** Opponent codes take a trailing jersey number: ok11. */
const OPP: Partial<Record<ActionCode, true>> = { OK: true, OA: true, OE: true, TP: true };

export interface QuickItem { code: ActionCode; num?: string; op?: string; raw: string }
export type QuickResult = { items: QuickItem[]; undo: number; errors: string[] };

export function parseQuick(line: string): QuickResult {
  const out: QuickResult = { items: [], undo: 0, errors: [] };
  for (const raw of line.toLowerCase().split(/[\s,;]+/).filter(Boolean)) {
    if (raw === "u" || raw === "undo") { out.undo++; continue; }
    const m = raw.match(/^#?(\d{1,3})?([a-z]+)([0-3])?(\d{1,3})?$/);
    if (!m) { out.errors.push(raw); continue; }
    const [, num, letters, grade, trail] = m;
    let key = letters, op: string | undefined;
    if (grade !== undefined && (letters === "p" || letters === "r")) { key = letters + grade; op = trail; }
    else if (grade !== undefined) op = grade + (trail || "");
    else op = trail;
    const code = CODE_MAP[key];
    if (!code) { out.errors.push(raw); continue; }
    if (op && !OPP[code]) { out.errors.push(raw); continue; }
    out.items.push({ code, num: num || undefined, op: op || undefined, raw });
  }
  return out;
}

export const QUICK_HELP: [string, string][] = [
  ["7k / 7e / 7a", "kill · attack error · attempt"],
  ["1set / 1ast / 1bh", "set attempt · assist · setting error"],
  ["12ace / 12in / 12sn / 12so", "ace · in · serve error net · out (server is automatic: just ace, in…)"],
  ["4p3 … 4p0", "pass grade 3 to 0"],
  ["3d / 3de", "dig · dig error"],
  ["9bs / 9ba / 9be", "solo block · block assist · net error"],
  ["ok11 / oa7 / oe / tp", "their kill · ace · error · other point (with their #)"],
  ["ce / ee / pe / ref / up", "communication · effort · positioning · bad call · our point"],
  ["u", "undo your last entry"],
];
