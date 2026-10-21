import { createRoot } from "react-dom/client";
import "./styles/app.css";
import { App } from "./app/App";
import { init } from "./data/store";
import { startSync } from "./cloud/sync";

createRoot(document.getElementById("root")!).render(<App />);
init().then(startSync);

if ("serviceWorker" in navigator && location.protocol.startsWith("http") && location.hostname !== "localhost") {
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}
