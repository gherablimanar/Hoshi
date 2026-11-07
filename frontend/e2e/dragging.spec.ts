import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { Project, Component } from "../src/contracts";
const flatten = (c: Component): Component[] => [
  c,
  ...c.children.flatMap(flatten),
];
async function project(page: Page): Promise<Project> {
  const id = await page.evaluate(() => localStorage.getItem("rocket-project"));
  return (await page.request.get(`/api/projects/${id}`)).json();
}
async function open(page: Page, example = false) {
  await page.goto("/");
  await page.getByRole("button", { name: "Skip introduction" }).click();
  await page
    .getByRole("button", {
      name: example ? /A simple model rocket/ : "Create blank rocket",
    })
    .click();
  await expect(page.locator(".app")).toBeVisible();
}
async function add(page: Page, search: string, label: string) {
  await page
    .getByRole("button", { name: "Add Component", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Search components" }).fill(search);
  await page
    .getByRole("button", { name: new RegExp(label + ".*Fits under") })
    .click();
  await page.getByRole("button", { name: "Add " + label, exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function startDrag(page: Page, id: string, distance: number) {
  const node = page
    .locator(`.rocket-part[data-component-id="${id}"]`)
    .first()
    .locator("path,polygon,rect:not(.selection-outline)")
    .first();
  const box = (await node.boundingBox())!;
  const x = box.x + box.width * 0.6,
    y = box.y + box.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + distance, y, { steps: 12 });
}
test("body tubes stay visible; nose defaults to front; hierarchy and scene dragging save and undo", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await add(page, "body tube", "Body tube");
  await add(page, "body tube", "Body tube");
  await add(page, "nose cone", "Nose cone");
  let p = await project(page);
  const children = p.rocket.children[0].children;
  expect(children.map((c) => c.type)).toEqual([
    "NoseCone",
    "BodyTube",
    "BodyTube",
  ]);
  for (const tube of children.filter((c) => c.type === "BodyTube")) {
    expect(tube.shape.outerRadius).toBeGreaterThan(0);
    expect(tube.mass).toBeGreaterThan(0);
  }
  const nose = children[0],
    lastTube = children[2];
  const source = page.locator(`.tree-row[data-component-id="${nose.id}"]`),
    target = page.locator(`.tree-row[data-component-id="${lastTube.id}"]`);
  const targetBox = (await target.boundingBox())!;
  await source.dragTo(target, {
    targetPosition: { x: 65, y: targetBox.height - 3 },
  });
  await expect
    .poll(
      async () => (await project(page)).rocket.children[0].children.at(-1)!.id,
    )
    .toBe(nose.id);
  p = await project(page);
  const revision = p.revision;
  const shape = (await page
    .locator(`.rocket-part[data-component-id="${nose.id}"] path`)
    .boundingBox())!;
  const scene = (await page.locator(".rocket-canvas").boundingBox())!;
  const start = shape.x + shape.width * 0.6;
  let writes = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/mutate")) writes++;
  });
  await startDrag(page, nose.id, scene.x + scene.width * 0.12 - start);
  expect(writes).toBe(0);
  await page.mouse.up();
  await expect
    .poll(async () => (await project(page)).rocket.children[0].children[0].id)
    .toBe(nose.id);
  expect((await project(page)).revision).toBe(revision + 1);
  expect(writes).toBe(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(
      async () => (await project(page)).rocket.children[0].children.at(-1)!.id,
    )
    .toBe(nose.id);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect
    .poll(async () => (await project(page)).rocket.children[0].children[0].id)
    .toBe(nose.id);
  await expect(page.locator(".statusbar")).toContainText("Hoshi Editor 0.6");
  await page.screenshot({ path: "../tests/mouse-assembly.png" });
  await page.reload();
  await page
    .getByRole("button", { name: "Recent projects", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: /Untitled rocket.*Last opened.*Continue project/,
    })
    .click();
  expect((await project(page)).rocket.children[0].children[0].id).toBe(nose.id);
  expect(errors).toEqual([]);
});
test("drag fins along the rocket; clicks and Escape do not save changes", async ({
  page,
}) => {
  await open(page, true);
  let p = await project(page);
  const fin = flatten(p.rocket).find((c) => c.type === "TrapezoidFinSet")!;
  const oldOffset = Number(
    fin.properties.find((p) => p.key === "axialOffset")!.value,
  );
  const revision = p.revision;
  await page.locator(`.tree-row[data-component-id="${fin.id}"]`).click();
  await startDrag(page, fin.id, 32);
  await expect(page.locator(".canvas-bottom")).toContainText(
    "Release to apply position",
  );
  expect((await project(page)).revision).toBe(revision);
  await page.mouse.up();
  await expect
    .poll(async () => (await project(page)).revision)
    .toBe(revision + 1);
  p = await project(page);
  expect(
    Number(
      flatten(p.rocket)
        .find((c) => c.id === fin.id)!
        .properties.find((p) => p.key === "axialOffset")!.value,
    ),
  ).toBeGreaterThan(oldOffset);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () =>
      Number(
        flatten((await project(page)).rocket)
          .find((c) => c.id === fin.id)!
          .properties.find((p) => p.key === "axialOffset")!.value,
      ),
    )
    .toBeCloseTo(oldOffset, 8);
  const unchanged = (await project(page)).revision;
  await startDrag(page, fin.id, -28);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect((await project(page)).revision).toBe(unchanged);
  const node = page
    .locator(`.rocket-part[data-component-id="${fin.id}"]`)
    .first()
    .locator("polygon")
    .first();
  await node.click();
  expect((await project(page)).revision).toBe(unchanged);
});
test("existing zero-diameter tubes have an explicit repair and retain native mass", async ({
  page,
}) => {
  let p: Project = await (
    await page.request.post("/api/projects", { data: { name: "Legacy tubes" } })
  ).json();
  async function mutate(data: object) {
    p = await (
      await page.request.post(`/api/projects/${p.id}/mutate`, {
        data: { revision: p.revision, ...data },
      })
    ).json();
  }
  await mutate({ op: "add", parentId: p.rocket.id, type: "AxialStage" });
  const stage = p.rocket.children[0].id;
  await mutate({ op: "add", parentId: stage, type: "BodyTube" });
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
      name: /Legacy tubes.*Last opened.*Continue project/,
    })
    .click();
  await page.locator(`.tree-row[data-component-id="${tube}"]`).click();
  await expect(page.locator(".zero-diameter-warning")).toContainText(
    "zero outer diameter",
  );
  await page.getByRole("button", { name: "Use 50 mm tube dimensions" }).click();
  await expect(page.locator(".zero-diameter-warning")).toHaveCount(0);
  const repaired = flatten((await project(page)).rocket).find(
    (c) => c.id === tube,
  )!;
  expect(repaired.shape.outerRadius).toBeCloseTo(0.025);
  expect(repaired.mass).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".zero-diameter-warning")).toBeVisible();
});
test("hierarchy dragging reparents compatible parts and rejects ancestor cycles", async ({
  page,
}) => {
  await open(page, true);
  const p = await project(page),
    nodes = flatten(p.rocket);
  const parachute = nodes.find((c) => c.type === "Parachute")!,
    nose = nodes.find((c) => c.type === "NoseCone")!;
  const body = nodes.find((c) => c.id === parachute.parentId)!;
  expect(nose.compatibleTypes).toContain("Parachute");
  const row = (id: string) =>
    page.locator(`.tree-row[data-component-id="${id}"]`);
  await row(parachute.id).dragTo(row(nose.id));
  await expect
    .poll(
      async () =>
        flatten((await project(page)).rocket).find(
          (c) => c.id === parachute.id,
        )!.parentId,
    )
    .toBe(nose.id);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(
      async () =>
        flatten((await project(page)).rocket).find(
          (c) => c.id === parachute.id,
        )!.parentId,
    )
    .toBe(body.id);
  const revision = (await project(page)).revision;
  await row(body.id).dragTo(row(parachute.id));
  expect((await project(page)).revision).toBe(revision);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
