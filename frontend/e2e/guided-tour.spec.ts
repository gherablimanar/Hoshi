import { test, expect } from "@playwright/test";
import type { Project } from "../src/contracts";

test("guided practice follows real clicks, saved dimensions, native add dialog, flight calculation and export", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const tour = page.locator(".guided-tour");
  await expect(tour).toHaveAttribute("data-step", "project");
  await page.locator('[data-tour="example"]').click();
  await expect(tour).toHaveAttribute("data-step", "select");
  await page
    .locator(".tree-row")
    .filter({ hasText: "Body tube" })
    .first()
    .click();
  await expect(tour).toHaveAttribute("data-step", "length");
  const length = page.locator('.inspector input[aria-label="Length"]');
  await length.fill("240");
  await length.press("Enter");
  await expect(tour).toHaveAttribute("data-step", "scene");
  const id = await page.evaluate(() => localStorage.getItem("rocket-project"));
  let p: Project = await (await page.request.get(`/api/projects/${id}`)).json();
  const body = p.rocket.children[0].children.find(
    (c) => c.type === "BodyTube",
  )!;
  expect(body.length).toBeCloseTo(0.24);
  const countBefore = await page.locator(".tree-row").count();
  await tour.getByRole("button", { name: "Show me how to add a part" }).click();
  await page
    .getByRole("button", { name: "Add Component", exact: true })
    .click();
  await expect(tour).toHaveAttribute("data-step", "pick");
  await expect(page.locator("dialog[open] .guided-tour")).toHaveCount(1);
  await page.locator('[data-part-type="BodyTube"]').click();
  await expect(tour).toHaveAttribute("data-step", "attach");
  await page
    .getByRole("button", { name: "Add Body tube", exact: true })
    .click();
  await expect(tour).toHaveAttribute("data-step", "added");
  await expect(page.locator(".tree-row")).toHaveCount(countBefore + 1);
  await expect(page.locator(".tree-row.selected")).toContainText(/Body tube/i);
  await tour.getByRole("button", { name: "Personalise this part" }).click();
  await expect(tour).toHaveAttribute("data-step", "material");
  await tour.getByRole("button", { name: "Keep current material" }).click();
  await page.locator('[data-tour="flight"]').click();
  await expect(tour).toHaveAttribute("data-step", "conditions");
  await expect(page.locator(".app")).toHaveAttribute("data-mode", "flight");
  await tour.getByRole("button", { name: "Reviewed · continue" }).click();
  await expect(tour).toHaveAttribute("data-step", "run");
  await page
    .getByRole("button", { name: "Simulate launch", exact: true })
    .click();
  await expect(tour).toHaveAttribute("data-step", "results", {
    timeout: 30000,
  });
  await expect(page.locator(".status.completed")).toBeVisible();
  await page.screenshot({ path: "../tests/guided-flight.png" });
  await tour.getByRole("button", { name: "Show me how to save" }).click();
  const download = page.waitForEvent("download");
  await page.locator('[data-tour="export"]').click();
  expect((await download).suggestedFilename()).toBe("rocket.ork");
  await expect(tour).toHaveAttribute("data-step", "finish");
  await tour.getByRole("button", { name: "Finish guide" }).click();
  await expect(tour).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "What will you build?" }),
  ).toBeVisible();
  await expect(tour).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("reduced-motion mobile lesson switches visible panels, fits viewport and can be dismissed with Escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const tour = page.locator(".guided-tour");
  await page.locator('[data-tour="example"]').click();
  await expect(tour).toHaveAttribute("data-step", "select");
  await page
    .locator(".tree-row")
    .filter({ hasText: "Body tube" })
    .first()
    .click();
  await expect(tour).toHaveAttribute("data-step", "length");
  await expect(page.locator(".app")).toHaveAttribute("data-pane", "Inspector");
  await expect(
    page.locator('.inspector input[aria-label="Length"]'),
  ).toBeVisible();
  const box = await page.locator(".guided-card").boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  expect(
    await page
      .locator(".guided-demo-cursor")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.screenshot({ path: "../tests/guided-mobile.png" });
  await page.keyboard.press("Escape");
  await expect(tour).toHaveCount(0);
  await page.getByRole("button", { name: "Hierarchy", exact: true }).click();
  await page
    .getByRole("button", { name: "Add Component", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Help / walkthrough" }).click();
  await page
    .getByRole("button", { name: "Replay the guided introduction" })
    .click();
  await expect(tour).toHaveAttribute("data-step", "select");
  await page.keyboard.press("Tab");
  await expect(
    page.locator(".tree-row").filter({ hasText: "Body tube" }).first(),
  ).toBeFocused();
});
