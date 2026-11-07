import { test, expect } from "@playwright/test";
const engine = "http://127.0.0.1:18081";
test("Pages subpath connects to a protected engine; real flight, CSV/ORK downloads and reload password", async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (e) => runtimeErrors.push(e.message));
  await page.goto("/Hoshi/");
  await page.getByRole("button", { name: "Skip introduction" }).click();
  await expect(
    page.getByRole("heading", { name: "Connect your flight engine" }),
  ).toBeVisible();
  await page.getByLabel("Engine website address").fill(engine);
  await page.getByLabel("Engine access password").fill("incorrect");
  await page.getByRole("button", { name: "Open Hoshi" }).click();
  await expect(page.getByRole("alert")).toContainText("access password");
  await page
    .getByLabel("Engine access password")
    .fill("test-password-for-hosted-browser");
  await page.getByRole("button", { name: "Open Hoshi" }).click();
  await expect(
    page.getByRole("heading", { name: "What will you build?", level: 1 }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: /A simple model rocket/ }).click();
  const popupEvent = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Simulate launch" }).click();
  const popup = await popupEvent;
  popup.on("pageerror", (e) => runtimeErrors.push(e.message));
  await expect(popup.getByLabel("Engine access password")).toHaveCount(0);
  await popup
    .getByRole("button", { name: "Run flight simulation", exact: true })
    .click();
  await expect(popup.locator(".status.completed")).toBeVisible({
    timeout: 30000,
  });
  await popup
    .getByRole("button", { name: "Close simulation window", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Flight Simulation", exact: true })
    .click();
  await expect(page.locator(".status.completed")).toBeVisible({
    timeout: 30000,
  });
  const ork = page.waitForEvent("download");
  await page.getByRole("link", { name: /Export$/ }).click();
  expect((await ork).suggestedFilename()).toBe("rocket.ork");
  const csv = page.waitForEvent("download");
  await page.getByRole("link", { name: /CSV$/ }).click();
  expect((await csv).suggestedFilename()).toBe("flight.csv");
  const recordEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "↓ Run record", exact: true }).click();
  const record = await recordEvent;
  expect(record.suggestedFilename()).toBe("flight-run.json");
  const recordPath = await record.path();
  const { readFile } = await import("node:fs/promises");
  const saved = JSON.parse(await readFile(recordPath!, "utf8"));
  expect(saved.engine.version).toBe("24.12");
  expect(saved.sourceProject).toBeTruthy();
  expect(saved.configurationSnapshot.simulations).toBeTruthy();
  expect(JSON.stringify(saved)).not.toContain(
    "test-password-for-hosted-browser",
  );
  const storage = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }));
  expect(JSON.stringify(storage)).not.toContain(
    "test-password-for-hosted-browser",
  );
  expect(JSON.stringify(storage)).not.toContain("cm9ja2V0");
  await page.screenshot({
    path: "../tests/github-pages-connected.png",
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Connect your flight engine" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("access password");
  await page
    .getByLabel("Engine access password")
    .fill("test-password-for-hosted-browser");
  await page.getByRole("button", { name: "Open Hoshi" }).click();
  await page
    .getByRole("button", { name: "Recent projects", exact: true })
    .click();
  await page
    .getByRole("button", { name: /A simple model rocket.*Continue project/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Flight Simulation", exact: true })
    .click();
  await expect(page.locator(".status.completed")).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});
test("offline engine is explicit, never fabricated samples", async ({
  page,
}) => {
  await page.goto("/Hoshi/");
  await page.getByRole("button", { name: "Skip introduction" }).click();
  await page.getByLabel("Engine website address").fill("http://127.0.0.1:1");
  await page.getByRole("button", { name: "Open Hoshi" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Cannot reach the OpenRocket engine",
  );
  await expect(page.locator(".status.completed")).toHaveCount(0);
});
