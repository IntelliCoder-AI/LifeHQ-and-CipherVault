"use client";
import { ThemeToggle } from "@lifehq/ui/theme";
import { useWorkspaceRouter } from "@/lib/navigation";
import { Suspense, useEffect, useRef, useState, useMemo } from "react";
import { WorkspaceLink as Link } from "@/lib/navigation";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Layers3,
  LayoutDashboard,
  CalendarDays,
  CheckSquare2,
  FolderKanban,
  Target,
  Leaf,
  NotebookPen,
  ChartNoAxesCombined,
  Settings2,
  Search,
  Plus,
  Bell,
  Menu,
  ArrowUpRight,
  LogOut,
  ShieldCheck,
  ArrowRight,
  LoaderCircle,
} from "lucide-react";
import { Button, Modal, Empty, Badge } from "@lifehq/ui";
import { type Row, type Table } from "@lifehq/shared";
import {
  schedule,
  today,
  addDays,
  scheduleInstant,
} from "@lifehq/shared/dates";
import { WorkspaceProvider, useWorkspace } from "@/lib/store";
import { Dashboard } from "./dashboard";
import {
  EntityEditor,
  DeleteDialog,
  type EditRequest,
  type OpenEditor,
  type Editable,
} from "./entity-editor";
import { TasksPage, ProjectsPage } from "./tasks-projects";
const CalendarPage = dynamic(() =>
  import("./calendar").then((m) => m.CalendarPage),
);
const GoalsPage = dynamic(() =>
  import("./goals-habits").then((m) => m.GoalsPage),
);
const HabitsPage = dynamic(() =>
  import("./goals-habits").then((m) => m.HabitsPage),
);
const NotesPage = dynamic(() => import("./notes").then((m) => m.NotesPage));
const AnalyticsPage = dynamic(() =>
  import("./analytics-settings").then((m) => m.AnalyticsPage),
);
const SettingsPage = dynamic(() =>
  import("./analytics-settings").then((m) => m.SettingsPage),
);
const VaultAccess = dynamic(() =>
  import("./vault-access").then((m) => m.VaultAccess),
);
const sectionLoaders: Record<string, () => Promise<unknown>> = {
  planner: () => import("./calendar"),
  goals: () => import("./goals-habits"),
  habits: () => import("./goals-habits"),
  notes: () => import("./notes"),
  review: () => import("./analytics-settings"),
  settings: () => import("./analytics-settings"),
  ciphervault: () => import("./vault-access"),
};
const navigation = [
  { id: "", label: "Overview", icon: LayoutDashboard },
  { id: "planner", label: "Daily planner", icon: CalendarDays },
  { id: "tasks", label: "Tasks", icon: CheckSquare2 },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "goals", label: "Goals", icon: Target },
  { id: "habits", label: "Habits", icon: Leaf },
  { id: "notes", label: "Notes", icon: NotebookPen },
  { id: "review", label: "Insights & reflection", icon: ChartNoAxesCombined },
];
const headings: Record<
  string,
  { title: string; description: string; create: Editable }
> = {
  tasks: {
    title: "A little more focus.",
    description: "Clear your mind. Give the next step a place.",
    create: "tasks",
  },
  planner: {
    title: "Make room for your day.",
    description: "A thoughtful rhythm for the things that matter.",
    create: "events",
  },
  projects: {
    title: "Good things take shape.",
    description: "From a small idea to something meaningful.",
    create: "projects",
  },
  goals: {
    title: "A direction of your own.",
    description: "Meaningful ambitions. Measurable steps.",
    create: "goals",
  },
  habits: {
    title: "The art of showing up.",
    description: "Small rituals for the life you want to live.",
    create: "habits",
  },
  notes: {
    title: "A home for your thoughts.",
    description: "Capture an idea. Follow a thread. Begin anywhere.",
    create: "notes",
  },
};
export function Workspace({ demo }: { demo: boolean }) {
  return (
    <Suspense fallback={<div className="loading">Opening your workspace…</div>}>
      <WorkspaceProvider demo={demo}>
        <Shell />
      </WorkspaceProvider>
    </Suspense>
  );
}
function Shell() {
  const {
    data,
    preferences,
    demo,
    loading,
    error,
    refresh,
    busy,
    toast,
    message,
    pendingDeletions,
    undoDeletion,
    setPreferences,
  } = useWorkspace();
  const pathname = usePathname(),
    router = useWorkspaceRouter(),
    params = useSearchParams();
  const section = pathname.split("/")[2] || "",
    base = demo ? "/demo" : "/workspace";
  const [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(false),
    [editRequest, setEditRequest] = useState<EditRequest | null>(null),
    [deletion, setDeletion] = useState<{
      table: Table;
      row: Row<Table>;
    } | null>(null),
    [reminders, setReminders] = useState(false),
    [quick, setQuick] = useState(false),
    [now, setNow] = useState(() => Date.now());
  const edit: OpenEditor = (table, row, initial) =>
    setEditRequest({ table, row, initial });
  const remove = (table: Table, row: Row<Table>) => setDeletion({ table, row });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const date = today(preferences.timezone);
  const upcoming = useMemo(
    () =>
      preferences.reminders
        ? schedule(data, date, addDays(date, 7))
            .filter((i) => i.status !== "done" && i.kind !== "project")
            .filter((i) => {
              const source =
                i.kind === "task"
                  ? data.tasks.find((t) => t.id === i.id)
                  : data.events.find((e) => e.id === i.id);
              if (source?.reminder_minutes == null || !i.time) return false;
              const time = Date.parse(
                scheduleInstant(i.date, i.time, i.timezone),
              );
              return (
                time >= now - 15 * 60000 &&
                time - source.reminder_minutes * 60000 <= now
              );
            })
        : [],
    [data, date, now, preferences.reminders],
  );
  async function logout() {
    if (demo) {
      router.push("/login");
      return;
    }
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      if (!r.ok) throw new Error("Unable to sign out. Try again.");
      router.push("/login");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to sign out");
    }
  }
  const sidebar = (
    <>
      <Link className="brand" href={base}>
        <span className="brand-mark">
          <Layers3 size={21} />
        </span>
        LifeHQ<span className="brand-period">.</span>
      </Link>
      <div className="workspace-label">
        <span className="workspace-avatar">
          {preferences.name[0]?.toUpperCase()}
        </span>
        <div>
          <strong>My personal space</strong>
          <small>
            {demo ? "Local demo workspace" : "A little room for everything"}
          </small>
        </div>
      </div>
      <button
        className="sidebar-search"
        onClick={() => {
          setSearch(true);
          setMobile(false);
        }}
      >
        <Search size={16} />
        <span>Find anything</span>
        <kbd>⌘ K</kbd>
      </button>
      <span className="nav-label">YOUR WORKSPACE</span>
      <nav aria-label="Main navigation">
        {navigation.map((n) => (
          <Link
            key={n.id}
            href={`${base}/${n.id}`}
            className={`nav-link ${section === n.id ? "active" : ""}`}
            aria-current={section === n.id ? "page" : undefined}
            onClick={() => setMobile(false)}
            onMouseEnter={() => {
              void sectionLoaders[n.id]?.().catch(() => {});
            }}
            onFocus={() => {
              void sectionLoaders[n.id]?.().catch(() => {});
            }}
          >
            <n.icon size={18} />
            <span>{n.label}</span>
            {n.id === "tasks" &&
              data.tasks.some((t) => t.status !== "done") && (
                <small>
                  {
                    data.tasks.filter(
                      (t) => t.status !== "done" && !t.parent_id,
                    ).length
                  }
                </small>
              )}
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <Link
          className="vault-link"
          href="/ciphervault"
          target="_blank"
          rel="noopener noreferrer"
          aria-current={section === "ciphervault" ? "page" : undefined}
          onClick={() => setMobile(false)}
        >
          <ShieldCheck size={18} />
          <div>
            <strong>CipherVault</strong>
            <small>Separate encrypted app</small>
          </div>
          <ArrowUpRight size={14} />
        </Link>
        <Link
          className={`nav-link ${section === "settings" ? "active" : ""}`}
          href={`${base}/settings`}
          onClick={() => setMobile(false)}
        >
          <Settings2 size={18} />
          <span>Settings</span>
        </Link>
        <button className="profile-button" onClick={() => void logout()}>
          <span className="profile-avatar">
            {preferences.name[0]?.toUpperCase()}
          </span>
          <span className="grow">
            <strong>{preferences.name}</strong>
            <small>{demo ? "Leave demo" : "Sign out of your space"}</small>
          </span>
          <LogOut size={15} />
        </button>
      </div>
    </>
  );
  if (section === "ciphervault") return <VaultAccess />;
  return (
    <div className="app-shell">
      <aside className="sidebar">{sidebar}</aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="row">
            <Button
              className="mobile-menu"
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </Button>
            <span className="topbar-breadcrumb">
              My space<span>/</span>
              <strong>
                {navigation.find((n) => n.id === section)?.label ||
                  (section === "ciphervault" ? "CipherVault" : "Settings")}
              </strong>
            </span>
          </div>
          <div className="row topbar-actions">
            <ThemeToggle
              onChange={(theme) =>
                setPreferences({ ...preferences, theme }).catch(() =>
                  toast(
                    "Theme changed on this device. Account preference could not be saved.",
                  ),
                )
              }
            />
            {busy && (
              <span className="subtle row">
                <LoaderCircle size={13} className="spin" />
                Saving
              </span>
            )}
            <span className="private-label">
              <span />A space of your own
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search workspace"
              onClick={() => setSearch(true)}
            >
              <Search size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Reminders, ${upcoming.length} due`}
              onClick={() => setReminders(true)}
              className="notification-button"
            >
              <Bell size={18} />
              {upcoming.length > 0 && <span />}
            </Button>
            <Button
              size="sm"
              aria-label="Quick add"
              onClick={() => setQuick(true)}
            >
              <Plus size={16} />
              <span>Quick add</span>
            </Button>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <span>
              <strong>LOCAL DEMO</strong> Saved in this browser. Sample records
              are for exploration.
            </span>
            <Link href="/login">
              Create your own space
              <ArrowUpRight size={13} />
            </Link>
          </div>
        )}
        <main
          id="main"
          className={`content ${section === "notes" ? "notes-content" : ""}`}
          tabIndex={-1}
        >
          {loading ? (
            <div className="loading">
              <span className="spinner" />
              <p>Making room for your day…</p>
            </div>
          ) : error ? (
            <Empty
              title="We couldn’t open your workspace."
              description={error}
              action={<Button onClick={() => void refresh()}>Try again</Button>}
            />
          ) : (
            <>
              {headings[section] && (
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">
                      {navigation.find((n) => n.id === section)?.label}
                    </span>
                    <h1>{headings[section].title}</h1>
                    <p>{headings[section].description}</p>
                  </div>
                  <Button onClick={() => edit(headings[section].create)}>
                    <Plus size={16} />
                    New{" "}
                    {headings[section].create === "events"
                      ? "event"
                      : headings[section].create.slice(0, -1)}
                  </Button>
                </div>
              )}
              {section === "review" && (
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">INSIGHTS & REFLECTION</span>
                    <h1>See how far you’ve come.</h1>
                  </div>
                </div>
              )}
              {section === "settings" && (
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">
                      THE DETAILS THAT MAKE IT YOURS
                    </span>
                    <h1>A space that fits you.</h1>
                  </div>
                </div>
              )}
              {section === "" ? (
                <Dashboard edit={edit} />
              ) : section === "tasks" ? (
                <TasksPage edit={edit} remove={remove} />
              ) : section === "projects" ? (
                <ProjectsPage
                  edit={edit}
                  remove={remove}
                  id={params.get("id")}
                />
              ) : section === "planner" ? (
                <CalendarPage edit={edit} remove={remove} />
              ) : section === "goals" ? (
                <GoalsPage edit={edit} remove={remove} />
              ) : section === "habits" ? (
                <HabitsPage edit={edit} remove={remove} />
              ) : section === "notes" ? (
                <NotesPage edit={edit} remove={remove} />
              ) : section === "review" ? (
                <AnalyticsPage remove={remove} />
              ) : section === "settings" ? (
                <SettingsPage />
              ) : section === "ciphervault" ? (
                <VaultAccess />
              ) : (
                <Empty
                  title="This page has moved."
                  description="Return to your overview to find your way."
                  action={
                    <Button onClick={() => router.push(base)}>Overview</Button>
                  }
                />
              )}
            </>
          )}
        </main>
      </div>
      <Modal open={mobile} onOpenChange={setMobile} title="Your workspace">
        <div className="mobile-navigation">{sidebar}</div>
      </Modal>
      <CommandPalette
        open={search}
        onClose={() => setSearch(false)}
        edit={edit}
      />
      <Modal
        open={quick}
        onOpenChange={setQuick}
        title="Make a little room."
        description="What would you like to add?"
      >
        <div className="quick-create-grid">
          {(
            [
              "tasks",
              "events",
              "projects",
              "goals",
              "habits",
              "notes",
            ] as Editable[]
          ).map((t) => (
            <Button
              variant="secondary"
              key={t}
              onClick={() => {
                setQuick(false);
                edit(t);
              }}
            >
              <Plus size={16} />
              {t[0].toUpperCase() + t.slice(1, -1)}
            </Button>
          ))}
        </div>
      </Modal>
      <Modal
        open={reminders}
        onOpenChange={setReminders}
        title="A gentle reminder."
        description={
          preferences.reminders
            ? "Reminders appear here while LifeHQ is open."
            : "In-app reminders are turned off in settings."
        }
      >
        {upcoming.length ? (
          upcoming.map((i) => (
            <button
              key={i.key}
              className="reminder-row"
              onClick={() => {
                setReminders(false);
                router.push(`${base}/planner`);
              }}
            >
              <Bell size={17} />
              <div>
                <strong>{i.title}</strong>
                <p>
                  {i.date} · {i.time} · {i.timezone}
                </p>
              </div>
              <ArrowRight size={16} />
            </button>
          ))
        ) : (
          <Empty
            title="Nothing needs your attention."
            description="Set a reminder when you schedule a task or event."
          />
        )}
      </Modal>
      {editRequest && (
        <EntityEditor
          key={`${editRequest.table}-${editRequest.row?.id || "new"}`}
          request={editRequest}
          onClose={() => setEditRequest(null)}
        />
      )}
      {deletion && (
        <DeleteDialog {...deletion} onClose={() => setDeletion(null)} />
      )}
      <div className="workspace-feedback">
        {pendingDeletions.map((item) => (
          <DeletionNotice
            key={item.id}
            item={item}
            undo={() => undoDeletion(item.id)}
            toast={toast}
          />
        ))}
        {message && (
          <div className="toast" role="status">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
function DeletionNotice({
  item,
  undo,
  toast,
}: {
  item: { label?: string; expires_at: string };
  undo: () => Promise<void>;
  toast: (message: string) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(
    0,
    Math.ceil((Date.parse(item.expires_at) - now) / 1000),
  );
  return (
    <div className="toast undo-toast" role="status">
      <span>
        {remaining ? (
          <>
            Deleting {item.label || "record"}.{" "}
            <span aria-hidden="true">{remaining}s</span>
            <span className="sr-only">You have ten seconds to undo.</span>
          </>
        ) : (
          <>Finishing deletion of {item.label || "record"}…</>
        )}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={busy || !remaining}
        aria-label={`Undo deletion of ${item.label || "record"}`}
        onClick={async () => {
          setBusy(true);
          try {
            await undo();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Could not undo deletion.");
            setBusy(false);
          }
        }}
      >
        Undo
      </Button>
    </div>
  );
}
function CommandPalette({
  open,
  onClose,
  edit,
}: {
  open: boolean;
  onClose: () => void;
  edit: OpenEditor;
}) {
  const { data, demo } = useWorkspace();
  const router = useWorkspaceRouter();
  const [query, setQuery] = useState(""),
    [index, setIndex] = useState(0);
  const base = demo ? "/demo" : "/workspace",
    input = useRef<HTMLInputElement>(null);
  const items = [
    ...navigation.map((n) => ({
      id: `nav-${n.id}`,
      title: n.label,
      type: "Go to",
      action: () => router.push(`${base}/${n.id}`),
    })),
    ...(
      ["tasks", "projects", "goals", "notes", "habits", "events"] as Editable[]
    ).map((t) => ({
      id: `new-${t}`,
      title: `New ${t.slice(0, -1)}`,
      type: "Create",
      action: () => edit(t),
    })),
    ...(["tasks", "projects", "goals", "notes"] as const).flatMap((t) =>
      data[t].map((r) => ({
        id: r.id,
        title: r.title,
        type: t.slice(0, -1),
        action: () => {
          if (t === "projects" || t === "notes")
            router.push(`${base}/${t}?id=${r.id}`);
          else edit(t, r);
        },
      })),
    ),
  ]
    .filter((i) => i.title.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 30);
  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
    }
  }, [open]);
  useEffect(() => {
    document
      .getElementById(`command-${index}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);
  function choose(i: number) {
    items[i]?.action();
    onClose();
  }
  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title="Find your next step."
      description="Search your workspace, jump to a page, or create something new."
    >
      <div className="command-input">
        <Search size={19} />
        <input
          ref={input}
          autoFocus
          role="combobox"
          aria-label="Search commands and records"
          aria-expanded="true"
          aria-controls="command-results"
          aria-activedescendant={
            items.length
              ? `command-${Math.min(index, items.length - 1)}`
              : undefined
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          placeholder="What are you looking for?"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => (i + 1) % Math.max(1, items.length));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex(
                (i) => (i - 1 + items.length) % Math.max(1, items.length),
              );
            }
            if (e.key === "Enter") {
              e.preventDefault();
              choose(index);
            }
          }}
        />
      </div>
      <div
        id="command-results"
        role="listbox"
        aria-label="Results"
        className="command-results"
      >
        {items.map((item, i) => (
          <button
            key={item.id}
            id={`command-${i}`}
            role="option"
            aria-selected={index === i}
            className={index === i ? "selected" : ""}
            onMouseMove={() => setIndex(i)}
            onClick={() => choose(i)}
          >
            <span className="grow">{item.title}</span>
            <Badge>{item.type}</Badge>
            <ArrowRight size={14} />
          </button>
        ))}
        {!items.length && (
          <p className="empty">
            No matches. Try a title or choose a shorter search.
          </p>
        )}
      </div>
      <p className="subtle command-help">
        ↑ ↓ to move · Enter to select · Esc to close
      </p>
    </Modal>
  );
}
