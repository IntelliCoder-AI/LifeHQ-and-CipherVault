"use client";
import { useWorkspaceRouter } from "@/lib/navigation";
import { useState } from "react";

import {
  Plus,
  Search,
  List,
  Columns3,
  ArrowUpRight,
  Archive,
  MoreHorizontal,
  Trash2,
  RotateCcw,
  Check,
  Flag,
} from "lucide-react";
import { Button, Badge, Empty, Progress, SectionTitle } from "@lifehq/ui";
import { schemas, type Row, type Table } from "@lifehq/shared";
import { today, dateLabel } from "@lifehq/shared/dates";
import { projectProgress, percent } from "@lifehq/shared/analytics";
import { useWorkspace } from "@/lib/store";
import type { OpenEditor } from "./entity-editor";
export type RemoveRequest = (table: Table, row: Row<Table>) => void;
export function TaskLine({
  task,
  edit,
  remove,
  select,
  selected = false,
}: {
  task: Row<"tasks">;
  edit: OpenEditor;
  remove?: RemoveRequest;
  select?: (id: string) => void;
  selected?: boolean;
}) {
  const { data, preferences, update, toast } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const date = today(preferences.timezone),
    project = data.projects.find((p) => p.id === task.project_id),
    subtasks = data.tasks.filter((t) => t.parent_id === task.id);
  return (
    <div
      className={`task-line ${task.status === "done" ? "task-complete" : ""}`}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("task", task.id)}
    >
      {select && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => select(task.id)}
          aria-label={`Select ${task.title}`}
        />
      )}
      <button
        className="task-check"
        disabled={busy || !!task.recurrence}
        aria-label={
          task.recurrence
            ? "Complete recurring tasks in the planner"
            : `Mark ${task.title} ${task.status === "done" ? "incomplete" : "complete"}`
        }
        aria-pressed={task.status === "done"}
        onClick={async () => {
          setBusy(true);
          try {
            await update("tasks", task, {
              status: task.status === "done" ? "todo" : "done",
            });
          } catch (e) {
            toast(e instanceof Error ? e.message : "Unable to save");
          } finally {
            setBusy(false);
          }
        }}
      >
        {task.status === "done" ? (
          <Check size={14} />
        ) : task.recurrence ? (
          <RotateCcw size={12} />
        ) : null}
      </button>
      <button className="task-title grow" onClick={() => edit("tasks", task)}>
        <span>{task.title}</span>
        <small>
          {project?.title || task.category}
          {subtasks.length
            ? ` · ${subtasks.filter((t) => t.status === "done").length}/${subtasks.length} checklist`
            : ""}
        </small>
      </button>
      <div className="task-meta">
        {task.due_date && (
          <span
            className={
              task.due_date < date && task.status !== "done"
                ? "overdue-text"
                : "subtle"
            }
          >
            {task.due_date === date
              ? "Today"
              : dateLabel(task.due_date, preferences.date_format)}
          </span>
        )}
        <Badge tone={task.priority}>
          <Flag size={10} />
          {task.priority}
        </Badge>
      </div>
      {remove && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${task.title}`}
          onClick={() => remove("tasks", task)}
        >
          <Trash2 size={15} />
        </Button>
      )}
    </div>
  );
}
function TaskBoard({
  tasks,
  edit,
}: {
  tasks: Row<"tasks">[];
  edit: OpenEditor;
}) {
  const { update, toast } = useWorkspace();
  return (
    <div className="board">
      {(["todo", "doing", "done"] as const).map((status) => (
        <section
          key={status}
          className="board-column"
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => {
            e.preventDefault();
            const task = tasks.find(
              (t) => t.id === e.dataTransfer.getData("task"),
            );
            if (task) {
              try {
                if (task.recurrence && status === "done")
                  throw new Error(
                    "Complete recurring occurrences in the planner.",
                  );
                await update("tasks", task, { status });
              } catch (e) {
                toast(e instanceof Error ? e.message : "Unable to save");
              }
            }
          }}
        >
          <div className="board-heading">
            <span className={`status-dot ${status}`} />
            <h3>
              {status === "todo"
                ? "To do"
                : status === "doing"
                  ? "In progress"
                  : "Complete"}
            </h3>
            <span className="subtle">
              {tasks.filter((t) => t.status === status).length}
            </span>
          </div>
          {tasks
            .filter((t) => t.status === status)
            .map((t) => (
              <article
                key={t.id}
                className="board-card"
                draggable
                onDragStart={(e) => e.dataTransfer.setData("task", t.id)}
              >
                <button
                  onClick={() => edit("tasks", t)}
                  className="board-card-title"
                >
                  {t.title}
                </button>
                <p className="subtle">
                  {t.description.slice(0, 100) || t.category}
                </p>
                <div className="between">
                  <Badge tone={t.priority}>{t.priority}</Badge>
                  <select
                    aria-label={`Status of ${t.title}`}
                    value={t.status}
                    onChange={(e) =>
                      void update("tasks", t, {
                        status: e.target.value as "todo",
                      }).catch((e) => toast(e.message))
                    }
                  >
                    <option value="todo">To do</option>
                    <option value="doing">In progress</option>
                    <option value="done" disabled={!!t.recurrence}>
                      Complete
                    </option>
                  </select>
                </div>
              </article>
            ))}
          <button
            className="board-add"
            onClick={() => edit("tasks", undefined, { status })}
          >
            <Plus size={15} />
            Add task
          </button>
        </section>
      ))}
    </div>
  );
}
export function TasksPage({
  edit,
  remove,
  projectId,
}: {
  edit: OpenEditor;
  remove: RemoveRequest;
  projectId?: string;
}) {
  const { data, save, preferences, bulk, toast, update } = useWorkspace();
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("active"),
    [priority, setPriority] = useState("all"),
    [project, setProject] = useState("all"),
    [sort, setSort] = useState("due"),
    [view, setView] = useState("list"),
    [quick, setQuick] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  const date = today(preferences.timezone);
  const tasks = data.tasks
    .filter(
      (t) =>
        !t.parent_id &&
        (!projectId || t.project_id === projectId) &&
        (project === "all" || t.project_id === project) &&
        (priority === "all" || t.priority === priority) &&
        `${t.title} ${t.description} ${t.tags.join(" ")} ${t.category}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (filter === "all" ||
          (filter === "active" && t.status !== "done") ||
          (filter === "done" && t.status === "done") ||
          (filter === "overdue" &&
            t.status !== "done" &&
            !!t.due_date &&
            t.due_date < date)),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "priority"
          ? ["urgent", "high", "medium", "low"].indexOf(a.priority) -
            ["urgent", "high", "medium", "low"].indexOf(b.priority)
          : (a.due_date || "9999").localeCompare(b.due_date || "9999"),
    );
  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!quick.trim()) return;
    setBusy(true);
    try {
      await save(
        "tasks",
        schemas.tasks.parse({
          title: quick,
          project_id: projectId || null,
          timezone: preferences.timezone,
        }),
      );
      setQuick("");
      toast("Task added");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to add task");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <div className="toolbar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search tasks"
            placeholder="Find a task, tag, or category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="tab-bar">
          <button
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List size={16} />
            List
          </button>
          <button
            aria-pressed={view === "board"}
            onClick={() => setView("board")}
          >
            <Columns3 size={16} />
            Board
          </button>
        </div>
      </div>
      <div className="filter-bar">
        <select
          aria-label="Task filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="active">Open tasks</option>
          <option value="all">All tasks</option>
          <option value="overdue">Overdue</option>
          <option value="done">Completed archive</option>
        </select>
        <select
          aria-label="Priority filter"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="all">All priorities</option>
          {["urgent", "high", "medium", "low"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        {!projectId && (
          <select
            aria-label="Project filter"
            value={project}
            onChange={(e) => setProject(e.target.value)}
          >
            <option value="all">All projects</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Sort tasks"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="due">By due date</option>
          <option value="priority">By priority</option>
          <option value="title">By title</option>
        </select>
        <span className="subtle">{tasks.length} tasks</span>
      </div>
      <form className="quick-add" onSubmit={quickAdd}>
        <Plus size={18} />
        <input
          aria-label="Quick-add task"
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          placeholder="Add a task. Make a little room in your mind."
          maxLength={200}
        />
        <Button type="submit" size="sm" disabled={busy || !quick.trim()}>
          Add task
        </Button>
      </form>
      {selected.length > 0 && (
        <div className="selection-bar">
          <span>{selected.length} selected</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              void bulk(selected, "done")
                .then(() => setSelected([]))
                .catch((e) => toast(e.message))
            }
          >
            Complete selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            Clear
          </Button>
        </div>
      )}
      {view === "board" ? (
        <TaskBoard tasks={tasks} edit={edit} />
      ) : tasks.length ? (
        <div className="paper-panel task-list">
          {tasks.map((t) => (
            <TaskLine
              key={t.id}
              task={t}
              edit={edit}
              remove={remove}
              select={(id) =>
                setSelected((s) =>
                  s.includes(id) ? s.filter((i) => i !== id) : [...s, id],
                )
              }
              selected={selected.includes(t.id)}
            />
          ))}
        </div>
      ) : (
        <Empty
          title={
            filter === "done"
              ? "Your wins will live here."
              : "A little space to begin."
          }
          description="Add something you want to move forward, however small."
          action={
            <Button
              onClick={() =>
                edit("tasks", undefined, { project_id: projectId || null })
              }
            >
              <Plus size={16} />
              New task
            </Button>
          }
        />
      )}
      {filter === "done" && (
        <section className="paper-panel">
          <SectionTitle title="Completed recurring occurrences" />
          {data.task_occurrences
            .filter((o) => o.status === "done")
            .filter((o) => {
              const t = data.tasks.find((t) => t.id === o.task_id);
              return (
                t &&
                (!projectId || t.project_id === projectId) &&
                (project === "all" || t.project_id === project) &&
                (priority === "all" || t.priority === priority) &&
                t.title.toLowerCase().includes(query.toLowerCase())
              );
            })
            .sort((a, b) =>
              (b.completed_at || "").localeCompare(a.completed_at || ""),
            )
            .map((o) => (
              <div className="history-entry" key={o.id}>
                <time>
                  {dateLabel(o.scheduled_date, preferences.date_format)}
                </time>
                <span className="grow">
                  {data.tasks.find((t) => t.id === o.task_id)?.title}
                </span>
                <Badge tone="done">Complete</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void update("task_occurrences", o, {
                      status: "todo",
                      completed_at: null,
                    }).catch((e) => toast(e.message))
                  }
                >
                  Undo
                </Button>
              </div>
            ))}
          {!data.task_occurrences.some((o) => o.status === "done") && (
            <p className="subtle">
              Completed repeating tasks will appear here.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
export function ProjectsPage({
  edit,
  remove,
  id,
}: {
  edit: OpenEditor;
  remove: RemoveRequest;
  id?: string | null;
}) {
  const { data, demo, update, toast, save } = useWorkspace();
  const router = useWorkspaceRouter();
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("active"),
    [milestone, setMilestone] = useState("");
  const project = data.projects.find((p) => p.id === id);
  if (project) {
    const progress = projectProgress(data, project.id);
    return (
      <div className="stack">
        <button
          className="text-link"
          onClick={() =>
            router.push(`${demo ? "/demo" : "/workspace"}/projects`)
          }
        >
          ← All projects
        </button>
        <section className={`project-detail-header accent-${project.color}`}>
          <div className="grow">
            <Badge tone={project.status}>{project.status}</Badge>
            <h2>{project.title}</h2>
            <p>{project.description || "A project with room to take shape."}</p>
            <div className="row">
              <span className="subtle">
                {progress.done} of {progress.total} tasks complete
              </span>
              {project.due_date && <Badge>Due {project.due_date}</Badge>}
            </div>
            <Progress
              value={percent(progress.done, progress.total)}
              label="Project progress"
            />
          </div>
          <Button variant="secondary" onClick={() => edit("projects", project)}>
            Edit project
          </Button>
        </section>
        <section className="paper-panel">
          <SectionTitle title="Milestones" />
          <div className="stack">
            {data.milestones
              .filter((m) => m.project_id === project.id)
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
                    onClick={() => remove("milestones", m)}
                    aria-label={`Delete ${m.title}`}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            <form
              className="row"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await save(
                    "milestones",
                    schemas.milestones.parse({
                      title: milestone,
                      project_id: project.id,
                    }),
                  );
                  setMilestone("");
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Unable to save");
                }
              }}
            >
              <input
                aria-label="Project milestone"
                placeholder="Name the next milestone"
                value={milestone}
                onChange={(e) => setMilestone(e.target.value)}
                required
              />
              <Button type="submit" variant="secondary">
                Add milestone
              </Button>
            </form>
          </div>
        </section>
        <TasksPage edit={edit} remove={remove} projectId={project.id} />
      </div>
    );
  }
  const list = data.projects.filter(
    (p) =>
      p.title.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" || filter === "archived"
        ? filter === "all" || p.status === "archived"
        : p.status !== "archived"),
  );
  return (
    <div className="stack">
      <div className="toolbar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search projects"
            placeholder="Find a project…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label="Project status filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="active">Current projects</option>
          <option value="archived">Archived</option>
          <option value="all">All projects</option>
        </select>
      </div>
      {list.length ? (
        <div className="project-grid">
          {list.map((p, i) => {
            const progress = projectProgress(data, p.id);
            return (
              <article className={`project-card accent-${p.color}`} key={p.id}>
                <div className="project-card-top">
                  <span className="project-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Badge tone={p.status}>{p.status}</Badge>
                </div>
                <button
                  className="project-open"
                  onClick={() =>
                    router.push(
                      `${demo ? "/demo" : "/workspace"}/projects?id=${p.id}`,
                    )
                  }
                >
                  <h2>{p.title}</h2>
                  <ArrowUpRight size={21} />
                </button>
                <p>
                  {p.description || "A little room for your next big thing."}
                </p>
                <div className="project-card-bottom">
                  <div className="between">
                    <span className="subtle">
                      {progress.done}/{progress.total} tasks
                    </span>
                    <strong>{percent(progress.done, progress.total)}%</strong>
                  </div>
                  <Progress
                    value={percent(progress.done, progress.total)}
                    label={`${p.title} progress`}
                  />
                  <div className="between">
                    <span className="subtle">
                      {p.due_date ? `Due ${p.due_date}` : "No deadline"}
                    </span>
                    <div className="row">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Edit ${p.title}`}
                        onClick={() => edit("projects", p)}
                      >
                        <MoreHorizontal size={18} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`${p.status === "archived" ? "Restore" : "Archive"} ${p.title}`}
                        onClick={() =>
                          void update("projects", p, {
                            status:
                              p.status === "archived" ? "active" : "archived",
                          }).catch((e) => toast(e.message))
                        }
                      >
                        {p.status === "archived" ? (
                          <RotateCcw size={16} />
                        ) : (
                          <Archive size={16} />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Delete ${p.title}`}
                        onClick={() => remove("projects", p)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title="What would you like to bring to life?"
          description="Give a project a name. Break it into small, meaningful steps."
          action={
            <Button onClick={() => edit("projects")}>
              <Plus size={16} />
              Create a project
            </Button>
          }
        />
      )}
    </div>
  );
}
