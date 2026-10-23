"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Search,
  Plus,
  Pin,
  Star,
  Copy,
  Download,
  Upload,
  Trash2,
  ArrowLeft,
  Check,
  Eye,
  Pencil,
} from "lucide-react";
import { Button, Empty, Field, download } from "@lifehq/ui";
import { cleanValues, schemas, type Row } from "@lifehq/shared";
import { useWorkspace } from "@/lib/store";
import type { OpenEditor } from "./entity-editor";
import type { RemoveRequest } from "./tasks-projects";
export function NotesPage({
  edit,
  remove,
}: {
  edit: OpenEditor;
  remove: RemoveRequest;
}) {
  const { data, demo, save, toast } = useWorkspace();
  const router = useRouter(),
    params = useSearchParams(),
    selected = data.notes.find((n) => n.id === params.get("id"));
  const [query, setQuery] = useState(""),
    [folder, setFolder] = useState("all");
  const file = useRef<HTMLInputElement>(null);
  const notes = data.notes
    .filter(
      (n) =>
        `${n.title} ${n.content} ${n.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (folder === "all" ||
          (folder === "favorites" && n.favorite) ||
          folder === n.folder),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.updated_at.localeCompare(a.updated_at),
    );
  return (
    <div className={`notes-layout ${selected ? "has-selected" : ""}`}>
      <aside className="notes-sidebar">
        <div className="search-input">
          <Search size={16} />
          <input
            aria-label="Search notes"
            placeholder="Search your thoughts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="between">
          <select
            aria-label="Note folder"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
          >
            <option value="all">All notes</option>
            <option value="favorites">Favorites</option>
            {[...new Set(data.notes.map((n) => n.folder))].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Import Markdown"
            onClick={() => file.current?.click()}
          >
            <Upload size={17} />
          </Button>
          <input
            ref={file}
            hidden
            type="file"
            accept=".md,.txt,text/markdown,text/plain"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                if (f.size > 50000)
                  throw new Error("Use a Markdown file smaller than 50 KB.");
                const row = await save(
                  "notes",
                  schemas.notes.parse({
                    title: f.name.replace(/\.(md|txt)$/, ""),
                    content: await f.text(),
                  }),
                );
                router.push(
                  `${demo ? "/demo" : "/workspace"}/notes?id=${row.id}`,
                );
                toast("Note imported");
              } catch (e) {
                toast(e instanceof Error ? e.message : "Could not import note");
              }
              e.target.value = "";
            }}
          />
        </div>
        <div className="notes-list">
          {notes.map((n) => (
            <button
              key={n.id}
              className={`note-preview ${selected?.id === n.id ? "selected" : ""}`}
              onClick={() =>
                router.push(`${demo ? "/demo" : "/workspace"}/notes?id=${n.id}`)
              }
            >
              <div className="between">
                <span className="eyebrow">{n.folder}</span>
                <div className="row">
                  {n.pinned && <Pin size={12} />}
                  {n.favorite && <Star size={12} />}
                </div>
              </div>
              <h3>{n.title}</h3>
              <p>
                {n.content.replace(/[#*>`\[\]]/g, "").slice(0, 105) ||
                  "A blank page, full of possibility."}
              </p>
              <span className="subtle">
                {new Date(n.updated_at).toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </span>
            </button>
          ))}
        </div>
        <Button variant="ghost" onClick={() => edit("notes")}>
          <Plus size={15} />
          New note
        </Button>
      </aside>
      <section className="note-workspace">
        {selected ? (
          <NoteEditor
            key={selected.id}
            note={selected}
            remove={remove}
            back={() => router.push(`${demo ? "/demo" : "/workspace"}/notes`)}
          />
        ) : (
          <Empty
            title="Keep a thought. Follow an idea."
            description="Open a note, or start a fresh page. Markdown makes it yours."
            action={
              <Button onClick={() => edit("notes")}>
                <Plus size={16} />
                Write something
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}
function NoteEditor({
  note,
  remove,
  back,
}: {
  note: Row<"notes">;
  remove: RemoveRequest;
  back: () => void;
}) {
  const { data, save, toast } = useWorkspace();
  const [draft, setDraft] = useState(() => cleanValues("notes", note)),
    [preview, setPreview] = useState(false),
    [status, setStatus] = useState<"saved" | "pending" | "saving" | "error">(
      "saved",
    ),
    [error, setError] = useState(""),
    [tagText, setTagText] = useState(note.tags.join(", "));
  const current = useRef(note),
    latest = useRef(draft),
    saved = useRef(JSON.stringify(draft)),
    inflight = useRef(false),
    mounted = useRef(true),
    version = useRef(0);
  latest.current = draft;
  async function flush() {
    if (inflight.current || JSON.stringify(latest.current) === saved.current)
      return;
    inflight.current = true;
    setStatus("saving");
    const captured = latest.current;
    try {
      const row = await save("notes", captured, current.current);
      current.current = row;
      saved.current = JSON.stringify(captured);
      if (mounted.current) {
        setStatus(
          JSON.stringify(latest.current) === saved.current
            ? "saved"
            : "pending",
        );
        setError("");
      }
    } catch (e) {
      if (mounted.current) {
        setStatus("error");
        setError(
          e instanceof Error
            ? e.message
            : "Unable to save. Your text is still here.",
        );
      }
    } finally {
      inflight.current = false;
    }
  }
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (status === "pending") {
      const timer = setTimeout(() => void flushRef.current(), 650);
      return () => clearTimeout(timer);
    }
  }, [draft, status]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== saved.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const navigation = (e: MouseEvent) => {
      const a = (e.target as Element).closest("a, .note-preview");
      if (a && JSON.stringify(latest.current) !== saved.current) {
        e.preventDefault();
        toast("Let this note finish saving before leaving.");
      }
    };
    const shortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void flushRef.current();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigation, true);
    window.addEventListener("keydown", shortcut);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigation, true);
      window.removeEventListener("keydown", shortcut);
    };
  }, [toast]);
  function change(patch: Partial<typeof draft>) {
    version.current++;
    setDraft((d) => ({ ...d, ...patch }));
    setStatus("pending");
  }
  function safeBack() {
    if (status === "saved") back();
    else toast("Save your changes before closing this note.");
  }
  return (
    <>
      <div className="note-toolbar">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to notes"
          onClick={safeBack}
        >
          <ArrowLeft size={17} />
        </Button>
        <span
          className={`save-status ${status === "error" ? "overdue-text" : ""}`}
          role="status"
        >
          {status === "saved" ? (
            <>
              <Check size={13} />
              Saved
            </>
          ) : status === "saving" ? (
            "Saving…"
          ) : status === "error" ? (
            "Not saved"
          ) : (
            "Unsaved changes"
          )}
        </span>
        <div className="grow" />
        <Button
          variant="ghost"
          size="icon"
          aria-label={draft.pinned ? "Unpin note" : "Pin note"}
          aria-pressed={draft.pinned}
          onClick={() => change({ pinned: !draft.pinned })}
        >
          <Pin size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={draft.favorite ? "Remove favorite" : "Favorite note"}
          aria-pressed={draft.favorite}
          onClick={() => change({ favorite: !draft.favorite })}
        >
          <Star size={16} fill={draft.favorite ? "currentColor" : "none"} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Duplicate note"
          onClick={async () => {
            try {
              await save("notes", {
                ...draft,
                title: `${draft.title} (copy)`.slice(0, 200),
              });
              toast("Note duplicated");
            } catch (e) {
              toast(e instanceof Error ? e.message : "Unable to duplicate");
            }
          }}
        >
          <Copy size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Export Markdown"
          onClick={() =>
            download(
              `${draft.title.replace(/[^a-zA-Z0-9 _-]/g, "") || "note"}.md`,
              draft.content,
              "text/markdown",
            )
          }
        >
          <Download size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete note"
          onClick={() => remove("notes", current.current)}
        >
          <Trash2 size={16} />
        </Button>
      </div>
      <div className="note-editor-body">
        <div className="between">
          <span className="eyebrow">{draft.folder} / A SPACE TO THINK</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreview((p) => !p)}
          >
            {preview ? <Pencil size={14} /> : <Eye size={14} />}
            {preview ? "Edit" : "Preview"}
          </Button>
        </div>
        <input
          aria-label="Note title"
          className="note-title-input"
          value={draft.title}
          onChange={(e) => change({ title: e.target.value })}
          maxLength={200}
        />
        <div className="note-metadata">
          <Field label="Folder">
            <input
              value={draft.folder}
              onChange={(e) => change({ folder: e.target.value })}
              maxLength={80}
            />
          </Field>
          <Field label="Project">
            <select
              value={draft.project_id || ""}
              onChange={(e) => change({ project_id: e.target.value || null })}
            >
              <option value="">None</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tags">
            <input
              value={tagText}
              onChange={(e) => {
                setTagText(e.target.value);
                change({
                  tags: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                });
              }}
            />
          </Field>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
            <Button variant="ghost" onClick={() => void flush()}>
              Retry save
            </Button>
          </div>
        )}
        {preview ? (
          <div className="markdown">
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                img: ({ alt }) => (
                  <span>
                    [Image: {alt || "external image hidden for privacy"}]
                  </span>
                ),
                a: ({ href, children }) => (
                  <a href={href} rel="noopener noreferrer" target="_blank">
                    {children}
                  </a>
                ),
              }}
            >
              {draft.content}
            </Markdown>
          </div>
        ) : (
          <textarea
            aria-label="Note content"
            className="note-content-input"
            value={draft.content}
            onChange={(e) => change({ content: e.target.value })}
            placeholder="Let your thoughts find a place…"
            maxLength={50000}
            spellCheck
          />
        )}
        <div className="note-editor-footer">
          <span>
            {draft.content.trim()
              ? draft.content.trim().split(/\s+/).length
              : 0}{" "}
            words
          </span>
          <span>Markdown · ⌘ / Ctrl S to save</span>
        </div>
      </div>
    </>
  );
}
