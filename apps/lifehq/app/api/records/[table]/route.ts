import { z } from "zod";
import { schemas, tables, type Table } from "@lifehq/shared";
import { supabase } from "@/lib/supabase";
import { body, failure, json, originAllowed } from "@/lib/api";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ table: string }> },
) {
  if (!originAllowed(request))
    return json({ error: "Request origin rejected" }, 403);
  try {
    const { table } = await params;
    if (!tables.includes(table as Table))
      return json({ error: "Unknown record type" }, 404);
    const db = await supabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return json({ error: "Please sign in again." }, 401);
    const input = z
      .object({
        action: z.enum(["save", "delete", "bulk"]),
        id: z.uuid().optional(),
        version: z.number().int().positive().optional(),
        values: z.unknown().optional(),
        ids: z.array(z.uuid()).min(1).max(100).optional(),
        status: z.enum(["todo", "doing", "done"]).optional(),
      })
      .strict()
      .parse(await body(request));
    if (input.action === "bulk") {
      if (table !== "tasks" || !input.ids || !input.status)
        throw new Error("Invalid bulk action");
      const { error } = await db
        .from("tasks")
        .update({
          status: input.status,
          completed_at:
            input.status === "done" ? new Date().toISOString() : null,
        })
        .in("id", input.ids)
        .eq("user_id", user.id);
      if (error) throw error;
      return json({ ok: true });
    }
    if (input.action === "delete") {
      if (!input.id || !input.version)
        throw new Error("Missing record version");
      const { data, error } = await db
        .from(table)
        .delete()
        .eq("id", input.id)
        .eq("user_id", user.id)
        .eq("version", input.version)
        .select("id");
      if (error) throw error;
      if (!data.length)
        return json(
          { error: "This record changed. Refresh before deleting." },
          409,
        );
      return json({ ok: true });
    }
    const values = schemas[table as Table].parse(input.values);
    if (table === "tasks" || table === "task_occurrences") {
      const v = values as { status: string; completed_at: string | null };
      v.completed_at =
        v.status === "done" ? v.completed_at || new Date().toISOString() : null;
    }
    if (input.id && !input.version) throw new Error("Missing record version");
    const query = input.id
      ? db
          .from(table)
          .update(values)
          .eq("id", input.id)
          .eq("user_id", user.id)
          .eq("version", input.version!)
      : db.from(table).insert({ ...values, user_id: user.id });
    const { data, error } = await query.select().maybeSingle();
    if (error)
      throw new Error(
        error.code === "23503"
          ? "The linked record is unavailable. Choose a record from your workspace."
          : error.code === "23505"
            ? "This entry already exists. Refresh your workspace."
            : "Could not save this record. Check the values and retry.",
      );
    if (!data)
      return json(
        {
          error:
            "This record changed in another window. Refresh, then try again.",
        },
        409,
      );
    return json({ record: data });
  } catch (error) {
    return failure(error);
  }
}
