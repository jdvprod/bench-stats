/** Sign in, create account, password reset, and the account screen. Shares a split "scoreboard" shell with first-run setup. */
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { setPrefs, state, team, toast } from "../data/store";
import { CloudError, cloudAvailable, currentUser, resendConfirmation, sendPasswordReset, signIn, signOut, signUp, updatePassword } from "./client";
import { isLinked, linkTeam, restoreTeams, status, syncNow } from "./sync";
import { go } from "../app/router";
import { Card } from "../ui/kit";
import { Icon } from "../ui/icons";

/* A real-looking set: down 9–15, comeback, wins 25–23. Drawn as the score margin after each rally. */
const SET = [0, 1, 0, -1, -2, -1, -2, -3, -2, -3, -4, -3, -4, -5, -6, -5, -6, -5, -4, -3, -4, -3, -2, -1, 0, 1, 0, 1, 2, 1, 2, 3, 2, 1, 2, 1, 0, 1, 2, 1, 2, 3, 2, 1, 2, 3, 2];

function Momentum() {
  const W = 420, H = 120, mx = 7, x = (i: number) => (i / (SET.length - 1)) * W, y = (v: number) => H / 2 - (v / mx) * (H / 2 - 6);
  const d = SET.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join("");
  return <svg className="auth-flow" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
    <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="mid" />
    <path d={d + `L${W} ${H / 2}L0 ${H / 2}Z`} className="area" />
    <path d={d} className="line" pathLength={1} />
    <circle cx={x(SET.length - 1)} cy={y(SET[SET.length - 1])} r="4.5" className="dot" />
  </svg>;
}

/** Dark scoreboard panel on the left (top on phones), content on the right. */
export function AuthShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div className="auth">
    <aside className="auth-board">
      <div className="auth-brand"><i><Icon name="brand" /></i><b>Benchboard</b></div>
      <div className="auth-score" aria-hidden="true">
        <div className="auth-nums"><span className="us">25</span><span className="sep">–</span><span className="them">23</span></div>
        <p className="auth-caption">Fifth set, down 9–15. Rotation 4 sides out, the run starts, and you saw it coming on your own bench.</p>
        <Momentum />
      </div>
      <ul className="auth-points">
        <li>Track every touch from the bench, offline in any gym.</li>
        <li>Side-out by pass grade, rotation results and where their kills land.</li>
        <li>Assistants track on their phones. Parents follow live.</li>
      </ul>
    </aside>
    <main className={"auth-main" + (wide ? " wide" : "")}><div className="auth-inner">{children}</div></main>
  </div>;
}

const errText = (e: unknown) => (e instanceof CloudError ? e.message : "Something went wrong. Try again.");
type Mode = "signin" | "signup" | "check" | "forgot" | "sent" | "newpw";

export function AuthPage({ initial = "signin", onSkip }: { initial?: Mode; onSkip?: () => void }) {
  const [mode, setMode] = useState<Mode>(initial);
  const [email, setEmail] = useState(""), [pw, setPw] = useState(""), [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false), [err, setErr] = useState<{ field?: "email" | "pw"; text: string } | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setErr(null); if (mode !== "newpw") emailRef.current?.focus(); }, [mode]);

  const afterSignIn = async () => {
    toast("Signed in");
    try { await restoreTeams(); } catch { /* sync shows its own status */ }
    const pending = sessionStorage.getItem("bs-join");
    if (pending) { sessionStorage.removeItem("bs-join"); go("join", pending); return; }
    go(team() ? "track" : "team");
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    if (mode !== "newpw" && !/^\S+@\S+\.\S+$/.test(email.trim())) return setErr({ field: "email", text: "Enter your email address." });
    if ((mode === "signin" || mode === "signup" || mode === "newpw") && pw.length < (mode === "signin" ? 1 : 8)) return setErr({ field: "pw", text: mode === "signin" ? "Enter your password." : "Use at least 8 characters." });
    setBusy(true);
    try {
      if (mode === "signin") { await signIn(email.trim(), pw); await afterSignIn(); }
      else if (mode === "signup") { const r = await signUp(email.trim(), pw); if (r === "confirm-email") setMode("check"); else await afterSignIn(); }
      else if (mode === "forgot") { await sendPasswordReset(email.trim()); setMode("sent"); }
      else if (mode === "newpw") { await updatePassword(pw); toast("Password updated"); go(team() ? "track" : "team"); }
    } catch (e2) {
      const t = errText(e2);
      setErr({ field: /password/i.test(t) ? "pw" : /email/i.test(t) ? "email" : undefined, text: t });
    }
    setBusy(false);
  };

  if (!cloudAvailable()) return <AuthShell><h1 className="auth-title">Accounts aren't set up</h1><p className="auth-sub">This version of Benchboard runs on this device only.</p>{onSkip && <button className="auth-btn" onClick={onSkip}>Continue</button>}</AuthShell>;

  if (mode === "check" || mode === "sent") return <AuthShell>
    <div className="auth-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5l8.5 6.5 8.5-6.5" /></svg></div>
    <h1 className="auth-title">Check your email</h1>
    <p className="auth-sub">{mode === "check" ? <>We sent a confirmation link to <b>{email}</b>. Open it on this device to finish creating your account.</> : <>If <b>{email}</b> has an account, a link to reset your password is on its way.</>}</p>
    <div className="auth-actions">
      <button className="auth-btn" onClick={() => setMode("signin")}>Back to sign in</button>
      {mode === "check" && <button className="auth-link" disabled={busy} onClick={async () => { setBusy(true); try { await resendConfirmation(email); toast("Sent again"); } catch (e) { toast(errText(e)); } setBusy(false); }}>Didn't get it? Send again</button>}
    </div>
  </AuthShell>;

  const title = { signin: "Sign in to Benchboard", signup: "Create your account", forgot: "Reset your password", newpw: "Choose a new password" }[mode];
  const sub = { signin: "Your teams, stats and lineups on every device.", signup: "Free for coaches. Your teams sync across your devices and staff.", forgot: "Enter the email you use for Benchboard and we'll send you a reset link.", newpw: "You're signed in. Set a new password to finish." }[mode];
  const cta = { signin: "Sign in", signup: "Create account", forgot: "Send reset link", newpw: "Save password" }[mode];

  return <AuthShell>
    <h1 className="auth-title">{title}</h1>
    <p className="auth-sub">{sub}</p>
    <form className="auth-form" onSubmit={submit} noValidate>
      {mode !== "newpw" && <div className={"auth-field" + (err?.field === "email" ? " bad" : "")}>
        <label htmlFor="auth-email">Email</label>
        <input id="auth-email" ref={emailRef} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.org" aria-invalid={err?.field === "email"} />
        {err?.field === "email" && <p className="auth-err" role="alert">{err.text}</p>}
      </div>}
      {mode !== "forgot" && <div className={"auth-field" + (err?.field === "pw" ? " bad" : "")}>
        <div className="auth-row"><label htmlFor="auth-pw">{mode === "newpw" ? "New password" : "Password"}</label>
          {mode === "signin" && <button type="button" className="auth-link small" onClick={() => setMode("forgot")}>Forgot password?</button>}</div>
        <div className="auth-pw">
          <input id="auth-pw" type={show ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder={mode === "signin" ? "" : "At least 8 characters"} aria-invalid={err?.field === "pw"} />
          <button type="button" className="auth-eye" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
        </div>
        {err?.field === "pw" && <p className="auth-err" role="alert">{err.text}</p>}
      </div>}
      {err && !err.field && <p className="auth-err box" role="alert">{err.text}</p>}
      <button className="auth-btn" type="submit" disabled={busy} aria-busy={busy}>{busy ? <span className="auth-spin" aria-label="Working" /> : cta}</button>
    </form>
    <div className="auth-foot">
      {mode === "signin" && <p>New to Benchboard? <button className="auth-link" onClick={() => setMode("signup")}>Create an account</button></p>}
      {mode === "signup" && <p>Already have an account? <button className="auth-link" onClick={() => setMode("signin")}>Sign in</button></p>}
      {mode === "forgot" && <p><button className="auth-link" onClick={() => setMode("signin")}>Back to sign in</button></p>}
      {onSkip && (mode === "signin" || mode === "signup") && <p className="auth-skip"><button className="auth-link quiet" onClick={onSkip}>Use without an account</button><span>Everything stays on this device. You can sign in later.</span></p>}
    </div>
  </AuthShell>;
}

/** #/account when signed in. */
export function AccountPage() {
  const u = currentUser()!, t = team();
  return <div className="page" style={{ maxWidth: 720 }}>
    <div className="pagehead"><h1>Account</h1></div>
    <Card>
      <div className="acct">
        <span className="avatar big">{u.email.slice(0, 1).toUpperCase()}</span>
        <div className="grow" style={{ minWidth: 0 }}><b style={{ fontSize: 17 }}>{u.email}</b>
          <p className="small muted">{status.state === "error" ? status.error : status.last ? "Synced " + new Date(status.last).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Signed in"}</p></div>
        <button className="btn" onClick={() => syncNow()}>Sync now</button>
      </div>
    </Card>
    {t && <Card title={t.name}>
      <p className="small">{isLinked(t.id) ? "This team syncs to your account. Invite coaches from the Team tab." : t.sample ? "The sample team stays on this device." : "This team is only on this device."}</p>
      <div className="row" style={{ marginTop: 10 }}>
        {!isLinked(t.id) && !t.sample && <button className="btn sm primary" onClick={() => linkTeam(t.id).then(() => toast("Team synced")).catch((e) => toast(errText(e)))}>Sync this team</button>}
        <button className="btn sm" onClick={() => go("team")}>Team & sharing</button></div>
    </Card>}
    <Card>
      <div className="row between"><div><b>Password</b><p className="small muted">Get a link by email to set a new one.</p></div>
        <button className="btn sm" onClick={async () => { try { await sendPasswordReset(u.email); toast("Reset link sent to " + u.email); } catch (e) { toast(errText(e)); } }}>Send reset link</button></div>
    </Card>
    <Card>
      <div className="row between"><div><b>Sign out</b><p className="small muted">Your teams stay on this device. Changes sync again when you sign back in.</p></div>
        <button className="btn sm" onClick={() => { signOut(); toast("Signed out"); go("track"); }}>Sign out</button></div>
    </Card>
  </div>;
}

/** Sidebar account chip. */
export function AccountChip() {
  const u = currentUser();
  if (!cloudAvailable()) return null;
  return <a className="tab acct-chip wide-only" href="#/account">
    {u ? <span className="avatar">{u.email.slice(0, 1).toUpperCase()}</span> : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></svg>}
    <span>{u ? u.email : "Sign in"}</span>
  </a>;
}

export const skipAccounts = () => setPrefs({ offline: true });
export const wantsAuthGate = () => cloudAvailable() && !currentUser() && !state.prefs.offline;
