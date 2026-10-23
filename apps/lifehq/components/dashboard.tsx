"use client";
import { useRouter } from "next/navigation";
import { Temporal } from "@js-temporal/polyfill";
import {
  ArrowUpRight,
  Plus,
  Check,
  Sun,
  ArrowRight,
  Leaf,
  Target,
  NotebookPen,
} from "lucide-react";
import {
  Button,
  Badge,
  Progress,
  SectionTitle,
  TextLink,
  Empty,
} from "@lifehq/ui";
import { today, addDays, schedule, habitScheduled } from "@lifehq/shared/dates";
import {
  projectProgress,
  goalProgress,
  percent,
  completionTrend,
} from "@lifehq/shared/analytics";
import { useWorkspace } from "@/lib/store";
import { TaskLine } from "./tasks-projects";
import dynamic from "next/dynamic";
const TrendChart = dynamic(
  () => import("./analytics-settings").then((m) => m.TrendChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="chart-skeleton"
        role="status"
        aria-label="Loading completion chart"
      />
    ),
  },
);
import { timeLabel } from "./calendar";
import type { OpenEditor } from "./entity-editor";
export function Dashboard({ edit }: { edit: OpenEditor }) {
  const {
    data,
    preferences,
    demo,
    toggleHabit,
    toggleScheduled,
    toast,
    loadSamples,
  } = useWorkspace();
  const router = useRouter();
  const date = today(preferences.timezone),
    base = demo ? "/demo" : "/workspace";
  const daily = schedule(data, date, date),
    open = data.tasks.filter((t) => t.status !== "done" && !t.parent_id),
    priorities = open
      .filter(
        (t) =>
          !t.recurrence &&
          (t.priority === "high" ||
            t.priority === "urgent" ||
            t.due_date === date),
      )
      .sort(
        (a, b) =>
          ["urgent", "high", "medium", "low"].indexOf(a.priority) -
          ["urgent", "high", "medium", "low"].indexOf(b.priority),
      )
      .slice(0, 5);
  const habits = data.habits.filter(
    (h) => !h.archived && habitScheduled(h, date),
  );
  const habitDone = habits.filter((h) =>
    data.habit_entries.some((e) => e.habit_id === h.id && e.date === date),
  ).length;
  const tasksToday = daily.filter((i) => i.kind === "task"),
    doneToday = tasksToday.filter((t) => t.status === "done").length;
  const projects = data.projects.filter((p) => p.status === "active");
  const go = (path: string) => router.push(`${base}/${path}`);
  const hour = Temporal.Now.zonedDateTimeISO(preferences.timezone).hour;
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const allEmpty =
    data.tasks.length +
      data.projects.length +
      data.notes.length +
      data.habits.length +
      data.goals.length +
      data.events.length ===
    0;
  const sections: Record<string, React.ReactNode> = {
    priorities: (
      <section key="priorities" className="dashboard-section span-seven">
        <SectionTitle
          eyebrow="MAKE SPACE FOR WHAT MATTERS"
          title="A few things to focus on"
          action={<TextLink onClick={() => go("tasks")}>All tasks</TextLink>}
        />
        {priorities.length ? (
          <div className="priority-list">
            {priorities.map((t, i) => (
              <div className="priority-row" key={t.id}>
                <span className="priority-index">0{i + 1}</span>
                <TaskLine task={t} edit={edit} />
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="What matters most today?"
            description="Choose a priority or schedule a task. Keep your focus here."
            action={
              <Button
                variant="secondary"
                onClick={() =>
                  edit("tasks", undefined, { priority: "high", due_date: date })
                }
              >
                <Plus size={15} />
                Set a priority
              </Button>
            }
          />
        )}
        <button
          className="quiet-add"
          onClick={() => edit("tasks", undefined, { due_date: date })}
        >
          <Plus size={16} />
          Make room for something else
        </button>
      </section>
    ),
    schedule: (
      <section
        key="schedule"
        className="dashboard-section span-five daily-rhythm"
      >
        <SectionTitle
          eyebrow="ONE THING AT A TIME"
          title="The shape of your day"
          action={<TextLink onClick={() => go("planner")}>Planner</TextLink>}
        />
        {daily.length ? (
          <div className="daily-timeline">
            {daily.slice(0, 5).map((item) => (
              <div className={`daily-item ${item.kind}`} key={item.key}>
                <span className="timeline-dot" />
                <time>{timeLabel(item.time, preferences.time_format)}</time>
                <div className="grow">
                  <button
                    onClick={() => {
                      if (item.kind === "task") {
                        const t = data.tasks.find((t) => t.id === item.id);
                        if (t) edit("tasks", t);
                      } else go("planner");
                    }}
                  >
                    {item.title}
                  </button>
                  <small>
                    {item.kind === "project"
                      ? "Deadline"
                      : `${item.duration} minutes · ${item.timezone}`}
                  </small>
                </div>
                {item.kind === "task" && (
                  <button
                    className="task-check"
                    aria-label={`Complete scheduled ${item.title}`}
                    aria-pressed={item.status === "done"}
                    onClick={() =>
                      void toggleScheduled(item).catch((e) => toast(e.message))
                    }
                  >
                    {item.status === "done" && <Check size={13} />}
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="schedule-empty">
            <Sun size={28} />
            <p>A little breathing room.</p>
            <span>Your schedule is clear today.</span>
            <TextLink
              onClick={() => edit("events", undefined, { due_date: date })}
            >
              Plan a moment
            </TextLink>
          </div>
        )}
        <button className="schedule-footer" onClick={() => go("planner")}>
          <span>
            {schedule(data, addDays(date, 1), addDays(date, 7)).length} upcoming
            in the next 7 days
          </span>
          <ArrowRight size={16} />
        </button>
      </section>
    ),
    projects: (
      <section key="projects" className="dashboard-section span-seven">
        <SectionTitle
          eyebrow="THINGS TAKING SHAPE"
          title="Your ongoing projects"
          action={
            <TextLink onClick={() => go("projects")}>All projects</TextLink>
          }
        />
        {projects.length ? (
          <div className="dashboard-projects">
            {projects.slice(0, 3).map((p, i) => {
              const v = projectProgress(data, p.id);
              return (
                <button
                  key={p.id}
                  className={`mini-project accent-${p.color}`}
                  onClick={() => go(`projects?id=${p.id}`)}
                >
                  <div className="between">
                    <span className="mini-project-symbol">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <ArrowUpRight size={16} />
                  </div>
                  <h3>{p.title}</h3>
                  <div className="between">
                    <span>
                      {v.done} / {v.total} tasks
                    </span>
                    <strong>{percent(v.done, v.total)}%</strong>
                  </div>
                  <Progress value={percent(v.done, v.total)} label={p.title} />
                </button>
              );
            })}
          </div>
        ) : (
          <Empty
            title="Give an idea a little structure."
            description="A project brings the small steps together."
            action={
              <Button variant="secondary" onClick={() => edit("projects")}>
                Start a project
              </Button>
            }
          />
        )}
      </section>
    ),
    habits: (
      <section key="habits" className="dashboard-section span-five">
        <SectionTitle
          eyebrow="SMALL THINGS, DONE OFTEN"
          title="Your daily rituals"
          action={
            <Badge tone="forest">
              {habitDone} / {habits.length}
            </Badge>
          }
        />
        {habits.length ? (
          <div className="daily-habits">
            {habits.map((h) => {
              const done = data.habit_entries.some(
                (e) => e.habit_id === h.id && e.date === date,
              );
              return (
                <button
                  key={h.id}
                  className={done ? "checked" : ""}
                  onClick={() =>
                    void toggleHabit(h, date).catch((e) => toast(e.message))
                  }
                  aria-pressed={done}
                >
                  <span className="ritual-icon">
                    <Leaf size={16} />
                  </span>
                  <span className="grow">{h.title}</span>
                  <span className="ritual-check">
                    {done ? <Check size={14} /> : <Plus size={14} />}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <Empty
            title="Begin with something small."
            description="Choose a habit you want to make room for."
            action={
              <Button variant="secondary" onClick={() => edit("habits")}>
                Add a ritual
              </Button>
            }
          />
        )}
        <TextLink onClick={() => go("habits")}>See your consistency</TextLink>
      </section>
    ),
    goals: (
      <section key="goals" className="dashboard-section span-seven">
        <SectionTitle
          eyebrow="A DIRECTION WORTH PURSUING"
          title="A little closer"
          action={<TextLink onClick={() => go("goals")}>Your goals</TextLink>}
        />
        {data.goals
          .filter((g) => !g.archived)
          .slice(0, 3)
          .map((g) => {
            const p = goalProgress(data, g, preferences.timezone);
            return (
              <button
                className="dashboard-goal"
                onClick={() => go("goals")}
                key={g.id}
              >
                <span className="goal-icon">
                  <Target size={20} />
                </span>
                <div className="grow">
                  <div className="between">
                    <h3>{g.title}</h3>
                    <strong>{percent(p.value, p.target)}%</strong>
                  </div>
                  <p>
                    {p.value} of {p.target}{" "}
                    {g.measurement === "milestones" ? "milestones" : g.unit}
                  </p>
                  <Progress
                    value={percent(p.value, p.target)}
                    label={g.title}
                  />
                </div>
              </button>
            );
          })}
        {!data.goals.some((g) => !g.archived) && (
          <Empty
            title="Where would you like to go?"
            description="Make a goal measurable. Notice each small step."
            action={
              <Button variant="secondary" onClick={() => edit("goals")}>
                Set a goal
              </Button>
            }
          />
        )}
      </section>
    ),
    notes: (
      <section key="notes" className="dashboard-section span-five">
        <SectionTitle
          eyebrow="IDEAS, KEPT CLOSE"
          title="From your notebook"
          action={<TextLink onClick={() => go("notes")}>All notes</TextLink>}
        />
        {data.notes
          .slice()
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          .slice(0, 3)
          .map((n) => (
            <button
              key={n.id}
              className="dashboard-note"
              onClick={() => go(`notes?id=${n.id}`)}
            >
              <NotebookPen size={18} />
              <div className="grow">
                <h3>{n.title}</h3>
                <span>
                  {n.folder} ·{" "}
                  {n.content.trim() ? n.content.trim().split(/\s+/).length : 0}{" "}
                  words
                </span>
              </div>
              <ArrowUpRight size={15} />
            </button>
          ))}
        {!data.notes.length && (
          <Empty
            title="A place for a thought."
            description="Save an idea before it slips away."
            action={
              <Button variant="secondary" onClick={() => edit("notes")}>
                Open a fresh page
              </Button>
            }
          />
        )}
      </section>
    ),
    week: (
      <section key="week" className="dashboard-section span-full">
        <div className="week-panel">
          <div>
            <span className="eyebrow">YOUR WEEK, AT A GLANCE</span>
            <h2>Progress has a rhythm.</h2>
            <p>
              {completionTrend(
                data,
                addDays(date, -6),
                date,
                preferences.timezone,
              ).reduce((s, d) => s + d.tasks, 0)}{" "}
              tasks completed in the last seven days.
              <br />
              Every small step counts.
            </p>
            <TextLink onClick={() => go("review")}>
              Take a moment to reflect
            </TextLink>
          </div>
          <div className="grow">
            <TrendChart />
          </div>
        </div>
      </section>
    ),
  };
  return (
    <>
      <div className="dashboard-welcome">
        <div>
          <span className="eyebrow">YOUR DAY, WITH INTENTION</span>
          <h1>
            {greeting}, {preferences.name.split(" ")[0]}
            <span className="welcome-period">.</span>
          </h1>
          <p>
            {tasksToday.length
              ? `${tasksToday.length - doneToday} tasks to move forward. A little focus can go a long way.`
              : "A fresh page. A little space for what matters to you."}
          </p>
        </div>
        <div className="date-stamp">
          <span>
            {Temporal.PlainDate.from(date).toLocaleString("en", {
              weekday: "long",
            })}
          </span>
          <strong>{Temporal.PlainDate.from(date).day}</strong>
          <span>
            {Temporal.PlainDate.from(date).toLocaleString("en", {
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
      </div>
      <div className="daily-summary">
        <div>
          <span className="summary-mark">
            <Check size={17} />
          </span>
          <strong>
            {doneToday}
            <span> / {tasksToday.length}</span>
          </strong>
          <span>tasks today</span>
        </div>
        <div>
          <span className="summary-mark">
            <Leaf size={17} />
          </span>
          <strong>
            {habitDone}
            <span> / {habits.length}</span>
          </strong>
          <span>daily rituals</span>
        </div>
        <div>
          <span className="summary-mark">
            <Target size={17} />
          </span>
          <strong>{projects.length}</strong>
          <span>active projects</span>
        </div>
        <Button size="sm" variant="ghost" onClick={() => go("review")}>
          Daily reflection
          <ArrowUpRight size={14} />
        </Button>
      </div>
      {allEmpty && (
        <div className="onboarding">
          <div>
            <h2>Let’s make this space yours.</h2>
            <p>
              Start with one task, a meaningful project, or a thought you want
              to keep.
            </p>
          </div>
          <div className="row wrap">
            <Button onClick={() => edit("tasks")}>
              <Plus size={16} />
              Your first task
            </Button>
            {demo && (
              <Button variant="secondary" onClick={loadSamples}>
                Explore sample workspace
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="dashboard-grid">
        {preferences.dashboard.map((key) => sections[key])}
      </div>
      <div className="dashboard-signoff">
        <span />A little more intention. A little more you.
        <span />
      </div>
    </>
  );
}
