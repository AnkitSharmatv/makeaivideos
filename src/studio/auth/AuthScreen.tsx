"use client";

import { useState } from "react";
import { APP_NAME } from "@/config";
import { setupAccount, signIn, signUp } from "@/auth/actions";
import type { AuthState } from "@/auth/actions";

type Props = { auth: AuthState; onSignedIn: () => void };

/** First run creates the admin account; afterwards it's a sign-in form (sign-up only if the instance allows it). */
export function AuthScreen({ auth, onSignedIn }: Props) {
  const [mode, setMode] = useState<"setup" | "signin" | "signup">(auth.needsSetup ? "setup" : "signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = mode === "setup" ? await setupAccount(email, name, password) : mode === "signup" ? await signUp(email, name, password) : await signIn(email, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.reason);
      return;
    }
    onSignedIn();
  };

  return (
    <div className="auth">
      <form
        className="auth-card"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <span className="wordmark">{APP_NAME}</span>
        <h1 className="auth-title">{mode === "setup" ? "Create your account" : mode === "signup" ? "Create an account" : "Sign in"}</h1>
        <p className="auth-sub">
          {mode === "setup"
            ? "This is the first run on this computer. Your account, your provider keys and every project stay in this app's own data folder — nothing leaves the machine."
            : "Your keys and projects are stored locally in this app's data folder."}
        </p>

        {mode !== "signin" ? (
          <label className="field">
            <span className="label">Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Your name" />
          </label>
        ) : null}
        <label className="field">
          <span className="label">Email</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus placeholder="you@example.com" />
        </label>
        <label className="field">
          <span className="label">Password</span>
          <span className="key-input-row">
            <input
              className="input"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={mode === "signin" ? undefined : 8}
              placeholder={mode === "signin" ? "" : "At least 8 characters"}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShow((s) => !s)} aria-pressed={show}>
              {show ? "Hide" : "Show"}
            </button>
          </span>
        </label>
        {error ? (
          <span className="help is-error" role="alert">
            {error}
          </span>
        ) : null}
        <button type="submit" className={`btn btn-primary btn-lg${busy ? " is-loading" : ""}`} disabled={busy}>
          <span>{mode === "setup" ? "Create account" : mode === "signup" ? "Sign up" : "Sign in"}</span>
        </button>
        {mode === "signin" && auth.signupOpen ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode("signup")}>
            Need an account? Sign up
          </button>
        ) : null}
        {mode === "signin" ? (
          <p className="auth-foot">
            {auth.signupOpen ? "" : "Sign-up is closed on this instance (set ALLOW_SIGNUP=true to open it). "}
            Forgot the password? Run <code>pnpm reset-password you@example.com</code> in the app folder.
          </p>
        ) : null}
        {mode === "signup" ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode("signin")}>
            Have an account? Sign in
          </button>
        ) : null}
      </form>
    </div>
  );
}
