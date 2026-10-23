import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { today, addDays } from "../../packages/shared/dates";
const date = today("Asia/Kolkata");
async function newEntity(page: Page, path: string, title: string) {
  await page.goto(`/demo/${path}`);
  await page.locator(".page-heading").getByRole("button").click();
  await page
    .getByRole("dialog")
    .getByLabel("Title", { exact: true })
    .fill(title);
}
async function submit(page: Page, name: string) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name, exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function stored(page: Page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("lifehq-demo-v1") || "{}"),
  );
}
test("task lifecycle persists and updates the dashboard", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await newEntity(page, "tasks", "A meaningful next step");
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Description")
    .fill("A task created through the real form.");
  await dialog.getByLabel("Priority", { exact: true }).selectOption("high");
  await dialog.getByLabel("Due date", { exact: true }).fill(date);
  await submit(page, "Create task");
  await expect(
    page.getByRole("button", { name: /A meaningful next step Personal/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("A meaningful next step", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /A meaningful next step Personal/ })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Title", { exact: true })
    .fill("A thoughtful next step");
  await submit(page, "Save changes");
  await page.goto("/demo");
  await expect(
    page.getByText("A thoughtful next step", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Mark A thoughtful next step complete",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => (await stored(page)).data.tasks[0].status)
    .toBe("done");
  await page.goto("/demo/tasks");
  await page.getByLabel("Task filter").selectOption("done");
  await expect(
    page.getByText("A thoughtful next step", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete A thoughtful next step", exact: true })
    .click();
  await submit(page, "Delete permanently");
  await expect(
    page.getByText("A thoughtful next step", { exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("projects connect to tasks, board status, milestones and archive restoration", async ({
  page,
}) => {
  await newEntity(page, "projects", "A new studio");
  await page
    .getByRole("dialog")
    .getByLabel("Description")
    .fill("A place to create");
  await submit(page, "Create project");
  await page.getByRole("button", { name: "A new studio", exact: true }).click();
  await page.getByLabel("Quick-add task").fill("Choose the desk");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(
    page.getByText("Choose the desk", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Project milestone").fill("Space cleared");
  await page
    .getByRole("button", { name: "Add milestone", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Space cleared", exact: true })
    .check();
  await page.getByRole("button", { name: "Board", exact: true }).click();
  await page.getByLabel("Status of Choose the desk").selectOption("done");
  await expect(
    page.getByText("1 of 1 tasks complete", { exact: true }),
  ).toBeVisible();
  await page.goto("/demo/projects");
  await page
    .getByRole("button", { name: "Archive A new studio", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "A new studio", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Project status filter").selectOption("archived");
  await page
    .getByRole("button", { name: "Restore A new studio", exact: true })
    .click();
  await page.getByLabel("Project status filter").selectOption("active");
  await expect(
    page.getByRole("button", { name: "A new studio", exact: true }),
  ).toBeVisible();
});
test("calendar creates a recurring event and reschedules only one occurrence", async ({
  page,
}) => {
  await newEntity(page, "planner", "A weekly reset");
  const d = page.getByRole("dialog");
  await d.getByLabel("Event date").fill(date);
  await d.getByLabel("Start time", { exact: true }).fill("09:00");
  await d.getByLabel("Repeat frequency").selectOption("daily");
  await submit(page, "Create event");
  await page.getByRole("button", { name: "Day", exact: true }).click();
  await page.getByRole("button", { name: /A weekly reset.*30 min/ }).click();
  await page.getByLabel("Scheduled date").fill(addDays(date, 1));
  await page.getByLabel("Start time", { exact: true }).fill("11:00");
  await submit(page, "Save schedule");
  await expect(
    page.getByRole("button", { name: /A weekly reset.*30 min/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Next period", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /A weekly reset.*30 min/ }),
  ).toHaveCount(2);
  const snapshot = await stored(page);
  expect(snapshot.data.events).toHaveLength(1);
  expect(snapshot.data.event_occurrences[0]).toMatchObject({
    occurrence_date: date,
    scheduled_date: addDays(date, 1),
    start_time: "11:00",
  });
});
test("goals derive progress from milestones and measured entries", async ({
  page,
}) => {
  await newEntity(page, "goals", "Read more thoughtfully");
  const d = page.getByRole("dialog");
  await d.getByLabel("Measure progress by").selectOption("milestones");
  await submit(page, "Create goal");
  await page
    .getByRole("button", { name: "Review & update", exact: true })
    .click();
  await page.getByLabel("Goal milestone").fill("Finish the first book");
  await page
    .getByRole("button", { name: "Add milestone", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Finish the first book", exact: true })
    .check();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(
    page.locator(".goal-card").getByText("Complete", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".goal-card").getByRole("progressbar"),
  ).toHaveAttribute("aria-valuenow", "100");
  await newEntity(page, "goals", "Twenty books");
  await page
    .getByRole("dialog")
    .getByLabel("Target", { exact: true })
    .fill("20");
  await page
    .getByRole("dialog")
    .getByLabel("Unit", { exact: true })
    .fill("books");
  await submit(page, "Create goal");
  await page
    .locator(".goal-card")
    .filter({ hasText: "Twenty books" })
    .getByRole("button", { name: "Review & update", exact: true })
    .click();
  await page.getByLabel("Add progress (books)").fill("3");
  await page.getByLabel("Reflection", { exact: true }).fill("One small step.");
  await page
    .getByRole("button", { name: "Record progress", exact: true })
    .click();
  await expect(page.getByText("+3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(
    page
      .locator(".goal-card")
      .filter({ hasText: "Twenty books" })
      .getByRole("progressbar"),
  ).toHaveAttribute("aria-valuenow", "15");
});
test("habits support multiple dated check-ins and deterministic streak display", async ({
  page,
}) => {
  await newEntity(page, "habits", "A daily walk");
  await page
    .getByRole("dialog")
    .getByLabel("Start date", { exact: true })
    .fill(addDays(date, -10));
  await submit(page, "Create habit");
  await page
    .getByRole("button", { name: /A daily walk 7 days per week/ })
    .click();
  for (const day of [addDays(date, -2), addDays(date, -1), date])
    await page
      .getByRole("button", { name: `Check-in ${day}`, exact: true })
      .click();
  await expect(
    page.getByRole("dialog").locator(".mini-stats>div").first(),
  ).toContainText("3");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.reload();
  await expect(page.locator(".habit-streak strong")).toHaveText("3");
  expect((await stored(page)).data.habit_entries).toHaveLength(3);
});
test("notes autosave, persist, search, duplicate, preview Markdown safely, and export", async ({
  page,
}) => {
  await newEntity(page, "notes", "A captured thought");
  await page
    .getByRole("dialog")
    .getByLabel("Markdown content")
    .fill("## A beginning\n\nSomething worth keeping.");
  await submit(page, "Create note");
  await page.getByRole("button", { name: /A captured thought/ }).click();
  await page
    .getByLabel("Note content")
    .fill(
      "# A clearer thought\n\n<script>window.hacked=true</script>\n\n[unsafe](javascript:alert(1))\n\nA persisted sentence.",
    );
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(page.getByLabel("Note content")).toContainText(
    "A persisted sentence.",
  );
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".markdown")).toContainText("A clearer thought");
  expect(
    await page.evaluate(() => Reflect.get(window, "hacked")),
  ).toBeUndefined();
  expect(await page.locator(".markdown a").getAttribute("href")).not.toContain(
    "javascript:",
  );
  await page
    .getByRole("button", { name: "Duplicate note", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /A captured thought \(copy\)/ }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export Markdown", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("A captured thought.md");
  await page.getByLabel("Search notes").fill("persisted sentence");
  await expect(page.locator(".note-preview")).toHaveCount(2);
});
test("preferences, keyboard command palette, exports, and empty results work", async ({
  page,
}) => {
  await page.goto("/demo/settings");
  await page.getByLabel("Display name").fill("Anurag");
  await page.getByLabel("Appearance").selectOption("dark");
  await page.getByLabel("Week starts on").selectOption("sunday");
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.getByLabel("Display name")).toHaveValue("Anurag");
  await expect(page.getByLabel("Week starts on")).toHaveValue("sunday");
  await page.keyboard.press("Control+k");
  await page
    .getByRole("combobox", { name: "Search commands and records" })
    .fill("New task");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "New task" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const dl = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export all data", exact: true })
    .click();
  expect((await dl).suggestedFilename()).toContain("lifehq-export-");
});
test("protected routes and mutation endpoints reject anonymous or cross-origin requests", async ({
  page,
  request,
}) => {
  await page.goto("/workspace");
  await expect(page).toHaveURL(/\/login/);
  const base = process.env.LIFEHQ_BASE_URL || "http://localhost:3000";
  const anon = await request.get("/api/workspace");
  expect(anon.status()).toBe(401);
  const rejected = await request.post("/api/records/tasks", {
    headers: { Origin: "https://untrusted.example" },
    data: { action: "save", values: { title: "Rejected" } },
  });
  expect(rejected.status()).toBe(403);
  const noSession = await request.post("/api/records/tasks", {
    headers: { Origin: base },
    data: { action: "save", values: { title: "Rejected" } },
  });
  expect(noSession.status()).toBe(401);
});
for (const width of [1440, 768, 390])
  test(`responsive screens and critical accessibility at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/demo");
    await page
      .getByRole("button", { name: "Explore sample workspace", exact: true })
      .click();
    await expect(
      page.getByText("A space to create", { exact: true }).last(),
    ).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0, { timeout: 10000 });
    for (const section of [
      "",
      "tasks",
      "planner",
      "projects",
      "goals",
      "habits",
      "notes",
      "review",
      "settings",
    ]) {
      await page.goto(`/demo/${section}`);
      await expect(page.locator(".loading")).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `docs/screenshots/${section || "overview"}-${width}.png`,
        fullPage: true,
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      expect(overflow, `${section} horizontal overflow`).toBe(false);
    }
    await page.goto("/demo");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    if (width === 390) {
      await page
        .getByRole("button", { name: "Open navigation", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("link", { name: "Tasks", exact: false })
        .click();
      await expect(page).toHaveURL(/\/demo\/tasks/);
      await page.locator(".page-heading").getByRole("button").click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
    }
    expect(errors).toEqual([]);
  });

test("recurring tasks complete one occurrence and expose completed history; events can be deleted", async ({
  page,
}) => {
  await newEntity(page, "tasks", "A recurring focus block");
  const d = page.getByRole("dialog");
  await d.getByLabel("Due date", { exact: true }).fill(date);
  await d.getByLabel("Repeat frequency").selectOption("daily");
  await submit(page, "Create task");
  await page.goto("/demo/planner");
  await page.getByRole("button", { name: "Day", exact: true }).click();
  await page
    .getByRole("button", { name: /A recurring focus block.*30 min/ })
    .click();
  await submit(page, "Complete task");
  await page.goto("/demo/tasks");
  await page.getByLabel("Task filter").selectOption("done");
  await expect(page.locator(".history-entry")).toContainText(
    "A recurring focus block",
  );
  expect((await stored(page)).data.tasks[0].status).toBe("todo");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await stored(page)).data.task_occurrences[0].status).toBe("todo");
  await newEntity(page, "planner", "A temporary meeting");
  await submit(page, "Create event");
  await page.getByRole("button", { name: "Day", exact: true }).click();
  await page
    .getByRole("button", { name: /A temporary meeting.*30 min/ })
    .click();
  await page.getByRole("button", { name: "Delete event", exact: true }).click();
  await submit(page, "Delete permanently");
  expect((await stored(page)).data.events).toHaveLength(0);
});

test("authentication form retains input and recovers from network and service errors", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("dummy@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("dummy-password-for-testing");
  await page.route("**/api/auth", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".error[role=alert]")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Email address")).toHaveValue(
    "dummy@example.test",
  );
  await page.unroute("**/api/auth");
  await page.route("**/api/auth", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Too many attempts. Please try again later.",
      }),
    }),
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".error[role=alert]")).toContainText(
    "Too many attempts",
  );
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
});

test("major screens and the editor meet automated accessibility checks in both themes", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Explore sample workspace", exact: true })
    .click();
  for (const theme of ["light", "dark"]) {
    if (theme === "dark") {
      await page.goto("/demo/settings");
      await page.getByLabel("Appearance").selectOption("dark");
      await page
        .getByRole("button", { name: "Save preferences", exact: true })
        .click();
    }
    for (const section of [
      "",
      "tasks",
      "planner",
      "projects",
      "goals",
      "habits",
      "notes",
      "review",
      "settings",
    ]) {
      await page.goto(`/demo/${section}`);
      await expect(page.locator(".loading")).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect
        .soft(
          result.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
          `${theme} ${section}`,
        )
        .toEqual([]);
    }
  }
  await page.goto("/demo/tasks");
  await page.locator(".page-heading").getByRole("button").click();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});
