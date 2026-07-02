import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

type SignInMode = "magic" | "password";

export default function Auth({ session }: { session: Session | null }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<SignInMode>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set-password form state (shown when already signed in)
  const [newPw, setNewPw] = useState("");
  const [newPwConfirm, setNewPwConfirm] = useState("");
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  // ── Already signed in ─────────────────────────────────────────────────────
  if (session) {
    async function savePassword() {
      if (newPw !== newPwConfirm) { setPwError("Passwords don't match."); return; }
      if (newPw.length < 6) { setPwError("Use at least 6 characters."); return; }
      setPwLoading(true);
      setPwError(null);
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) setPwError(error.message);
      else { setPwSaved(true); setNewPw(""); setNewPwConfirm(""); }
      setPwLoading(false);
    }

    return (
      <section className="pp-card pp-form">
        <p className="pp-auth-title">Account</p>
        <p className="pp-muted">{session.user.email}</p>

        <div className="pp-auth-divider" />

        <p className="pp-auth-subtitle">Set a password</p>
        <p className="pp-muted">Once set, you can sign in with email + password — no magic link needed.</p>

        {pwSaved ? (
          <p className="pp-auth-success">Password saved. You're all set.</p>
        ) : (
          <>
            <input
              className="pp-inline-input"
              type="password"
              placeholder="New password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
            <input
              className="pp-inline-input"
              type="password"
              placeholder="Confirm password"
              value={newPwConfirm}
              onChange={(e) => setNewPwConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !pwLoading && savePassword()}
            />
            {pwError && <p className="pp-inline-error">{pwError}</p>}
            <button
              className="pp-btn-primary"
              onClick={savePassword}
              disabled={!newPw || !newPwConfirm || pwLoading}
            >
              {pwLoading ? "Saving…" : "Save password"}
            </button>
          </>
        )}

        <Link className="pp-link" to="/" style={{ textAlign: "center" }}>
          ← Back to app
        </Link>
      </section>
    );
  }

  // ── Magic link form ───────────────────────────────────────────────────────
  if (mode === "magic") {
    if (sent) {
      return (
        <section className="pp-card pp-form">
          <p className="pp-auth-title">Check your email</p>
          <p className="pp-muted">
            Sent a sign-in link to <strong>{email}</strong>. Click it to
            continue — you can close this tab.
          </p>
          <button className="pp-link" onClick={() => { setSent(false); setMode("password"); }}>
            I have a password — sign in instead
          </button>
        </section>
      );
    }

    async function sendMagicLink() {
      setLoading(true);
      setError(null);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) setError(error.message);
      else setSent(true);
      setLoading(false);
    }

    return (
      <section className="pp-card pp-form">
        <p className="pp-auth-title">Sign in</p>
        <p className="pp-muted">Enter your email and we'll send you a sign-in link.</p>
        <input
          className="pp-inline-input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && email && sendMagicLink()}
          autoFocus
        />
        {error && <p className="pp-inline-error">{error}</p>}
        <button
          className="pp-btn-primary"
          onClick={sendMagicLink}
          disabled={!email || loading}
        >
          {loading ? "Sending…" : "Send sign-in link"}
        </button>
        <button className="pp-link" onClick={() => { setError(null); setMode("password"); }}>
          I have a password →
        </button>
      </section>
    );
  }

  // ── Password form ─────────────────────────────────────────────────────────
  async function signInWithPassword() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else navigate("/");
    setLoading(false);
  }

  return (
    <section className="pp-card pp-form">
      <p className="pp-auth-title">Sign in</p>
      <input
        className="pp-inline-input"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoFocus
      />
      <input
        className="pp-inline-input"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !loading && email && password && signInWithPassword()}
      />
      {error && <p className="pp-inline-error">{error}</p>}
      <button
        className="pp-btn-primary"
        onClick={signInWithPassword}
        disabled={!email || !password || loading}
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <button className="pp-link" onClick={() => { setError(null); setPassword(""); setMode("magic"); }}>
        ← Send me a magic link instead
      </button>
    </section>
  );
}
