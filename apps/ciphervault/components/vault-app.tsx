"use client";
import Link from "next/link";
import { ThemeToggle } from "@lifehq/ui/theme";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Shield,
  Vault,
  LockKeyhole,
  UnlockKeyhole,
  Plus,
  Search,
  KeyRound,
  NotebookPen,
  Star,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Download,
  Upload,
  Settings2,
  Trash2,
  ArrowRight,
  Check,
  ChevronRight,
} from "lucide-react";
import { Button, Field, Modal, Badge, Empty, download } from "@lifehq/ui";
import {
  createVault,
  unlockVault,
  encryptVault,
  changePassphrase,
  generatePassword,
  strength,
  parseBackup,
  entrySchema,
  type Unlocked,
  type Envelope,
  type Entry,
} from "@/lib/crypto";
import { readEncrypted, writeEncrypted } from "@/lib/storage";
export function VaultApp() {
  const [envelope, setEnvelope] = useState<Envelope | null>(null),
    [session, setSession] = useState<Unlocked | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [pass, setPass] = useState(""),
    [confirmPass, setConfirmPass] = useState(""),
    [acknowledge, setAcknowledge] = useState(false),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [editing, setEditing] = useState<Entry | null | undefined>(undefined),
    [deleting, setDeleting] = useState<Entry | null>(null),
    [settings, setSettings] = useState(false),
    [idleMinutes, setIdleMinutes] = useState(5),
    [restore, setRestore] = useState<Envelope | null>(null),
    [restorePass, setRestorePass] = useState(""),
    [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null),
    current = useRef<Unlocked | null>(null),
    lastActivity = useRef(0),
    channel = useRef<BroadcastChannel | null>(null),
    epoch = useRef(0),
    noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  current.current = session;
  const notify = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 6000);
  }, []);
  const lock = useCallback(() => {
    epoch.current++;
    current.current = null;
    setSession(null);
    setPass("");
    setConfirmPass("");
    setQuery("");
    setEditing(undefined);
    setSelectedId(null);
    setDeleting(null);
    setSettings(false);
    setRestorePass("");
    setRestore(null);
    setBusy(false);
    lastActivity.current = Date.now();
  }, []);
  useEffect(() => {
    void readEncrypted()
      .then(setEnvelope)
      .catch(() =>
        setError(
          "Local storage could not be read. Do not clear your browser data; restore from an encrypted backup if needed.",
        ),
      )
      .finally(() => setLoading(false));
    try {
      const value = Number(localStorage.getItem("ciphervault-idle"));
      if ([1, 2, 5, 10, 15].includes(value)) setIdleMinutes(value);
    } catch {
      /* Nonsensitive preference is optional. */
    }
    channel.current = new BroadcastChannel("ciphervault-updates");
    channel.current.onmessage = () => {
      lock();
      void readEncrypted()
        .then(setEnvelope)
        .catch(() =>
          setError("Unable to read the latest vault. Reload this page."),
        );
      notify("Vault changed in another tab. Unlock again to continue.");
    };
    return () => {
      channel.current?.close();
    };
  }, [lock, notify]);
  const unlocked = !!session;
  useEffect(() => {
    if (!unlocked) return;
    lastActivity.current = Date.now();
    const activity = () => {
      if (Date.now() - lastActivity.current >= idleMinutes * 60000) {
        lock();
        notify("Vault locked after inactivity.");
      } else lastActivity.current = Date.now();
    };
    const tick = () => {
      if (Date.now() - lastActivity.current >= idleMinutes * 60000) {
        lock();
        notify("Vault locked after inactivity.");
      }
    };
    const visibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    const pagehide = () => lock();
    ["pointerdown", "keydown", "touchstart"].forEach((event) =>
      window.addEventListener(event, activity, { passive: true }),
    );
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pagehide);
    const timer = setInterval(tick, 1000);
    return () => {
      clearInterval(timer);
      ["pointerdown", "keydown", "touchstart"].forEach((event) =>
        window.removeEventListener(event, activity),
      );
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pagehide);
    };
  }, [unlocked, idleMinutes, lock, notify]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const attempt = epoch.current;
    try {
      if (!envelope && (!acknowledge || pass !== confirmPass))
        throw new Error("Confirm your passphrase and the prototype warning.");
      const unlocked = envelope
        ? await unlockVault(envelope, pass)
        : await createVault(pass);
      if (epoch.current !== attempt) return;
      if (!envelope) {
        await writeEncrypted(unlocked.envelope, null);
        channel.current?.postMessage("updated");
      }
      setEnvelope(unlocked.envelope);
      setSession(unlocked);
      setPass("");
      setConfirmPass("");
      lastActivity.current = Date.now();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open vault");
    } finally {
      setBusy(false);
    }
  }
  async function persist(entries: Entry[]) {
    const active = current.current;
    if (!active) throw new Error("The vault is locked.");
    const attempt = epoch.current;
    const next = await encryptVault({ entries }, active.key, active.envelope);
    if (epoch.current !== attempt)
      throw new Error("Vault locked before saving. Unlock and try again.");
    await writeEncrypted(next, active.envelope.nonce);
    if (epoch.current !== attempt) {
      setEnvelope(next);
      return;
    }
    setEnvelope(next);
    setSession({ ...active, envelope: next, vault: { entries } });
    channel.current?.postMessage("updated");
  }
  async function saveEntry(entry: Entry) {
    setBusy(true);
    try {
      if (!current.current) throw new Error("Vault is locked");
      await persist([
        ...current.current.vault.entries.filter((e) => e.id !== entry.id),
        entry,
      ]);
      setEditing(undefined);
      setSelectedId(entry.id);
      notify("Encrypted and saved locally");
    } finally {
      setBusy(false);
    }
  }
  const entries =
    session?.vault.entries
      .filter(
        (e) =>
          `${e.title} ${e.username} ${e.url} ${e.notes} ${e.category}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (filter === "all" ||
            (filter === "favorites" && e.favorite) ||
            (filter === "credentials" && e.kind === "credential") ||
            (filter === "notes" && e.kind === "note") ||
            filter === `category:${e.category}`),
      )
      .sort((a, b) => a.title.localeCompare(b.title)) || [];
  const selected = session?.vault.entries.find((e) => e.id === selectedId);
  const categories = [
    ...new Set(session?.vault.entries.map((e) => e.category) || []),
  ];
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      notify("Copied. Clipboard clearing depends on browser permissions.");
      setTimeout(async () => {
        try {
          const permission = await navigator.permissions.query({
            name: "clipboard-read" as PermissionName,
          });
          if (
            permission.state === "granted" &&
            (await navigator.clipboard.readText()) === value
          )
            await navigator.clipboard.writeText("");
        } catch {
          /* Browser does not permit reading/clearing; never claim it was cleared. */
        }
      }, 20000);
    } catch {
      notify(
        "Clipboard access was denied. Reveal the value and copy it manually.",
      );
    }
  }
  return (
    <div className="vault-app">
      <header className="vault-header">
        <Link className="vault-brand" href="/">
          <span>
            <Vault size={24} />
          </span>
          CipherVault<span className="vault-brand-dot">.</span>
        </Link>
        <div className="row">
          <ThemeToggle />
          <Badge tone={session ? "forest" : "neutral"}>
            {session ? <UnlockKeyhole size={12} /> : <LockKeyhole size={12} />}
            {session ? "Unlocked locally" : "Vault locked"}
          </Badge>
          {session && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                lock();
                notify("Vault locked");
              }}
            >
              <LockKeyhole size={14} />
              Lock
            </Button>
          )}
        </div>
      </header>
      <div className="prototype-banner">
        <Shield size={15} />
        <span>
          <strong>DEVELOPMENT PROTOTYPE</strong> Not independently audited. Use
          dummy credentials only. Unsuitable for real credentials until expert
          review.
        </span>
      </div>
      {loading ? (
        <main id="main" className="loading">
          <span className="spinner" />
          Opening local storage…
        </main>
      ) : !session ? (
        <main id="main" className="vault-gate">
          <section className="vault-gate-story">
            <span className="eyebrow">
              PRIVATE BY DESIGN. LOCAL BY DEFAULT.
            </span>
            <h1>
              Your secrets.
              <br />
              <em>Your custody.</em>
            </h1>
            <p>
              A separate space, kept in this browser.
              <br />
              Your vault passphrase is independent of LifeHQ.
            </p>
            <div className="lock-illustration" aria-hidden="true">
              <div />
              <div />
              <div />
              <span>
                <LockKeyhole size={42} strokeWidth={1} />
              </span>
            </div>
            <div className="vault-guarantees">
              <span>
                <Check size={14} />
                Client-side encryption
              </span>
              <span>
                <Check size={14} />
                No cloud synchronization
              </span>
              <span>
                <Check size={14} />
                No AI or analytics
              </span>
            </div>
          </section>
          <section className="vault-gate-form">
            <div className="vault-lock-icon">
              <LockKeyhole size={27} strokeWidth={1.5} />
            </div>
            <span className="eyebrow">
              {envelope ? "YOUR LOCAL VAULT" : "A SEPARATE SPACE"}
            </span>
            <h2>{envelope ? "Welcome back." : "Create your local vault."}</h2>
            <p>
              {envelope
                ? "Unlock with your master passphrase."
                : "Use a long, unique master passphrase. Only you will know it."}
            </p>
            <form onSubmit={login} className="form-stack">
              <Field
                label="Master passphrase"
                hint={
                  envelope
                    ? undefined
                    : "At least 16 characters. Several unrelated words work well."
                }
              >
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  autoComplete="off"
                  required
                  minLength={envelope ? 1 : 16}
                  maxLength={256}
                />
              </Field>
              {!envelope && (
                <>
                  <Field label="Confirm master passphrase">
                    <input
                      type="password"
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                      autoComplete="off"
                      required
                      minLength={16}
                      maxLength={256}
                    />
                  </Field>
                  <label className="check-label prototype-ack">
                    <input
                      type="checkbox"
                      checked={acknowledge}
                      onChange={(e) => setAcknowledge(e.target.checked)}
                      required
                    />
                    <span>
                      I’ll use dummy credentials. I understand there is no
                      passphrase recovery.
                    </span>
                  </label>
                </>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <Button disabled={busy} type="submit">
                {busy
                  ? "Deriving encryption key…"
                  : envelope
                    ? "Unlock vault"
                    : "Create encrypted vault"}
                <ArrowRight size={16} />
              </Button>
            </form>
            <div className="vault-recovery-note">
              <strong>No reset link. No recovery service.</strong>
              <p>
                Forgetting your passphrase or clearing browser data can
                permanently erase access. Keep an encrypted backup.
              </p>
            </div>
            <Button variant="ghost" onClick={() => input.current?.click()}>
              <Upload size={15} />
              Restore encrypted backup
            </Button>
          </section>
        </main>
      ) : (
        <main
          id="main"
          className={`vault-workspace ${selected ? "has-selection" : ""}`}
        >
          <aside className="vault-sidebar">
            <span className="eyebrow">YOUR VAULT</span>
            {[
              { id: "all", title: "All items", icon: Shield },
              { id: "favorites", title: "Favorites", icon: Star },
              { id: "credentials", title: "Credentials", icon: KeyRound },
              { id: "notes", title: "Secure notes", icon: NotebookPen },
            ].map((item) => (
              <button
                key={item.id}
                className={`vault-nav ${filter === item.id ? "active" : ""}`}
                onClick={() => {
                  setFilter(item.id);
                  setSelectedId(null);
                }}
              >
                <item.icon size={17} />
                <span>{item.title}</span>
                {item.id === "all" && (
                  <small>{session.vault.entries.length}</small>
                )}
              </button>
            ))}
            <span className="eyebrow vault-category-label">CATEGORIES</span>
            {categories.map((c) => (
              <button
                className={`vault-nav ${filter === `category:${c}` ? "active" : ""}`}
                key={c}
                onClick={() => setFilter(`category:${c}`)}
              >
                <span className="category-dot" />
                {c}
              </button>
            ))}
            <div className="vault-sidebar-bottom">
              <button
                className="vault-nav"
                onClick={() =>
                  download(
                    `ciphervault-backup-${new Date().toISOString().slice(0, 10)}.json`,
                    JSON.stringify(envelope, null, 2),
                  )
                }
              >
                <Download size={16} />
                Encrypted backup
              </button>
              <button
                className="vault-nav"
                onClick={() => input.current?.click()}
              >
                <Upload size={16} />
                Restore backup
              </button>
              <button className="vault-nav" onClick={() => setSettings(true)}>
                <Settings2 size={16} />
                Vault settings
              </button>
              <p>
                <LockKeyhole size={12} />
                Auto-lock after {idleMinutes} minutes
              </p>
            </div>
          </aside>
          <section className="vault-items">
            <div className="vault-items-heading">
              <div>
                <span className="eyebrow">ONLY ON THIS DEVICE</span>
                <h2>
                  {filter === "all"
                    ? "Your private collection."
                    : filter === "favorites"
                      ? "Kept close."
                      : filter === "notes"
                        ? "A private thought."
                        : filter === "credentials"
                          ? "Your credentials."
                          : filter.replace("category:", "")}
                </h2>
              </div>
              <Button size="sm" onClick={() => setEditing(null)}>
                <Plus size={15} />
                New item
              </Button>
            </div>
            <div className="vault-search">
              <Search size={17} />
              <input
                aria-label="Search vault"
                placeholder="Find an item…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="vault-item-list">
              {entries.length ? (
                entries.map((entry) => (
                  <button
                    key={entry.id}
                    className={`vault-item ${selectedId === entry.id ? "selected" : ""}`}
                    onClick={() => setSelectedId(entry.id)}
                  >
                    <span className="credential-icon">
                      {entry.kind === "note" ? (
                        <NotebookPen size={20} />
                      ) : (
                        entry.title.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <div className="grow">
                      <strong>{entry.title}</strong>
                      <small>
                        {entry.kind === "note"
                          ? "Secure note"
                          : entry.username || entry.category}
                      </small>
                    </div>
                    {entry.favorite && <Star size={13} />}
                    <ChevronRight size={14} />
                  </button>
                ))
              ) : (
                <Empty
                  title={
                    query
                      ? "No matching items."
                      : "A little privacy, organized."
                  }
                  description={
                    query
                      ? "Try a title, category, or username."
                      : "Create a dummy credential or secure note to explore your local vault."
                  }
                  action={
                    !query && (
                      <Button onClick={() => setEditing(null)}>
                        <Plus size={15} />
                        Add your first item
                      </Button>
                    )
                  }
                />
              )}
            </div>
          </section>
          <section className="vault-detail">
            {selected ? (
              <EntryDetail
                key={selected.id}
                entry={selected}
                onEdit={() => setEditing(selected)}
                onDelete={() => setDeleting(selected)}
                onCopy={copy}
                onBack={() => setSelectedId(null)}
                onFavorite={() =>
                  void saveEntry({
                    ...selected,
                    favorite: !selected.favorite,
                    updated_at: new Date().toISOString(),
                  }).catch((e) => notify(e.message))
                }
              />
            ) : (
              <div className="vault-detail-empty">
                <Shield size={44} strokeWidth={1} />
                <h2>
                  Private things.
                  <br />A little more order.
                </h2>
                <p>Select an item to see its details.</p>
                <span>ENCRYPTED LOCALLY · AES-256-GCM</span>
              </div>
            )}
          </section>
        </main>
      )}
      <input
        hidden
        ref={input}
        type="file"
        accept="application/json,.json"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            if (file.size > 7_000_000) throw new Error("Backup exceeds 7 MB");
            setRestore(parseBackup(await file.text()));
            setRestorePass("");
            setError("");
          } catch (e) {
            notify(e instanceof Error ? e.message : "Invalid backup");
          }
          e.target.value = "";
        }}
      />
      {session && editing !== undefined && (
        <EntryEditor
          entry={editing}
          onSave={saveEntry}
          onClose={() => setEditing(undefined)}
          busy={busy}
        />
      )}
      {session && deleting && (
        <Modal
          open
          onOpenChange={(v) => {
            if (!v) setDeleting(null);
          }}
          title="Delete this item?"
          description="The item will be removed from the local vault. Older encrypted backups may still contain it."
        >
          <p>{deleting.title}</p>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Keep item
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await persist(
                    session.vault.entries.filter((e) => e.id !== deleting.id),
                  );
                  setDeleting(null);
                  setSelectedId(null);
                  notify("Item removed from local vault");
                } catch (e) {
                  notify(e instanceof Error ? e.message : "Unable to delete");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete item
            </Button>
          </div>
        </Modal>
      )}
      {session && settings && (
        <VaultSettings
          idleMinutes={idleMinutes}
          onIdleChange={(value) => {
            setIdleMinutes(value);
            localStorage.setItem("ciphervault-idle", String(value));
          }}
          onClose={() => setSettings(false)}
          onChangePassphrase={async (old, next) => {
            const active = current.current;
            if (!active) throw new Error("Vault locked");
            const attempt = epoch.current;
            const updated = await changePassphrase(active, old, next);
            if (attempt !== epoch.current)
              throw new Error("Vault locked before passphrase change");
            await writeEncrypted(updated.envelope, active.envelope.nonce);
            setEnvelope(updated.envelope);
            if (attempt === epoch.current) setSession(updated);
            channel.current?.postMessage("updated");
            notify("Passphrase changed. Export a new encrypted backup.");
          }}
        />
      )}
      {restore && (
        <Modal
          open
          onOpenChange={(v) => {
            if (!v) {
              setRestore(null);
              setRestorePass("");
            }
          }}
          title="Restore encrypted backup"
          description="Restoring replaces the vault in this browser. Export your current encrypted backup first. The backup passphrase is required."
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const attempt = epoch.current;
              try {
                const unlocked = await unlockVault(restore, restorePass);
                if (attempt !== epoch.current) return;
                await writeEncrypted(
                  unlocked.envelope,
                  envelope?.nonce || null,
                );
                setEnvelope(unlocked.envelope);
                setSession(unlocked);
                setRestore(null);
                setRestorePass("");
                setSelectedId(null);
                setEditing(undefined);
                channel.current?.postMessage("updated");
                notify("Encrypted backup authenticated and restored");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Unable to restore");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Backup master passphrase">
              <input
                type="password"
                autoComplete="off"
                value={restorePass}
                onChange={(e) => setRestorePass(e.target.value)}
                required
                maxLength={256}
              />
            </Field>
            <label className="check-label">
              <input type="checkbox" required />
              <span>Replace this browser’s local vault with the backup.</span>
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Authenticating backup…" : "Authenticate & restore"}
            </Button>
          </form>
        </Modal>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      <footer className="vault-footer">
        <span>CIPHERVAULT / LOCAL PROTOTYPE</span>
        <span>Independent security review required before real use.</span>
      </footer>
    </div>
  );
}
function EntryDetail({
  entry,
  onEdit,
  onDelete,
  onCopy,
  onBack,
  onFavorite,
}: {
  entry: Entry;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: (s: string) => Promise<void>;
  onBack: () => void;
  onFavorite: () => void;
}) {
  const [reveal, setReveal] = useState(false);
  return (
    <>
      <div className="vault-detail-toolbar">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← All items
        </Button>
        <div className="grow" />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle favorite"
          aria-pressed={entry.favorite}
          onClick={onFavorite}
        >
          <Star size={17} fill={entry.favorite ? "currentColor" : "none"} />
        </Button>
        <Button variant="secondary" size="sm" onClick={onEdit}>
          Edit item
        </Button>
      </div>
      <div className="entry-detail-body">
        <span className="large-credential-icon">
          {entry.kind === "note" ? (
            <NotebookPen size={30} />
          ) : (
            entry.title[0].toUpperCase()
          )}
        </span>
        <h1>{entry.title}</h1>
        <Badge>{entry.category}</Badge>
        {entry.kind === "credential" && (
          <>
            <div className="secret-field">
              <span className="eyebrow">USERNAME</span>
              <div className="row">
                <span className="grow secret-text">
                  {entry.username || "Not set"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Copy username"
                  onClick={() => void onCopy(entry.username)}
                >
                  <Copy size={16} />
                </Button>
              </div>
            </div>
            <div className="secret-field">
              <span className="eyebrow">PASSWORD</span>
              <div className="row">
                <span className="grow secret-text secret-password">
                  {reveal ? entry.password : "••••••••••••••••"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={reveal ? "Hide password" : "Reveal password"}
                  onClick={() => setReveal((r) => !r)}
                >
                  {reveal ? <EyeOff size={17} /> : <Eye size={17} />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Copy password"
                  onClick={() => void onCopy(entry.password)}
                >
                  <Copy size={16} />
                </Button>
              </div>
              <small>{strength(entry.password).label}</small>
            </div>
            {entry.url && (
              <div className="secret-field">
                <span className="eyebrow">WEBSITE</span>
                <a href={entry.url} rel="noopener noreferrer" target="_blank">
                  {entry.url}
                </a>
              </div>
            )}
          </>
        )}
        {entry.notes && (
          <div className="secret-field">
            <span className="eyebrow">PRIVATE NOTES</span>
            <p className="secure-note-text">{entry.notes}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void onCopy(entry.notes)}
            >
              <Copy size={14} />
              Copy note
            </Button>
          </div>
        )}
        <div className="entry-footer">
          <span>Updated {new Date(entry.updated_at).toLocaleDateString()}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete item"
            onClick={onDelete}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>
    </>
  );
}
function EntryEditor({
  entry,
  onSave,
  onClose,
  busy,
}: {
  entry: Entry | null;
  onSave: (entry: Entry) => Promise<void>;
  onClose: () => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<Entry>(
      () =>
        entry || {
          id: crypto.randomUUID(),
          kind: "credential",
          title: "",
          username: "",
          password: "",
          url: "",
          notes: "",
          category: "Personal",
          favorite: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
    ),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(false),
    [show, setShow] = useState(false),
    [length, setLength] = useState(24),
    [symbols, setSymbols] = useState(true);
  const score = strength(draft.password);
  const change = (patch: Partial<Entry>) => {
    setDirty(true);
    setDraft((d) => ({ ...d, ...patch }));
  };
  const close = () => {
    if (!busy && (!dirty || confirm("Discard this unsaved item?"))) onClose();
  };
  return (
    <Modal
      open
      onOpenChange={(v) => {
        if (!v) close();
      }}
      title={entry ? "Edit private item" : "A new private item"}
      description="Use dummy credentials only. This prototype has not been independently audited."
      wide
    >
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await onSave(
              entrySchema.parse({
                ...draft,
                updated_at: new Date().toISOString(),
              }),
            );
          } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to save");
          }
        }}
      >
        <div className="form-grid">
          <Field label="Item type">
            <select
              value={draft.kind}
              onChange={(e) =>
                change({ kind: e.target.value as Entry["kind"] })
              }
            >
              <option value="credential">Credential</option>
              <option value="note">Secure note</option>
            </select>
          </Field>
          <Field label="Category">
            <input
              value={draft.category}
              onChange={(e) => change({ category: e.target.value })}
              required
              maxLength={80}
            />
          </Field>
          <div className="field-wide">
            <Field label="Title">
              <input
                value={draft.title}
                onChange={(e) => change({ title: e.target.value })}
                required
                maxLength={200}
                autoComplete="off"
              />
            </Field>
          </div>
          {draft.kind === "credential" && (
            <>
              <Field label="Username / email">
                <input
                  value={draft.username}
                  onChange={(e) => change({ username: e.target.value })}
                  autoComplete="off"
                  maxLength={500}
                />
              </Field>
              <Field label="Website">
                <input
                  value={draft.url}
                  onChange={(e) => change({ url: e.target.value })}
                  placeholder="https://example.test"
                  maxLength={2048}
                />
              </Field>
              <div className="field-wide">
                <Field label="Password">
                  <div className="row">
                    <input
                      type={show ? "text" : "password"}
                      value={draft.password}
                      onChange={(e) => change({ password: e.target.value })}
                      autoComplete="off"
                      maxLength={4096}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      aria-label="Toggle password visibility"
                      onClick={() => setShow((v) => !v)}
                    >
                      {show ? <EyeOff size={17} /> : <Eye size={17} />}
                    </Button>
                  </div>
                </Field>
                <div className="strength-indicator" aria-label={score.label}>
                  {[1, 2, 3, 4].map((v) => (
                    <span
                      key={v}
                      className={v <= score.level ? "filled" : ""}
                    />
                  ))}
                </div>
                <p className="subtle">
                  {score.label} · Heuristic only; no breach lookup.
                </p>
              </div>
              <div className="password-generator field-wide">
                <div className="between">
                  <h3>Password generator</h3>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      change({ password: generatePassword(length, symbols) })
                    }
                  >
                    <RefreshCw size={14} />
                    Generate
                  </Button>
                </div>
                <div className="row">
                  <Field label={`Length: ${length}`}>
                    <input
                      type="range"
                      min={16}
                      max={64}
                      value={length}
                      onChange={(e) => setLength(Number(e.target.value))}
                    />
                  </Field>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={symbols}
                      onChange={(e) => setSymbols(e.target.checked)}
                    />
                    Symbols
                  </label>
                </div>
              </div>
            </>
          )}
          <div className="field-wide">
            <Field label="Private notes">
              <textarea
                value={draft.notes}
                onChange={(e) => change({ notes: e.target.value })}
                maxLength={50000}
                autoComplete="off"
              />
            </Field>
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={draft.favorite}
              onChange={(e) => change({ favorite: e.target.checked })}
            />
            Keep in favorites
          </label>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            <LockKeyhole size={15} />
            {busy ? "Encrypting…" : "Encrypt & save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function VaultSettings({
  idleMinutes,
  onIdleChange,
  onClose,
  onChangePassphrase,
}: {
  idleMinutes: number;
  onIdleChange: (n: number) => void;
  onClose: () => void;
  onChangePassphrase: (old: string, next: string) => Promise<void>;
}) {
  const [old, setOld] = useState(""),
    [next, setNext] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
      title="Vault settings"
      description="Your local encryption boundary, in a few considered choices."
    >
      <div className="stack">
        <Field label="Lock after inactivity">
          <select
            value={idleMinutes}
            onChange={(e) => onIdleChange(Number(e.target.value))}
          >
            {[1, 2, 5, 10, 15].map((n) => (
              <option key={n} value={n}>
                {n} minute{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </Field>
        <hr className="divider" />
        <h3>Change master passphrase</h3>
        <p className="subtle">
          The vault is re-encrypted with a new salt and key. Older backups still
          require the old passphrase.
        </p>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            if (next !== confirmation) {
              setError("New passphrases do not match");
              return;
            }
            setBusy(true);
            try {
              await onChangePassphrase(old, next);
              setOld("");
              setNext("");
              setConfirmation("");
              onClose();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Unable to change passphrase",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Current master passphrase">
            <input
              type="password"
              autoComplete="off"
              value={old}
              onChange={(e) => setOld(e.target.value)}
              required
              maxLength={256}
            />
          </Field>
          <Field label="New master passphrase">
            <input
              type="password"
              autoComplete="off"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              minLength={16}
              maxLength={256}
            />
          </Field>
          <Field label="Confirm new master passphrase">
            <input
              type="password"
              autoComplete="off"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              required
              minLength={16}
              maxLength={256}
            />
          </Field>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Re-encrypting…" : "Change & re-encrypt"}
          </Button>
        </form>
        <div className="warning">
          Browser encryption cannot protect against malware, malicious
          extensions, compromised application code, or someone using an unlocked
          vault. JavaScript cannot guarantee secure memory erasure.
        </div>
      </div>
    </Modal>
  );
}
