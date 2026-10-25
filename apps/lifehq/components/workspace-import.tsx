"use client";
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button, Modal } from "@lifehq/ui";
import { entityNames, tables, type Preferences } from "@lifehq/shared";
import {
  IMPORT_BYTES,
  inspectBackup,
  type ImportPreview,
} from "@lifehq/shared/import";
import { useWorkspace } from "@/lib/store";
export function WorkspaceImport({
  onImported,
}: {
  onImported?: (preferences: Preferences | null) => void;
}) {
  const { importWorkspace } = useWorkspace();
  const file = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<
      (ImportPreview & { backup: unknown; name: string }) | null
    >(null),
    [preferences, setPreferences] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function choose(selected: File) {
    setError("");
    try {
      if (selected.size > IMPORT_BYTES)
        throw new Error("Choose a JSON file smaller than 5 MB.");
      const backup: unknown = JSON.parse(await selected.text()),
        result = inspectBackup(backup);
      setPreview({ ...result, backup, name: selected.name });
      setPreferences(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The backup could not be opened.",
      );
    } finally {
      if (file.current) file.current.value = "";
    }
  }
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => file.current?.click()}
      >
        <Upload size={16} />
        Import JSON
      </Button>
      <input
        ref={file}
        hidden
        type="file"
        accept="application/json,.json"
        aria-label="Workspace JSON file"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) void choose(selected);
        }}
      />
      {error && !preview && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open && !busy) {
              setPreview(null);
              setError("");
            }
          }}
          title="Import your workspace"
          description="Adds new copies of your records and preserves their links. Existing records stay in place. Reimporting the same file creates additional copies."
        >
          <p className="subtle">
            {preview.name} · {preview.count}{" "}
            {preview.count === 1 ? "record" : "records"}
          </p>
          <div className="import-counts">
            {tables
              .filter((t) => preview.counts[t])
              .map((t) => (
                <div className="between" key={t}>
                  <span>{entityNames[t]}</span>
                  <strong>{preview.counts[t]}</strong>
                </div>
              ))}
          </div>
          {preview.preferences && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={preferences}
                onChange={(e) => setPreferences(e.target.checked)}
              />
              Also import preferences (including name, theme and profile photo)
            </label>
          )}
          <p className="subtle">
            Imported records belong to the current workspace. Account email,
            passwords and CipherVault data are never imported.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setPreview(null);
                setError("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || (!preview.count && !preferences)}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await importWorkspace(preview.backup, preferences);
                  onImported?.(preferences ? preview.preferences : null);
                  setPreview(null);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Import failed. Please retry.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy
                ? "Importing…"
                : preview.count
                  ? `Import ${preview.count} ${preview.count === 1 ? "record" : "records"}`
                  : "Import preferences"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
