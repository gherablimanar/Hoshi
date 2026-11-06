import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

async function add(page: Page, search: string, name: string) {
  await page
    .getByRole("button", { name: "Add Component", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Search components" }).fill(search);
  await page
    .getByRole("button", {
      name: new RegExp(
        name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ".*Fits under",
      ),
    })
    .click();
  await page.getByRole("button", { name: `Add ${name}`, exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function project(page: Page) {
  const id = await page.evaluate(() => localStorage.getItem("rocket-project"));
  return (await page.request.get(`/api/projects/${id}`)).json();
}
async function visibleSelection(page: Page, name: string) {
  const node = page.locator(".rocket-canvas .rocket-part.selected").first();
  await expect(node).toHaveAttribute(
    "aria-label",
    new RegExp(`^Select ${name}$`, "i"),
  );
  await expect(node.locator(".selection-name")).toHaveCount(0);
  expect(
    await node.evaluate((el) => {
      const shape = el.getBoundingClientRect();
      const scene = el.closest("svg")!.getBoundingClientRect();
      return (
        shape.width > 0 &&
        shape.height > 0 &&
        shape.left < scene.right &&
        shape.right > scene.left &&
        shape.top < scene.bottom &&
        shape.bottom > scene.top
      );
    }),
  ).toBe(true);
}
test("one add workflow: visible parts, real dimensions/material/mass, and explicit empty stages", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Skip introduction" }).click();
  await page.getByRole("button", { name: "Create blank rocket" }).click();
  await expect(
    page.getByRole("button", { name: "Add Component", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Components", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^(Rear|3D)$/ })).toHaveCount(
    0,
  );
  await expect(page.locator(".assembly-context")).toContainText(
    "Empty assembly container",
  );
  await add(page, "nose cone", "Nose cone");
  await visibleSelection(page, "Nose cone");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await add(page, "body tube", "Body tube");
  await visibleSelection(page, "Body tube");
  await expect(page.locator(".zoom-controls")).toContainText("100%");
  const length = page.getByRole("spinbutton", { name: "Length", exact: true });
  await length.fill("320");
  await length.press("Enter");
  await expect(length).toHaveValue("320");
  const diameter = page.getByRole("spinbutton", {
    name: "Outer Diameter",
    exact: true,
  });
  await diameter.fill("40");
  await diameter.press("Enter");
  await expect(diameter).toHaveValue("40");
  const before = await project(page);
  const stage = before.rocket.children[0];
  const body = stage.children.find((c: any) => c.type === "BodyTube");
  expect(body.length).toBeCloseTo(0.32);
  expect(body.shape.outerRadius).toBeCloseTo(0.02);
  await page
    .getByRole("combobox", { name: "Material library" })
    .selectOption("Aluminum");
  await page
    .getByRole("button", { name: "Apply material", exact: true })
    .click();
  await expect(
    page.locator(".material-settings .group-hint").first(),
  ).toContainText("Aluminum");
  const after = await project(page);
  const changed = after.rocket.children[0].children.find(
    (c: any) => c.id === body.id,
  );
  expect(changed.material).toMatchObject({
    name: "Aluminum",
    density: 2700,
    type: "BULK",
  });
  expect(changed.mass).toBeGreaterThan(body.mass);
  await page
    .getByRole("textbox", { name: "Search component settings" })
    .fill("mass");
  await page
    .getByRole("checkbox", { name: "Mass Overridden", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Mass Overridden", exact: true }),
  ).toBeChecked();
  const mass = page.getByRole("spinbutton", {
    name: "Override Mass",
    exact: true,
  });
  await mass.fill("123");
  await mass.press("Enter");
  await expect(mass).toHaveValue("123");
  const measured = await project(page);
  expect(
    measured.rocket.children[0].children.find((c: any) => c.id === body.id)
      .mass,
  ).toBeCloseTo(0.123);
  await page
    .getByRole("textbox", { name: "Search component settings" })
    .fill("");
  await page.screenshot({ path: "../tests/component-settings.png" });
  const count = await page.locator(".rocket-part").count();
  await add(page, "stage", "Stage (assembly container)");
  await expect(page.locator(".assembly-context")).toContainText(
    "Empty assembly container",
  );
  await expect(page.locator(".assembly-explanation")).toContainText(
    "no material or solid shape",
  );
  await expect(page.locator(".assembly-explanation")).toBeInViewport({
    ratio: 1,
  });
  await expect(page.locator(".rocket-part")).toHaveCount(count);
  await expect(
    page.locator(".tree-row.selected .tree-container-label"),
  ).toHaveText("empty");
  await expect(
    page.getByRole("button", { name: "Add Component", exact: true }),
  ).toHaveCount(1);
  await page.screenshot({ path: "../tests/empty-stage.png" });
  await page.reload();
  await page
    .getByRole("button", { name: "Recent projects", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: /Untitled rocket.*Last opened.*Continue project/,
    })
    .click();
  await page
    .locator(".tree-row")
    .filter({ hasText: /body tube/i })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Length", exact: true }),
  ).toHaveValue("320");
  await expect(
    page.locator(".material-settings .group-hint").first(),
  ).toContainText("Aluminum");
  expect(errors).toEqual([]);
});

test("recovery settings use surface and line material densities", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Skip introduction" }).click();
  await page.getByRole("button", { name: /A simple model rocket/ }).click();
  await page
    .locator(".tree-row")
    .filter({ hasText: /parachute/i })
    .click();
  await expect(
    page.getByRole("spinbutton", {
      name: "Material density (kg/m²)",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Material library" })
    .selectOption("Mylar");
  await page
    .getByRole("button", { name: "Apply material", exact: true })
    .click();
  await expect(
    page.locator(".material-settings .group-hint").first(),
  ).toContainText("0.021 kg/m²");
  await page
    .locator(".tree-row")
    .filter({ hasText: /shock cord/i })
    .click();
  await expect(
    page.getByRole("spinbutton", {
      name: "Material density (kg/m)",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Material library" })
    .selectOption("Thread (heavy-duty)");
  await page
    .getByRole("button", { name: "Apply material", exact: true })
    .click();
  await expect(
    page.locator(".material-settings .group-hint").first(),
  ).toContainText("0.0003 kg/m");
});
