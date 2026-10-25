import { describe, it, expect } from "vitest";
import { sampleData } from "../../apps/lifehq/lib/demo";
import { inspectBackup, prepareImport } from "../../packages/shared/import";
import {
  defaults,
  emptyData,
  preferencesSchema,
  schemas,
} from "../../packages/shared/index";
const owner = "00000000-0000-4000-8000-000000000098";
const backup = () => ({
  format: "lifehq",
  version: 1,
  data: sampleData(),
  preferences: defaults,
});
describe("workspace JSON import", () => {
  it("accepts an export and creates owned copies with all relationships remapped", () => {
    const original = backup(),
      prepared = prepareImport(original, owner, true);
    expect(prepared.count).toBe(
      Object.values(original.data).reduce((n, rows) => n + rows.length, 0),
    );
    const originalIds = new Set(
      Object.values(original.data)
        .flat()
        .map((r) => r.id),
    );
    for (const row of Object.values(prepared.data).flat()) {
      expect(row.user_id).toBe(owner);
      expect(originalIds.has(row.id)).toBe(false);
      expect(row.version).toBe(1);
    }
    const task = prepared.data.tasks.find((r) => r.project_id)!;
    expect(prepared.data.projects.some((p) => p.id === task.project_id)).toBe(
      true,
    );
    expect(prepared.preferences).toEqual(defaults);
  });
  it("rejects unsupported files, duplicates, missing relationships and parent cycles before any writes", () => {
    expect(() =>
      inspectBackup({ format: "another-app", version: 1, data: {} }),
    ).toThrow();
    const duplicate = backup();
    duplicate.data.projects.push(duplicate.data.projects[0]);
    expect(() => inspectBackup(duplicate)).toThrow("duplicate");
    const missing = backup();
    missing.data.projects = [];
    expect(() => inspectBackup(missing)).toThrow("missing");
    const cycle = backup();
    cycle.data.tasks[0].parent_id = cycle.data.tasks[1].id;
    cycle.data.tasks[1].parent_id = cycle.data.tasks[0].id;
    expect(() => inspectBackup(cycle)).toThrow("cycle");
  });
  it("sorts children after parents and accepts database timestamp offsets", () => {
    const input = backup();
    const parent = input.data.tasks[0],
      child = input.data.tasks[1];
    child.parent_id = parent.id;
    child.completed_at = "2026-10-25T12:00:00+00:00";
    input.data.tasks = [child, parent, ...input.data.tasks.slice(2)];
    const result = prepareImport(input, owner);
    expect(result.data.tasks[0].title).toBe(parent.title);
    expect(result.data.tasks[1].parent_id).toBe(result.data.tasks[0].id);
    expect(result.data.tasks[1].completed_at).toBe("2026-10-25T12:00:00.000Z");
    expect(result.preferences).toBeNull();
  });
  it("limits record count and rejects arbitrary executable or remote profile photos", () => {
    const data = emptyData();
    data.projects = Array.from({ length: 2001 }, () => ({
      ...schemas.projects.parse({ title: "Too many" }),
      id: crypto.randomUUID(),
      user_id: owner,
      version: 1,
      created_at: "",
      updated_at: "",
    }));
    expect(() =>
      inspectBackup({ format: "lifehq", version: 1, data }),
    ).toThrow();
    for (const avatar of [
      "https://tracking.example/photo.png",
      "data:image/svg+xml,<svg/>",
      "javascript:alert(1)",
    ])
      expect(() => preferencesSchema.parse({ avatar })).toThrow();
  });
});
