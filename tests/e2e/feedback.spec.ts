import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { today, addDays } from "../../packages/shared/dates";
const date = today("Asia/Kolkata");
async function create(page: Page, section: string, title: string) {
  await page.goto(`/demo/${section}`);
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
async function raw(page: Page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("lifehq-demo-v1") || "{}"),
  );
}
test("header and Settings share the theme immediately without discarding other drafts", async ({
  page,
}) => {
  await page.goto("/demo/settings");
  await page.getByLabel("Display name").fill("Unsaved draft");
  await page.getByRole("switch", { name: "Dark theme", exact: true }).click();
  await expect(page.getByLabel("Appearance")).toHaveValue("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByLabel("Display name")).toHaveValue("Unsaved draft");
  await page.getByLabel("Appearance").selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await page.reload();
  await expect(page.getByLabel("Appearance")).toHaveValue("light");
  await expect(page.getByLabel("Display name")).toHaveValue("Unsaved draft");
  await page.getByLabel("Appearance").selectOption("dark");
  await expect(
    page.getByRole("switch", { name: "Dark theme", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(page.getByLabel("Appearance")).toHaveValue("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
test("habit start day works, unavailable dates explain why, and missed days can be backfilled", async ({
  page,
}) => {
  await create(page, "habits", "Start-day routine");
  await page
    .getByRole("dialog")
    .getByLabel("Start date", { exact: true })
    .fill(date);
  await submit(page, "Create habit");
  const current = page.getByRole("button", {
    name: `Start-day routine on ${date}`,
    exact: true,
  });
  await expect(current).toBeEnabled();
  await current.click();
  await expect(current).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Edit Start-day routine", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Start date", { exact: true })
    .fill(addDays(date, -3));
  await submit(page, "Save changes");
  await page
    .getByRole("button", { name: /Start-day routine 7 days per week/ })
    .click();
  const before = page.getByRole("button", {
    name: `Check-in ${addDays(date, -4)}`,
    exact: true,
  });
  await expect(before).toBeDisabled();
  await expect(before).toHaveAttribute(
    "title",
    `This habit starts on ${addDays(date, -3)}.`,
  );
  const future = page.getByRole("button", {
    name: `Check-in ${addDays(date, 1)}`,
    exact: true,
  });
  await expect(future).toBeDisabled();
  await expect(future).toHaveAttribute(
    "title",
    "Future dates cannot be checked in yet.",
  );
  await page
    .getByRole("button", { name: `Check-in ${addDays(date, -1)}`, exact: true })
    .click();
  await expect(
    page.getByRole("dialog").locator(".mini-stats>div").first(),
  ).toContainText("2");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.reload();
  await expect(page.locator(".habit-streak strong")).toHaveText("2");
});
test("ten-second deletion undo survives reload and restores linked records", async ({
  page,
}) => {
  await create(page, "projects", "Undo parent");
  await submit(page, "Create project");
  await create(page, "tasks", "Undo child");
  await page
    .getByRole("dialog")
    .getByLabel("Project", { exact: true })
    .selectOption({ label: "Undo parent" });
  await submit(page, "Create task");
  await page.clock.install();
  await page.clock.setFixedTime(new Date());
  await page.goto("/demo/projects");
  await page
    .getByRole("button", { name: "Delete Undo parent", exact: true })
    .click();
  await submit(page, "Delete");
  await expect(page.getByText("Undo parent", { exact: true })).toHaveCount(0);
  expect((await raw(page)).data.projects).toHaveLength(1);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.screenshot({
    path: "docs/screenshots/qa-undo-1440.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 1000 });
  await expect(
    page.getByRole("button", {
      name: "Undo deletion of Undo parent",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/qa-undo-390.png",
    fullPage: true,
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Undo deletion of Undo parent", exact: true })
    .click();
  await expect(page.getByText("Undo parent", { exact: true })).toBeVisible();
  await page.goto("/demo/tasks");
  await expect(page.getByText("Undo child", { exact: true })).toBeVisible();
  expect((await raw(page)).pendingDeletions).toHaveLength(0);
});
test("deletion expires after ten seconds and Notes uses the standard confirmation", async ({
  page,
}) => {
  await create(page, "notes", "Expiry note");
  await submit(page, "Create note");
  await page.getByRole("button", { name: /Expiry note/ }).click();
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.getByRole("button", { name: "Delete note", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "permanently removed after a 10-second undo window",
  );
  await submit(page, "Delete");
  await expect(
    page.getByRole("button", {
      name: "Undo deletion of Expiry note",
      exact: true,
    }),
  ).toBeVisible();
  await page.clock.fastForward(10250);
  await expect.poll(async () => (await raw(page)).data.notes.length).toBe(0);
  await expect(page.locator(".undo-toast")).toHaveCount(0);
  await page.reload();
  expect((await raw(page)).data.notes).toHaveLength(0);
});
test("deleted-account confirmation and expired-link recovery have clear next steps", async ({
  page,
}) => {
  await page.goto("/login?notice=account-deleted");
  await expect(page.getByRole("status")).toContainText("Account deleted.");
  await expect(
    page.getByRole("button", { name: /Create an account/ }),
  ).toBeVisible();
  await page.goto("/login#error_code=otp_expired");
  await expect(page.locator(".error[role=alert]")).toContainText(
    "expired or was already used",
  );
  await expect(page).not.toHaveURL(/#/);
  await page
    .getByRole("button", { name: "Resend confirmation email", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await page.getByLabel("Email address").fill("dummy@example.test");
  let action = "";
  await page.route("**/api/auth", async (route) => {
    action = route.request().postDataJSON().action;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message:
          "If that address needs confirmation, a new email is on its way.",
      }),
    });
  });
  await page
    .getByRole("button", { name: "Send confirmation email", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "new email is on its way",
  );
  expect(action).toBe("resend");
});

test("JSON import previews an export, remaps linked records, and survives reload", async ({
  page,
}) => {
  await create(page, "projects", "Import parent");
  await submit(page, "Create project");
  await create(page, "tasks", "Import child");
  await page
    .getByRole("dialog")
    .getByLabel("Project", { exact: true })
    .selectOption({ label: "Import parent" });
  await submit(page, "Create task");
  const original = await raw(page);
  const backup = {
    format: "lifehq",
    version: 1,
    data: original.data,
    preferences: {
      ...original.preferences,
      name: "Restored preferences",
      theme: "dark",
    },
  };
  await page.goto("/demo/settings");
  await page.getByLabel("Workspace JSON file").setInputFiles({
    name: "workspace.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(
    page.getByRole("dialog", { name: "Import your workspace" }),
  ).toContainText("2 records");
  await expect(page.getByRole("dialog")).toContainText(
    "Existing records stay in place",
  );
  await page.getByRole("checkbox", { name: /Also import preferences/ }).check();
  await page
    .getByRole("button", { name: "Import 2 records", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Display name")).toHaveValue(
    "Restored preferences",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  const saved = await raw(page);
  expect(saved.data.tasks).toHaveLength(2);
  expect(saved.data.projects).toHaveLength(2);
  const copy = saved.data.tasks.find(
    (r: { id: string }) => r.id !== original.data.tasks[0].id,
  );
  expect(copy.project_id).not.toBe(original.data.projects[0].id);
  expect(
    saved.data.projects.some((r: { id: string }) => r.id === copy.project_id),
  ).toBe(true);
  await page.getByLabel("Workspace JSON file").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"format":"wrong","version":1,"data":{}}'),
  });
  await expect(page.locator(".error[role=alert]")).toBeVisible();
  expect((await raw(page)).data.tasks).toHaveLength(2);
});
test("profile photos are resized, saved privately, shown in navigation and removable", async ({
  page,
}) => {
  await page.goto("/demo/settings");
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 200;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#a34b1d";
    c.fillRect(0, 0, 300, 200);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("Profile photo file").setInputFiles({
    name: "test-photo.png",
    mimeType: "image/png",
    buffer: Buffer.from(image, "base64"),
  });
  await expect(page.getByAltText("Your chosen profile photo")).toBeVisible();
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".profile-avatar img")).toBeVisible();
  const saved = await raw(page);
  expect(saved.preferences.avatar).toMatch(/^data:image\/jpeg;base64,/);
  expect(saved.preferences.avatar.length).toBeLessThan(64000);
  await page.getByRole("button", { name: "Remove photo", exact: true }).click();
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".profile-avatar img")).toHaveCount(0);
});
test("email-confirmed feedback is shown once and removes its navigation marker", async ({
  page,
}) => {
  await page.goto("/demo?notice=email-confirmed");
  await expect(page.locator(".workspace-feedback [role=status]")).toContainText(
    "Email confirmed.",
  );
  await expect(page).not.toHaveURL(/notice=/);
  await page.reload();
  await expect(page.locator(".workspace-feedback [role=status]")).toHaveCount(
    0,
  );
});

test("token-hash email links require explicit confirmation and remove the token from the address bar", async ({
  page,
}) => {
  let consumed = false;
  await page.route("**/api/confirm", async (route) => {
    consumed = true;
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({
      token_hash: "a".repeat(64),
      type: "signup",
    });
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error: "This link is invalid or expired. Request a fresh email.",
      }),
    });
  });
  await page.goto(`/auth/confirm?token_hash=${"a".repeat(64)}&type=signup`);
  await expect(page).toHaveURL(/\/auth\/confirm$/);
  await expect(
    page.getByRole("heading", { name: "Confirm your email.", exact: true }),
  ).toBeVisible();
  expect(consumed).toBe(false);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".auth-form .error[role=alert]")).toContainText(
    "invalid or expired",
  );
  expect(consumed).toBe(true);
});
