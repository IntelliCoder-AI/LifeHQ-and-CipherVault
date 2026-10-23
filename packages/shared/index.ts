import { z } from "zod";
export const dateSchema = z.iso
  .date()
  .refine(
    (v) => v >= "1900-01-01" && v <= "2100-12-31",
    "Choose a date between 1900 and 2100",
  );
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const timezoneSchema = z.string().refine((v) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}, "Choose a valid timezone");
const id = z.uuid();
const optionalId = id.nullable().default(null);
const title = z.string().trim().min(1, "Please enter a title").max(200);
const text = z.string().max(50000).default("");
const tags = z.array(z.string().trim().min(1).max(40)).max(20).default([]);
export const recurrenceSchema = z
  .object({
    frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
    interval: z.number().int().min(1).max(52).default(1),
    weekdays: z.array(z.number().int().min(1).max(7)).max(7).default([]),
    until: dateSchema.nullable().default(null),
  })
  .strict()
  .nullable()
  .default(null);
const schedule = {
  due_date: dateSchema.nullable().default(null),
  start_time: timeSchema.nullable().default(null),
  duration: z.number().int().min(5).max(1440).default(30),
  timezone: timezoneSchema.default("Asia/Kolkata"),
  recurrence: recurrenceSchema,
  reminder_minutes: z.number().int().min(0).max(10080).nullable().default(null),
};
const taskSchema = z
  .object({
    title,
    description: text,
    status: z.enum(["todo", "doing", "done"]).default("todo"),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    ...schedule,
    project_id: optionalId,
    parent_id: optionalId,
    category: z.string().max(80).default("Personal"),
    tags,
    completed_at: z.iso.datetime().nullable().default(null),
  })
  .strict()
  .refine(
    (v) => !v.recurrence || v.due_date,
    "Recurring tasks need a start date",
  )
  .refine(
    (v) => !v.recurrence || v.status !== "done",
    "Complete recurring occurrences in the planner",
  )
  .refine(
    (v) =>
      !v.recurrence?.until || !v.due_date || v.recurrence.until >= v.due_date,
    "Recurrence ends before it starts",
  );
const eventSchema = z
  .object({
    title,
    description: text,
    ...schedule,
    due_date: dateSchema,
    location: z.string().max(200).default(""),
    tags,
  })
  .strict();
const projectSchema = z
  .object({
    title,
    description: text,
    status: z
      .enum(["active", "paused", "completed", "archived"])
      .default("active"),
    due_date: dateSchema.nullable().default(null),
    color: z.enum(["forest", "copper", "ink", "sage"]).default("forest"),
    tags,
  })
  .strict();
const goalSchema = z
  .object({
    title,
    description: text,
    measurement: z
      .enum(["count", "percent", "milestones", "actions"])
      .default("count"),
    target: z.number().positive().max(1e9).default(100),
    unit: z.string().max(40).default("units"),
    start_date: dateSchema,
    due_date: dateSchema.nullable().default(null),
    project_id: optionalId,
    habit_id: optionalId,
    archived: z.boolean().default(false),
    tags,
  })
  .strict()
  .refine(
    (v) => !v.due_date || v.due_date >= v.start_date,
    "Target date must follow the start date",
  );
const habitSchema = z
  .object({
    title,
    description: text,
    frequency: z.enum(["daily", "weekly"]).default("daily"),
    weekdays: z
      .array(z.number().int().min(1).max(7))
      .min(1)
      .max(7)
      .default([1, 2, 3, 4, 5, 6, 7]),
    weekly_target: z.number().int().min(1).max(7).default(3),
    start_date: dateSchema,
    color: z.enum(["forest", "copper", "ink", "sage"]).default("forest"),
    archived: z.boolean().default(false),
  })
  .strict();
const noteSchema = z
  .object({
    title,
    content: text,
    folder: z.string().trim().max(80).default("Inbox"),
    tags,
    pinned: z.boolean().default(false),
    favorite: z.boolean().default(false),
    project_id: optionalId,
  })
  .strict();
const milestoneSchema = z
  .object({
    title,
    goal_id: optionalId,
    project_id: optionalId,
    completed: z.boolean().default(false),
    due_date: dateSchema.nullable().default(null),
  })
  .strict()
  .refine(
    (v) => Boolean(v.goal_id) !== Boolean(v.project_id),
    "A milestone belongs to one goal or project",
  );
const habitEntrySchema = z.object({ habit_id: id, date: dateSchema }).strict();
const goalEntrySchema = z
  .object({
    goal_id: id,
    date: dateSchema,
    value: z.number().min(0).max(1e9),
    note: z.string().max(2000).default(""),
  })
  .strict();
const taskOccurrenceSchema = z
  .object({
    task_id: id,
    occurrence_date: dateSchema,
    scheduled_date: dateSchema,
    status: z.enum(["todo", "doing", "done"]).default("todo"),
    start_time: timeSchema.nullable().default(null),
    completed_at: z.iso.datetime().nullable().default(null),
  })
  .strict();
const eventOccurrenceSchema = z
  .object({
    event_id: id,
    occurrence_date: dateSchema,
    scheduled_date: dateSchema,
    start_time: timeSchema.nullable().default(null),
    cancelled: z.boolean().default(false),
  })
  .strict();
const reviewSchema = z
  .object({
    title,
    period: z.enum(["daily", "weekly"]),
    date: dateSchema,
    content: text,
  })
  .strict();
export const preferencesSchema = z
  .object({
    name: z.string().trim().min(1).max(80).default("Friend"),
    theme: z.enum(["light", "dark", "system"]).default("light"),
    timezone: timezoneSchema.default("Asia/Kolkata"),
    week_start: z.enum(["monday", "sunday"]).default("monday"),
    date_format: z.enum(["dmy", "mdy", "iso"]).default("dmy"),
    time_format: z.enum(["12", "24"]).default("12"),
    reminders: z.boolean().default(true),
    dashboard: z
      .array(
        z.enum([
          "priorities",
          "schedule",
          "projects",
          "habits",
          "goals",
          "notes",
          "week",
        ]),
      )
      .max(7)
      .default([
        "priorities",
        "schedule",
        "projects",
        "habits",
        "goals",
        "notes",
        "week",
      ]),
  })
  .strict();
export const schemas = {
  tasks: taskSchema,
  events: eventSchema,
  projects: projectSchema,
  goals: goalSchema,
  habits: habitSchema,
  notes: noteSchema,
  milestones: milestoneSchema,
  habit_entries: habitEntrySchema,
  goal_entries: goalEntrySchema,
  task_occurrences: taskOccurrenceSchema,
  event_occurrences: eventOccurrenceSchema,
  reviews: reviewSchema,
};
export type Table = keyof typeof schemas;
export const tables = Object.keys(schemas) as Table[];
export type Values<T extends Table> = z.output<(typeof schemas)[T]>;
export type Row<T extends Table> = Values<T> & {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  version: number;
};
export type Data = { [T in Table]: Row<T>[] };
export type Preferences = z.output<typeof preferencesSchema>;
export const emptyData = (): Data =>
  Object.fromEntries(tables.map((t) => [t, []])) as unknown as Data;
export const defaults = preferencesSchema.parse({});
export const entityNames: Record<Table, string> = {
  tasks: "task",
  events: "event",
  projects: "project",
  goals: "goal",
  habits: "habit",
  notes: "note",
  milestones: "milestone",
  habit_entries: "check-in",
  goal_entries: "progress entry",
  task_occurrences: "task occurrence",
  event_occurrences: "event occurrence",
  reviews: "review",
};
export function cleanValues<T extends Table>(table: T, row: Row<T>): Values<T> {
  const {
    id: _id,
    user_id: _user,
    created_at: _created,
    updated_at: _updated,
    version: _version,
    ...values
  } = row;
  void _id;
  void _user;
  void _created;
  void _updated;
  void _version;
  return schemas[table].parse(values) as Values<T>;
}

/** Mirrors the database's ON DELETE CASCADE ownership relationships in the local demo. */
export function cascadeDelete(data: Data, table: Table, id: string): Data {
  const next = structuredClone(data);
  const queue: { table: Table; id: string }[] = [{ table, id }];
  const relations: Partial<Record<Table, { table: Table; field: string }[]>> = {
    projects: [
      { table: "tasks", field: "project_id" },
      { table: "notes", field: "project_id" },
      { table: "goals", field: "project_id" },
      { table: "milestones", field: "project_id" },
    ],
    tasks: [
      { table: "tasks", field: "parent_id" },
      { table: "task_occurrences", field: "task_id" },
    ],
    events: [{ table: "event_occurrences", field: "event_id" }],
    goals: [
      { table: "milestones", field: "goal_id" },
      { table: "goal_entries", field: "goal_id" },
    ],
    habits: [
      { table: "habit_entries", field: "habit_id" },
      { table: "goals", field: "habit_id" },
    ],
  };
  const seen = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i],
      key = `${item.table}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const relation of relations[item.table] || [])
      for (const row of next[relation.table])
        if (
          (row as unknown as Record<string, unknown>)[relation.field] ===
          item.id
        )
          queue.push({ table: relation.table, id: row.id });
    (next[item.table] as Row<Table>[]) = next[item.table].filter(
      (row) => row.id !== item.id,
    );
  }
  return next;
}
