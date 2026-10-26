import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const url = process.env.VAULT_BASE_URL || "http://localhost:3001";
const pass = "four distinct words for testing only";
test("local encrypted vault lifecycle, backup restoration, passphrase changes, and inactivity lock", async ({
  page,
}) => {
  const errors: string[] = [];
  const outbound: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (!r.url().startsWith(url) && !r.url().startsWith("data:"))
      outbound.push(r.url());
  });
  await page.goto(url);
  await expect(
    page.getByRole("heading", {
      name: "Create your local vault.",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Master passphrase", { exact: true }).fill(pass);
  await page
    .getByLabel("Confirm master passphrase", { exact: true })
    .fill(pass);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create encrypted vault", exact: false })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Your private collection.",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New item", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Title", { exact: true })
    .fill("Dummy account");
  await page
    .getByRole("dialog")
    .getByLabel("Username / email")
    .fill("dummy@example.test");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Private notes")
    .fill("dummy private note — never a real credential");
  await page
    .getByRole("button", { name: "Encrypt & save", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dummy account", exact: true }),
  ).toBeVisible();
  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("ciphervault-local-v1");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const value = await new Promise<unknown>((resolve, reject) => {
      const r = db
        .transaction("encrypted")
        .objectStore("encrypted")
        .get("vault");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    db.close();
    return JSON.stringify(value);
  });
  expect(stored).not.toContain("dummy@example.test");
  expect(stored).not.toContain("Dummy account");
  expect(stored).not.toContain("dummy private note");
  expect(stored).toContain("argon2id");
  await page
    .getByRole("button", { name: "Reveal password", exact: true })
    .click();
  const password = await page.locator(".secret-password").innerText();
  expect(password).toHaveLength(24);
  await page.getByRole("button", { name: "Edit item", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Title", { exact: true })
    .fill("Updated dummy account");
  await page
    .getByRole("button", { name: "Encrypt & save", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Toggle favorite", exact: true })
    .click();
  await page.getByLabel("Search vault").fill("Updated");
  await expect(page.locator(".vault-item")).toHaveCount(1);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Encrypted backup", exact: true })
    .click();
  const backup = await download;
  const path = await backup.path();
  expect(path).toBeTruthy();
  await page.getByRole("button", { name: "Lock", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back.", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Master passphrase", { exact: true })
    .fill("wrong passphrase");
  await page.getByRole("button", { name: "Unlock vault", exact: true }).click();
  await expect(page.locator(".error[role=alert]")).toContainText(
    "Unable to unlock",
  );
  await page.getByLabel("Master passphrase", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Unlock vault", exact: true }).click();
  await expect(
    page.locator(".vault-item").filter({ hasText: "Updated dummy account" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Vault settings", exact: true })
    .click();
  await page.getByLabel("Current master passphrase").fill(pass);
  const next = "a new independent passphrase for tests";
  await page.getByLabel("New master passphrase", { exact: true }).fill(next);
  await page.getByLabel("Confirm new master passphrase").fill(next);
  await page
    .getByRole("button", { name: "Change & re-encrypt", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Lock", exact: true }).click();
  await page.getByLabel("Master passphrase", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Unlock vault", exact: true }).click();
  await expect(page.locator(".error[role=alert]")).toContainText(
    "Unable to unlock",
  );
  await page.getByLabel("Master passphrase", { exact: true }).fill(next);
  await page.getByRole("button", { name: "Unlock vault", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Your private collection.",
      exact: true,
    }),
  ).toBeVisible();
  await page.locator("input[type=file]").setInputFiles(path!);
  await page.getByLabel("Backup master passphrase").fill(pass);
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Authenticate & restore", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Vault settings", exact: true })
    .click();
  await page.getByLabel("Lock after inactivity").selectOption("1");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.clock.install();
  await page.clock.fastForward(61000);
  await expect(
    page.getByRole("heading", { name: "Welcome back.", exact: true }),
  ).toBeVisible();
  await page.clock.resume();
  await page.getByLabel("Master passphrase", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Unlock vault", exact: true }).click();
  await page
    .locator(".vault-item")
    .filter({ hasText: "Updated dummy account" })
    .click();
  await page.getByRole("button", { name: "Delete item", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete item", exact: true })
    .click();
  await expect(
    page.getByText("A little privacy, organized.", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(outbound).toEqual([]);
});
for (const width of [1440, 768, 390])
  test(`vault layout and accessibility at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(url);
    await expect(
      page.getByRole("heading", {
        name: "Create your local vault.",
        exact: true,
      }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `docs/screenshots/vault-setup-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
    ).toBe(false);
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      scan.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    if (width === 1440) {
      await page
        .getByRole("switch", { name: "Dark theme", exact: true })
        .click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      const darkScan = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        darkScan.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
      ).toEqual([]);
      await page
        .getByRole("switch", { name: "Dark theme", exact: true })
        .click();
    }
    await page.getByLabel("Master passphrase", { exact: true }).fill(pass);
    await page
      .getByLabel("Confirm master passphrase", { exact: true })
      .fill(pass);
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Create encrypted vault", exact: false })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Your private collection.",
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/vault-unlocked-${width}.png`,
      fullPage: true,
    });
    if (width === 1440) {
      await page
        .getByRole("switch", { name: "Dark theme", exact: true })
        .click();
      const unlockedScan = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        unlockedScan.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
      ).toEqual([]);
      await page
        .getByRole("switch", { name: "Dark theme", exact: true })
        .click();
    }

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
    ).toBe(false);
  });

test("another tab locks stale plaintext and malformed backups do not replace the vault", async ({
  page,
  context,
}) => {
  await page.goto(url);
  await page.getByLabel("Master passphrase", { exact: true }).fill(pass);
  await page
    .getByLabel("Confirm master passphrase", { exact: true })
    .fill(pass);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create encrypted vault", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Your private collection.",
      exact: true,
    }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto(url);
  await other.getByLabel("Master passphrase", { exact: true }).fill(pass);
  await other
    .getByRole("button", { name: "Unlock vault", exact: true })
    .click();
  await other.getByRole("button", { name: "New item", exact: true }).click();
  await other
    .getByRole("dialog")
    .getByLabel("Title", { exact: true })
    .fill("Dummy shared change");
  await other
    .getByRole("button", { name: "Encrypt & save", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome back.", exact: true }),
  ).toBeVisible();
  await page.locator("input[type=file]").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":9000,"plaintext":"not a vault"}'),
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Master passphrase", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Unlock vault", exact: true }).click();
  await expect(page.locator(".vault-item")).toContainText(
    "Dummy shared change",
  );
  await other.close();
});

test("pending setup and restore cannot reopen the vault after page exit; locks propagate across tabs", async ({
  page,
  context,
}) => {
  // Hold only delivery of IndexedDB completion, after the write actually commits.
  await page.addInitScript(() => {
    const state = window as typeof window & {
      holdStorage: boolean;
      storageWaiters: (() => void)[];
    };
    state.holdStorage = false;
    state.storageWaiters = [];
    const original = IDBTransaction.prototype.addEventListener;
    IDBTransaction.prototype.addEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (type !== "complete" || !listener)
        return Reflect.apply(original, this, [type, listener, options]);
      return Reflect.apply(original, this, [
        type,
        (event: Event) => {
          const deliver = () =>
            typeof listener === "function"
              ? listener.call(this, event)
              : listener.handleEvent(event);
          if (state.holdStorage && this.mode === "readwrite")
            state.storageWaiters.push(deliver);
          else deliver();
        },
        options,
      ]);
    };
  });
  const hold = () =>
    page.evaluate(() => {
      (window as typeof window & { holdStorage: boolean }).holdStorage = true;
    });
  const waitForWrite = () =>
    expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { storageWaiters: unknown[] })
              .storageWaiters.length,
        ),
      )
      .toBeGreaterThan(0);
  const lockAndRelease = () =>
    page.evaluate(() => {
      window.dispatchEvent(new Event("pagehide"));
      const state = window as typeof window & {
        holdStorage: boolean;
        storageWaiters: (() => void)[];
      };
      state.holdStorage = false;
      state.storageWaiters.splice(0).forEach((deliver) => deliver());
    });
  await page.goto(url);
  await expect(
    page.getByRole("heading", {
      name: "Create your local vault.",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Master passphrase", { exact: true }).fill(pass);
  await page
    .getByLabel("Confirm master passphrase", { exact: true })
    .fill(pass);
  await page.getByRole("checkbox").check();
  await hold();
  await page.getByRole("button", { name: "Create encrypted vault" }).click();
  await waitForWrite();
  await lockAndRelease();
  await expect(
    page.getByRole("heading", { name: "Welcome back.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "New item", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Master passphrase", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Unlock vault", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "New item", exact: true }),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Encrypted backup", exact: true })
    .click();
  const backup = await downloadEvent;
  await page.locator("input[type=file]").setInputFiles((await backup.path())!);
  await page.getByLabel("Backup master passphrase").fill(pass);
  await page.getByRole("dialog").getByRole("checkbox").check();
  await hold();
  await page
    .getByRole("button", { name: "Authenticate & restore", exact: true })
    .click();
  await waitForWrite();
  await lockAndRelease();
  await expect(
    page.getByRole("heading", { name: "Welcome back.", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Master passphrase", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Unlock vault", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "New item", exact: true }),
  ).toBeVisible();
  const second = await context.newPage();
  await second.goto(url);
  await second.getByLabel("Master passphrase", { exact: true }).fill(pass);
  await second
    .getByRole("button", { name: "Unlock vault", exact: true })
    .click();
  await expect(
    second.getByRole("button", { name: "New item", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lock", exact: true }).click();
  await expect(
    second.getByRole("heading", { name: "Welcome back.", exact: true }),
  ).toBeVisible();
  await second.close();
});
