import { z } from "zod";
import { supabase } from "@/lib/supabase";
import {
  body,
  failure,
  InputError,
  json,
  originAllowed,
  appOrigin,
} from "@/lib/api";
export async function POST(request: Request) {
  if (!originAllowed(request))
    return json({ error: "Request origin rejected" }, 403);
  try {
    const input = z
      .object({
        action: z.enum([
          "login",
          "signup",
          "logout",
          "reset",
          "resend",
          "update",
          "change_password",
          "change_email",
          "delete",
        ]),
        email: z.email().max(254).optional(),
        password: z
          .string()
          .min(12, "Use at least 12 characters")
          .max(128)
          .optional(),
        name: z.string().max(80).optional(),
        confirmation: z.string().max(80).optional(),
        confirmPassword: z.string().max(128).optional(),
        currentPassword: z.string().min(1).max(128).optional(),
      })
      .strict()
      .parse(await body(request));
    if (
      ["signup", "update", "change_password"].includes(input.action) &&
      input.password !== input.confirmPassword
    )
      return json({ error: "Passwords do not match." }, 400);
    const db = await supabase();
    const origin = appOrigin(request);
    if (input.action === "logout") {
      const { error } = await db.auth.signOut();
      if (error) throw error;
      return json({ ok: true });
    }
    if (input.action === "resend") {
      if (!input.email) throw new InputError("Enter your email");
      const { error } = await db.auth.resend({
        type: "signup",
        email: input.email,
        options: { emailRedirectTo: `${origin}/auth/callback` },
      });
      if (error && error.status === 429)
        return json(
          {
            error: "Please wait before requesting another confirmation email.",
          },
          429,
        );
      if (error && error.status && error.status >= 500)
        throw new InputError(
          "Email delivery is temporarily unavailable. Please try again.",
        );
      return json({
        message:
          "If that address needs confirmation, a new email is on its way. Use the newest link.",
      });
    }
    if (input.action === "reset") {
      if (!input.email) throw new InputError("Enter your email");
      const { error } = await db.auth.resetPasswordForEmail(input.email, {
        redirectTo: `${origin}/auth/callback?next=/reset`,
      });
      if (error && error.code !== "user_not_found") throw error;
      return json({
        message:
          "If that address has an account, a recovery email is on its way.",
      });
    }
    if (input.action === "change_password" || input.action === "change_email") {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user?.email)
        return json(
          { error: "Sign in again before changing account details." },
          401,
        );
      if (!input.currentPassword)
        throw new InputError("Enter your current password.");
      if (input.action === "change_password") {
        if (!input.password) throw new InputError("Enter a new password.");
        const { error: reauth } = await db.auth.signInWithPassword({
          email: user.email,
          password: input.currentPassword,
        });
        if (reauth)
          return json(
            { error: "Your current password was not accepted." },
            400,
          );
        const { error } = await db.auth.updateUser({
          password: input.password,
          current_password: input.currentPassword,
        });
        if (error) throw error;
        return json({
          ok: true,
          message:
            "Password updated. Use your new password the next time you sign in.",
        });
      }
      if (!input.email) throw new InputError("Enter your new email address.");
      if (input.email.toLowerCase() === user.email.toLowerCase())
        throw new InputError("Enter a different email address.");
      const { error: reauth } = await db.auth.signInWithPassword({
        email: user.email,
        password: input.currentPassword,
      });
      if (reauth)
        return json({ error: "Your current password was not accepted." }, 400);
      const { data, error } = await db.auth.updateUser(
        { email: input.email },
        { emailRedirectTo: `${origin}/auth/callback` },
      );
      if (error) throw error;
      return json({
        ok: true,
        message:
          data.user?.email?.toLowerCase() === input.email.toLowerCase()
            ? "Email address updated."
            : "Check your current and new inboxes for Supabase’s confirmation instructions. Your sign-in email stays unchanged until confirmation is complete.",
      });
    }
    if (input.action === "update") {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user)
        return json({ error: "Sign in using your recovery email first" }, 401);
      const { data: verified, error: claimsError } = await db.auth.getClaims();
      const now = Math.floor(Date.now() / 1000);
      const recovery =
        !claimsError &&
        verified?.claims.sub === user.id &&
        verified.claims.amr?.some((entry) => {
          const method = typeof entry === "string" ? entry : entry.method;
          const timestamp =
            typeof entry === "string" ? verified.claims.iat : entry.timestamp;
          return (
            method === "recovery" &&
            typeof timestamp === "number" &&
            timestamp <= now + 60 &&
            timestamp >= now - 3600
          );
        });
      if (!recovery)
        return json(
          {
            error:
              "Open a fresh password-reset email link before choosing a new password.",
          },
          403,
        );
      if (!input.password) throw new InputError("Enter a new password");
      const { error } = await db.auth.updateUser({ password: input.password });
      if (error) throw error;
      return json({ ok: true });
    }
    if (input.action === "delete") {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) return json({ error: "Sign in again" }, 401);
      if (input.confirmation !== "DELETE MY ACCOUNT" || !input.password)
        throw new InputError("Confirm deletion and enter your password");
      const { error: reauth } = await db.auth.signInWithPassword({
        email: user.email!,
        password: input.password,
      });
      if (reauth)
        return json(
          {
            error:
              "Your password was not accepted. Try again before deleting your account.",
          },
          400,
        );
      const { error } = await db.rpc("delete_own_account");
      if (error) throw error;
      await db.auth.signOut({ scope: "local" });
      return json({ ok: true });
    }
    if (!input.email || !input.password)
      throw new InputError("Enter your email and password");
    if (input.action === "signup") {
      const { data, error } = await db.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: { display_name: input.name || "Friend" },
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });
      if (error && error.code !== "user_already_exists") throw error;
      return json({
        ok: true,
        confirm: !data?.session,
        message: "Check your inbox to confirm your account.",
      });
    }
    const { error } = await db.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (error) {
      if (error.code === "invalid_credentials")
        return json(
          {
            error:
              "Email or password is incorrect. Check your details or reset your password. If you deleted your account, create a new one.",
          },
          400,
        );
      if (error.code === "email_not_confirmed")
        return json(
          {
            error:
              "Confirm your email before signing in. You can request a new confirmation email below.",
          },
          400,
        );
      throw error;
    }
    return json({ ok: true });
  } catch (error) {
    const authError = error as { code?: string; status?: number };
    const feedback: Record<string, string> = {
      weak_password: "Choose a stronger password with at least 12 characters.",
      same_password: "Choose a password different from your current password.",
      email_address_invalid: "Enter a valid email address.",
      email_address_not_authorized:
        "Email delivery is unavailable for this address. Try again later.",
      session_not_found: "Your session ended. Please sign in again.",
    };
    if (authError.code && feedback[authError.code])
      return json({ error: feedback[authError.code] }, 400);
    if (authError.code === "over_email_send_rate_limit")
      return json(
        {
          error:
            "The email sending limit has been reached. Please wait before requesting another email. This does not mean your account or password is invalid.",
        },
        429,
      );
    if (authError.status === 429)
      return json(
        { error: "Too many requests. Please wait before trying again." },
        429,
      );
    if (
      authError.code === "reauthentication_needed" ||
      authError.code === "reauthentication_not_valid"
    )
      return json(
        {
          error:
            "For your security, sign out and sign in again before changing your password.",
        },
        400,
      );
    return failure(error);
  }
}
