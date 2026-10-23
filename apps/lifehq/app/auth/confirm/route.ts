import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/api";
import { supabase } from "@/lib/supabase";
export async function GET(request: Request) {
  const url = new URL(request.url),
    token_hash = url.searchParams.get("token_hash"),
    type = url.searchParams.get("type");
  if (
    token_hash &&
    (type === "signup" || type === "recovery" || type === "email")
  ) {
    const db = await supabase();
    const { error } = await db.auth.verifyOtp({ token_hash, type });
    if (!error)
      return NextResponse.redirect(
        new URL(
          type === "recovery" ? "/reset" : "/workspace",
          appOrigin(request),
        ),
      );
  }
  return NextResponse.redirect(
    new URL(
      "/login?error=This%20link%20is%20invalid%20or%20expired.",
      appOrigin(request),
    ),
  );
}
