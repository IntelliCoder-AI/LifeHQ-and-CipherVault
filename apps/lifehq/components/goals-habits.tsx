"use client";
import { useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import {
  Plus,
  Check,
  ChevronLeft,
  ChevronRight,
  Archive,
  MoreHorizontal,
  Trash2,
  ArrowUpRight,
} from "lucide-react";
import { Button, Badge, Progress, Empty, Modal, Field } from "@lifehq/ui";
import { schemas, type Row } from "@lifehq/shared";
import {
  addDays,
  today,
  weekStart,
  monthStart,
  habitScheduled,
} from "@lifehq/shared/dates";
import { goalProgress, percent, habitStats } from "@lifehq/shared/analytics";
import { useWorkspace } from "@/lib/store";
import type { OpenEditor } from "./entity-editor";
import type { RemoveRequest } from "./tasks-projects";
export function GoalsPage({
  edit,
  remove,
}: {
  edit: OpenEditor;
  remove: RemoveRequest;
}) {
  const { data, preferences, save, update, toast } = useWorkspace();
  const date = today(preferences.timezone);
  const [filter, setFilter] = useState("active"),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [value, setValue] = useState("1"),
    [entryDate, setEntryDate] = useState(date),
    [note, setNote] = useState(""),
    [milestone, setMilestone] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const selected = data.goals.find((g) => g.id === selectedId);
  const goals = data.goals.filter(
    (g) =>
      filter === "all" || (filter === "archived" ? g.archived : !g.archived),
  );
  return (
    <div className="stack">
      <div className="between">
        <p className="muted">Direction, with room for the journey.</p>
        <select
          aria-label="Goal filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="active">Active goals</option>
          <option value="archived">Archived goals</option>
          <option value="all">All goals</option>
        </select>
      </div>
      {goals.length ? (
        <div className="goals-grid">
          {goals.map((g, i) => {
            const p = goalProgress(data, g, preferences.timezone),
              progress = percent(p.value, p.target),
              missed = !!g.due_date && g.due_date < date && progress < 100;
            return (
              <article className="goal-card" key={g.id}>
                <div className="between">
                  <span className="eyebrow">
                    AMBITION {String(i + 1).padStart(2, "0")}
                  </span>
                  <Badge
                    tone={
                      missed ? "overdue" : progress === 100 ? "done" : "neutral"
                    }
                  >
                    {g.archived
                      ? "Archived"
                      : progress === 100
                        ? "Complete"
                        : missed
                          ? "Past target date"
                          : g.measurement}
                  </Badge>
                </div>
                <div className="goal-main">
                  <div>
                    <h2>{g.title}</h2>
                    <p>
                      {g.description || "Small steps, meaningful progress."}
                    </p>
                  </div>
                  <div
                    className="goal-ring"
                    style={
                      { "--progress": `${progress}%` } as React.CSSProperties
                    }
                  >
                    <span>
                      {progress}
                      <small>%</small>
                    </span>
                  </div>
                </div>
                <div className="between">
                  <span className="subtle">
                    {p.value} of {p.target}{" "}
                    {g.measurement === "milestones" ? "milestones" : g.unit}
                  </span>
                  <span className="subtle">
                    {g.due_date ? `By ${g.due_date}` : "No target date"}
                  </span>
                </div>
                <Progress value={progress} label={`${g.title} progress`} />
                <div className="between goal-actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelectedId(g.id);
                      setError("");
                    }}
                  >
                    Review & update
                    <ArrowUpRight size={14} />
                  </Button>
                  <div className="row">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${g.title}`}
                      onClick={() => edit("goals", g)}
                    >
                      <MoreHorizontal size={18} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${g.archived ? "Restore" : "Archive"} ${g.title}`}
                      onClick={() =>
                        void update("goals", g, {
                          archived: !g.archived,
                        }).catch((e) => toast(e.message))
                      }
                    >
                      <Archive size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${g.title}`}
                      onClick={() => remove("goals", g)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title="A direction worth moving toward."
          description="Set a measurable goal, then give it a little attention each week."
          action={
            <Button onClick={() => edit("goals")}>
              <Plus size={16} />
              Create a goal
            </Button>
          }
        />
      )}
      {selected && (
        <Modal
          open
          onOpenChange={(v) => {
            if (!v) setSelectedId(null);
          }}
          title={selected.title}
          description="Progress comes from what you record. Take a moment to reflect."
          wide
        >
          <div className="stack">
            {selected.measurement === "count" ||
            selected.measurement === "percent" ? (
              <form
                className="form-grid"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  try {
                    await save("goal_entries", {
                      goal_id: selected.id,
                      value: Number(value),
                      date: entryDate,
                      note,
                    });
                    setNote("");
                    toast("Progress recorded");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Unable to save");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Field label={`Add progress (${selected.unit})`}>
                  <input
                    type="number"
                    min="0"
                    max="1000000000"
                    step="any"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Date">
                  <input
                    type="date"
                    value={entryDate}
                    max={date}
                    onChange={(e) => setEntryDate(e.target.value)}
                    required
                  />
                </Field>
                <div className="field-wide">
                  <Field label="Reflection">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="What moved forward? What did you learn?"
                    />
                  </Field>
                </div>
                <Button type="submit" disabled={busy}>
                  Record progress
                </Button>
              </form>
            ) : selected.measurement === "actions" ? (
              <div className="notice">
                Progress counts completed tasks in the linked project and
                check-ins in the linked habit during the goal’s date range.
              </div>
            ) : null}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <h3>Milestones</h3>
            {data.milestones
              .filter((m) => m.goal_id === selected.id)
              .map((m) => (
                <div className="between" key={m.id}>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={m.completed}
                      onChange={() =>
                        void update("milestones", m, {
                          completed: !m.completed,
                        }).catch((e) => toast(e.message))
                      }
                    />
                    {m.title}
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${m.title}`}
                    onClick={() => remove("milestones", m)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            <form
              className="row"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await save(
                    "milestones",
                    schemas.milestones.parse({
                      title: milestone,
                      goal_id: selected.id,
                    }),
                  );
                  setMilestone("");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Unable to save");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <input
                aria-label="Goal milestone"
                placeholder="A meaningful milestone"
                value={milestone}
                onChange={(e) => setMilestone(e.target.value)}
                required
              />
              <Button type="submit" variant="secondary" disabled={busy}>
                Add milestone
              </Button>
            </form>
            <h3>Progress history</h3>
            {data.goal_entries
              .filter((e) => e.goal_id === selected.id)
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((e) => (
                <div className="history-entry" key={e.id}>
                  <time>{e.date}</time>
                  <strong>+{e.value}</strong>
                  <p>{e.note || "Progress recorded"}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete progress from ${e.date}`}
                    onClick={() => remove("goal_entries", e)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            {data.goal_entries.every((e) => e.goal_id !== selected.id) && (
              <p className="subtle">No manual progress entries yet.</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
function checkInUnavailable(
  habit: Row<"habits">,
  date: string,
  current: string,
) {
  if (date < habit.start_date)
    return `This habit starts on ${habit.start_date}.`;
  if (date > current) return "Future dates cannot be checked in yet.";
  if (!habitScheduled(habit, date))
    return "This day is outside your habit schedule. Edit the habit to change its scheduled days.";
  return "";
}
export function HabitsPage({
  edit,
  remove,
}: {
  edit: OpenEditor;
  remove: RemoveRequest;
}) {
  const { data, preferences, toggleHabit, update, toast } = useWorkspace();
  const current = today(preferences.timezone);
  const [week, setWeek] = useState(
      weekStart(current, preferences.week_start === "sunday"),
    ),
    [filter, setFilter] = useState("active"),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [month, setMonth] = useState(monthStart(current)),
    [pending, setPending] = useState("");
  const selected = data.habits.find((h) => h.id === selectedId);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  async function check(habit: Row<"habits">, date: string) {
    setPending(habit.id + date);
    try {
      await toggleHabit(habit, date);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setPending("");
    }
  }
  const habits = data.habits.filter((h) =>
    filter === "archived" ? h.archived : !h.archived,
  );
  return (
    <div className="stack">
      <div className="toolbar habit-controls">
        <div className="row">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Previous week"
            onClick={() => setWeek(addDays(week, -7))}
          >
            <ChevronLeft size={18} />
          </Button>
          <span className="subtle">
            {week} — {addDays(week, 6)}
          </span>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Next week"
            onClick={() => setWeek(addDays(week, 7))}
          >
            <ChevronRight size={18} />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setWeek(weekStart(current, preferences.week_start === "sunday"))
            }
          >
            This week
          </Button>
        </div>
        <select
          aria-label="Habit filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="active">Active habits</option>
          <option value="archived">Archived habits</option>
        </select>
      </div>
      {habits.length ? (
        <section className="habit-table paper-panel">
          <div className="habit-table-head">
            <span>THE SMALL THINGS, DONE OFTEN</span>
            <div className="habit-week">
              {days.map((d) => (
                <span key={d} className={d === current ? "today-label" : ""}>
                  {Temporal.PlainDate.from(d).toLocaleString("en", {
                    weekday: "short",
                  })}
                  <strong>{Temporal.PlainDate.from(d).day}</strong>
                </span>
              ))}
            </div>
            <span>STREAK</span>
          </div>
          {habits.map((h) => {
            const stats = habitStats(h, data.habit_entries, current);
            return (
              <div className="habit-row" key={h.id}>
                <button
                  className="habit-name"
                  onClick={() => {
                    setSelectedId(h.id);
                    setMonth(monthStart(current));
                  }}
                >
                  <span className={`habit-symbol accent-${h.color}`}>
                    <Check size={19} />
                  </span>
                  <span>
                    <strong>{h.title}</strong>
                    <small>
                      {h.frequency === "weekly"
                        ? `${h.weekly_target} times per week`
                        : `${h.weekdays.length} days per week`}
                    </small>
                  </span>
                </button>
                <div className="habit-week">
                  {days.map((d) => {
                    const done = data.habit_entries.some(
                        (e) => e.habit_id === h.id && e.date === d,
                      ),
                      reason = checkInUnavailable(h, d, current),
                      enabled = !reason;
                    return (
                      <button
                        key={d}
                        className={`habit-check ${done ? "checked" : ""} ${d === current ? "today" : ""}`}
                        aria-disabled={!enabled || pending === h.id + d}
                        aria-describedby="habit-checkin-help"
                        title={
                          reason ||
                          (done
                            ? "Remove check-in"
                            : "Record or backfill this day")
                        }
                        aria-label={`${h.title} on ${d}`}
                        aria-pressed={done}
                        onClick={() => {
                          if (reason) toast(reason);
                          else if (pending !== h.id + d) void check(h, d);
                        }}
                      >
                        {done ? <Check size={17} /> : enabled ? <span /> : "—"}
                        <small className="habit-mobile-day" aria-hidden="true">
                          {Temporal.PlainDate.from(d).day}
                        </small>
                      </button>
                    );
                  })}
                </div>
                <div className="habit-streak">
                  <strong>{stats.current}</strong>
                  <span>{h.frequency === "weekly" ? "weeks" : "days"}</span>
                </div>
                <div className="habit-row-actions">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${h.title}`}
                    onClick={() => edit("habits", h)}
                  >
                    <MoreHorizontal size={18} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${h.archived ? "Restore" : "Archive"} ${h.title}`}
                    onClick={() =>
                      void update("habits", h, { archived: !h.archived }).catch(
                        (e) => toast(e.message),
                      )
                    }
                  >
                    <Archive size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${h.title}`}
                    onClick={() => remove("habits", h)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <Empty
          title="Small rituals. Lasting change."
          description="Choose something simple enough to do today, and meaningful enough to keep."
          action={
            <Button onClick={() => edit("habits")}>
              <Plus size={16} />
              Start a habit
            </Button>
          }
        />
      )}
      <div className="habit-footnote">
        <span className="eyebrow">A NOTE ON CONSISTENCY</span>
        <p id="habit-checkin-help">
          You can check in on any scheduled day from the start date through
          today, including missed days. Select a habit’s name to open its
          monthly history. Days outside its schedule stay unavailable, even on
          its start date.
        </p>
        <p>
          An unfinished today doesn’t break your streak. Missed scheduled days
          do. Weekly streaks count weeks that meet your target.
        </p>
      </div>
      {selected && (
        <Modal
          open
          onOpenChange={(v) => {
            if (!v) setSelectedId(null);
          }}
          title={selected.title}
          description="Your history, one day at a time."
          wide
        >
          <HabitHistory
            habit={selected}
            month={month}
            setMonth={setMonth}
            pending={pending}
            onCheck={check}
          />
        </Modal>
      )}
    </div>
  );
}
function HabitHistory({
  habit,
  month,
  setMonth,
  pending,
  onCheck,
}: {
  habit: Row<"habits">;
  month: string;
  setMonth: (s: string) => void;
  pending: string;
  onCheck: (h: Row<"habits">, d: string) => Promise<void>;
}) {
  const { data, preferences, toast } = useWorkspace();
  const current = today(preferences.timezone),
    stats = habitStats(habit, data.habit_entries, current),
    d = Temporal.PlainDate.from(month),
    start = weekStart(month, preferences.week_start === "sunday"),
    days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const monthEntries = data.habit_entries.filter(
      (e) => e.habit_id === habit.id && e.date.startsWith(month.slice(0, 7)),
    ).length,
    weekEntries = data.habit_entries.filter(
      (e) =>
        e.habit_id === habit.id &&
        e.date >= weekStart(current) &&
        e.date <= current,
    ).length;
  return (
    <div className="stack">
      <div className="mini-stats">
        <div>
          <strong>{stats.current}</strong>
          <span>Current streak</span>
        </div>
        <div>
          <strong>{stats.longest}</strong>
          <span>Longest streak</span>
        </div>
        <div>
          <strong>{monthEntries}</strong>
          <span>This month</span>
        </div>
        <div>
          <strong>{weekEntries}</strong>
          <span>This week</span>
        </div>
      </div>
      <div className="between">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Previous month"
          onClick={() => setMonth(d.subtract({ months: 1 }).toString())}
        >
          <ChevronLeft size={18} />
        </Button>
        <h3>{d.toLocaleString("en", { month: "long", year: "numeric" })}</h3>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Next month"
          onClick={() => setMonth(d.add({ months: 1 }).toString())}
        >
          <ChevronRight size={18} />
        </Button>
      </div>
      <p className="subtle" id="habit-history-help">
        Backfill a missed scheduled day by selecting its date. Future dates,
        dates before the start date and days outside your schedule are
        unavailable.
      </p>
      <div className="habit-calendar">
        {days.map((date) => {
          const done = data.habit_entries.some(
            (e) => e.habit_id === habit.id && e.date === date,
          );
          const reason = checkInUnavailable(habit, date, current);
          return (
            <button
              key={date}
              className={`${done ? "checked" : ""} ${date.slice(0, 7) !== month.slice(0, 7) ? "outside" : ""}`}
              aria-label={`Check-in ${date}`}
              aria-pressed={done}
              aria-disabled={Boolean(reason) || pending === habit.id + date}
              aria-describedby="habit-history-help"
              title={
                reason ||
                (done ? "Remove check-in" : "Record or backfill this day")
              }
              onClick={() => {
                if (reason) toast(reason);
                else if (pending !== habit.id + date) void onCheck(habit, date);
              }}
            >
              <span>{Temporal.PlainDate.from(date).day}</span>
              {done && <Check size={14} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
