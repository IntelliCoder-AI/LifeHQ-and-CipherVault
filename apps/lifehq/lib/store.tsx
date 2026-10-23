"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  emptyData,
  defaults,
  schemas,
  cleanValues,
  cascadeDelete,
  type Data,
  type Preferences,
  type Table,
  type Row,
  type Values,
} from "@lifehq/shared";
import { DEMO_KEY, DEMO_USER, sampleData } from "./demo";
import { today, type Scheduled } from "@lifehq/shared/dates";
export type Store = {
  data: Data;
  preferences: Preferences;
  demo: boolean;
  loading: boolean;
  error: string;
  busy: boolean;
  email: string;
  refresh: () => Promise<void>;
  save: <T extends Table>(
    table: T,
    values: Values<T>,
    row?: Row<T>,
  ) => Promise<Row<T>>;
  remove: <T extends Table>(table: T, row: Row<T>) => Promise<void>;
  update: <T extends Table>(
    table: T,
    row: Row<T>,
    patch: Partial<Values<T>>,
  ) => Promise<Row<T>>;
  bulk: (ids: string[], status: "todo" | "doing" | "done") => Promise<void>;
  setPreferences: (p: Preferences) => Promise<void>;
  loadSamples: () => void;
  clearDemo: () => void;
  toggleHabit: (habit: Row<"habits">, date: string) => Promise<void>;
  toggleScheduled: (item: Scheduled) => Promise<void>;
  toast: (message: string) => void;
  message: string;
};
const Context = createContext<Store | null>(null);
export const useWorkspace = () => {
  const value = useContext(Context);
  if (!value) throw new Error("Missing workspace provider");
  return value;
};
async function api(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  let result;
  try {
    result = await res.json();
  } catch {
    throw new Error(
      "The server could not be reached. Your changes have not been saved.",
    );
  }
  if (!res.ok) throw new Error(result.error || "Unable to save. Please retry.");
  return result;
}
export function WorkspaceProvider({
  children,
  demo,
}: {
  children: React.ReactNode;
  demo: boolean;
}) {
  const [data, setData] = useState<Data>(emptyData),
    [preferences, setPref] = useState<Preferences>(defaults),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [pending, setPending] = useState(0),
    [email, setEmail] = useState(""),
    [message, setMessage] = useState("");
  const snapshot = useRef(data),
    prefs = useRef(preferences),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  snapshot.current = data;
  prefs.current = preferences;
  const toast = useCallback((value: string) => {
    setMessage(value);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMessage(""), 4500);
  }, []);
  const commit = useCallback(
    (next: Data, p = prefs.current) => {
      if (demo)
        localStorage.setItem(
          DEMO_KEY,
          JSON.stringify({ data: next, preferences: p }),
        );
      snapshot.current = next;
      setData(next);
    },
    [demo],
  );
  const refresh = useCallback(async () => {
    setError("");
    try {
      if (demo) {
        const saved = localStorage.getItem(DEMO_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setData({ ...emptyData(), ...parsed.data });
          setPref({ ...defaults, ...parsed.preferences });
        } else {
          setData(emptyData());
        }
      } else {
        const result = await api("/api/workspace");
        setData(result.data);
        setPref(result.preferences);
        setEmail(result.user.email);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load your workspace",
      );
    } finally {
      setLoading(false);
    }
  }, [demo]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const handler = () => {
      void refresh();
    };
    if (demo) window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [demo, refresh]);
  useEffect(() => {
    const theme =
      preferences.theme === "system"
        ? matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : preferences.theme;
    document.documentElement.dataset.theme = theme;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      if (preferences.theme === "system")
        document.documentElement.dataset.theme = media.matches
          ? "dark"
          : "light";
    };
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preferences.theme]);
  const save = useCallback(
    async <T extends Table>(
      table: T,
      values: Values<T>,
      row?: Row<T>,
    ): Promise<Row<T>> => {
      setPending((n) => n + 1);
      try {
        const parsed = schemas[table].parse(values);
        let result: Row<T>;
        if (demo) {
          const existing = row
            ? (snapshot.current[table] as Row<T>[]).find((r) => r.id === row.id)
            : undefined;
          if (row && (!existing || existing.version !== row.version))
            throw new Error("This record changed. Reopen it and try again.");
          const now = new Date().toISOString();
          result = {
            ...parsed,
            id: row?.id || crypto.randomUUID(),
            user_id: DEMO_USER,
            created_at: row?.created_at || now,
            updated_at: now,
            version: (row?.version || 0) + 1,
          } as unknown as Row<T>;
          if (table === "tasks" || table === "task_occurrences") {
            const t = result as Row<"tasks">;
            t.completed_at = t.status === "done" ? t.completed_at || now : null;
          }
          if (
            table === "habit_entries" &&
            snapshot.current.habit_entries.some(
              (e) =>
                e.habit_id === (result as Row<"habit_entries">).habit_id &&
                e.date === (result as Row<"habit_entries">).date &&
                e.id !== row?.id,
            )
          )
            throw new Error("Already checked in on this date.");
        } else {
          const response = await api(`/api/records/${table}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "save",
              values: parsed,
              id: row?.id,
              version: row?.version,
            }),
          });
          result = response.record;
        }
        const next = {
          ...snapshot.current,
          [table]: [
            ...snapshot.current[table].filter((r) => r.id !== result.id),
            result,
          ],
        } as Data;
        commit(next);
        return result;
      } finally {
        setPending((n) => n - 1);
      }
    },
    [demo, commit],
  );
  const update = useCallback(
    async <T extends Table>(table: T, row: Row<T>, patch: Partial<Values<T>>) =>
      save(table, { ...cleanValues(table, row), ...patch }, row),
    [save],
  );
  const remove = useCallback(
    async <T extends Table>(table: T, row: Row<T>) => {
      setPending((n) => n + 1);
      try {
        if (!demo) {
          await api(`/api/records/${table}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "delete",
              id: row.id,
              version: row.version,
            }),
          });
          await refresh();
        } else {
          const next = cascadeDelete(snapshot.current, table, row.id);
          commit(next);
        }
        toast("Deleted");
      } finally {
        setPending((n) => n - 1);
      }
    },
    [demo, commit, refresh, toast],
  );
  const bulk = useCallback(
    async (ids: string[], status: "todo" | "doing" | "done") => {
      if (
        status === "done" &&
        snapshot.current.tasks.some((t) => ids.includes(t.id) && t.recurrence)
      )
        throw new Error("Complete recurring occurrences in the planner.");
      if (demo) {
        const next = {
          ...snapshot.current,
          tasks: snapshot.current.tasks.map((t) =>
            ids.includes(t.id)
              ? {
                  ...t,
                  status,
                  completed_at:
                    status === "done" ? new Date().toISOString() : null,
                  version: t.version + 1,
                }
              : t,
          ),
        };
        commit(next);
      } else {
        await api("/api/records/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "bulk", ids, status }),
        });
        await refresh();
      }
      toast(`${ids.length} tasks updated`);
    },
    [demo, commit, refresh, toast],
  );
  const setPreferences = useCallback(
    async (p: Preferences) => {
      if (!demo)
        await api("/api/workspace", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        });
      else commit(snapshot.current, p);
      setPref(p);
      prefs.current = p;
      toast("Preferences saved");
    },
    [demo, commit, toast],
  );
  const toggleHabit = useCallback(
    async (habit: Row<"habits">, date: string) => {
      if (date > today(prefs.current.timezone) || date < habit.start_date)
        throw new Error(
          "Check-ins must be between the habit start date and today.",
        );
      const entry = snapshot.current.habit_entries.find(
        (e) => e.habit_id === habit.id && e.date === date,
      );
      if (entry) await remove("habit_entries", entry);
      else await save("habit_entries", { habit_id: habit.id, date });
    },
    [save, remove],
  );
  const toggleScheduled = useCallback(
    async (item: Scheduled) => {
      if (item.kind !== "task") return;
      const task = snapshot.current.tasks.find((t) => t.id === item.id);
      if (!task) return;
      if (!item.recurring) {
        await update("tasks", task, {
          status: item.status === "done" ? "todo" : "done",
        });
        return;
      }
      const entry = snapshot.current.task_occurrences.find(
        (e) => e.task_id === item.id && e.occurrence_date === item.originalDate,
      );
      await save(
        "task_occurrences",
        {
          task_id: item.id,
          occurrence_date: item.originalDate,
          scheduled_date: item.date,
          start_time: item.time,
          status: item.status === "done" ? "todo" : "done",
          completed_at:
            item.status === "done" ? null : new Date().toISOString(),
        },
        entry,
      );
    },
    [save, update],
  );
  return (
    <Context.Provider
      value={{
        data,
        preferences,
        demo,
        loading,
        error,
        busy: pending > 0,
        email,
        refresh,
        save,
        update,
        remove,
        bulk,
        setPreferences,
        loadSamples: () => {
          commit(sampleData());
          toast("Sample data loaded — local demo only");
        },
        clearDemo: () => {
          commit(emptyData());
          toast("Demo cleared");
        },
        toggleHabit,
        toggleScheduled,
        toast,
        message,
      }}
    >
      {children}
    </Context.Provider>
  );
}
