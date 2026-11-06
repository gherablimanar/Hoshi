import type { Project, SimulationRun } from "./contracts";
import { flatten } from "./Canvas";
export interface FlightIssue {
  id: string;
  severity: "blocker" | "warning";
  reason: string;
  fix: string;
  componentId?: string;
  action: "design" | "motor" | "simulation" | "settings";
}
export function flightChecks(p: Project, index: number): FlightIssue[] {
  const issues: FlightIssue[] = [];
  const nodes = flatten(p.rocket);
  const sim = p.simulations[index];
  const add = (
    id: string,
    reason: string,
    fix: string,
    action: FlightIssue["action"],
    componentId?: string,
    severity: FlightIssue["severity"] = "blocker",
  ) => issues.push({ id, reason, fix, action, componentId, severity });
  if (!sim)
    add(
      "simulation",
      "No simulation is selected.",
      "Assign a motor, then create a simulation using its configuration.",
      "simulation",
    );
  if (!p.hasMotors)
    add(
      "motor",
      "The active configuration has no motor.",
      "Choose a body or inner tube and assign a real motor that fits.",
      "motor",
    );
  if (sim && sim.configurationId !== p.selectedConfigurationId)
    add(
      "configuration",
      "The simulation and drawing use different motor configurations.",
      "Inspect the simulation configuration, or explicitly link it to the active motor configuration.",
      "simulation",
    );
  if (!(p.quantities.length > 0))
    add(
      "length",
      "The active rocket has no positive airframe length.",
      "Add and size a body tube and check which stages are enabled.",
      "design",
    );
  if (
    p.hasMotors &&
    (!(p.quantities.loadedMass! > 0) ||
      !Number.isFinite(p.quantities.loadedMass))
  )
    add(
      "mass",
      "The active rocket has no finite positive loaded mass.",
      "Check dimensions, density and measured-mass overrides.",
      "design",
    );
  if (
    nodes.some((c) => c.stageEnabled !== undefined) &&
    nodes
      .filter((c) => c.stageEnabled !== undefined)
      .every((c) => c.stageEnabled === false)
  )
    add(
      "stages",
      "All stages are disabled in the active configuration.",
      "Select a stage and enable it for this configuration.",
      "design",
    );
  for (const c of nodes) {
    if (c.type === "BodyTube" && !(c.shape.outerRadius > 0))
      add(
        "diameter-" + c.id,
        `${c.name} has zero outer diameter.`,
        "Set a positive outside diameter in Dimensions, or use the tube repair button.",
        "design",
        c.id,
      );
    const thickness = c.properties.find((x) => x.key === "thickness");
    const filled = c.properties.find((x) => x.key === "filled")?.value;
    if (
      c.type === "BodyTube" &&
      thickness &&
      Number(thickness.value) <= 0 &&
      !filled
    )
      add(
        "wall-" + c.id,
        `${c.name} has no wall thickness.`,
        "Enter the measured wall thickness or model an intentionally solid component.",
        "design",
        c.id,
      );
  }
  if (p.quantities.length > 0 && p.quantities.cp === null)
    add(
      "cp",
      "The engine cannot calculate a centre of pressure for the active geometry.",
      "Check the airframe and fin geometry, active stages and engine warnings before launching.",
      "design",
    );
  if (p.quantities.stability !== null && p.quantities.stability <= 0)
    add(
      "stability",
      "The static stability reference is zero or negative at the displayed conditions.",
      "Review fin geometry and loaded balance. Consider moving mass forward or aerodynamic area aft; inspect the full flight, not only this reference.",
      "design",
      undefined,
      "warning",
    );
  if (!nodes.some((c) => ["Parachute", "Streamer"].includes(c.type)))
    add(
      "recovery",
      "No parachute or streamer is present in this design.",
      "Add an appropriate recovery device and configure deployment, or explicitly review the intended ballistic recovery case.",
      "design",
      undefined,
      "warning",
    );
  if (sim) {
    for (const key of [
      "launchRodLength",
      "maxSimulationTime",
      "timeStep",
      "launchPressure",
      "launchTemperature",
    ]) {
      const value = sim.options.find((o) => o.key === key)?.value;
      if (
        value !== undefined &&
        (!Number.isFinite(Number(value)) || Number(value) <= 0)
      )
        add(
          key,
          `${key} must be finite and greater than zero.`,
          "Correct this value in Flight controls or Flight settings.",
          "settings",
        );
    }
  }
  p.warnings.forEach((w, i) =>
    add(
      "engine-" + i,
      w,
      "Inspect the engine warning and the relevant geometry or flight configuration.",
      "design",
      undefined,
      "warning",
    ),
  );
  return issues;
}
export function flightConcerns(run: SimulationRun) {
  const events = run.branches?.flatMap((b) => b.events) || [];
  const concerns: { reason: string; fix: string }[] = [];
  for (const e of events.filter(
    (e) => e.type === "SIM_ABORT" || e.type === "EXCEPTION",
  )) {
    const reason = (e.detail || run.error || "The engine stopped this flight.")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    let fix =
      "Inspect Events and engine warnings. Correct the reported design or launch setting, then run a new simulation.";
    if (
      /no motors|no ignition|no motors ignited|ignite at liftoff/i.test(reason)
    )
      fix =
        "Assign a motor to this simulation configuration and set its initial motor ignition event to launch.";
    else if (/without liftoff|no lift.?off/i.test(reason))
      fix =
        "The selected motor did not lift this model. Review loaded mass and the motor's thrust curve; choose an appropriate motor or reduce mass, then check guide-exit speed.";
    else if (/cent(?:er|re) of pressure|\bCP\b/i.test(reason))
      fix =
        "Check fin and airframe geometry and enabled stages so the engine can calculate aerodynamics.";
    else if (/tumble/i.test(reason))
      fix =
        "Review fin geometry, loaded balance, motor alignment and launch conditions. Do not treat this as a successful stable flight.";
    else if (/recovery.*thrust/i.test(reason))
      fix =
        "Change recovery deployment and ejection timing so deployment does not occur while the motor is producing thrust.";
    else if (/no active stages|length.*0|mass.*0/i.test(reason))
      fix =
        "Enable the intended stages and give their physical components positive dimensions and realistic mass.";
    concerns.push({ reason, fix });
  }
  if (run.status === "failed" && !concerns.length)
    concerns.push({
      reason:
        run.error || "The engine failed before a flight could be completed.",
      fix: "Inspect the actual engine error, Events and warnings. No successful trajectory is substituted.",
    });
  if (
    events.some((e) => e.type === "TUMBLE") &&
    !concerns.some((c) => /tumble/i.test(c.reason))
  )
    concerns.push({
      reason: "Tumbling was recorded during this flight.",
      fix: "Review stability and flight conditions. A completed engine calculation does not establish a stable flight.",
    });
  if (run.status === "completed" && !events.some((e) => e.type === "LIFTOFF"))
    concerns.push({
      reason: "No lift-off event was recorded.",
      fix: "Inspect motor ignition, thrust and loaded mass. Engine completion alone does not mean the rocket launched.",
    });
  if (
    run.status === "completed" &&
    events.some((e) => e.type === "GROUND_HIT") &&
    !events.some((e) => e.type === "RECOVERY_DEVICE_DEPLOYMENT")
  )
    concerns.push({
      reason: "No recovery deployment was recorded before ground contact.",
      fix: "Review recovery equipment, deployment conditions and motor ejection delay; inspect impact velocity in the flight variables.",
    });
  if (
    run.status === "completed" &&
    events.some((e) => e.type === "LIFTOFF") &&
    !events.some((e) => e.type === "GROUND_HIT")
  )
    concerns.push({
      reason: "The recorded flight ends without ground contact.",
      fix: "Inspect terminal events and increase the maximum simulation time when a full descent record is required.",
    });
  return concerns;
}
