import { Temporal } from "@js-temporal/polyfill";
import type { Data, Row } from "./index";
import { addDays, datesInRange, habitScheduled, weekStart } from "./dates";
export function instantDay(instant: string | null, timezone = "Asia/Kolkata") {
  return instant
    ? Temporal.Instant.from(instant)
        .toZonedDateTimeISO(timezone)
        .toPlainDate()
        .toString()
    : null;
}
export function projectProgress(data: Data, id: string) {
  const tasks = data.tasks.filter((t) => t.project_id === id && !t.parent_id);
  return {
    done: tasks.filter((t) => t.status === "done").length,
    total: tasks.length,
  };
}
export function goalProgress(
  data: Data,
  goal: Row<"goals">,
  timezone = "Asia/Kolkata",
) {
  if (goal.measurement === "milestones") {
    const m = data.milestones.filter((m) => m.goal_id === goal.id);
    return { value: m.filter((m) => m.completed).length, target: m.length };
  }
  if (goal.measurement === "actions") {
    const inRange = (date: string | null) =>
      !!date &&
      date >= goal.start_date &&
      (!goal.due_date || date <= goal.due_date);
    const tasks = new Set(
      data.tasks
        .filter(
          (t) =>
            goal.project_id && t.project_id === goal.project_id && !t.parent_id,
        )
        .map((t) => t.id),
    );
    return {
      value:
        data.tasks.filter(
          (t) =>
            tasks.has(t.id) &&
            !t.recurrence &&
            t.status === "done" &&
            inRange(instantDay(t.completed_at, timezone)),
        ).length +
        data.task_occurrences.filter(
          (t) =>
            tasks.has(t.task_id) &&
            t.status === "done" &&
            inRange(instantDay(t.completed_at, timezone)),
        ).length +
        data.habit_entries.filter(
          (e) =>
            goal.habit_id && e.habit_id === goal.habit_id && inRange(e.date),
        ).length,
      target: goal.target,
    };
  }
  return {
    value: data.goal_entries
      .filter((e) => e.goal_id === goal.id)
      .reduce((s, e) => s + e.value, 0),
    target: goal.target,
  };
}
export function percent(value: number, target: number) {
  return target > 0
    ? Math.max(0, Math.min(100, Math.round((value / target) * 100)))
    : 0;
}
export function habitStats(
  habit: Row<"habits">,
  entries: Row<"habit_entries">[],
  asOf: string,
) {
  const done = new Set(
    entries
      .filter(
        (e) =>
          e.habit_id === habit.id &&
          e.date <= asOf &&
          e.date >= habit.start_date,
      )
      .map((e) => e.date),
  );
  const dates = datesInRange(habit.start_date, asOf);
  const periods =
    habit.frequency === "weekly"
      ? [...new Set(dates.map((d) => weekStart(d)))]
      : dates.filter((d) => habitScheduled(habit, d));
  let current = 0,
    longest = 0,
    achieved = 0;
  const active = habit.frequency === "weekly" ? weekStart(asOf) : asOf;
  for (const period of periods) {
    const count =
      habit.frequency === "weekly"
        ? datesInRange(period, addDays(period, 6)).filter((d) => done.has(d))
            .length
        : Number(done.has(period));
    const target = habit.frequency === "weekly" ? habit.weekly_target : 1;
    achieved += Math.min(count, target);
    const success = count >= target;
    if (success) {
      current++;
      longest = Math.max(longest, current);
    } else if (period !== active) {
      current = 0;
    }
  }
  const range = dates.filter((d) => habitScheduled(habit, d)),
    completed = range.filter((d) => done.has(d)).length,
    scheduled =
      habit.frequency === "weekly"
        ? periods.length * habit.weekly_target
        : range.length;
  return {
    current,
    longest,
    completed,
    scheduled,
    consistency: percent(achieved, scheduled),
  };
}
export function completionTrend(
  data: Data,
  start: string,
  end: string,
  timezone = "Asia/Kolkata",
) {
  return datesInRange(start, end).map((date) => ({
    date,
    tasks:
      data.tasks.filter(
        (t) =>
          !t.recurrence &&
          t.status === "done" &&
          instantDay(t.completed_at, timezone) === date,
      ).length +
      data.task_occurrences.filter(
        (t) =>
          t.status === "done" && instantDay(t.completed_at, timezone) === date,
      ).length,
    habits: data.habit_entries.filter((e) => e.date === date).length,
  }));
}
