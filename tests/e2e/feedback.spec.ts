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
