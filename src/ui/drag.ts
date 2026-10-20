/**
 * Drag and drop that works with mouse, pen and touch. Mark draggable elements with
 * data-drag="<kind>" data-drag-id="<id>" and targets with data-drop="<kind>" data-drop-id="<id>".
 */
import { useEffect, useRef } from "react";

export interface DropInfo { kind: string; id: string; target: string; targetId: string }
let suppressUntil = 0;
/** True right after a drag ends, so the click that follows is ignored. */
export const justDragged = () => Date.now() < suppressUntil;

export function useDragDrop(onDrop: (d: DropInfo) => void, enabled = true) {
  const cb = useRef(onDrop); cb.current = onDrop;
  useEffect(() => {
    if (!enabled) return;
    let s: null | { el: HTMLElement; kind: string; id: string; x: number; y: number; moved: boolean; ghost: HTMLElement | null; over: HTMLElement | null } = null;
    const at = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-drop]") || null;
    const down = (e: PointerEvent) => {
      if (e.button > 0) return;
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-drag]");
      if (!el) return;
      s = { el, kind: el.dataset.drag!, id: el.dataset.dragId!, x: e.clientX, y: e.clientY, moved: false, ghost: null, over: null };
    };
    const move = (e: PointerEvent) => {
      if (!s) return;
      if (!s.moved) {
        if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 10) return;
        s.moved = true;
        const g = s.el.cloneNode(true) as HTMLElement; g.classList.add("ghost-drag"); g.removeAttribute("data-drop"); g.style.width = s.el.offsetWidth + "px";
        document.body.appendChild(g); s.ghost = g;
      }
      e.preventDefault();
      s.ghost!.style.left = e.clientX + "px"; s.ghost!.style.top = e.clientY + "px";
      const t = at(e.clientX, e.clientY);
      if (s.over !== t) { s.over?.classList.remove("droptarget"); if (t && t !== s.el) t.classList.add("droptarget"); s.over = t; }
    };
    const end = (e: PointerEvent, cancel: boolean) => {
      if (!s) return; const d = s; s = null;
      d.ghost?.remove(); d.over?.classList.remove("droptarget");
      if (!d.moved) return;
      suppressUntil = Date.now() + 80;
      if (cancel) return;
      const t = at(e.clientX, e.clientY);
      if (t && t !== d.el) cb.current({ kind: d.kind, id: d.id, target: t.dataset.drop!, targetId: t.dataset.dropId! });
    };
    const up = (e: PointerEvent) => end(e, false), cancel = (e: PointerEvent) => end(e, true);
    const clickGuard = (e: MouseEvent) => { if (justDragged()) { e.stopPropagation(); e.preventDefault(); } };
    document.addEventListener("pointerdown", down);
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", cancel);
    document.addEventListener("click", clickGuard, true);
    return () => {
      document.removeEventListener("pointerdown", down); document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", cancel); document.removeEventListener("click", clickGuard, true);
    };
  }, [enabled]);
}
