import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/api";
import { supabase } from "@/lib/supabase";
export async function GET(request: Request) {
  const url = new URL(request.url),
    code = url.searchParams.get("code");
  const next =
    url.searchParams.get("next") === "/reset" ? "/reset" : "/workspace";
  if (code) {
    const db = await supabase();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) {
      const destination = new URL(next, appOrigin(request));
      if (next === "/workspace")
        destination.searchParams.set("notice", "email-confirmed");
      return NextResponse.redirect(destination);
    }
    const destination = new URL("/login", appOrigin(request));
    destination.searchParams.set(
      "error",
      "This email link could not complete sign-in in this browser. Try signing in with your password, or request a fresh confirmation or recovery email.",
    );
    return NextResponse.redirect(destination);
  }
  return NextResponse.redirect(
    new URL(
      "/login?error=Confirmation%20link%20expired.%20Request%20a%20new%20one.",
      appOrigin(request),
    ),
  );
}
