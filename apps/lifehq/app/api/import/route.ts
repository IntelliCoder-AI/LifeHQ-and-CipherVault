import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { failure, json, originAllowed } from "@/lib/api";
import { IMPORT_BYTES, prepareImport } from "@lifehq/shared/import";
async function readLimited(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Choose a LifeHQ JSON export.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > IMPORT_BYTES) {
      await reader.cancel();
      throw new Error("Choose a JSON file smaller than 5 MB.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
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
      .parse(await readLimited(request));
    const prepared = prepareImport(
      input.backup,
      user.id,
      input.includePreferences,
    );
    if (!prepared.count && !prepared.preferences)
      throw new Error(
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
