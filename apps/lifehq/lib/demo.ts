import {
  emptyData,
  schemas,
  type Data,
  type Row,
  type Table,
} from "@lifehq/shared";
import { addDays, today } from "@lifehq/shared/dates";
export const DEMO_KEY = "lifehq-demo-v1";
export const DEMO_USER = "00000000-0000-4000-8000-000000000001";
export function sampleData(): Data {
  const data = emptyData(),
    date = today();
  function add<T extends Table>(table: T, values: unknown) {
    const now = new Date().toISOString();
    const row = {
      ...schemas[table].parse(values),
      id: crypto.randomUUID(),
      user_id: DEMO_USER,
      created_at: now,
      updated_at: now,
      version: 1,
    } as unknown as Row<T>;
    (data[table] as Row<T>[]).push(row);
    return row;
  }
  const studio = add("projects", {
    title: "A space to create",
    description:
      "Turn the spare room into a thoughtful studio for writing, making, and deep work.",
    due_date: addDays(date, 18),
    color: "forest",
    tags: ["Home", "Creative"],
  });
  const journal = add("projects", {
    title: "The slow living journal",
    description:
      "A collection of small observations. Build a weekly writing practice and publish the first edition.",
    due_date: addDays(date, 30),
    color: "copper",
    tags: ["Writing"],
  });
  add("projects", {
    title: "Weekend, somewhere new",
    description:
      "Plan a quiet weekend away. Find a trail, a good book, and somewhere to stay.",
    due_date: addDays(date, 12),
    color: "sage",
    tags: ["Personal"],
  });
  const tasks = [
    {
      title: "Sketch the studio layout",
      project_id: studio.id,
      priority: "high",
      start_time: "09:00",
      duration: 60,
      category: "Creative",
    },
    {
      title: "Read & capture three ideas",
      priority: "medium",
      start_time: "11:00",
      duration: 30,
      category: "Personal",
    },
    {
      title: "Outline the first journal entry",
      project_id: journal.id,
      priority: "high",
      start_time: "14:00",
      duration: 90,
      category: "Writing",
    },
    {
      title: "Choose a desk lamp",
      project_id: studio.id,
      priority: "low",
      category: "Home",
    },
  ];
  tasks.forEach((t) => add("tasks", { ...t, due_date: date }));
  add("tasks", {
    title: "Measure the room",
    project_id: studio.id,
    status: "done",
    due_date: addDays(date, -1),
    completed_at: new Date(`${addDays(date, -1)}T10:00:00Z`).toISOString(),
  });
  add("tasks", {
    title: "Collect material references",
    project_id: studio.id,
    status: "done",
    due_date: addDays(date, -2),
    completed_at: new Date(`${addDays(date, -2)}T10:00:00Z`).toISOString(),
  });
  add("tasks", {
    title: "Write the journal introduction",
    project_id: journal.id,
    status: "doing",
    due_date: addDays(date, 2),
    priority: "medium",
  });
  add("events", {
    title: "A walk, without a screen",
    due_date: date,
    start_time: "17:30",
    duration: 45,
    location: "The neighborhood park",
  });
  add("events", {
    title: "Weekly reset",
    due_date: addDays(date, 2),
    start_time: "18:00",
    duration: 30,
    recurrence: { frequency: "weekly", interval: 1, weekdays: [], until: null },
  });
  const habits = [
    add("habits", {
      title: "Read a few pages",
      description: "Make a little room for a different perspective.",
      start_date: addDays(date, -28),
      color: "forest",
    }),
    add("habits", {
      title: "Move for 30 minutes",
      start_date: addDays(date, -28),
      color: "copper",
    }),
    add("habits", {
      title: "An unhurried morning",
      start_date: addDays(date, -28),
      color: "sage",
    }),
  ];
  habits.forEach((h, i) => {
    for (let d = -21; d <= 0; d++)
      if ((d + i) % 5 !== 0 && (d !== 0 || i === 0))
        add("habit_entries", { habit_id: h.id, date: addDays(date, d) });
  });
  const goal = add("goals", {
    title: "Make reading a daily ritual",
    description: "Twenty books, one page at a time.",
    measurement: "count",
    unit: "books",
    target: 20,
    start_date: addDays(date, -90),
    due_date: addDays(date, 180),
    habit_id: habits[0].id,
  });
  [2, 1, 3, 2].forEach((value, i) =>
    add("goal_entries", {
      goal_id: goal.id,
      value,
      date: addDays(date, -30 + i * 7),
      note: "Finished and reflected.",
    }),
  );
  const g = add("goals", {
    title: "A studio that feels like me",
    measurement: "milestones",
    unit: "milestones",
    start_date: addDays(date, -14),
    due_date: addDays(date, 30),
    project_id: studio.id,
  });
  ["Clear the space", "Choose the essentials", "Make it your own"].forEach(
    (title, i) =>
      add("milestones", { title, goal_id: g.id, completed: i === 0 }),
  );
  add("notes", {
    title: "A few things worth remembering",
    content:
      "# A little more intention\n\nThe days feel different when I choose what to pay attention to.\n\n> Make room for the work that only you can do.\n\n## This week\n\n- Protect the first hour of the morning\n- Finish one thing before starting another\n- Leave some space for the unexpected",
    folder: "Reflections",
    pinned: true,
    tags: ["Personal"],
  });
  add("notes", {
    title: "Studio — materials & mood",
    content:
      "# Materials & mood\n\nWarm oak. Linen. A good reading light.\n\nA workspace should feel like an invitation, not an obligation.",
    folder: "Ideas",
    project_id: studio.id,
    tags: ["Home"],
  });
  add("notes", {
    title: "The art of a quieter weekend",
    content: "A long walk, a new recipe, and a book that takes its time.",
    folder: "Personal",
    favorite: true,
  });
  for (let i = 1; i <= 6; i++)
    for (let n = 0; n < (i % 3) + 1; n++)
      add("tasks", {
        title: `Sample completed task ${i}.${n}`,
        status: "done",
        due_date: addDays(date, -i),
        completed_at: new Date(`${addDays(date, -i)}T12:00:00Z`).toISOString(),
      });
  return data;
}
