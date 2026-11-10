import { test, expect } from "@playwright/test";

test("public visitor opens without password, runs a flight, exports, reloads and stays isolated", async ({
  browser,
}) => {
  const url = process.env.ROCKET_PUBLIC_TEST_URL || "http://127.0.0.1:18090/";
  const a = await browser.newContext(),
    b = await browser.newContext();
  const page = await a.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await expect(page.getByLabel("Engine access password")).toHaveCount(0);
  await page.getByRole("button", { name: "Skip introduction" }).click();
  await page.getByRole("button", { name: /A simple model rocket/ }).click();
  await expect(page.locator(".app")).toBeVisible();
  const id = await page.evaluate(() => localStorage.getItem("rocket-project"));
  const popup = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "Simulate launch", exact: true })
    .click();
  const flight = await popup;
  await expect(flight.getByLabel("Engine access password")).toHaveCount(0);
  await flight
    .getByRole("button", { name: "Run flight simulation", exact: true })
    .click();
  await expect(flight.locator(".status.completed")).toBeVisible({
    timeout: 30000,
  });
  // The shared download helper initiates browser downloads from the main window.
  const download = page.waitForEvent("download");
  await flight.getByRole("link", { name: "↓ CSV", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("flight.csv");
  await flight.close();
  const ork = page.waitForEvent("download");
  await page.locator('[data-tour="export"]').click();
  expect((await ork).suggestedFilename()).toBe("rocket.ork");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "What will you build?" }),
  ).toBeVisible();
  await expect(page.getByLabel("Engine access password")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Recent projects", exact: true })
    .click();
  await expect(page.locator(".recent")).toContainText("A simple model rocket");
  const other = await b.newPage();
  await other.goto(url);
  await other.getByRole("button", { name: "Skip introduction" }).click();
  await other
    .getByRole("button", { name: "Recent projects", exact: true })
    .click();
  await expect(other.locator(".recent")).toHaveCount(0);
  const status = await other.evaluate(async (projectId) => {
    const entry = Object.entries(localStorage).find(([k]) =>
      k.startsWith("hoshi-visitor-v1:"),
    );
    return (
      await fetch("/api/projects/" + projectId, {
        headers: { Authorization: "Bearer " + entry![1] },
      })
    ).status;
  }, id);
  expect(status).toBe(404);
  const tokenBefore = await page.evaluate(
    () =>
      Object.entries(localStorage).find(([k]) =>
        k.startsWith("hoshi-visitor-v1:"),
      )![1],
  );
  await page.route("**/api/projects/" + id, async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "Expired visitor session" } }),
    });
    await page.unroute("**/api/projects/" + id);
  });
  await page
    .getByRole("button", { name: /A simple model rocket.*Continue project/ })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Object.entries(localStorage).find(([k]) =>
            k.startsWith("hoshi-visitor-v1:"),
          )?.[1],
      ),
    )
    .not.toBe(tokenBefore);
  await expect(
    page.getByRole("heading", { name: "What will you build?" }),
  ).toBeVisible();
  await expect(page.getByLabel("Engine access password")).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "../tests/public-visitor-workspace.png" });
  await a.close();
  await b.close();
});
