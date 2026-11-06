import { test, expect } from "@playwright/test";
test("tutorial, clean design workspace, and motor-to-simulation recovery workflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Skip introduction" }).click();
  await page
    .getByRole("button", { name: "First time designing a rocket", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Start with a complete example" }),
  ).toBeVisible();
  for (let i = 0; i < 9; i++)
    await page
      .getByRole("button", { name: "Next chapter", exact: true })
      .click();
  await expect(
    page.getByRole("heading", {
      name: "Simulation is one part of preparation",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open the simple example to practise" })
    .click();
  await expect(page.locator(".app")).toBeVisible();
  await expect(page.locator(".results")).toHaveCount(0);
  await expect(page.locator(".selection-name")).toHaveCount(0);
  const id = await page.evaluate(() => localStorage.getItem("rocket-project"));
  let p = await (await page.request.get(`/api/projects/${id}`)).json();
  // A genuine engine project with no motor or flight settings reproduces the user's blocked launch.
  let blank = await (
    await page.request.post("/api/projects", {
      data: { name: "Flight setup regression" },
    })
  ).json();
  async function mutate(data: object) {
    blank = await (
      await page.request.post(`/api/projects/${blank.id}/mutate`, {
        data: { revision: blank.revision, ...data },
      })
    ).json();
  }
  await mutate({ op: "add", type: "AxialStage", parentId: blank.rocket.id });
  const stage = blank.rocket.children[0].id;
  await mutate({ op: "add", type: "BodyTube", parentId: stage });
  const body = blank.rocket.children[0].children[0].id;
  await mutate({
    op: "set",
    componentId: body,
    changes: { outerRadius: 0.025, thickness: 0.002 },
  });
  await mutate({ op: "add", type: "InnerTube", parentId: body });
  await mutate({ op: "add", type: "TrapezoidFinSet", parentId: body });
  await page.evaluate(
    (id) => localStorage.setItem("rocket-project", id),
    blank.id,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Recent projects", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: /Flight setup regression.*Last opened.*Continue project/,
    })
    .click();
  let jobs = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/jobs")) jobs++;
  });
  await page
    .getByRole("button", { name: "Flight Simulation", exact: true })
    .click();
  await page.getByRole("button", { name: "Simulate launch" }).click();
  await expect(
    page.getByRole("heading", { name: "Prepare your flight" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Create simulation with active configuration",
    }),
  ).toBeDisabled();
  expect(jobs).toBe(0);
  await page
    .getByRole("button", { name: /Choose motor for Inner Tube/i })
    .click();
  await page.getByRole("textbox", { name: "Search motors" }).fill("C6");
  await page
    .locator(".motor-list button")
    .filter({ hasText: /Estes.*C6/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Assign to active configuration" })
    .click();
  await expect(
    page.getByText("The active configuration has a motor.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue to flight setup" }).click();
  await page
    .getByRole("button", {
      name: "Create simulation with active configuration",
    })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Simulation to run" }),
  ).not.toContainText("No simulation configured");
  p = await (await page.request.get(`/api/projects/${blank.id}`)).json();
  expect(p.hasMotors).toBe(true);
  expect(p.simulations[0].configurationId).toBe(p.selectedConfigurationId);
  await page
    .getByRole("button", { name: "Flight Simulation", exact: true })
    .click();
  await page.getByRole("button", { name: "Simulate launch" }).click();
  await expect.poll(() => jobs).toBe(1);
  await expect(page.locator(".status.completed,.status.failed")).toBeVisible({
    timeout: 30000,
  });
  await page
    .getByRole("button", { name: "Design workspace", exact: true })
    .click();
  await expect(page.locator(".results")).toHaveCount(0);
  await page.screenshot({ path: "../tests/design-workspace.png" });
});
