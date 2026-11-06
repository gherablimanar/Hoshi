import type { Project } from "./contracts";
import { flatten } from "./Canvas";
import { flightChecks } from "./flightChecks";
import type { FlightIssue } from "./flightChecks";
import { FlightControls } from "./FlightControls";
export function FlightSetup({
  project,
  index,
  busy,
  active,
  chooseMotor,
  mutate,
  setIndex,
  settings,
  design,
  fix,
}: {
  project: Project;
  index: number;
  busy: boolean;
  active: boolean;
  chooseMotor: (id: string) => void;
  mutate: (data: Record<string, unknown>) => Promise<void>;
  setIndex: (i: number) => void;
  settings: () => void;
  design: () => void;
  fix: (issue: FlightIssue) => void;
}) {
  const sim = project.simulations[index];
  const mismatch =
    !!sim && sim.configurationId !== project.selectedConfigurationId;
  const mounts = flatten(project.rocket).filter((c) => c.motorConfiguration);
  const issues = flightChecks(project, index);
  return (
    <section className="flight-setup">
      <header>
        <div>
          <small>FLIGHT SIMULATION</small>
          <h1>Prepare your flight</h1>
        </div>
        <button onClick={design}>Back to design</button>
      </header>
      <section className="preflight-checks" aria-label="Launch checks">
        <h2>
          {issues.some((i) => i.severity === "blocker")
            ? "Launch blocked — fix these setup issues"
            : "Launch checks and model warnings"}
        </h2>
        {issues.length ? (
          issues.map((issue) => (
            <article key={issue.id} className={`preflight-${issue.severity}`}>
              <strong>
                {issue.severity === "blocker" ? "Blocks launch: " : "Warning: "}
                {issue.reason}
              </strong>
              <p>{issue.fix}</p>
              <button disabled={busy || active} onClick={() => fix(issue)}>
                {issue.action === "design"
                  ? "Show design to fix this"
                  : issue.action === "motor"
                    ? "Choose a motor"
                    : "Review flight setup"}
              </button>
            </article>
          ))
        ) : (
          <p>
            No blocking setup errors found. This is not a certification of
            real-flight suitability.
          </p>
        )}
        <p className="model-boundary">
          OpenRocket models flight dynamics, aerodynamics, mass, motors and
          recovery. It does not verify construction strength, heat resistance,
          physical assembly or every real-world failure. A completed calculation
          is not proof of a safe or successful real flight.
        </p>
      </section>
      <div className="flight-steps">
        <section>
          <h2>1 · Motor and mount</h2>
          <p>
            {project.hasMotors
              ? "The active configuration has a motor. Check its mount and delay."
              : "No motor is assigned to the active configuration. Choose a tube and assign a motor that fits."}
          </p>
          {mounts.length ? (
            mounts.map((c) => (
              <button
                disabled={busy || active}
                key={c.id}
                onClick={() => chooseMotor(c.id)}
              >
                Choose motor for {c.name}
              </button>
            ))
          ) : (
            <button onClick={design}>
              Return to design and add a motor tube
            </button>
          )}
          <small>
            Assignment uses the active configuration; the motor catalog checks
            diameter and length.
          </small>
        </section>
        <section>
          <h2>2 · Simulation configuration</h2>
          <p>
            {!sim
              ? "No simulation configured. Assign a motor first, then create a simulation using that configuration."
              : `Selected: ${sim.name}`}
          </p>
          <button
            disabled={busy || active || !project.hasMotors}
            onClick={async () => {
              const next = project.simulations.length;
              await mutate({ op: "simulation", name: "Launch " + (next + 1) });
              setIndex(next);
            }}
          >
            Create simulation with active configuration
          </button>
          {mismatch && (
            <>
              <p className="warning-inline">
                The simulation uses a different motor configuration. Select it
                to inspect its actual motors before launching.
              </p>
              <button
                disabled={busy || active}
                onClick={() =>
                  mutate({
                    op: "selectConfiguration",
                    configurationId: sim.configurationId,
                  })
                }
              >
                Inspect simulation configuration
              </button>
              {project.hasMotors && (
                <button
                  disabled={busy || active}
                  onClick={() =>
                    mutate({
                      op: "settings",
                      simulationIndex: index,
                      configurationId: project.selectedConfigurationId,
                    })
                  }
                >
                  Use active motor configuration for this simulation
                </button>
              )}
            </>
          )}
        </section>
        <section>
          <h2>3 · Recovery and launch</h2>
          <p>
            Review recovery deployment, launch guide, atmosphere and wind. The
            design must have suitable geometry and recovery equipment.
          </p>
          <button disabled={busy || active} onClick={settings}>
            Open flight settings
          </button>
          {project.warnings.length > 0 && (
            <details>
              <summary>
                {project.warnings.length} engine geometry warnings
              </summary>
              {project.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </details>
          )}
          <p>
            Run the selected flight with Simulate launch above. Failed runs show
            the engine error below.
          </p>
        </section>
      </div>
      <FlightControls
        project={project}
        index={index}
        busy={busy || active}
        mutate={mutate}
      />
    </section>
  );
}
