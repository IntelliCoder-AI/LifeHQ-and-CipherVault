import { supabase } from "@/lib/supabase";
import { body, failure, json, originAllowed } from "@/lib/api";
import { defaults, preferencesSchema, tables } from "@lifehq/shared";
export async function GET() {
  try {
    const db = await supabase();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();
    if (authError || !user)
      return json({ error: "Please sign in again." }, 401);
    const profileRequest = db
      .from("profiles")
      .select("preferences")
      .eq("user_id", user.id)
      .maybeSingle();
    const [results, { data: profile, error }] = await Promise.all([
      Promise.all(
        tables.map(async (table) => {
          const rows: unknown[] = [];
          let offset = 0;
          while (true) {
            const { data, error } = await db
              .from(table)
              .select("*")
              .order("id")
              .range(offset, offset + 499);
            if (error)
              throw new Error(`Could not load ${table}. Please retry.`);
            rows.push(...data);
            if (data.length < 500) break;
            offset += 500;
          }
          return [table, rows];
        }),
      ),
      profileRequest,
    ]);
    if (error) throw error;
    return json({
      data: Object.fromEntries(results),
      preferences: preferencesSchema.parse({
        ...defaults,
        name: user.user_metadata.display_name || "Friend",
        ...profile?.preferences,
      }),
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: Request) {
  if (!originAllowed(request))
    return json({ error: "Request origin rejected" }, 403);
  try {
    const db = await supabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return json({ error: "Sign in again" }, 401);
    const preferences = preferencesSchema.parse(await body(request));
    const { error } = await db.from("profiles").upsert({
      user_id: user.id,
      preferences,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return json({ preferences });
  } catch (error) {
    return failure(error);
  }
}
