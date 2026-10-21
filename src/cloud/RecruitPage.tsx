/** #/recruit/CODE: a player's recruiting page for college coaches. Shown in a sandboxed frame (no scripts). */
import { useEffect, useState } from "react";
import { rpc, cloudAvailable } from "./client";

export function RecruitPage({ code }: { code: string }) {
  const [html, setHtml] = useState<string | null>(null), [err, setErr] = useState("");
  useEffect(() => {
    if (!cloudAvailable()) { setErr("Profile links aren't set up in this version of the app."); return; }
    rpc("recruit_view", { share: code }, true).then((r: any) => { if (r?.html) { setHtml(r.html); const t = /<title>([^<]*)<\/title>/.exec(r.html); if (t) document.title = t[1].replace(/&amp;/g, "&"); } else setErr("This profile link isn't active. Ask the coach for a new one."); })
      .catch(() => setErr("Couldn't load the profile. Check your connection."));
  }, [code]);
  if (!html) return <div className="watch"><p className="empty" style={{ padding: 30 }}>{err || "Loading the profile…"}</p></div>;
  return <iframe className="recruit-frame" title="Recruiting profile" sandbox="allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation" srcDoc={html.replace("<head>", '<head><base target="_blank">')} />;
}
