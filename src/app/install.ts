/** "Install the app": keeps the browser's install prompt so Settings can offer it. iPhone needs Share → Add to Home Screen. */
let deferred: any = null;
const listeners = new Set<() => void>();
export function initInstall() {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; listeners.forEach((f) => f()); });
  window.addEventListener("appinstalled", () => { deferred = null; listeners.forEach((f) => f()); });
}
export const installed = () => matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
export const canPrompt = () => !!deferred;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  deferred.prompt(); const r = await deferred.userChoice.catch(() => null); deferred = null; listeners.forEach((f) => f());
  return r?.outcome === "accepted";
}
export function onInstallChange(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }
