"use client";
import { useState } from "react";
import { Button, Field, Modal, Badge } from "@lifehq/ui";
import {
  schemas,
  entityNames,
  cleanValues,
  type Row,
  type Table,
} from "@lifehq/shared";
import { today } from "@lifehq/shared/dates";
import { useWorkspace } from "@/lib/store";
export type Editable =
  "tasks" | "events" | "projects" | "goals" | "habits" | "notes";
export type EditRequest = {
  table: Editable;
  row?: Row<Editable>;
  initial?: Record<string, unknown>;
};
export type OpenEditor = (
  table: Editable,
  row?: Row<Editable>,
  initial?: Record<string, unknown>,
) => void;
export function EntityEditor({
  request,
  onClose,
}: {
  request: EditRequest;
  onClose: () => void;
}) {
  const { data, preferences, save, update, toast } = useWorkspace();
  const { table, row } = request;
  const date = today(preferences.timezone);
  const [form, setForm] = useState<Record<string, unknown>>(() =>
    row
      ? cleanValues(table, row)
      : {
          title: "",
          description: "",
          status: table === "projects" ? "active" : "todo",
          priority: "medium",
          due_date: table === "events" ? date : null,
          start_time: null,
          duration: 30,
          timezone: preferences.timezone,
          recurrence: null,
          reminder_minutes: null,
          project_id: null,
          parent_id: null,
          category: "Personal",
          tags: [],
          completed_at: null,
          location: "",
          color: "forest",
          measurement: "count",
          target: 100,
          unit: "units",
          start_date: date,
          habit_id: null,
          archived: false,
          frequency: "daily",
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          weekly_target: 3,
          content: "",
          folder: "Inbox",
          pinned: false,
          favorite: false,
          ...request.initial,
        },
  );
  const [tagText, setTagText] = useState(
    ((form.tags as string[]) || []).join(", "),
  );
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [subtask, setSubtask] = useState("");
  const set = (name: string, value: unknown) => {
    setForm((f) => ({ ...f, [name]: value }));
    setDirty(true);
  };
  const str = (name: string) => String(form[name] ?? "");
  const input = (
    name: string,
    label: string,
    type = "text",
    options?: { required?: boolean; min?: number; max?: number },
  ) => (
    <Field label={label}>
      <input
        name={name}
        type={type}
        value={str(name)}
        required={options?.required}
        min={options?.min}
        max={options?.max}
        onChange={(e) =>
          set(
            name,
            type === "number" ? Number(e.target.value) : e.target.value || null,
          )
        }
      />
    </Field>
  );
  const select = (name: string, label: string, options: string[]) => (
    <Field label={label}>
      <select value={str(name)} onChange={(e) => set(name, e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {name === "color"
              ? (
                  {
                    forest: "Ember",
                    copper: "Copper",
                    ink: "Stone",
                    sage: "Ochre",
                  } as Record<string, string>
                )[o]
              : o.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase())}
          </option>
        ))}
      </select>
    </Field>
  );
  const relation = (
    name: string,
    label: string,
    items: { id: string; title: string }[],
  ) => (
    <Field label={label}>
      <select
        value={str(name)}
        onChange={(e) => set(name, e.target.value || null)}
      >
        <option value="">None</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.title}
          </option>
        ))}
      </select>
    </Field>
  );
  function close() {
    if (!busy && (!dirty || confirm("Discard your unsaved changes?")))
      onClose();
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const keys: Record<Editable, string[]> = {
        tasks: [
          "title",
          "description",
          "status",
          "priority",
          "due_date",
          "start_time",
          "duration",
          "timezone",
          "recurrence",
          "reminder_minutes",
          "project_id",
          "parent_id",
          "category",
          "tags",
          "completed_at",
        ],
        events: [
          "title",
          "description",
          "due_date",
          "start_time",
          "duration",
          "timezone",
          "recurrence",
          "reminder_minutes",
          "location",
          "tags",
        ],
        projects: [
          "title",
          "description",
          "status",
          "due_date",
          "color",
          "tags",
        ],
        goals: [
          "title",
          "description",
          "measurement",
          "target",
          "unit",
          "start_date",
          "due_date",
          "project_id",
          "habit_id",
          "archived",
          "tags",
        ],
        habits: [
          "title",
          "description",
          "frequency",
          "weekdays",
          "weekly_target",
          "start_date",
          "color",
          "archived",
        ],
        notes: [
          "title",
          "content",
          "folder",
          "tags",
          "pinned",
          "favorite",
          "project_id",
        ],
      };
      const values = schemas[table].parse(
        Object.fromEntries(keys[table].map((k) => [k, form[k]])),
      );
      await save(table, values, row);
      toast(`${entityNames[table]} ${row ? "updated" : "created"}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }
  const recurrence = form.recurrence as {
    frequency: string;
    interval: number;
    weekdays: number[];
    until: string | null;
  } | null;
  const children =
    row && table === "tasks"
      ? data.tasks.filter((t) => t.parent_id === row.id)
      : [];
  return (
    <Modal
      open
      onOpenChange={(v) => {
        if (!v) close();
      }}
      title={`${row ? "Edit" : "New"} ${entityNames[table]}`}
      description={
        table === "tasks"
          ? "A little clarity on what comes next."
          : table === "projects"
            ? "Give a meaningful idea room to take shape."
            : "Make it specific. Make it yours."
      }
      wide
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field-wide">
            {input("title", "Title", "text", { required: true })}
          </div>
          <div className="field-wide">
            <Field
              label={table === "notes" ? "Markdown content" : "Description"}
            >
              <textarea
                value={str(table === "notes" ? "content" : "description")}
                onChange={(e) =>
                  set(
                    table === "notes" ? "content" : "description",
                    e.target.value,
                  )
                }
                placeholder="A little context goes a long way…"
              />
            </Field>
          </div>
          {(table === "tasks" || table === "projects") &&
            select(
              "status",
              "Status",
              table === "tasks"
                ? ["todo", "doing", "done"]
                : ["active", "paused", "completed", "archived"],
            )}
          {table === "tasks" && (
            <>
              {select("priority", "Priority", [
                "low",
                "medium",
                "high",
                "urgent",
              ])}
              {input("category", "Category")}
              {relation(
                "project_id",
                "Project",
                data.projects.filter((p) => p.status !== "archived"),
              )}
            </>
          )}
          {["tasks", "events", "projects", "goals"].includes(table) &&
            input(
              "due_date",
              table === "events"
                ? "Event date"
                : table === "goals"
                  ? "Target date"
                  : "Due date",
              "date",
              { required: table === "events" },
            )}
          {(table === "tasks" || table === "events") && (
            <>
              {input("start_time", "Start time", "time")}
              {input("duration", "Duration (minutes)", "number", {
                min: 5,
                max: 1440,
              })}
              {input("timezone", "Schedule timezone")}
              {table === "events" && input("location", "Location")}
              <Field label="In-app reminder">
                <select
                  value={str("reminder_minutes")}
                  onChange={(e) =>
                    set(
                      "reminder_minutes",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                >
                  <option value="">No reminder</option>
                  <option value="0">At start time</option>
                  <option value="5">5 minutes before</option>
                  <option value="15">15 minutes before</option>
                  <option value="60">1 hour before</option>
                </select>
              </Field>
              <div className="field-wide recurrence-box">
                <div className="between">
                  <div>
                    <strong>Repeat</strong>
                    <p className="subtle">
                      Dates and times follow the schedule timezone.
                    </p>
                  </div>
                  <select
                    aria-label="Repeat frequency"
                    value={recurrence?.frequency || ""}
                    onChange={(e) =>
                      set(
                        "recurrence",
                        e.target.value
                          ? {
                              frequency: e.target.value,
                              interval: 1,
                              weekdays: [],
                              until: null,
                            }
                          : null,
                      )
                    }
                  >
                    <option value="">Does not repeat</option>
                    {["daily", "weekly", "monthly", "yearly"].map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                {recurrence && (
                  <div className="form-grid">
                    <Field label="Every">
                      <input
                        type="number"
                        min={1}
                        max={52}
                        value={recurrence.interval}
                        onChange={(e) =>
                          set("recurrence", {
                            ...recurrence,
                            interval: Number(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field label="Repeat until (optional)">
                      <input
                        type="date"
                        min={str("due_date")}
                        value={recurrence.until || ""}
                        onChange={(e) =>
                          set("recurrence", {
                            ...recurrence,
                            until: e.target.value || null,
                          })
                        }
                      />
                    </Field>
                    {recurrence.frequency === "weekly" && (
                      <div className="field-wide day-picker">
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                          (d, i) => (
                            <button
                              type="button"
                              key={d}
                              aria-pressed={recurrence.weekdays.includes(i + 1)}
                              onClick={() =>
                                set("recurrence", {
                                  ...recurrence,
                                  weekdays: recurrence.weekdays.includes(i + 1)
                                    ? recurrence.weekdays.filter(
                                        (n) => n !== i + 1,
                                      )
                                    : [...recurrence.weekdays, i + 1],
                                })
                              }
                            >
                              {d}
                            </button>
                          ),
                        )}
                      </div>
                    )}
                    <p className="subtle field-wide">
                      Monthly dates clamp to the last day of shorter months.
                      Editing here changes the series; use the calendar to move
                      one occurrence.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
          {(table === "projects" || table === "habits") &&
            select("color", "Accent", ["forest", "copper", "ink", "sage"])}
          {table === "goals" && (
            <>
              {select("measurement", "Measure progress by", [
                "count",
                "percent",
                "milestones",
                "actions",
              ])}
              {input("target", "Target", "number", {
                required: true,
                min: 1,
                max: 1e9,
              })}
              {input("unit", "Unit")}
              {input("start_date", "Start date", "date", { required: true })}
              {relation("project_id", "Linked project", data.projects)}
              {relation("habit_id", "Linked habit", data.habits)}
              <p className="subtle field-wide">
                Count and percent goals add progress entries. Milestone goals
                count checked milestones. Action goals count completed project
                tasks and habit check-ins during the goal dates.
              </p>
            </>
          )}
          {table === "habits" && (
            <>
              {select("frequency", "Frequency", ["daily", "weekly"])}
              {input("start_date", "Start date", "date", { required: true })}
              {form.frequency === "weekly" ? (
                input("weekly_target", "Check-ins per week", "number", {
                  min: 1,
                  max: 7,
                })
              ) : (
                <div className="field-wide">
                  <span className="subtle">Scheduled days</span>
                  <div className="day-picker">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                      (d, i) => (
                        <button
                          type="button"
                          key={d}
                          aria-pressed={(form.weekdays as number[]).includes(
                            i + 1,
                          )}
                          onClick={() =>
                            set(
                              "weekdays",
                              (form.weekdays as number[]).includes(i + 1)
                                ? (form.weekdays as number[]).filter(
                                    (n) => n !== i + 1,
                                  )
                                : [...(form.weekdays as number[]), i + 1],
                            )
                          }
                        >
                          {d}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          {table === "notes" && (
            <>
              {input("folder", "Folder")}
              {relation("project_id", "Project", data.projects)}
            </>
          )}
          {table !== "habits" && (
            <div className="field-wide">
              <Field label="Tags" hint="Separate tags with commas.">
                <input
                  value={tagText}
                  onChange={(e) => {
                    setTagText(e.target.value);
                    set(
                      "tags",
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    );
                  }}
                />
              </Field>
            </div>
          )}
        </div>
        {children.length > 0 && (
          <div className="stack checklist-editor">
            <h3>Checklist</h3>
            {children.map((t) => (
              <label className="check-label" key={t.id}>
                <input
                  type="checkbox"
                  checked={t.status === "done"}
                  onChange={() =>
                    void update("tasks", t, {
                      status: t.status === "done" ? "todo" : "done",
                    }).catch((e) => setError(e.message))
                  }
                />
                {t.title}
              </label>
            ))}
          </div>
        )}
        {row && table === "tasks" && (
          <div className="row checklist-editor">
            <input
              aria-label="New subtask"
              value={subtask}
              onChange={(e) => setSubtask(e.target.value)}
              placeholder="Add a checklist item"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={!subtask.trim() || busy}
              onClick={async () => {
                try {
                  await save(
                    "tasks",
                    schemas.tasks.parse({
                      title: subtask,
                      parent_id: row.id,
                      project_id: form.project_id,
                      timezone: preferences.timezone,
                    }),
                  );
                  setSubtask("");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Unable to save");
                }
              }}
            >
              Add item
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy
              ? "Saving…"
              : row
                ? "Save changes"
                : `Create ${entityNames[table]}`}
          </Button>
        </div>
      </form>
      {row && table === "tasks" && (
        <p className="subtle">
          <Badge>Saved separately</Badge> Checklist changes save immediately.
        </p>
      )}
    </Modal>
  );
}
export function DeleteDialog({
  table,
  row,
  onClose,
}: {
  table: Table;
  row: Row<Table>;
  onClose: () => void;
}) {
  const { remove } = useWorkspace();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
      title={`Delete ${entityNames[table]}?`}
      description={
        ["projects", "goals", "habits", "tasks", "events"].includes(table)
          ? "This record and its linked records will be permanently removed after a 10-second undo window. Export a backup first if you need one."
          : "This record will be permanently removed after a 10-second undo window. Export a backup first if you need one."
      }
    >
      <p>{"title" in row ? String(row.title) : "This entry"}</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Keep it
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await remove(table, row);
              onClose();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not delete");
              setBusy(false);
            }
          }}
        >
          {busy ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </Modal>
  );
}
