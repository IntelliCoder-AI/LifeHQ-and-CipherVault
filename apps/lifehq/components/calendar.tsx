"use client";
import { useMemo, useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  RotateCcw,
  ArrowUpRight,
} from "lucide-react";
import { Button, Modal, Field, Badge, Empty } from "@lifehq/ui";
import {
  schedule,
  today,
  addDays,
  weekStart,
  monthStart,
  type Scheduled,
} from "@lifehq/shared/dates";
import { useWorkspace } from "@/lib/store";
import type { OpenEditor } from "./entity-editor";
import type { RemoveRequest } from "./tasks-projects";
export function timeLabel(time: string | null, format = "12") {
  if (!time) return "Any time";
  if (format === "24") return time;
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
}
export function CalendarPage({
  edit,
  remove,
}: {
  edit: OpenEditor;
  remove: RemoveRequest;
}) {
  const { data, preferences, save, update, toggleScheduled, toast } =
    useWorkspace();
  const current = today(preferences.timezone);
  const [date, setDate] = useState(current),
    [view, setView] = useState<"day" | "week" | "month">("week"),
    [selected, setSelected] = useState<Scheduled | null>(null),
    [moveDate, setMoveDate] = useState(""),
    [moveTime, setMoveTime] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const start =
    view === "month"
      ? weekStart(monthStart(date), preferences.week_start === "sunday")
      : view === "week"
        ? weekStart(date, preferences.week_start === "sunday")
        : date;
  const count = view === "month" ? 42 : view === "week" ? 7 : 1;
  const days = Array.from({ length: count }, (_, i) => addDays(start, i));
  const items = useMemo(
    () => schedule(data, start, addDays(start, count - 1)),
    [data, start, count],
  );
  function open(item: Scheduled) {
    setSelected(item);
    setMoveDate(item.date);
    setMoveTime(item.time || "");
    setError("");
  }
  async function move(
    item: Scheduled,
    nextDate: string,
    nextTime: string | null,
  ) {
    if (item.kind === "project") {
      const p = data.projects.find((p) => p.id === item.id);
      if (p) await update("projects", p, { due_date: nextDate });
    } else if (item.kind === "task") {
      const t = data.tasks.find((t) => t.id === item.id);
      if (!t) return;
      if (item.recurring)
        await save(
          "task_occurrences",
          {
            task_id: item.id,
            occurrence_date: item.originalDate,
            scheduled_date: nextDate,
            start_time: nextTime,
            status: item.status as "todo" | "doing" | "done",
            completed_at:
              item.status === "done" ? new Date().toISOString() : null,
          },
          data.task_occurrences.find(
            (e) =>
              e.task_id === item.id && e.occurrence_date === item.originalDate,
          ),
        );
      else
        await update("tasks", t, { due_date: nextDate, start_time: nextTime });
    } else {
      const e = data.events.find((e) => e.id === item.id);
      if (!e) return;
      if (item.recurring)
        await save(
          "event_occurrences",
          {
            event_id: item.id,
            occurrence_date: item.originalDate,
            scheduled_date: nextDate,
            start_time: nextTime,
            cancelled: false,
          },
          data.event_occurrences.find(
            (e) =>
              e.event_id === item.id && e.occurrence_date === item.originalDate,
          ),
        );
      else
        await update("events", e, { due_date: nextDate, start_time: nextTime });
    }
  }
  function nav(direction: number) {
    setDate(
      view === "month"
        ? Temporal.PlainDate.from(date).add({ months: direction }).toString()
        : addDays(date, direction * (view === "week" ? 7 : 1)),
    );
  }
  return (
    <div className="stack">
      <div className="toolbar calendar-toolbar">
        <div className="row">
          <Button variant="secondary" onClick={() => setDate(current)}>
            Today
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Previous period"
            onClick={() => nav(-1)}
          >
            <ChevronLeft size={18} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Next period"
            onClick={() => nav(1)}
          >
            <ChevronRight size={18} />
          </Button>
          <h2 className="calendar-month">
            {Temporal.PlainDate.from(date).toLocaleString("en", {
              month: "long",
              year: "numeric",
            })}
          </h2>
        </div>
        <div className="tab-bar">
          {(["day", "week", "month"] as const).map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <p className="subtle">
        Schedule times stay in each item’s timezone. Your workspace:{" "}
        {preferences.timezone}. Drag an item to move it, or open it to choose a
        new date.
      </p>
      {view === "day" ? (
        <div className="day-layout">
          <section className="paper-panel day-schedule">
            <div className="between">
              <h2>
                {Temporal.PlainDate.from(date).toLocaleString("en", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h2>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => edit("events", undefined, { due_date: date })}
              >
                <Plus size={15} />
                Event
              </Button>
            </div>
            {items.length ? (
              items.map((item) => (
                <div key={item.key} className="timeline-row">
                  <time>{timeLabel(item.time, preferences.time_format)}</time>
                  <button
                    className={`schedule-event ${item.kind}`}
                    onClick={() => open(item)}
                  >
                    <strong>{item.title}</strong>
                    <span>
                      {item.kind === "project"
                        ? "Project deadline"
                        : `${item.duration} min · ${item.timezone}`}
                      {item.recurring ? " · Repeats" : ""}
                    </span>
                  </button>
                </div>
              ))
            ) : (
              <Empty
                title="A little breathing room."
                description="Add a time block or schedule a task for this day."
              />
            )}
          </section>
          <aside className="paper-panel">
            <h3>Unscheduled tasks</h3>
            <p className="subtle">Give your open tasks a place in the day.</p>
            {data.tasks
              .filter((t) => !t.due_date && t.status !== "done" && !t.parent_id)
              .map((t) => (
                <button
                  className="unscheduled-task"
                  key={t.id}
                  onClick={() => edit("tasks", t, { due_date: date })}
                >
                  {t.title}
                  <ArrowUpRight size={16} />
                </button>
              ))}
          </aside>
        </div>
      ) : (
        <div
          className={`calendar-grid ${view}`}
          role="region"
          aria-label={`${view} calendar`}
        >
          {days.map((d) => {
            const daily = items.filter((i) => i.date === d);
            const day = Temporal.PlainDate.from(d);
            return (
              <section
                className={`calendar-cell ${d === current ? "is-today" : ""} ${view === "month" && day.month !== Temporal.PlainDate.from(date).month ? "other-month" : ""}`}
                key={d}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault();
                  const item = items.find(
                    (i) => i.key === e.dataTransfer.getData("schedule"),
                  );
                  if (item)
                    try {
                      await move(item, d, item.time);
                      toast("Schedule updated");
                    } catch (e) {
                      toast(
                        e instanceof Error ? e.message : "Unable to reschedule",
                      );
                    }
                }}
              >
                <button
                  className="calendar-date"
                  aria-label={`Open ${d}`}
                  onClick={() => {
                    setDate(d);
                    setView("day");
                  }}
                >
                  <span>{day.toLocaleString("en", { weekday: "short" })}</span>
                  <strong>{day.day}</strong>
                </button>
                <div className="calendar-events">
                  {daily.map((item) => (
                    <button
                      key={item.key}
                      className={`calendar-item ${item.kind} ${item.status === "done" ? "done" : ""}`}
                      onClick={() => open(item)}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData("schedule", item.key)
                      }
                    >
                      <span className="calendar-item-time">
                        {item.kind === "project"
                          ? "DEADLINE"
                          : timeLabel(item.time, preferences.time_format)}
                      </span>
                      <strong>{item.title}</strong>
                      {item.recurring && <RotateCcw size={11} />}
                    </button>
                  ))}
                </div>
                <button
                  className="calendar-add"
                  aria-label={`Add event on ${d}`}
                  onClick={() => edit("events", undefined, { due_date: d })}
                >
                  <Plus size={14} />
                  <span>Add event</span>
                </button>
              </section>
            );
          })}
        </div>
      )}
      <div className="row wrap subtle">
        <span className="legend-dot forest" />
        Task
        <span className="legend-dot copper" />
        Event
        <span className="legend-dot ink" />
        Project deadline
      </div>
      {selected && (
        <Modal
          open
          onOpenChange={(v) => {
            if (!v) setSelected(null);
          }}
          title={selected.title}
          description={
            selected.recurring
              ? "This occurrence is independent. Changes here leave the rest of the series intact."
              : `${selected.kind} · ${selected.timezone}`
          }
        >
          <div className="stack">
            <div className="row">
              <Badge tone={selected.status}>{selected.status}</Badge>
              <Badge>{selected.timezone}</Badge>
              {selected.recurring && <Badge>Repeating</Badge>}
            </div>
            <div className="form-grid">
              <Field label="Scheduled date">
                <input
                  type="date"
                  value={moveDate}
                  required
                  onChange={(e) => setMoveDate(e.target.value)}
                />
              </Field>
              {selected.kind !== "project" && (
                <Field label="Start time">
                  <input
                    type="time"
                    value={moveTime}
                    onChange={(e) => setMoveTime(e.target.value)}
                  />
                </Field>
              )}
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Button
              disabled={busy || !moveDate}
              onClick={async () => {
                setBusy(true);
                try {
                  await move(selected, moveDate, moveTime || null);
                  setSelected(null);
                  toast("Schedule updated");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Unable to save");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save schedule
            </Button>
            {selected.kind === "task" && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await toggleScheduled(selected);
                    setSelected(null);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Unable to save");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Check size={16} />
                {selected.status === "done"
                  ? "Mark incomplete"
                  : "Complete task"}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                if (selected.kind === "task") {
                  const t = data.tasks.find((t) => t.id === selected.id);
                  if (t) edit("tasks", t);
                } else if (selected.kind === "event") {
                  const e = data.events.find((e) => e.id === selected.id);
                  if (e) edit("events", e);
                } else {
                  const p = data.projects.find((p) => p.id === selected.id);
                  if (p) edit("projects", p);
                }
                setSelected(null);
              }}
            >
              {selected.recurring ? "Edit entire series" : "Edit details"}
            </Button>
            {selected.kind === "event" && (
              <Button
                variant="ghost"
                onClick={() => {
                  const event = data.events.find((e) => e.id === selected.id);
                  if (event) {
                    setSelected(null);
                    remove("events", event);
                  }
                }}
              >
                {selected.recurring ? "Delete entire series" : "Delete event"}
              </Button>
            )}
            {selected.kind === "event" && selected.recurring && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={async () => {
                  if (
                    !confirm(
                      "Cancel this occurrence? The rest of the series will remain.",
                    )
                  )
                    return;
                  setBusy(true);
                  try {
                    await save(
                      "event_occurrences",
                      {
                        event_id: selected.id,
                        occurrence_date: selected.originalDate,
                        scheduled_date: selected.date,
                        start_time: selected.time,
                        cancelled: true,
                      },
                      data.event_occurrences.find(
                        (e) =>
                          e.event_id === selected.id &&
                          e.occurrence_date === selected.originalDate,
                      ),
                    );
                    setSelected(null);
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Unable to cancel",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Cancel this occurrence
              </Button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
