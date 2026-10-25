"use client";
import { ThemeToggle } from "@lifehq/ui/theme";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Layers3,
  Command,
  Check,
  Leaf,
} from "lucide-react";
import { Button, Field } from "@lifehq/ui";
export function AuthScreen({
  configured,
  reset = false,
}: {
  configured: boolean;
  reset?: boolean;
}) {
  const [mode, setMode] = useState(reset ? "update" : "login"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [showPasswords, setShowPasswords] = useState(false);
  const router = useRouter(),
    params = useSearchParams();
  useEffect(() => {
    const errorCode = new URLSearchParams(location.hash.slice(1)).get(
      "error_code",
    );
    if (errorCode === "otp_expired" || errorCode === "access_denied") {
      setError(
        "This email link has expired or was already used. Request a new confirmation email or password reset link below.",
      );
      history.replaceState(
        history.state,
        "",
        location.pathname + location.search,
      );
    }
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    const fd = new FormData(e.currentTarget);
    if (
      (mode === "signup" || mode === "update") &&
      fd.get("password") !== fd.get("confirmPassword")
    ) {
      setError(
        "Passwords do not match. Please enter the same password in both fields.",
      );
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          email: fd.get("email") || undefined,
          password: fd.get("password") || undefined,
          confirmPassword: fd.get("confirmPassword") || undefined,
          name: fd.get("name") || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      if (mode === "reset" || mode === "resend" || result.confirm)
        setMessage(result.message);
      else {
        router.replace("/workspace");
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to connect. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="auth-page">
      <section className="auth-story">
        <Link href="/login" className="brand">
          <span className="brand-mark">
            <Layers3 size={21} />
          </span>
          LifeHQ<span className="brand-period">.</span>
        </Link>
        <div className="auth-editorial">
          <span className="eyebrow">
            A little clarity. A little room to grow.
          </span>
          <h1>
            Your life,
            <br /> thoughtfully
            <br /> <em>put together.</em>
          </h1>
          <p>
            A quiet space for the things that matter.
            <br /> Make room for your days, ideas, and ambitions.
          </p>
          <div className="atelier-illustration" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="illustration-card">
              <span className="eyebrow">A day with intention</span>
              <div className="row">
                <Check size={16} />
                <span>One meaningful thing.</span>
              </div>
              <div className="sketch-lines" />
              <Leaf size={30} />
            </div>
            <div className="small-orbit" />
          </div>
        </div>
        <div className="auth-footer">
          <span>THE MODERN PERSONAL ATELIER</span>
          <span>01 — LIFE, IN FOCUS</span>
        </div>
      </section>
      <section className="auth-form-section">
        <div className="auth-theme-toggle">
          <ThemeToggle />
        </div>
        <div className="auth-form">
          <span className="eyebrow">YOUR PERSONAL COMMAND CENTER</span>
          <h2>
            {mode === "signup"
              ? "Make yourself at home."
              : mode === "resend"
                ? "Confirm your email."
                : mode === "reset"
                  ? "A fresh start."
                  : mode === "update"
                    ? "Choose a new password."
                    : "Welcome back."}
          </h2>
          <p className="muted">
            {mode === "signup"
              ? "Create your own space for a more intentional day."
              : mode === "resend"
                ? "Request a fresh confirmation link for your account."
                : mode === "reset"
                  ? "We’ll email you a link to reset your password."
                  : "Pick up where you left off. Your space is waiting."}
          </p>
          {!configured && (
            <div className="warning">
              Account access needs Supabase configuration. You can explore the
              local demo below.
            </div>
          )}
          <form onSubmit={submit} className="form-stack">
            {mode === "signup" && (
              <Field label="Your name">
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={80}
                  placeholder="How should we call you?"
                />
              </Field>
            )}
            {mode !== "update" && (
              <Field label="Email address">
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                />
              </Field>
            )}
            {mode !== "reset" && mode !== "resend" && (
              <Field
                label={mode === "update" ? "New password" : "Password"}
                hint="At least 12 characters."
              >
                <input
                  name="password"
                  type={showPasswords ? "text" : "password"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                  minLength={12}
                  maxLength={128}
                />
              </Field>
            )}
            {(mode === "signup" || mode === "update") && (
              <Field label="Confirm password">
                <input
                  name="confirmPassword"
                  type={showPasswords ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                />
              </Field>
            )}
            {mode !== "reset" && mode !== "resend" && (
              <label className="check-label password-visibility">
                <input
                  type="checkbox"
                  checked={showPasswords}
                  onChange={(e) => setShowPasswords(e.target.checked)}
                />
                {mode === "signup" || mode === "update"
                  ? "Show passwords"
                  : "Show password"}
              </label>
            )}
            {(error || params.get("error")) && (
              <p className="error" role="alert">
                {error || params.get("error")}
              </p>
            )}
            {params.get("notice") === "account-deleted" && (
              <p className="notice" role="status">
                Account deleted. Your LifeHQ profile and workspace records have
                been permanently erased. Create a new account if you want to
                start again.
              </p>
            )}
            {message && (
              <p className="notice" role="status">
                {message}
              </p>
            )}
            <Button type="submit" disabled={busy || !configured}>
              {busy
                ? mode === "signup"
                  ? "Creating your account…"
                  : mode === "login"
                    ? "Signing in…"
                    : "Saving…"
                : mode === "signup"
                  ? "Create account"
                  : mode === "resend"
                    ? "Send confirmation email"
                    : mode === "reset"
                      ? "Send reset link"
                      : mode === "update"
                        ? "Save password"
                        : "Sign in"}
              <ArrowRight size={17} />
            </Button>
          </form>
          <div className="auth-switch">
            {mode === "login" ? (
              <>
                <button
                  onClick={() => {
                    setMode("reset");
                    setError("");
                  }}
                >
                  Forgot password?
                </button>
                <button
                  onClick={() => {
                    setMode("resend");
                    setError("");
                    setMessage("");
                  }}
                >
                  Resend confirmation email
                </button>
                <button
                  onClick={() => {
                    setMode("signup");
                    setError("");
                  }}
                >
                  Create an account <ArrowUpRight size={14} />
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Back to sign in
              </button>
            )}
          </div>
          <div className="demo-link">
            <Command size={18} />
            <div>
              <strong>A look around, without an account.</strong>
              <p>Try a local demo. Sample data is clearly labeled.</p>
            </div>
            <Link href="/demo" aria-label="Explore demo">
              <ArrowUpRight size={20} />
            </Link>
          </div>
          <p className="auth-privacy">
            Your own workspace. No ads. No AI required.
          </p>
        </div>
      </section>
    </main>
  );
}
