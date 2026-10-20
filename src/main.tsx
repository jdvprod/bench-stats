import { createRoot } from "react-dom/client";
import "./styles/app.css";
import { App } from "./app/App";
import { init } from "./data/store";

createRoot(document.getElementById("root")!).render(<App />);
init();

if ("serviceWorker" in navigator && location.protocol.startsWith("http") && location.hostname !== "localhost") {
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}
