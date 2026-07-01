import { useState } from "react";
import { Link } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export default function Auth({ session }: { session: Session | null }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) {
    return (
      <section className="pp-card pp-form">
        <p className="pp-auth-title">You're signed in</p>
        <p className="pp-muted">{session.user.email}</p>
        <Link className="pp-btn pp-btn-primary" to="/" style={{ textAlign: "center", textDecoration: "none" }}>
          Go to scoreboard
        </Link>
      </section>
    );
  }

  if (sent) {
    return (
      <section className="pp-card pp-form">
        <p className="pp-auth-title">Check your email</p>
        <p className="pp-muted">
          We sent a sign-in link to <strong>{email}</strong>. Click it to
          continue — you can close this tab.
        </p>
      </section>
    );
  }

  async function send() {
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
      <p className="pp-muted">
        Enter your email and we'll send you a sign-in link. No password needed.
      </p>
      <input
        className="pp-inline-input"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !loading && email && send()}
        autoFocus
      />
      {error && <p className="pp-inline-error">{error}</p>}
      <button
        className="pp-btn-primary"
        onClick={send}
        disabled={!email || loading}
      >
        {loading ? "Sending…" : "Send sign-in link"}
      </button>
    </section>
  );
}
