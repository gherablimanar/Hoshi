import { test, expect } from "@playwright/test";
const engine = "http://127.0.0.1:18081";
test("Pages subpath connects to a protected engine; real flight, CSV/ORK downloads and reload password", async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (e) => runtimeErrors.push(e.message));
  await page.goto("/Hoshi/");
  await expect(
    page.getByRole("heading", { name: "Connect your flight engine" }),
  ).toBeVisible();
  await page.getByLabel("Engine website address").fill(engine);
  await page.getByLabel("Engine access password").fill("incorrect");
  await page.getByRole("button", { name: "Open Rocket Designer" }).click();
  await expect(page.getByRole("alert")).toContainText("access password");
  await page
    .getByLabel("Engine access password")
    .fill("test-password-for-hosted-browser");
  await page.getByRole("button", { name: "Open Rocket Designer" }).click();
  await expect(
    page.getByRole("heading", { name: "Untitled rocket", level: 1 }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Explore examples" }).click();
  await page.getByRole("button", { name: /A simple model rocket/ }).click();
  await page.getByRole("button", { name: "Simulate launch" }).click();
  await expect(page.locator(".status.completed")).toBeVisible({
    timeout: 30000,
  });
  const ork = page.waitForEvent("download");
  await page.getByRole("link", { name: /Export$/ }).click();
  expect((await ork).suggestedFilename()).toBe("rocket.ork");
  const csv = page.waitForEvent("download");
  await page.getByRole("link", { name: /CSV$/ }).click();
  expect((await csv).suggestedFilename()).toBe("flight.csv");
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
  await page.getByRole("button", { name: "Open Rocket Designer" }).click();
  await expect(page.locator(".status.completed")).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});
test("offline engine is explicit, never fabricated samples", async ({
  page,
}) => {
  await page.goto("/Hoshi/");
  await page.getByLabel("Engine website address").fill("http://127.0.0.1:1");
  await page.getByRole("button", { name: "Open Rocket Designer" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Cannot reach the OpenRocket engine",
  );
  await expect(page.locator(".status.completed")).toHaveCount(0);
});
