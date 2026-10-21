/**
 * Formations: where each player stands in each rotation for serve receive, serving and base defense,
 * plus the overlap (rotation fault) check at the moment of serve.
 * Coordinates are court meters on our half: x 0 (left) to 9 (right), y 9 (net) to 18 (end line), facing the net.
 * Spots are keyed by court position "1".."6" (P1 right back, the server ... P6 middle back).
 */
export type Phase = "receive" | "serve" | "base";
export type Spot = [number, number];
export type Spots = Record<string, Spot>;
export interface Formations { receive: Spots[]; serve: Spots[]; base: Spots[] }

export const PHASES: [Phase, string][] = [["receive", "Serve receive"], ["serve", "Serving"], ["base", "Base defense"]];

const ZONE: Record<string, Spot> = { "1": [7.5, 15.5], "2": [7.5, 10.4], "3": [4.5, 10.4], "4": [1.5, 10.4], "5": [1.5, 15.5], "6": [4.5, 15.5] };

export function defaultSpots(phase: Phase): Spots {
  const s: Spots = {};
  for (const k in ZONE) s[k] = [...ZONE[k]] as Spot;
  if (phase === "receive") { for (const k of ["2", "3", "4"]) s[k] = [s[k][0], 11.2]; for (const k of ["1", "5", "6"]) s[k] = [s[k][0], 15]; }
  if (phase === "serve") s["1"] = [7.6, 18.9];
  if (phase === "base") { s["5"] = [1.4, 16]; s["6"] = [4.5, 16.8]; s["1"] = [7.6, 16]; }
  return s;
}

export function defaultFormations(): Formations {
  const six = (p: Phase) => Array.from({ length: 6 }, () => defaultSpots(p));
  return { receive: six("receive"), serve: six("serve"), base: six("base") };
}

/** Pairs that must keep their order at the serve: [player who must be in front/left, other, kind]. */
const RULES: [string, string, "front" | "left"][] = [
  ["4", "5", "front"], ["3", "6", "front"], ["2", "1", "front"],
  ["4", "3", "left"], ["3", "2", "left"], ["5", "6", "left"], ["6", "1", "left"],
];
const NAME: Record<string, string> = { "1": "right back", "2": "right front", "3": "middle front", "4": "left front", "5": "left back", "6": "middle back" };

export interface Fault { a: string; b: string; text: string }

/**
 * Overlap faults at the moment of serve. Front-row players must be closer to the net than the back-row player
 * behind them; players in the same row must keep their left-to-right order. The server is exempt.
 */
export function overlapFaults(s: Spots, phase: Phase): Fault[] {
  if (phase === "base") return [];
  const out: Fault[] = [];
  for (const [a, b, kind] of RULES) {
    if (phase === "serve" && (a === "1" || b === "1")) continue;
    const A = s[a], B = s[b]; if (!A || !B) continue;
    if (kind === "front" && !(A[1] < B[1])) out.push({ a, b, text: `P${a} (${NAME[a]}) must be closer to the net than P${b} (${NAME[b]}).` });
    if (kind === "left" && !(A[0] < B[0])) out.push({ a, b, text: `P${a} (${NAME[a]}) must stay left of P${b} (${NAME[b]}).` });
  }
  return out;
}

export const clampSpot = (x: number, y: number): Spot => [+Math.max(-1, Math.min(10, x)).toFixed(2), +Math.max(9.3, Math.min(19.6, y)).toFixed(2)];
