import { z } from "zod";
import { appOrigin, body, failure, json, originAllowed } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!originAllowed(request))
    return json({ error: "Request origin rejected" }, 403);
  try {
    const input = z
      .object({
        token_hash: z.string().regex(/^[a-f0-9]{40,128}$/i),
        type: z.enum(["signup", "recovery", "email"]),
      })
      .strict()
      .parse(await body(request, 2048));
    const db = await supabase();
    const { error } = await db.auth.verifyOtp(input);
    if (error)
      return json(
        { error: "This link is invalid or expired. Request a fresh email." },
        400,
      );
    return json({
      destination: new URL(
        input.type === "recovery"
          ? "/reset"
          : "/workspace?notice=email-confirmed",
        appOrigin(request),
      ).href,
    });
  } catch (error) {
    return failure(error);
  }
}
