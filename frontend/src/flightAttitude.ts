import type { Branch } from "./contracts";

// SimulationStatus records rotateZ(quaternion): theta = elevation,
// phi = heading clockwise from north. Do not infer attitude from velocity.
export function recordedAttitude(
  branch: Branch | undefined,
  index: number,
  time: number,
) {
  const stopped = branch?.events
    .filter(
      (e) =>
        ["RECOVERY_DEVICE_DEPLOYMENT", "TUMBLE", "GROUND_HIT"].includes(
          e.type,
        ) && e.time <= time,
    )
    .sort((a, b) => b.time - a.time)[0];
  if (stopped)
    return {
      angle: null,
      explanation:
        stopped.type === "RECOVERY_DEVICE_DEPLOYMENT"
          ? "Recovery descent: the engine uses a drag model; body orientation is not calculated."
          : stopped.type === "TUMBLE"
            ? "Tumbling: the engine uses an approximate drag model; body orientation is not calculated."
            : "On the ground: body orientation is not calculated.",
    };
  const theta = branch?.variables.find((v) => v.key === "Θ"),
    phi = branch?.variables.find((v) => v.key === "Φ");
  const elevation = theta?.values[index],
    heading = phi?.values[index];
  if (
    theta?.unit !== "rad" ||
    phi?.unit !== "rad" ||
    elevation == null ||
    heading == null ||
    !Number.isFinite(elevation) ||
    !Number.isFinite(heading)
  ) {
    return {
      angle: null,
      explanation:
        "Recorded body orientation is unavailable; the dot shows position only.",
    };
  }
  const east = Math.cos(elevation) * Math.sin(heading),
    up = Math.sin(elevation);
  if (Math.hypot(east, up) < 1e-6)
    return {
      angle: null,
      explanation:
        "The rocket points out of this east / altitude projection; the dot shows position only.",
    };
  return {
    angle: (Math.atan2(east, up) * 180) / Math.PI,
    explanation:
      "Calculated body orientation from the engine, projected east / up. Position axes are scaled independently; orientation is not a trajectory tangent.",
  };
}
