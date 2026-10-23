import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { body, failure, json, originAllowed } from "@/lib/api";
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
          "update",
          "delete",
        ]),
        email: z.email().optional(),
        password: z
          .string()
          .min(12, "Use at least 12 characters")
          .max(128)
          .optional(),
        name: z.string().max(80).optional(),
        confirmation: z.string().optional(),
      })
      .parse(await body(request));
    const db = await supabase();
    const origin = request.headers.get("origin")!;
    if (input.action === "logout") {
      const { error } = await db.auth.signOut();
      if (error) throw error;
      return json({ ok: true });
    }
    if (input.action === "reset") {
      if (!input.email) throw new Error("Enter your email");
      const { error } = await db.auth.resetPasswordForEmail(input.email, {
        redirectTo: `${origin}/auth/callback?next=/reset`,
      });
      if (error) throw error;
      return json({
        message:
          "If that address has an account, a recovery email is on its way.",
      });
    }
    if (input.action === "update") {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user)
        return json({ error: "Sign in using your recovery email first" }, 401);
      if (!input.password) throw new Error("Enter a new password");
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
        throw new Error("Confirm deletion and enter your password");
      const { error: reauth } = await db.auth.signInWithPassword({
        email: user.email!,
        password: input.password,
      });
      if (reauth) throw reauth;
      const { error } = await db.rpc("delete_own_account");
      if (error) throw error;
      await db.auth.signOut({ scope: "local" });
      return json({ ok: true });
    }
    if (!input.email || !input.password)
      throw new Error("Enter your email and password");
    if (input.action === "signup") {
      const { data, error } = await db.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: { display_name: input.name || "Friend" },
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });
      if (error) throw error;
      return json({
        ok: true,
        confirm: !data.session,
        message: "Check your inbox to confirm your account.",
      });
    }
    const { error } = await db.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (error) throw error;
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
