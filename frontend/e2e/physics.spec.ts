import { test, expect } from "@playwright/test";
import { recordedAttitude } from "../src/flightAttitude";
import type { Branch } from "../src/contracts";

const branch = (
  theta: (number | null)[],
  phi: (number | null)[],
  events: Branch["events"] = [],
): Branch => ({
  name: "Synthetic attitude projection regression",
  events,
  variables: [
    { key: "Θ", name: "Elevation", unit: "rad", values: theta },
    { key: "Φ", name: "Heading", unit: "rad", values: phi },
    // Descent velocity must never change a body's recorded attitude.
    { key: "Vz", name: "Vertical velocity", unit: "m/s", values: [10, -10] },
  ],
});

test("body orientation follows recorded quaternion angles, independent of ascent or descent velocity", () => {
  const vertical = branch([Math.PI / 2, Math.PI / 2], [0, 0]);
  expect(recordedAttitude(vertical, 0, 0).angle).toBeCloseTo(0);
  expect(recordedAttitude(vertical, 1, 1).angle).toBeCloseTo(0);
  expect(recordedAttitude(branch([0], [Math.PI / 2]), 0, 0).angle).toBeCloseTo(
    90,
  );
  expect(
    recordedAttitude(branch([0], [(3 * Math.PI) / 2]), 0, 0).angle,
  ).toBeCloseTo(-90);
  expect(
    Math.abs(recordedAttitude(branch([-Math.PI / 2], [0]), 0, 0).angle!),
  ).toBeCloseTo(180);
  expect(
    recordedAttitude(branch([Math.PI / 4], [Math.PI / 2]), 0, 0).angle,
  ).toBeCloseTo(45);
});

test("missing, nonfinite, wrong-unit and out-of-plane attitude produces a neutral position marker", () => {
  expect(recordedAttitude(undefined, 0, 0).angle).toBeNull();
  expect(recordedAttitude(branch([null], [0]), 0, 0).angle).toBeNull();
  expect(recordedAttitude(branch([NaN], [0]), 0, 0).angle).toBeNull();
  expect(recordedAttitude(branch([0], [0]), 0, 0).angle).toBeNull();
  const degrees = branch([90], [0]);
  degrees.variables[0].unit = "°";
  expect(recordedAttitude(degrees, 0, 0).angle).toBeNull();
});

test("recovery, tumble and ground events invalidate stale rigid-body orientation only from their recorded time", () => {
  const landed = branch(
    [Math.PI / 2],
    [0],
    [
      {
        type: "RECOVERY_DEVICE_DEPLOYMENT",
        time: 5,
        sourceId: null,
        detail: null,
      },
      { type: "GROUND_HIT", time: 10, sourceId: null, detail: null },
    ],
  );
  expect(recordedAttitude(landed, 0, 7).explanation).toContain(
    "Recovery descent",
  );
  expect(recordedAttitude(landed, 0, 10).explanation).toContain(
    "On the ground",
  );
  for (const type of ["RECOVERY_DEVICE_DEPLOYMENT", "TUMBLE", "GROUND_HIT"]) {
    const b = branch(
      [Math.PI / 2],
      [0],
      [{ type, time: 5, sourceId: null, detail: null }],
    );
    expect(recordedAttitude(b, 0, 4.99).angle).toBeCloseTo(0);
    expect(recordedAttitude(b, 0, 5).angle).toBeNull();
    expect(recordedAttitude(b, 0, 6).angle).toBeNull();
  }
});
