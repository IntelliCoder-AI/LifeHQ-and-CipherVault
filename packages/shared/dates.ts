import { Temporal } from "@js-temporal/polyfill";
import type { Data, Row, Values } from "./index";
export function today(
  timezone = "Asia/Kolkata",
  instant = Temporal.Now.instant(),
): string {
  return instant.toZonedDateTimeISO(timezone).toPlainDate().toString();
}
export function addDays(date: string, days: number): string {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}
export function dateLabel(date: string, format = "dmy"): string {
  const d = Temporal.PlainDate.from(date);
  return format === "iso"
    ? date
    : format === "mdy"
      ? `${d.month}/${d.day}/${d.year}`
      : `${d.day}/${d.month}/${d.year}`;
}
export function weekStart(date: string, sunday = false): string {
  const d = Temporal.PlainDate.from(date);
  return d
    .subtract({ days: sunday ? d.dayOfWeek % 7 : d.dayOfWeek - 1 })
    .toString();
}
export function monthStart(date: string): string {
  return Temporal.PlainDate.from(date).with({ day: 1 }).toString();
}
export function dayOfWeek(date: string): number {
  return Temporal.PlainDate.from(date).dayOfWeek;
}
export function daysBetween(start: string, end: string): number {
  return Temporal.PlainDate.from(start).until(Temporal.PlainDate.from(end))
    .days;
}
export function datesInRange(start: string, end: string): string[] {
  const count = daysBetween(start, end);
  if (count > 80000)
    throw new Error("Date range exceeds the supported calendar");
  return Array.from({ length: Math.max(0, count + 1) }, (_, i) =>
    addDays(start, i),
  );
}
export function scheduleInstant(
  date: string,
  time: string,
  timezone: string,
): string {
  return Temporal.PlainDate.from(date)
    .toPlainDateTime(Temporal.PlainTime.from(time))
    .toZonedDateTime(timezone, { disambiguation: "compatible" })
    .toInstant()
    .toString();
}
export function occursOn(
  anchor: string,
  rule: Values<"tasks">["recurrence"],
  date: string,
): boolean {
  if (date < anchor || (rule?.until && date > rule.until)) return false;
  if (!rule) return date === anchor;
  const a = Temporal.PlainDate.from(anchor),
    d = Temporal.PlainDate.from(date),
    interval = rule.interval;
  if (rule.frequency === "daily") return a.until(d).days % interval === 0;
  if (rule.frequency === "weekly")
    return (
      Math.floor(daysBetween(weekStart(anchor), weekStart(date)) / 7) %
        interval ===
        0 &&
      (rule.weekdays.length ? rule.weekdays : [a.dayOfWeek]).includes(
        d.dayOfWeek,
      )
    );
  if (rule.frequency === "monthly")
    return (
      ((d.year - a.year) * 12 + d.month - a.month) % interval === 0 &&
      d.day === Math.min(a.day, d.daysInMonth)
    );
  return (
    (d.year - a.year) % interval === 0 &&
    d.month === a.month &&
    d.day === Math.min(a.day, d.daysInMonth)
  );
}
export type Scheduled = {
  key: string;
  kind: "task" | "event" | "project";
  id: string;
  title: string;
  date: string;
  time: string | null;
  timezone: string;
  duration: number;
  status: string;
  priority: string;
  originalDate: string;
  recurring: boolean;
  project_id: string | null;
};
export function schedule(data: Data, start: string, end: string): Scheduled[] {
  const result: Scheduled[] = [];
  for (const task of data.tasks) {
    if (!task.due_date) continue;
    const exceptions = task.recurrence
      ? data.task_occurrences.filter((x) => x.task_id === task.id)
      : [];
    for (const date of datesInRange(start, end)) {
      if (
        !occursOn(task.due_date, task.recurrence, date) ||
        exceptions.some((x) => x.occurrence_date === date)
      )
        continue;
      result.push({
        key: `task:${task.id}:${date}`,
        kind: "task",
        id: task.id,
        title: task.title,
        date,
        time: task.start_time,
        timezone: task.timezone,
        duration: task.duration,
        status: task.status,
        priority: task.priority,
        originalDate: date,
        recurring: !!task.recurrence,
        project_id: task.project_id,
      });
    }
    for (const x of exceptions)
      if (x.scheduled_date >= start && x.scheduled_date <= end)
        result.push({
          key: `task:${task.id}:${x.occurrence_date}`,
          kind: "task",
          id: task.id,
          title: task.title,
          date: x.scheduled_date,
          time: x.start_time,
          timezone: task.timezone,
          duration: task.duration,
          status: x.status,
          priority: task.priority,
          originalDate: x.occurrence_date,
          recurring: true,
          project_id: task.project_id,
        });
  }
  for (const event of data.events) {
    const exceptions = event.recurrence
      ? data.event_occurrences.filter((x) => x.event_id === event.id)
      : [];
    for (const date of datesInRange(start, end)) {
      if (
        !occursOn(event.due_date, event.recurrence, date) ||
        exceptions.some((x) => x.occurrence_date === date)
      )
        continue;
      result.push({
        key: `event:${event.id}:${date}`,
        kind: "event",
        id: event.id,
        title: event.title,
        date,
        time: event.start_time,
        timezone: event.timezone,
        duration: event.duration,
        status: "scheduled",
        priority: "medium",
        originalDate: date,
        recurring: !!event.recurrence,
        project_id: null,
      });
    }
    for (const x of exceptions)
      if (!x.cancelled && x.scheduled_date >= start && x.scheduled_date <= end)
        result.push({
          key: `event:${event.id}:${x.occurrence_date}`,
          kind: "event",
          id: event.id,
          title: event.title,
          date: x.scheduled_date,
          time: x.start_time,
          timezone: event.timezone,
          duration: event.duration,
          status: "scheduled",
          priority: "medium",
          originalDate: x.occurrence_date,
          recurring: true,
          project_id: null,
        });
  }
  for (const p of data.projects)
    if (
      p.due_date &&
      p.due_date >= start &&
      p.due_date <= end &&
      p.status !== "archived"
    )
      result.push({
        key: `project:${p.id}`,
        kind: "project",
        id: p.id,
        title: p.title,
        date: p.due_date,
        time: null,
        timezone: "UTC",
        duration: 0,
        status: p.status,
        priority: "high",
        originalDate: p.due_date,
        recurring: false,
        project_id: p.id,
      });
  return result.sort((a, b) =>
    (a.date + (a.time || "99")).localeCompare(b.date + (b.time || "99")),
  );
}
export function habitScheduled(habit: Row<"habits">, date: string): boolean {
  return (
    date >= habit.start_date &&
    (habit.frequency === "weekly" || habit.weekdays.includes(dayOfWeek(date)))
  );
}
