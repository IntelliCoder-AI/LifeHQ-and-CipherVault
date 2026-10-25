import { z } from "zod";
import {
  cleanValues,
  emptyData,
  preferencesSchema,
  tables,
  type Data,
  type Row,
  type Table,
  type Preferences,
} from "./index";
export const IMPORT_LIMIT = 2000;
export const IMPORT_BYTES = 4 * 1024 * 1024;
export const importOrder: Table[] = [
  "projects",
  "habits",
  "goals",
  "tasks",
  "events",
  "notes",
  "milestones",
  "habit_entries",
  "goal_entries",
  "task_occurrences",
  "event_occurrences",
  "reviews",
];
const references: Partial<Record<Table, Record<string, Table>>> = {
  tasks: { project_id: "projects", parent_id: "tasks" },
  goals: { project_id: "projects", habit_id: "habits" },
  notes: { project_id: "projects" },
  milestones: { goal_id: "goals", project_id: "projects" },
  habit_entries: { habit_id: "habits" },
  goal_entries: { goal_id: "goals" },
  task_occurrences: { task_id: "tasks" },
  event_occurrences: { event_id: "events" },
};
const envelope = z
  .object({
    format: z.literal("lifehq"),
    version: z.literal(1),
    exported_at: z.string().optional(),
    preferences: z.unknown().optional(),
    data: z.record(z.string(), z.array(z.unknown()).max(IMPORT_LIMIT)),
  })
  .strict();
export function inspectBackup(input: unknown) {
  const backup = envelope.parse(input);
  if (Object.keys(backup.data).some((key) => !tables.includes(key as Table)))
    throw new Error("The backup contains an unknown record type.");
  const count = Object.values(backup.data).reduce(
    (sum, rows) => sum + rows.length,
    0,
  );
  if (count > IMPORT_LIMIT)
    throw new Error(`Import at most ${IMPORT_LIMIT} records at a time.`);
  const data = emptyData();
  for (const table of tables) {
    const seen = new Set<string>();
    for (const item of backup.data[table] || []) {
      const raw = z.record(z.string(), z.unknown()).parse(item);
      const id = z.uuid().parse(raw.id);
      if (seen.has(id))
        throw new Error(`The backup contains duplicate ${table} IDs.`);
      seen.add(id);
      if (
        typeof raw.completed_at === "string" &&
        z.iso.datetime({ offset: true }).safeParse(raw.completed_at).success
      )
        raw.completed_at = new Date(raw.completed_at).toISOString();
      const values = cleanValues(table, raw as unknown as Row<typeof table>);
      (data[table] as Row<Table>[]).push({ ...values, id } as Row<Table>);
    }
  }
  for (const table of tables)
    for (const row of data[table])
      for (const [field, target] of Object.entries(references[table] || {})) {
        const id = (row as unknown as Record<string, unknown>)[field];
        if (id && !data[target].some((record) => record.id === id))
          throw new Error(
            `A ${table} record refers to a missing ${target} record. Import a complete LifeHQ export.`,
          );
      }
  // Parent tasks must be inserted before their children. Reject cycles before any writes.
  const tasksById = new Map(data.tasks.map((row) => [row.id, row]));
  const visited = new Set<string>(),
    visiting = new Set<string>();
  const sorted: Row<"tasks">[] = [];
  function visit(row: Row<"tasks">) {
    if (visited.has(row.id)) return;
    if (visiting.has(row.id))
      throw new Error("The backup contains a cycle in parent tasks.");
    visiting.add(row.id);
    if (row.parent_id) visit(tasksById.get(row.parent_id)!);
    visiting.delete(row.id);
    visited.add(row.id);
    sorted.push(row);
  }
  for (const row of data.tasks) visit(row);
  data.tasks = sorted;
  return {
    data,
    count,
    counts: Object.fromEntries(
      tables.map((t) => [t, data[t].length]),
    ) as Record<Table, number>,
    preferences:
      backup.preferences === undefined
        ? null
        : preferencesSchema.parse(backup.preferences),
  };
}
export function prepareImport(
  input: unknown,
  userId: string,
  includePreferences = false,
) {
  const parsed = inspectBackup(input),
    data = emptyData();
  const ids = new Map(
    tables.map((t) => [
      t,
      new Map(parsed.data[t].map((row) => [row.id, crypto.randomUUID()])),
    ]),
  );
  const now = new Date().toISOString();
  for (const table of importOrder)
    for (const row of parsed.data[table]) {
      const values = cleanValues(table, row) as unknown as Record<
        string,
        unknown
      >;
      for (const [field, target] of Object.entries(references[table] || {}))
        if (values[field])
          values[field] = ids.get(target)!.get(String(values[field]));
      (data[table] as unknown[]).push({
        ...values,
        id: ids.get(table)!.get(row.id),
        user_id: userId,
        created_at: now,
        updated_at: now,
        version: 1,
      });
    }
  return {
    data,
    count: parsed.count,
    preferences: includePreferences ? parsed.preferences : null,
  };
}
export function mergeImported(existing: Data, imported: Data): Data {
  return Object.fromEntries(
    tables.map((t) => [t, [...existing[t], ...imported[t]]]),
  ) as Data;
}
export type ImportPreview = {
  count: number;
  counts: Record<Table, number>;
  preferences: Preferences | null;
};
