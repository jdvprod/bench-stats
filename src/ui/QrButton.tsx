/** "Show QR code": a full-screen code people can scan from the bleachers. */
import { useState } from "react";
import { qrSvg } from "../lib/qr";

export function QrButton({ url, title, label = "Show QR code" }: { url: string; title: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button className="btn sm" onClick={() => setOpen(true)}>{label}</button>
    {open && <div className="qr-overlay" role="dialog" aria-label={title} onClick={() => setOpen(false)}>
      <div className="qr-box" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <div className="qr-img" dangerouslySetInnerHTML={{ __html: qrSvg(url) }} />
        <p className="small muted" style={{ wordBreak: "break-all" }}>{url}</p>
        <button className="btn" onClick={() => setOpen(false)}>Close</button>
      </div>
    </div>}
  </>;
}
