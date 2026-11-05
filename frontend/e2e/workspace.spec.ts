import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
async function skipGuide(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Skip introduction" }).click();
  await expect(
    page.getByRole("heading", { name: "What will you build?" }),
  ).toBeVisible();
}
async function example(page: Page) {
  await page.getByRole("button", { name: /A simple model rocket/ }).click();
  await expect(page.locator(".app")).toBeVisible();
}
async function noDocumentScroll(page: Page) {
  expect(
    await page.evaluate(() => ({
      vertical: document.documentElement.scrollHeight <= innerHeight,
      horizontal: document.documentElement.scrollWidth <= innerWidth,
    })),
  ).toEqual({ vertical: true, horizontal: true });
}
test("first visit explains the editor, then chooses an example; no project created before selection", async ({
  page,
}) => {
  let creates = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/api/projects")) creates++;
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Design a rocket. Understand its flight.",
    }),
  ).toBeVisible();
  for (let i = 0; i < 8; i++)
    await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Finish guide", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "What will you build?" }),
  ).toBeVisible();
  expect(creates).toBe(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await noDocumentScroll(page);
  await page.screenshot({
    path: "../tests/project-launcher.png",
    fullPage: true,
  });
  await example(page);
  expect(creates).toBe(1);
  await noDocumentScroll(page);
  await expect(page.getByText("Not configured", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Explore examples" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Help / walkthrough" }).click();
  await page.getByRole("textbox", { name: "Search help" }).fill("root chord");
  await expect(
    page.getByText("Length of the fin edge attached to the body."),
  ).toBeVisible();
});
test("blank stage → compatible parts → inspector edits → keyboard duplicate and undo", async ({
  page,
}) => {
  await skipGuide(page);
  await page.getByRole("button", { name: "Create blank rocket" }).click();
  await expect(
    page.locator(".tree-row").filter({ hasText: /stage/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Simulate launch" }).click();
  await expect(
    page.getByText(
      "Create simulation settings and select a motor configuration first.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Add Component", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Search components" })
    .fill("body tube");
  await page.getByRole("button", { name: /Body tube.*Fits under/ }).click();
  await page
    .getByRole("button", { name: "Add Body tube", exact: true })
    .click();
  await expect(page.locator(".inspector h2")).toContainText(/body tube/i);
  const length = page.getByRole("spinbutton", { name: "Length", exact: true });
  await length.fill("310");
  await length.press("Enter");
  await expect(length).toHaveValue("310");
  await page
    .getByRole("button", { name: "Add Component", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Search components" })
    .fill("trapezoidal");
  await page
    .getByRole("button", { name: /Trapezoidal fins.*Fits under/ })
    .click();
  await expect(
    page
      .getByRole("combobox", { name: "Component attachment" })
      .locator("option:checked"),
  ).toHaveText(/body tube/i);
  await page
    .getByRole("button", { name: "Add Trapezoidal fins", exact: true })
    .click();
  await expect(page.locator(".inspector h2")).toContainText(/fin/i);
  await page.locator(".tree-row.selected").focus();
  await page.keyboard.press("Control+d");
  await expect(
    page.locator(".tree-row").filter({ hasText: /fin set copy/i }),
  ).toBeVisible();
  await page.keyboard.press("Control+z");
  await expect(
    page.locator(".tree-row").filter({ hasText: /fin set copy/i }),
  ).toHaveCount(0);
  await noDocumentScroll(page);
});
test("full-window editor: resize, real flight, export, recent projects and mobile panels", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await skipGuide(page);
  await example(page);
  await page
    .locator(".tree-row")
    .filter({ hasText: /body tube/i })
    .click();
  await page
    .getByRole("spinbutton", { name: "Length", exact: true })
    .fill("310");
  await page
    .getByRole("spinbutton", { name: "Length", exact: true })
    .press("Enter");
  await expect(page.getByText(/Autosaved · revision/)).toBeVisible();
  const sep = page.getByRole("separator", { name: "Inspector panel width" });
  const previous = await sep.getAttribute("aria-valuenow");
  await sep.focus();
  await page.keyboard.press("ArrowLeft");
  expect(await sep.getAttribute("aria-valuenow")).not.toBe(previous);
  await page.getByRole("button", { name: "Simulate launch" }).click();
  await expect(page.locator(".status.completed")).toBeVisible({
    timeout: 30000,
  });
  await noDocumentScroll(page);
  await page.screenshot({ path: "../tests/desktop.png", fullPage: true });
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /Export$/ }).click();
  expect((await download).suggestedFilename()).toBe("rocket.ork");
  await page.getByRole("button", { name: "Events", exact: true }).click();
  await expect(page.getByText("Apogee", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "What will you build?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Recent projects", exact: true })
    .click();
  await page
    .getByRole("button", { name: /A simple model rocket.*Continue project/ })
    .first()
    .click();
  await expect(page.locator(".status.completed")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await noDocumentScroll(page);
  await page
    .getByRole("button", { name: "Inspector", exact: true })
    .first()
    .click();
  await expect(page.locator(".inspector")).toBeVisible();
  await page.getByRole("button", { name: "Results", exact: true }).click();
  await expect(page.locator(".status.completed")).toBeVisible();
  await noDocumentScroll(page);
  await page.screenshot({ path: "../tests/mobile.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("3D, advanced analysis and explicit optimization acceptance stay functional", async ({
  page,
}) => {
  await skipGuide(page);
  await example(page);
  await page
    .locator(".tree-row")
    .filter({ hasText: /body tube/i })
    .click();
  const mesh = page.waitForResponse((r) => r.url().includes("/mesh"));
  await page.getByRole("button", { name: "3D", exact: true }).click();
  expect((await (await mesh).json()).vertices.length).toBeGreaterThan(50);
  await page.getByText("Tools ▾", { exact: true }).click();
  await page.getByRole("button", { name: "Analysis & optimization" }).click();
  await page.getByRole("button", { name: "Run analysis", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /analysis · completed/ }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "optimization", exact: true }).click();
  await page.getByLabel("Minimum [SI]", { exact: true }).fill("0.2");
  await page.getByLabel("Maximum [SI]", { exact: true }).fill("0.4");
  await page
    .getByRole("button", { name: "Run optimization", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Accept optimized design" }),
  ).toBeVisible({ timeout: 45000 });
  await page.getByRole("button", { name: "Accept optimized design" }).click();
  await expect(page.locator(".topbar")).toContainText("rev 2");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".topbar")).toContainText("rev 3");
});
