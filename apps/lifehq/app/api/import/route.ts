import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { body, failure, InputError, json, originAllowed } from "@/lib/api";
import { IMPORT_BYTES, prepareImport } from "@lifehq/shared/import";
export async function POST(request: Request) {
  if (!originAllowed(request))
    return json({ error: "Request origin rejected" }, 403);
  try {
    const db = await supabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return json({ error: "Please sign in again." }, 401);
    const input = z
      .object({
        backup: z.unknown(),
        includePreferences: z.boolean().default(false),
      })
      .strict()
      .parse(await body(request, IMPORT_BYTES));
    const prepared = prepareImport(
      input.backup,
      user.id,
      input.includePreferences,
    );
    if (!prepared.count && !prepared.preferences)
      throw new InputError(
        "There are no records or selected preferences to import.",
      );
    const { data, error } = await db.rpc("import_workspace", {
      payload: { data: prepared.data, preferences: prepared.preferences },
    });
    if (error)
      return json(
        {
          error:
            "The import could not be saved. Check record dates and relationships. Your existing workspace is unchanged.",
        },
        400,
      );
    return json({ imported: data.imported });
  } catch (error) {
    return failure(error);
  }
}
