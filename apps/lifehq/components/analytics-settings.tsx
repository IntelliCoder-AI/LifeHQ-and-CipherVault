"use client";
import { useState } from "react";
import { useTheme } from "@lifehq/ui/theme";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { Download, Save, Trash2, Check } from "lucide-react";
import {
  Button,
  Field,
  Progress,
  SectionTitle,
  Modal,
  download,
  Badge,
} from "@lifehq/ui";
import { schemas, defaults, type Preferences } from "@lifehq/shared";
import { today, addDays, weekStart } from "@lifehq/shared/dates";
import {
  completionTrend,
  goalProgress,
  projectProgress,
  percent,
  habitStats,
} from "@lifehq/shared/analytics";
import { useWorkspace } from "@/lib/store";
import type { RemoveRequest } from "./tasks-projects";
export function TrendChart({ days = 7 }: { days?: number }) {
  const { data, preferences } = useWorkspace();
  const date = today(preferences.timezone),
    trend = completionTrend(
      data,
      addDays(date, -days + 1),
      date,
      preferences.timezone,
    );
  return (
    <>
      <div
        className="chart"
        role="img"
        aria-label={`Task and habit completions over ${days} days; data table follows.`}
      >
        <ResponsiveContainer width="100%" height={185}>
          <BarChart
            data={trend}
            margin={{ top: 15, right: 0, left: -30, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--line)"
              strokeDasharray="3 4"
            />
            <XAxis
              dataKey="date"
              tickFormatter={(s) => String(s).slice(8)}
              tick={{ fill: "var(--muted)", fontSize: 13 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--muted)", fontSize: 13 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                color: "var(--ink)",
              }}
            />
            <Bar
              isAnimationActive={false}
              dataKey="tasks"
              name="Completed tasks"
              fill="var(--accent-primary)"
              radius={[3, 3, 0, 0]}
              maxBarSize={18}
            />
            <Bar
              isAnimationActive={false}
              dataKey="habits"
              name="Habit check-ins"
              fill="var(--copper)"
              radius={[3, 3, 0, 0]}
              maxBarSize={18}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="row subtle chart-legend">
        <span className="legend-dot forest" />
        Tasks
        <span className="legend-dot copper" />
        Habits
      </div>
      <details className="data-details">
        <summary>View chart data</summary>
        <table>
          <caption className="sr-only">Daily completions</caption>
          <thead>
            <tr>
              <th>Date</th>
              <th>Tasks</th>
              <th>Habits</th>
            </tr>
          </thead>
          <tbody>
            {trend.map((t) => (
              <tr key={t.date}>
                <td>{t.date}</td>
                <td>{t.tasks}</td>
                <td>{t.habits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
export function AnalyticsPage({ remove }: { remove: RemoveRequest }) {
  const { data, preferences, save, toast } = useWorkspace();
  const date = today(preferences.timezone);
  const [range, setRange] = useState(7),
    [period, setPeriod] = useState<"daily" | "weekly">("weekly"),
    [review, setReview] = useState(""),
    [busy, setBusy] = useState(false);
  const trend = completionTrend(
      data,
      addDays(date, -range + 1),
      date,
      preferences.timezone,
    ),
    prior = completionTrend(
      data,
      addDays(date, -range * 2 + 1),
      addDays(date, -range),
      preferences.timezone,
    ),
    done = trend.reduce((s, t) => s + t.tasks, 0),
    priorDone = prior.reduce((s, t) => s + t.tasks, 0),
    habitDone = trend.reduce((s, t) => s + t.habits, 0),
    overdue = data.tasks.filter(
      (t) =>
        t.status !== "done" && t.due_date && t.due_date < date && !t.recurrence,
    ).length;
  return (
    <div className="stack">
      <div className="between">
        <p className="muted">
          Notice what’s working. Make room for what’s next.
        </p>
        <div className="tab-bar">
          <button aria-pressed={range === 7} onClick={() => setRange(7)}>
            Week
          </button>
          <button aria-pressed={range === 30} onClick={() => setRange(30)}>
            Month
          </button>
        </div>
      </div>
      <div className="analytics-stats">
        <div>
          <span className="eyebrow">TASKS COMPLETED</span>
          <strong>{done}</strong>
          <p>
            {done - priorDone >= 0 ? "+" : ""}
            {done - priorDone} vs previous {range} days
          </p>
        </div>
        <div>
          <span className="eyebrow">HABIT CHECK-INS</span>
          <strong>{habitDone}</strong>
          <p>Small steps recorded</p>
        </div>
        <div>
          <span className="eyebrow">NEEDS ATTENTION</span>
          <strong>{overdue}</strong>
          <p>Open tasks past their due date</p>
        </div>
      </div>
      <section className="paper-panel">
        <SectionTitle
          eyebrow="YOUR RHYTHM"
          title="A little progress, every day"
        />
        <TrendChart days={range} />
      </section>
      <div className="two-column">
        <section className="paper-panel">
          <SectionTitle title="Projects, in perspective" />
          {data.projects
            .filter((p) => p.status !== "archived")
            .map((p) => {
              const v = projectProgress(data, p.id);
              return (
                <div className="progress-row" key={p.id}>
                  <div className="between">
                    <strong>{p.title}</strong>
                    <span>
                      {v.done}/{v.total}
                    </span>
                  </div>
                  <Progress value={percent(v.done, v.total)} label={p.title} />
                </div>
              );
            })}
          {!data.projects.length && (
            <p className="subtle">
              Project progress appears when you add tasks.
            </p>
          )}
        </section>
        <section className="paper-panel">
          <SectionTitle title="Habit consistency" />
          {data.habits
            .filter((h) => !h.archived)
            .map((h) => {
              const s = habitStats(h, data.habit_entries, date);
              return (
                <div className="progress-row" key={h.id}>
                  <div className="between">
                    <strong>{h.title}</strong>
                    <span>{s.consistency}%</span>
                  </div>
                  <Progress value={s.consistency} label={h.title} />
                  <small className="subtle">
                    {s.completed} check-ins / {s.scheduled} scheduled check-ins
                    since start
                  </small>
                </div>
              );
            })}
          {!data.habits.length && (
            <p className="subtle">Your first check-in starts the story.</p>
          )}
        </section>
      </div>
      <section className="paper-panel">
        <SectionTitle title="Goals over time" />
        {data.goals
          .filter((g) => !g.archived)
          .map((g) => {
            const p = goalProgress(data, g, preferences.timezone);
            const entries = data.goal_entries
              .filter((e) => e.goal_id === g.id)
              .sort((a, b) => a.date.localeCompare(b.date));
            let cumulative = 0;
            const series = entries.map((e) => ({
              date: e.date,
              value: (cumulative += e.value),
            }));
            return (
              <div className="goal-trend" key={g.id}>
                <div className="between">
                  <h3>{g.title}</h3>
                  <Badge>
                    {p.value} / {p.target}
                  </Badge>
                </div>
                {series.length > 1 ? (
                  <>
                    <div
                      role="img"
                      aria-label={`${g.title} cumulative progress; entries in data table below.`}
                      className="chart"
                    >
                      <ResponsiveContainer width="100%" height={150}>
                        <LineChart data={series}>
                          <XAxis
                            dataKey="date"
                            tick={{ fill: "var(--muted)", fontSize: 13 }}
                            tickFormatter={(s) => String(s).slice(5)}
                          />
                          <YAxis
                            tick={{ fill: "var(--muted)", fontSize: 13 }}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "var(--surface)",
                              color: "var(--ink)",
                            }}
                          />
                          <Line
                            isAnimationActive={false}
                            dataKey="value"
                            stroke="var(--accent-primary)"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <details className="data-details">
                      <summary>View progress data</summary>
                      <table>
                        <tbody>
                          {series.map((e, i) => (
                            <tr key={i}>
                              <td>{e.date}</td>
                              <td>{e.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  </>
                ) : (
                  <Progress
                    value={percent(p.value, p.target)}
                    label={g.title}
                  />
                )}
              </div>
            );
          })}
        {!data.goals.length && (
          <p className="subtle">
            Add a goal and record progress to see your journey.
          </p>
        )}
      </section>
      <section className="review-panel">
        <div>
          <span className="eyebrow">PAUSE. NOTICE. BEGIN AGAIN.</span>
          <h2>A moment to reflect.</h2>
          <p>
            What moved forward? What felt meaningful?
            <br />
            What deserves your attention next?
          </p>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await save(
                "reviews",
                schemas.reviews.parse({
                  title: `${period === "weekly" ? "Weekly" : "Daily"} review — ${date}`,
                  period,
                  date: period === "weekly" ? weekStart(date) : date,
                  content: review,
                }),
              );
              setReview("");
              toast("Reflection saved");
            } catch (e) {
              toast(e instanceof Error ? e.message : "Unable to save");
            } finally {
              setBusy(false);
            }
          }}
          className="form-stack"
        >
          <select
            aria-label="Review period"
            value={period}
            onChange={(e) => setPeriod(e.target.value as "daily" | "weekly")}
          >
            <option value="daily">Daily review</option>
            <option value="weekly">Weekly review</option>
          </select>
          <textarea
            aria-label="Reflection"
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="A few honest words…"
            required
          />
          <Button type="submit" disabled={busy || !review.trim()}>
            <Save size={16} />
            Save reflection
          </Button>
        </form>
      </section>
      {data.reviews.length > 0 && (
        <section className="paper-panel">
          <SectionTitle title="Past reflections" />
          {data.reviews
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((r) => (
              <article className="review-entry" key={r.id}>
                <div className="between">
                  <h3>{r.title}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${r.title}`}
                    onClick={() => remove("reviews", r)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
                <p>{r.content}</p>
              </article>
            ))}
        </section>
      )}
    </div>
  );
}
export function SettingsPage() {
  const { theme } = useTheme();
  const {
    data,
    preferences,
    setPreferences,
    demo,
    email,
    loadSamples,
    clearDemo,
    toast,
  } = useWorkspace();
  const router = useRouter();
  const [draft, setDraft] = useState(preferences),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [password, setPassword] = useState("");
  const change = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await setPreferences({ ...draft, theme });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save settings");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-layout">
      <form onSubmit={submit} className="stack">
        <section className="paper-panel">
          <SectionTitle eyebrow="MAKE YOURSELF AT HOME" title="Your profile" />
          <div className="form-grid">
            <Field label="Display name">
              <input
                value={draft.name}
                onChange={(e) => change("name", e.target.value)}
                required
                maxLength={80}
              />
            </Field>
            <Field label="Account">
              <input
                readOnly
                value={demo ? "Local demo — no account" : email}
              />
            </Field>
          </div>
        </section>
        <section className="paper-panel">
          <SectionTitle title="The way you work" />
          <div className="form-grid">
            <Field label="Appearance">
              <select
                value={theme}
                onChange={(e) => {
                  void setPreferences({
                    ...preferences,
                    theme: e.target.value as Preferences["theme"],
                  }).catch((e) =>
                    toast(
                      e instanceof Error
                        ? e.message
                        : "Theme could not be synced.",
                    ),
                  );
                }}
              >
                <option value="light">Daylight</option>
                <option value="dark">Moonlight</option>
                <option value="system">Follow system</option>
              </select>
            </Field>
            <Field label="Timezone">
              <input
                list="timezones"
                value={draft.timezone}
                onChange={(e) => change("timezone", e.target.value)}
                required
              />
              <datalist id="timezones">
                {Intl.supportedValuesOf("timeZone").map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Field>
            <Field label="Week starts on">
              <select
                value={draft.week_start}
                onChange={(e) =>
                  change("week_start", e.target.value as "monday" | "sunday")
                }
              >
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
              </select>
            </Field>
            <Field label="Date format">
              <select
                value={draft.date_format}
                onChange={(e) =>
                  change(
                    "date_format",
                    e.target.value as Preferences["date_format"],
                  )
                }
              >
                <option value="dmy">Day / month / year</option>
                <option value="mdy">Month / day / year</option>
                <option value="iso">Year-month-day</option>
              </select>
            </Field>
            <Field label="Time format">
              <select
                value={draft.time_format}
                onChange={(e) =>
                  change("time_format", e.target.value as "12" | "24")
                }
              >
                <option value="12">12-hour clock</option>
                <option value="24">24-hour clock</option>
              </select>
            </Field>
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={draft.reminders}
              onChange={(e) => change("reminders", e.target.checked)}
            />
            Show upcoming in-app reminders
          </label>
          <p className="subtle">
            Reminders appear while LifeHQ is open. This app does not send push
            notifications.
          </p>
        </section>
        <section className="paper-panel">
          <SectionTitle title="Customize Overview" />
          <p className="subtle">
            Choose the sections shown on your Overview page. Move them up or
            down to set their order, then save preferences. This does not change
            the sidebar navigation.
          </p>
          <div className="dashboard-settings">
            {[
              ...draft.dashboard,
              ...defaults.dashboard.filter((k) => !draft.dashboard.includes(k)),
            ].map((k, i) => (
              <div className="between" key={k}>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={draft.dashboard.includes(k)}
                    onChange={(e) =>
                      change(
                        "dashboard",
                        e.target.checked
                          ? [...draft.dashboard, k]
                          : draft.dashboard.filter((x) => x !== k),
                      )
                    }
                  />
                  {k[0].toUpperCase() + k.slice(1)}
                </label>
                {draft.dashboard.includes(k) && (
                  <div className="dashboard-order-actions">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={i === 0}
                      aria-label={`Move ${k} up`}
                      onClick={() => {
                        const list = [...draft.dashboard];
                        [list[i - 1], list[i]] = [list[i], list[i - 1]];
                        change("dashboard", list);
                      }}
                    >
                      Move up
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Move ${k} down`}
                      disabled={i === draft.dashboard.length - 1}
                      onClick={() => {
                        const list = [...draft.dashboard];
                        [list[i], list[i + 1]] = [list[i + 1], list[i]];
                        change("dashboard", list);
                      }}
                    >
                      Move down
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="between">
          <span className="subtle">Changes apply when saved.</span>
          <Button disabled={busy} type="submit">
            <Check size={16} />
            {busy ? "Saving…" : "Save preferences"}
          </Button>
        </div>
      </form>
      <aside className="stack">
        <section className="paper-panel">
          <span className="eyebrow">YOUR DATA BELONGS TO YOU</span>
          <h2>Take it with you.</h2>
          <p className="settings-copy">
            Export your workspace as JSON, including tasks, notes, goals, habit
            history, and preferences.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              download(
                `lifehq-export-${today(preferences.timezone)}.json`,
                JSON.stringify(
                  {
                    format: "lifehq",
                    version: 1,
                    exported_at: new Date().toISOString(),
                    preferences,
                    data,
                  },
                  null,
                  2,
                ),
              );
              toast("Workspace exported");
            }}
          >
            <Download size={16} />
            Export all data
          </Button>
        </section>
        {demo ? (
          <section className="paper-panel">
            <h3>Local demo</h3>
            <p className="settings-copy">
              Demo data is saved in this browser only. It is separate from
              signed-in accounts.
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                if (
                  confirm(
                    "Replace the current local demo with labeled sample data?",
                  )
                )
                  loadSamples();
              }}
            >
              Load sample data
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (confirm("Permanently clear local demo data?")) clearDemo();
              }}
            >
              Clear demo
            </Button>
          </section>
        ) : (
          <section className="paper-panel danger-panel">
            <h3>Delete account</h3>
            <p className="settings-copy">
              Permanently erase your LifeHQ profile and all workspace records.
              Export first if you need a copy.
            </p>
            <Button variant="ghost" onClick={() => setDeleting(true)}>
              <Trash2 size={16} />
              Delete my account
            </Button>
          </section>
        )}
      </aside>
      {deleting && (
        <Modal
          open
          onOpenChange={setDeleting}
          title="Delete your account?"
          description="All LifeHQ records will be permanently erased. This cannot be undone."
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const res = await fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "delete",
                    confirmation,
                    password,
                  }),
                });
                const r = await res.json();
                if (!res.ok) throw new Error(r.error);
                router.replace("/login?notice=account-deleted");
                router.refresh();
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Unable to delete account",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Type DELETE MY ACCOUNT">
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                required
              />
            </Field>
            <Field label="Current password">
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Button
              variant="danger"
              type="submit"
              disabled={busy || confirmation !== "DELETE MY ACCOUNT"}
            >
              Permanently delete my account
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
