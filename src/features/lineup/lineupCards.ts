/** Printable lineup cards: one per set, serving order I–VI with the libero, ready to hand to the scorer. */
import { player, team } from "../../data/store";

export function lineupCardsHtml(lu: string[], lib: string | null, o: { opp?: string; date?: string; sets?: number } = {}): string {
  const t = team()!, n = Math.max(1, Math.min(5, o.sets || 5));
  const esc = (x: unknown) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const num = (id: string | null) => (id && player(id)?.num) || "";
  const nm = (id: string | null) => { const p = id ? player(id) : null; return p ? `${p.first} ${p.last}`.trim() : ""; };
  const roman = ["I", "II", "III", "IV", "V", "VI"];
  // Court diagram: front row P4 P3 P2, back row P5 P6 P1 (lu index = position - 1)
  const court = `<div class="court"><div class="net">NET</div><div class="cg">${[3, 2, 1, 4, 5, 0].map((i) => `<div><b>${esc(num(lu[i]))}</b><span>P${i + 1}</span></div>`).join("")}</div></div>`;
  const card = (s: number) => `<div class="card">
  <div class="hd"><div><div class="tm">${esc(t.name)}</div><div class="mut">${o.opp ? "vs " + esc(o.opp) : "vs ____________________"}${o.date ? " · " + esc(o.date) : ""}</div></div><div class="set">Set <b>${s}</b></div></div>
  <div class="bd"><table><thead><tr><th>Serve order</th><th>No.</th><th>Player</th></tr></thead><tbody>
  ${lu.map((id, i) => `<tr><td class="r">${roman[i]}</td><td class="n">${esc(num(id))}</td><td>${esc(nm(id))}</td></tr>`).join("")}
  <tr class="lib"><td class="r">Libero</td><td class="n">${esc(num(lib))}</td><td>${esc(nm(lib))}</td></tr>
  </tbody></table>${court}</div>
  <div class="ft"><span>Coach ____________________</span><span>Team serving first: ☐ us ☐ them</span></div></div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(t.name)} lineup cards</title>
<style>*{box-sizing:border-box}body{margin:0;font:13px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;color:#000;background:#F3F4F6}
.bar{display:flex;justify-content:space-between;align-items:center;max-width:800px;margin:16px auto;padding:0 12px}.bar button{font:inherit;font-weight:700;background:#2B79B0;color:#fff;border:0;border-radius:8px;padding:9px 16px;cursor:pointer}
.sheet{max-width:800px;margin:0 auto 24px;display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 12px}
.card{background:#fff;border:2px solid #000;border-radius:6px;padding:10px 12px;break-inside:avoid;page-break-inside:avoid}
.hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px}.tm{font-weight:800;font-size:16px}.mut{color:#555;font-size:12px}
.set{font-size:12px;text-align:right}.set b{display:block;font-size:30px;line-height:1}
.bd{display:grid;grid-template-columns:1fr 112px;gap:10px;align-items:start}
table{border-collapse:collapse;width:100%}th{font-size:10.5px;text-align:left;color:#555;border-bottom:1px solid #999;padding:2px 4px}td{border-bottom:1px solid #ddd;padding:4px}
td.r{font-weight:700;width:44px}td.n{font-weight:800;font-size:18px;width:40px;text-align:center}tr.lib td{border-top:2px solid #000;background:#EEF6FC}
.court{border:1.5px solid #000}.net{background:#000;color:#fff;font-size:9px;text-align:center;letter-spacing:.1em}.cg{display:grid;grid-template-columns:repeat(3,1fr)}
.cg div{border:1px solid #ccc;text-align:center;padding:5px 0}.cg b{display:block;font-size:16px}.cg span{font-size:9px;color:#666}
.ft{display:flex;justify-content:space-between;gap:8px;margin-top:10px;font-size:11px;color:#333;flex-wrap:wrap}
@media (max-width:640px){.sheet{grid-template-columns:1fr}}
@media print{body{background:#fff}.bar{display:none}.sheet{margin:0;padding:0;gap:10px;max-width:none}@page{margin:12mm}}</style></head><body>
<div class="bar"><span><b>${esc(t.name)}</b> · lineup cards</span><button onclick="print()">Print</button></div>
<div class="sheet">${Array.from({ length: n }, (_, i) => card(i + 1)).join("")}</div></body></html>`;
}
