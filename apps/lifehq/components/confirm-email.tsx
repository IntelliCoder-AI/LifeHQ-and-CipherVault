"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@lifehq/ui";
import { ThemeToggle } from "@lifehq/ui/theme";

export function ConfirmEmail({
  tokenHash,
  type,
}: {
  tokenHash: string;
  type: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    history.replaceState(history.state, "", location.pathname);
  }, []);
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_hash: tokenHash, type }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      location.assign(result.destination);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to confirm. Try again.",
      );
      setBusy(false);
    }
  }
  return (
    <main id="main" className="auth-page">
      <section className="auth-story">
        <Link href="/login" className="brand">
          LifeHQ.
        </Link>
        <h1>A space of your own.</h1>
        <p>
          Continue only if you requested this email for your own LifeHQ account.
        </p>
      </section>
      <section className="auth-form-section">
        <ThemeToggle />
        <div className="auth-form">
          <span className="eyebrow">YOUR ACCOUNT</span>
          <h2>
            {type === "recovery"
              ? "Reset your password."
              : "Confirm your email."}
          </h2>
          <p className="muted">
            Select continue to use your email link. Opening this page alone does
            not sign you in.
          </p>
          <Button onClick={confirm} disabled={busy || !tokenHash}>
            {busy ? "Confirming…" : "Continue"}
          </Button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <p>
            <Link href="/login">Back to sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
