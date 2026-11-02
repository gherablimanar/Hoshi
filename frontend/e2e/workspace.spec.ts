import { test, expect } from "@playwright/test";
test("example → dimension edit → real flight → refresh → export", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Untitled rocket",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore examples" }).click();
  await page.getByRole("button", { name: /A simple model rocket/ }).click();
  await expect(
    page.locator(".tree-row").filter({ hasText: /body tube/i }),
  ).toBeVisible();
  await page
    .locator(".tree-row")
    .filter({ hasText: /body tube/i })
    .click();
  const field = page.getByRole("spinbutton", { name: "Length", exact: true });
  await field.fill("310");
  await field.press("Enter");
  await expect(page.getByText(/Autosaved · revision/)).toBeVisible();
  await page.getByRole("button", { name: "Simulate launch" }).click();
  await expect(page.locator(".status.completed")).toBeVisible({
    timeout: 30000,
  });
  await expect(
    page.getByRole("img", { name: "Altitude versus time" }),
  ).toBeVisible();
  await page.screenshot({ path: "../tests/desktop.png", fullPage: true });
  await page.reload();
  await expect(page.locator(".status.completed")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: /Export$/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("rocket.ork");
  await page.getByRole("button", { name: "Events", exact: true }).click();
  await expect(page.getByText("Apogee", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "../tests/mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(errors).toEqual([]);
});
test("empty workspace explains prerequisites; component library edits a real tree", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /New$/ }).click();
  await expect(
    page.getByRole("heading", {
      name: "Untitled rocket",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Simulate launch" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText(
      "Create simulation settings and select a motor configuration first.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Components", exact: true }).click();
  await page.getByRole("button", { name: /Axial Stage/ }).click();
  await page.getByRole("button", { name: "Design tree", exact: true }).click();
  await page.locator(".tree-row").filter({ hasText: /stage/i }).click();
  await page.getByRole("button", { name: "Components", exact: true }).click();
  await expect(page.getByRole("button", { name: /Nose Cone/ })).toBeEnabled();
  await page.getByRole("button", { name: /Nose Cone/ }).click();
  await page.getByRole("button", { name: "Design tree", exact: true }).click();
  await expect(
    page.locator(".tree-row").filter({ hasText: /nose cone/i }),
  ).toBeVisible();
});
test("core mesh, analysis and explicit optimization acceptance remain undoable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const response = await page.request.post("/api/projects", {
    data: { example: "A simple model rocket.ork" },
  });
  const p = await response.json();
  await page.goto("/");
  await page.evaluate((id) => localStorage.setItem("rocket-project", id), p.id);
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Simulation to run" }),
  ).toHaveValue("0");
  await expect(
    page.getByRole("combobox", { name: "Simulation to run" }),
  ).not.toContainText("No simulation configured");
  await page
    .locator(".tree-row")
    .filter({ hasText: /body tube/i })
    .click();
  const meshResponse = page.waitForResponse((r) => r.url().includes("/mesh"));
  await page.getByRole("button", { name: "3D", exact: true }).click();
  const mesh = await (await meshResponse).json();
  expect(mesh.vertices.length).toBeGreaterThan(50);
  await expect(
    page.getByRole("img", { name: "Upstream mesh three dimensional view" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Analysis", exact: true }).click();
  await page.getByRole("button", { name: "Run analysis", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /analysis · completed/ }),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    page.locator(".analysis-table th").filter({ hasText: "CP [m]" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "optimization", exact: true }).click();
  await page.getByLabel("Minimum [SI]", { exact: true }).fill("0.2");
  await page.getByLabel("Maximum [SI]", { exact: true }).fill("0.4");
  await page
    .getByRole("button", { name: "Run optimization", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Accept optimized design", exact: true }),
  ).toBeVisible({ timeout: 45000 });
  await expect(page.locator(".topbar")).toContainText("rev 1");
  await page
    .getByRole("button", { name: "Accept optimized design", exact: true })
    .click();
  await expect(page.locator(".topbar")).toContainText("rev 2");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".topbar")).toContainText("rev 3");
  expect(errors).toEqual([]);
});
