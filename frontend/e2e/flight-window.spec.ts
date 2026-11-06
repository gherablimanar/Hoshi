import { test, expect } from "@playwright/test";
import type { Project } from "../src/contracts";
test("separate flight window shares connection, edits real launch controls, replays engine data and preserves the design", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Skip introduction" }).click();
  await page.getByRole("button", { name: /A simple model rocket/ }).click();
  await expect(page.locator(".app")).toBeVisible();
  const id = await page.evaluate(() => localStorage.getItem("rocket-project"));
  const popupEvent = page.waitForEvent("popup");
  await page
    .getByRole("button", {
      name: "Open Flight Simulation window",
      exact: true,
    })
    .click();
  const popup = await popupEvent;
  popup.on("pageerror", (e) => errors.push(e.message));
  await expect(popup).toHaveTitle("Hoshi · Flight Simulation");
  await expect(
    popup.getByRole("heading", { name: "Prepare your flight" }),
  ).toBeVisible();
  await expect(popup.getByLabel("Engine access password")).toHaveCount(0);
  await expect(page.locator(".results")).toHaveCount(0);
  await popup.getByLabel("Mean wind speed (m/s)", { exact: true }).fill("1.2");
  await popup
    .getByLabel("Mean wind speed (m/s)", { exact: true })
    .press("Enter");
  await expect
    .poll(async () => {
      const p: Project = await (
        await page.request.get(`/api/projects/${id}`)
      ).json();
      return p.simulations[
        Number(
          await popup
            .getByRole("combobox", { name: "Window simulation", exact: true })
            .inputValue(),
        )
      ].wind.average;
    })
    .toBeCloseTo(1.2);
  await popup.getByRole("button", { name: "Set calm wind" }).click();
  await expect(
    popup.getByLabel("Mean wind speed (m/s)", { exact: true }),
  ).toHaveValue("0");
  const temperature = popup.getByLabel("Air temperature (K)", { exact: true });
  await expect(temperature).toBeDisabled();
  await popup.getByLabel("Use standard atmosphere", { exact: true }).click();
  await expect(temperature).toBeEnabled();
  await temperature.fill("300");
  await temperature.press("Enter");
  await expect(temperature).toHaveValue("300");
  const duration = popup.getByLabel("Maximum flight duration (s)", {
      exact: true,
    }),
    previousDuration = await duration.inputValue();
  await duration.fill("0");
  await duration.press("Enter");
  await expect(
    popup.getByRole("alert").filter({ hasText: "Maximum flight duration" }),
  ).toContainText("Change not applied");
  await expect(duration).toHaveValue(previousDuration);
  await duration.fill(previousDuration);
  await duration.press("Enter");
  await expect(
    popup.getByRole("button", { name: "Run flight simulation", exact: true }),
  ).toBeEnabled();
  await popup
    .getByRole("button", { name: /Choose motor for Inner Tube/i })
    .click();
  await popup.getByRole("textbox", { name: "Search motors" }).fill("D12");
  await popup
    .locator(".motor-list button")
    .filter({ hasText: /Estes.*D12/ })
    .first()
    .click();
  await popup
    .getByRole("button", { name: "Assign to active configuration" })
    .click();
  await expect(popup.getByRole("dialog").getByRole("alert")).toContainText(
    "Motor diameter exceeds mount diameter",
  );
  await popup.getByRole("button", { name: "Close dialog" }).click();
  await popup.getByRole("button", { name: "Dismiss flight error" }).click();
  await popup
    .getByRole("button", { name: "Open flight settings", exact: true })
    .click();
  await expect(popup.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await popup.getByRole("button", { name: "Close dialog" }).click();
  await popup
    .getByRole("button", { name: "Run flight simulation", exact: true })
    .click();
  await expect(popup.locator(".status.completed")).toBeVisible({
    timeout: 30000,
  });
  await expect(
    popup.getByRole("img", {
      name: "Rocket position on recorded flight trajectory",
    }),
  ).toBeVisible();
  const timeline = popup.getByRole("slider", { name: "Recorded flight time" });
  await popup
    .getByRole("combobox", { name: "Playback speed", exact: true })
    .selectOption("5");
  await popup
    .getByRole("button", { name: "Play recorded flight", exact: true })
    .click();
  await expect
    .poll(async () => Number(await timeline.inputValue()))
    .toBeGreaterThan(0);
  await popup
    .getByRole("button", { name: "Pause recorded flight", exact: true })
    .click();
  await popup
    .getByRole("button", { name: "Reset playback", exact: true })
    .click();
  await expect(timeline).toHaveValue("0");
  await popup.screenshot({ path: "../tests/flight-window.png" });
  await popup.getByLabel("Mean wind speed (m/s)", { exact: true }).fill("2");
  await popup
    .getByLabel("Mean wind speed (m/s)", { exact: true })
    .press("Enter");
  await expect(popup.locator(".recorded-revision-note")).toContainText(
    "re-run after resolving launch checks",
  );
  await popup
    .getByRole("button", { name: "Close simulation window", exact: true })
    .click();
  await expect.poll(() => popup.isClosed()).toBe(true);
  await expect(page.locator(".app")).toHaveAttribute("data-mode", "design");
  await expect(page.locator(".results")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("known zero-diameter geometry blocks job submission and points to the component", async ({
  page,
}) => {
  let p: Project = await (
    await page.request.post("/api/projects", {
      data: { name: "Blocked launch test" },
    })
  ).json();
  async function mutate(data: object) {
    p = await (
      await page.request.post(`/api/projects/${p.id}/mutate`, {
        data: { revision: p.revision, ...data },
      })
    ).json();
  }
  await mutate({ op: "add", type: "AxialStage", parentId: p.rocket.id });
  await mutate({
    op: "add",
    type: "BodyTube",
    parentId: p.rocket.children[0].id,
  });
  const tube = p.rocket.children[0].children[0].id;
  await mutate({
    op: "set",
    componentId: tube,
    changes: { outerRadiusAutomatic: false, outerRadius: 0 },
  });
  await page.addInitScript(
    (id) => localStorage.setItem("rocket-project", id),
    p.id,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Skip introduction" }).click();
  await page
    .getByRole("button", { name: "Recent projects", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: /Blocked launch test.*Last opened.*Continue project/,
    })
    .click();
  let jobs = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/jobs")) jobs++;
  });
  const popupEvent = page.waitForEvent("popup");
  await page
    .getByRole("button", {
      name: "Open Flight Simulation window",
      exact: true,
    })
    .click();
  const popup = await popupEvent;
  await expect(
    popup.getByRole("button", { name: "Run flight simulation", exact: true }),
  ).toBeDisabled();
  const issue = popup
    .locator(".preflight-blocker")
    .filter({ hasText: "zero outer diameter" });
  await expect(issue).toBeVisible();
  expect(jobs).toBe(0);
  await issue.getByRole("button", { name: "Show design to fix this" }).click();
  await expect.poll(() => popup.isClosed()).toBe(true);
  await expect(page.locator(".tree-row.selected")).toHaveAttribute(
    "data-component-id",
    tube,
  );
  await expect(page.locator(".zero-diameter-warning")).toBeVisible();
});
test("a real motor that cannot lift the loaded rocket produces its native abort reason and repair guidance", async ({
  page,
}) => {
  let p: Project = await (
    await page.request.post("/api/projects", {
      data: { example: "A simple model rocket.ork" },
    })
  ).json();
  p = await (
    await page.request.post(`/api/projects/${p.id}/mutate`, {
      data: {
        revision: p.revision,
        op: "set",
        componentId: p.rocket.id,
        changes: { massOverridden: true, overrideMass: 100 },
      },
    })
  ).json();
  await page.addInitScript(
    (id) => localStorage.setItem("rocket-project", id),
    p.id,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Skip introduction" }).click();
  await page
    .getByRole("button", { name: "Recent projects", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: /A simple model rocket.*Last opened.*Continue project/,
    })
    .click();
  await page
    .getByRole("button", { name: "Flight Simulation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Simulate launch", exact: true })
    .click();
  await expect(page.locator(".status.failed")).toBeVisible({ timeout: 30000 });
  const reason = page
    .locator(".flight-outcome-issue")
    .filter({ hasText: /without liftoff/i });
  await expect(reason).toBeVisible();
  await expect(reason).toContainText("Review loaded mass");
  await expect(
    page.getByRole("img", {
      name: "Rocket position on recorded flight trajectory",
    }),
  ).toBeVisible();
  await page.screenshot({ path: "../tests/failed-flight-guidance.png" });
});
