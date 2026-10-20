/** Volleyball court drawn in SVG, in meters: 9 wide x 18 long, their half on top. */
import { MouseEvent, useRef } from "react";

export const ZONE_POS: Record<"us" | "them", Record<number, [number, number]>> = {
  them: { 2: [1.5, 7.5], 3: [4.5, 7.5], 4: [7.5, 7.5], 1: [1.5, 3], 6: [4.5, 3], 5: [7.5, 3] },
  us: { 4: [1.5, 10.5], 3: [4.5, 10.5], 2: [7.5, 10.5], 5: [1.5, 15], 6: [4.5, 15], 1: [7.5, 15] },
};

export interface CourtDot { x: number; y: number; color: string; r?: number; opacity?: number; title?: string }

export function CourtSvg(props: {
  half?: "us" | "them" | "both";
  dots?: CourtDot[];
  /** Zone counts to print, keyed by zone, for one half. */
  counts?: { half: "us" | "them"; byZone: Record<string, number>; total: number; heat?: boolean };
  mark?: [number, number] | null;
  onTap?: (x: number, y: number) => void;
  labels?: { top?: string; bottom?: string };
  label?: string;
  className?: string;
}) {
  const half = props.half || "both";
  const y0 = half === "them" ? -1.5 : half === "us" ? 9 : -1.5;
  const y1 = half === "them" ? 9.6 : half === "us" ? 19.5 : 19.5;
  const H = y1 - y0, top = Math.max(0, y0), bot = Math.min(18, y1);
  const ref = useRef<SVGSVGElement>(null);
  const tap = (e: MouseEvent<SVGSVGElement>) => {
    if (!props.onTap || !ref.current) return;
    const pt = ref.current.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const m = ref.current.getScreenCTM(); if (!m) return;
    const p = pt.matrixTransform(m.inverse());
    props.onTap(+p.x.toFixed(2), +p.y.toFixed(2));
  };
  const line = (x1: number, ya: number, x2: number, yb: number, w = 0.07) => <line key={`${x1}-${ya}-${x2}-${yb}`} x1={x1} y1={ya} x2={x2} y2={yb} stroke="var(--ink)" strokeWidth={w} />;
  const c = props.counts;
  const maxZ = c ? Math.max(1, ...Object.values(c.byZone)) : 1;
  return (
    <svg ref={ref} className={props.className || "courtsvg"} viewBox={`-1.5 ${y0} 12 ${H}`} role="img" aria-label={props.label || "Court"} onClick={props.onTap ? tap : undefined} style={props.onTap ? { cursor: "crosshair", touchAction: "manipulation" } : undefined}>
      <rect x={-1.5} y={y0} width={12} height={H} fill="var(--surface-2)" />
      {top < 9 && <rect x={0} y={top} width={9} height={Math.min(9, bot) - top} fill="var(--them-soft)" />}
      {bot > 9 && <rect x={0} y={Math.max(9, top)} width={9} height={bot - Math.max(9, top)} fill="var(--us-soft)" />}
      {c && Object.entries(ZONE_POS[c.half]).map(([z, [zx, zy]]) => {
        const n = c.byZone[z] || 0, x0 = zx - 1.5, yy = c.half === "them" ? (zy > 5 ? 6 : 0) : zy < 12 ? 9 : 12, h = (c.half === "them" ? (zy > 5 ? 3 : 6) : zy < 12 ? 3 : 6);
        return c.heat && n ? <rect key={"h" + z} x={x0} y={yy} width={3} height={h} fill="var(--accent)" opacity={0.08 + 0.42 * (n / maxZ)} /> : null;
      })}
      {[3, 6].map((x) => <line key={"v" + x} x1={x} y1={top} x2={x} y2={bot} stroke="var(--muted)" strokeWidth={0.04} strokeDasharray=".25 .2" opacity={0.6} />)}
      {(["them", "us"] as const).filter((h) => (h === "them" && top < 9) || (h === "us" && bot > 9)).map((h) =>
        Object.entries(ZONE_POS[h]).map(([z, [zx, zy]]) => {
          if (c && c.half === h) {
            const n = c.byZone[z] || 0;
            return <g key={h + z}>
              <text x={zx - 1.3} y={zy - 1.05} fontSize={0.5} fill="var(--muted)" fontWeight={700}>Z{z}</text>
              {c.total > 0 && <><text x={zx} y={zy + 0.15} textAnchor="middle" fontSize={1.2} fontWeight={700} fill="var(--ink)" fontFamily="var(--display)">{n}</text>
                <text x={zx} y={zy + 0.95} textAnchor="middle" fontSize={0.5} fill="var(--muted)">{Math.round((100 * n) / c.total)}%</text></>}
            </g>;
          }
          return <text key={h + z} x={zx} y={zy + 0.5} textAnchor="middle" fontSize={1.4} fontWeight={700} fill="var(--ink)" opacity={0.25} fontFamily="var(--display)">{z}</text>;
        }))}
      {line(0, top, 0, bot)}{line(9, top, 9, bot)}
      {top <= 0 && line(0, 0, 9, 0)}{bot >= 18 && line(0, 18, 9, 18)}
      {[6, 12].filter((y) => y > top && y < bot).map((y) => line(0, y, 9, y))}
      {top <= 9 && bot >= 9 && line(-0.6, 9, 9.6, 9, 0.16)}
      {(props.dots || []).map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r || 0.3} fill={d.color} opacity={d.opacity ?? 0.85} stroke="var(--surface)" strokeWidth={0.05}>{d.title && <title>{d.title}</title>}</circle>)}
      {props.mark && <><circle cx={props.mark[0]} cy={props.mark[1]} r={0.42} fill="none" stroke="var(--ink)" strokeWidth={0.12} /><circle cx={props.mark[0]} cy={props.mark[1]} r={0.14} fill="var(--ink)" /></>}
      {props.labels?.top && <text x={4.5} y={y0 + 0.75} textAnchor="middle" fontSize={0.55} fontWeight={600} fill="var(--them)" fontFamily="var(--display)" letterSpacing=".05">{props.labels.top.toUpperCase()}</text>}
      {props.labels?.bottom && <text x={4.5} y={y1 - 0.5} textAnchor="middle" fontSize={0.55} fontWeight={600} fill="var(--us)" fontFamily="var(--display)">{props.labels.bottom.toUpperCase()}</text>}
    </svg>
  );
}
