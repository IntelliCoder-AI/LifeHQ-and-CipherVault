import { describe, it, expect } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { schemas, emptyData, type Row } from "../../packages/shared";
import {
  occursOn,
  scheduleInstant,
  schedule,
  today,
} from "../../packages/shared/dates";
import {
  habitStats,
  goalProgress,
  projectProgress,
  percent,
} from "../../packages/shared/analytics";
const meta = {
  id: "00000000-0000-4000-8000-000000000001",
  user_id: "00000000-0000-4000-8000-000000000002",
  created_at: "2026-10-22T00:00:00Z",
  updated_at: "2026-10-22T00:00:00Z",
  version: 1,
};
describe("recurrence and timezone handling", () => {
  const monthly = {
    frequency: "monthly" as const,
    interval: 1,
    weekdays: [],
    until: null,
  };
  it("clamps month ends without drifting the original anchor", () => {
    expect(occursOn("2024-01-31", monthly, "2024-02-29")).toBe(true);
    expect(occursOn("2024-01-31", monthly, "2024-03-31")).toBe(true);
    expect(occursOn("2024-01-31", monthly, "2024-03-29")).toBe(false);
    expect(occursOn("2025-01-31", monthly, "2025-02-28")).toBe(true);
  });
  it("handles leap-year anniversaries", () => {
    const rule = { ...monthly, frequency: "yearly" as const };
    expect(occursOn("2024-02-29", rule, "2025-02-28")).toBe(true);
    expect(occursOn("2024-02-29", rule, "2028-02-29")).toBe(true);
  });
  it("respects weekly intervals, selected weekdays, start and end boundaries", () => {
    const rule = {
      frequency: "weekly" as const,
      interval: 2,
      weekdays: [1, 3],
      until: "2026-11-10",
    };
    expect(occursOn("2026-10-19", rule, "2026-10-21")).toBe(true);
    expect(occursOn("2026-10-19", rule, "2026-10-28")).toBe(false);
    expect(occursOn("2026-10-19", rule, "2026-11-02")).toBe(true);
    expect(occursOn("2026-10-19", rule, "2026-11-16")).toBe(false);
    expect(occursOn("2026-10-19", rule, "2026-10-14")).toBe(false);
  });
  it("retains local wall time across daylight-saving transitions", () => {
    expect(scheduleInstant("2026-03-07", "09:00", "America/New_York")).toBe(
      "2026-03-07T14:00:00Z",
    );
    expect(scheduleInstant("2026-03-08", "09:00", "America/New_York")).toBe(
      "2026-03-08T13:00:00Z",
    );
    expect(scheduleInstant("2026-03-08", "02:30", "America/New_York")).toBe(
      "2026-03-08T07:30:00Z",
    );
    expect(scheduleInstant("2026-11-01", "01:30", "America/New_York")).toBe(
      "2026-11-01T05:30:00Z",
    );
  });
  it("uses the preferred timezone to determine today", () => {
    const instant = Temporal.Instant.from("2026-10-22T20:00:00Z");
    expect(today("Asia/Kolkata", instant)).toBe("2026-10-23");
    expect(today("America/New_York", instant)).toBe("2026-10-22");
  });
  it("moves just one occurrence without duplicates, including moved-in exceptions", () => {
    const data = emptyData();
    data.tasks = [
      {
        ...schemas.tasks.parse({
          title: "Read",
          due_date: "2026-10-20",
          start_time: "09:00",
          recurrence: {
            frequency: "daily",
            interval: 1,
            weekdays: [],
            until: null,
          },
        }),
        ...meta,
      },
    ];
    data.task_occurrences = [
      {
        ...schemas.task_occurrences.parse({
          task_id: meta.id,
          occurrence_date: "2026-10-20",
          scheduled_date: "2026-10-25",
          start_time: "10:00",
        }),
        ...meta,
        id: "00000000-0000-4000-8000-000000000003",
      },
    ];
    expect(schedule(data, "2026-10-20", "2026-10-20")).toHaveLength(0);
    const result = schedule(data, "2026-10-25", "2026-10-25");
    expect(result).toHaveLength(2);
    expect(new Set(result.map((r) => r.key)).size).toBe(2);
    expect(result.find((r) => r.originalDate === "2026-10-20")?.time).toBe(
      "10:00",
    );
  });
});
describe("deterministic habit streaks", () => {
  const habit: Row<"habits"> = {
    ...schemas.habits.parse({
      title: "Read",
      start_date: "2026-10-19",
      weekdays: [1, 2, 3, 4, 5],
    }),
    ...meta,
  };
  const entries = (dates: string[]) =>
    dates.map((date, i) => ({
      ...meta,
      id: `entry-${i}`,
      habit_id: habit.id,
      date,
    }));
  it("does not break an ongoing streak before today ends", () => {
    expect(
      habitStats(habit, entries(["2026-10-19", "2026-10-20"]), "2026-10-21")
        .current,
    ).toBe(2);
  });
  it("ignores off days and breaks on missed scheduled days", () => {
    expect(
      habitStats(
        habit,
        entries([
          "2026-10-19",
          "2026-10-20",
          "2026-10-21",
          "2026-10-22",
          "2026-10-23",
        ]),
        "2026-10-25",
      ),
    ).toMatchObject({ current: 5, longest: 5 });
    expect(
      habitStats(
        habit,
        entries(["2026-10-19", "2026-10-21", "2026-10-22"]),
        "2026-10-23",
      ),
    ).toMatchObject({ current: 2, longest: 2 });
  });
  it("counts weekly targets once per week", () => {
    const weekly = { ...habit, frequency: "weekly" as const, weekly_target: 2 };
    const e = entries(["2026-10-19", "2026-10-20", "2026-10-26", "2026-10-27"]);
    expect(habitStats(weekly, e, "2026-10-28")).toMatchObject({
      current: 2,
      longest: 2,
    });
    expect(habitStats(weekly, e, "2026-11-09").current).toBe(0);
  });
  it("deduplicates dates and excludes future entries", () => {
    expect(
      habitStats(
        habit,
        entries(["2026-10-19", "2026-10-19", "2026-10-25"]),
        "2026-10-20",
      ),
    ).toMatchObject({ completed: 1, current: 1 });
  });
});
describe("real metrics and validation", () => {
  it("starts with zero rather than fabricated progress", () => {
    expect(projectProgress(emptyData(), meta.id)).toEqual({
      done: 0,
      total: 0,
    });
    expect(percent(0, 0)).toBe(0);
  });
  it("sums measured entries and completed milestones", () => {
    const data = emptyData();
    const goal = {
      ...schemas.goals.parse({
        title: "Read",
        start_date: "2026-10-01",
        target: 10,
      }),
      ...meta,
    };
    data.goal_entries = [
      {
        ...schemas.goal_entries.parse({
          goal_id: meta.id,
          date: "2026-10-20",
          value: 3,
        }),
        ...meta,
      },
    ];
    expect(goalProgress(data, goal)).toEqual({ value: 3, target: 10 });
    data.milestones = [
      {
        ...schemas.milestones.parse({
          title: "One",
          goal_id: meta.id,
          completed: true,
        }),
        ...meta,
      },
    ];
    expect(goalProgress(data, { ...goal, measurement: "milestones" })).toEqual({
      value: 1,
      target: 1,
    });
  });
  it("rejects invalid dates, foreign input keys, impossible timezones and missing recurrence anchors", () => {
    expect(
      schemas.tasks.safeParse({ title: "test", due_date: "2026-02-30" })
        .success,
    ).toBe(false);
    expect(
      schemas.tasks.safeParse({ title: "test", user_id: meta.user_id }).success,
    ).toBe(false);
    expect(
      schemas.tasks.safeParse({ title: "test", timezone: "Invalid/Zone" })
        .success,
    ).toBe(false);
    expect(
      schemas.tasks.safeParse({
        title: "test",
        recurrence: { frequency: "daily" },
      }).success,
    ).toBe(false);
  });
  it("does not mutate a goal when deriving progress", () => {
    const goal = {
      ...schemas.goals.parse({ title: "A", start_date: "2026-10-01" }),
      ...meta,
    };
    const before = JSON.stringify(goal);
    goalProgress(emptyData(), goal);
    expect(JSON.stringify(goal)).toBe(before);
  });
});

describe("regressions found during implementation review", () => {
  it("requires recurring tasks to be completed by occurrence", () => {
    expect(
      schemas.tasks.safeParse({
        title: "Daily",
        due_date: "2026-10-22",
        recurrence: { frequency: "daily" },
        status: "done",
      }).success,
    ).toBe(false);
  });
  it("rejects a recurrence ending before its anchor", () => {
    expect(
      schemas.tasks.safeParse({
        title: "Daily",
        due_date: "2026-10-22",
        recurrence: { frequency: "daily", until: "2026-10-01" },
      }).success,
    ).toBe(false);
  });
});

it("stopping a recurrence hides its old exceptions from the schedule without erasing history", () => {
  const data = emptyData();
  data.tasks = [
    {
      ...schemas.tasks.parse({
        title: "Former series",
        due_date: "2026-10-20",
      }),
      ...meta,
    },
  ];
  data.task_occurrences = [
    {
      ...schemas.task_occurrences.parse({
        task_id: meta.id,
        occurrence_date: "2026-10-20",
        scheduled_date: "2026-10-25",
        status: "done",
      }),
      ...meta,
    },
  ];
  expect(schedule(data, "2026-10-20", "2026-10-25")).toHaveLength(1);
  expect(data.task_occurrences).toHaveLength(1);
});
