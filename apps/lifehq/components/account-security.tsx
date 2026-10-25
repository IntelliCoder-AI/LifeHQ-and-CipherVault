"use client";
import { useState } from "react";
import { Button, Field } from "@lifehq/ui";
import { useWorkspace } from "@/lib/store";
export function AccountSecurity() {
  const { demo, email, pendingEmail, refresh } = useWorkspace();
  const [busy, setBusy] = useState<"password" | "email" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  async function submit(
    event: React.FormEvent<HTMLFormElement>,
    action: "change_password" | "change_email",
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setMessage("");
    setError("");
    if (
      action === "change_password" &&
      fields.get("password") !== fields.get("confirmPassword")
    ) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(action === "change_password" ? "password" : "email");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          currentPassword: fields.get("currentPassword"),
          ...(action === "change_password"
            ? {
                password: fields.get("password"),
                confirmPassword: fields.get("confirmPassword"),
              }
            : { email: fields.get("email") }),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || "Account details could not be updated.",
        );
      form.reset();
      setMessage(result.message);
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to reach the server. Please retry.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="paper-panel account-security">
      <span className="eyebrow">SIGN-IN & SECURITY</span>
      <h2>Your account</h2>
      {demo ? (
        <p className="settings-copy">
          Email and password changes are available after you sign in to an
          account. The local demo has no account credentials.
        </p>
      ) : (
        <>
          <p className="settings-copy">
            Signed in as {email}. Your workspace and profile stay with this
            account when your email changes.
          </p>
          {pendingEmail && (
            <p className="notice" role="status">
              Email change pending: {pendingEmail}. Follow the confirmation
              instructions in your inboxes.
            </p>
          )}
          <form
            onSubmit={(e) => void submit(e, "change_password")}
            className="form-stack"
          >
            <h3>Change password</h3>
            <Field label="Current password">
              <input
                name="currentPassword"
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </Field>
            <Field label="New password" hint="At least 12 characters.">
              <input
                name="password"
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </Field>
            <Field label="Confirm new password">
              <input
                name="confirmPassword"
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </Field>
            <label className="check-label">
              <input
                type="checkbox"
                checked={visible}
                onChange={(e) => setVisible(e.target.checked)}
              />
              Show passwords
            </label>
            <Button type="submit" variant="secondary" disabled={Boolean(busy)}>
              {busy === "password" ? "Updating…" : "Update password"}
            </Button>
          </form>
          <form
            onSubmit={(e) => void submit(e, "change_email")}
            className="form-stack"
          >
            <h3>Change email address</h3>
            <Field label="New email address">
              <input name="email" type="email" autoComplete="email" required />
            </Field>
            <Field label="Current password to change email">
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </Field>
            <p className="subtle">
              Check both inboxes for confirmation instructions. Your sign-in
              address stays unchanged until the change is confirmed.
            </p>
            <Button type="submit" variant="secondary" disabled={Boolean(busy)}>
              {busy === "email" ? "Sending…" : "Change email"}
            </Button>
          </form>
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
