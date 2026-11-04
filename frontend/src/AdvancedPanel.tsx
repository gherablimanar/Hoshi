import { useState, useEffect } from "react";
import { DownloadLink } from "./DownloadLink";
import { api } from "./api";
import { flatten } from "./Canvas";
import type { Project, SimulationJob } from "./contracts";
interface TaskResult {
  id: string;
  kind: string;
  status: string;
  revision: number;
  error?: string;
  components?: Record<string, unknown>[];
  warnings?: string[];
  values?: {
    conditions: Record<string, number>;
    components: Record<string, unknown>[];
    warnings: string[];
  }[];
  evaluations?: {
    objective: number | null;
    parameters: number[];
    goal: number | null;
  }[];
  changes?: {
    componentId: string;
    property: string;
    before: number;
    after: number;
    unit: string;
  }[];
  objective?: string;
  objectiveUnit?: string;
  limitations?: string;
}
export function AdvancedPanel({
  project,
  selected,
  onAccept,
}: {
  project: Project;
  selected: string;
  onAccept: (path: string, body: Record<string, unknown>) => Promise<void>;
}) {
  const [kind, setKind] = useState("analysis"),
    [mach, setMach] = useState(0.3),
    [aoa, setAoa] = useState(0),
    [axis, setAxis] = useState("mach"),
    [min, setMin] = useState(0),
    [max, setMax] = useState(1),
    [steps, setSteps] = useState(15),
    [target, setTarget] = useState(selected),
    [property, setProperty] = useState("length"),
    [objective, setObjective] = useState("maxAltitude"),
    [goal, setGoal] = useState("maximize"),
    [stability, setStability] = useState(1),
    [simulationIndex, setSimulationIndex] = useState(0),
    [job, setJob] = useState<SimulationJob | null>(null),
    [result, setResult] = useState<TaskResult | null>(null),
    [error, setError] = useState(""),
    [parameters, setParameters] = useState(""),
    [multi, setMulti] = useState(false);
  const active = job && ["pending", "running"].includes(job.state),
    components = flatten(project.rocket),
    component = components.find((c) => c.id === target);
  useEffect(() => {
    if (!job || !active) return;
    const id = job.id;
    const timer = setInterval(async () => {
      try {
        const j = await api<SimulationJob>("/jobs/" + id);
        setJob(j);
        if (!["pending", "running"].includes(j.state)) {
          setResult(await api<TaskResult>("/runs/" + id));
          if (j.error) setError(j.error);
        }
      } catch (e) {
        setError((e as Error).message);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [job?.id, !!active]);
  async function start() {
    setError("");
    setResult(null);
    try {
      const body = {
        revision: project.revision,
        kind,
        configurationId: project.selectedConfigurationId,
        mach,
        angleOfAttack: (aoa * Math.PI) / 180,
        axis,
        min,
        max,
        steps,
        simulationIndex,
        objective,
        goal,
        minStability: stability,
        parameters: multi
          ? JSON.parse(parameters)
          : [{ componentId: target, property, min, max }],
      };
      setJob(
        await api<SimulationJob>(`/projects/${project.id}/analysis`, body),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="advanced-panel">
      <div className="dialog-actions">
        {["analysis", "sweep", "optimization"].map((k) => (
          <button
            key={k}
            className={kind === k ? "primary" : ""}
            onClick={() => setKind(k)}
          >
            {k}
          </button>
        ))}
      </div>
      <p>
        Uses the pinned core's force analysis and optimization
        objectives/solvers. SI values below. Every task retains its base
        revision; optimization changes require acceptance.
      </p>
      <div className="settings-grid">
        <section>
          {kind !== "optimization" ? (
            <>
              <label className="field">
                Mach
                <input
                  type="number"
                  step="any"
                  value={mach}
                  onChange={(e) => setMach(Number(e.target.value))}
                />
              </label>
              <label className="field">
                Angle of attack [°]
                <input
                  type="number"
                  step="any"
                  value={aoa}
                  onChange={(e) => setAoa(Number(e.target.value))}
                />
              </label>
              {kind === "sweep" && (
                <>
                  <label className="field">
                    Sweep axis
                    <select
                      value={axis}
                      onChange={(e) => setAxis(e.target.value)}
                    >
                      {["mach", "angleOfAttack", "rollAngle"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Samples
                    <input
                      type="number"
                      min="2"
                      max="100"
                      value={steps}
                      onChange={(e) => setSteps(Number(e.target.value))}
                    />
                  </label>
                </>
              )}
            </>
          ) : (
            <>
              <label className="field">
                Simulation
                <select
                  value={simulationIndex}
                  onChange={(e) => setSimulationIndex(Number(e.target.value))}
                >
                  {project.simulations.map((s, i) => (
                    <option key={i} value={i}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Objective
                <select
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                >
                  {[
                    "maxAltitude",
                    "maxSpeed",
                    "maxAcceleration",
                    "flightTime",
                    "deploymentSpeed",
                    "landingDistance",
                    "landingSpeed",
                    "stability",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Goal
                <select value={goal} onChange={(e) => setGoal(e.target.value)}>
                  <option>maximize</option>
                  <option>minimize</option>
                </select>
              </label>
              <label className="field">
                Minimum stability [cal]
                <input
                  type="number"
                  step="any"
                  value={stability}
                  onChange={(e) => setStability(Number(e.target.value))}
                />
              </label>
              <label className="field">
                Component
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Continuous parameter
                <select
                  value={property}
                  onChange={(e) => setProperty(e.target.value)}
                >
                  {component?.properties
                    .filter((p) => p.type === "number")
                    .map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.key} [{p.unit}]
                      </option>
                    ))}
                </select>
              </label>
              <label className="helper">
                <input
                  type="checkbox"
                  checked={multi}
                  onChange={(e) => setMulti(e.target.checked)}
                />{" "}
                Multiple parameters (JSON)
              </label>
              {multi && (
                <textarea
                  aria-label="Optimization parameters JSON"
                  rows={6}
                  value={parameters}
                  placeholder={
                    '[{"componentId":"…","property":"length","min":0.2,"max":0.4}]'
                  }
                  onChange={(e) => setParameters(e.target.value)}
                />
              )}
            </>
          )}
          {kind !== "analysis" && (
            <>
              <label className="field">
                Minimum [SI]
                <input
                  type="number"
                  step="any"
                  value={min}
                  onChange={(e) => setMin(Number(e.target.value))}
                />
              </label>
              <label className="field">
                Maximum [SI]
                <input
                  type="number"
                  step="any"
                  value={max}
                  onChange={(e) => setMax(Number(e.target.value))}
                />
              </label>
            </>
          )}
          <button className="primary" disabled={!!active} onClick={start}>
            Run {kind}
          </button>
          {active && (
            <button
              onClick={async () =>
                setJob(await api<SimulationJob>(`/jobs/${job!.id}/cancel`, {}))
              }
            >
              Cancel task
            </button>
          )}
          {job && (
            <p>
              Task {job.id.slice(0, 8)} · {job.state}
            </p>
          )}
          {error && (
            <p className="error-inline" role="alert">
              {error}
            </p>
          )}
        </section>
        <section>
          {result ? (
            <>
              <h3>
                {result.kind} · {result.status} · revision {result.revision}
              </h3>
              {result.warnings?.map((w, i) => (
                <p className="warning-inline" key={i}>
                  {w}
                </p>
              ))}
              {result.components && <AnalysisTable rows={result.components} />}{" "}
              {result.changes && (
                <>
                  <h3>Proposed design changes</h3>
                  {result.changes.map((c, i) => (
                    <p key={i}>
                      <strong>{c.property}</strong>: {c.before.toPrecision(5)} →{" "}
                      {c.after.toPrecision(5)} {c.unit}
                    </p>
                  ))}
                  <p>{result.limitations}</p>
                  <button
                    className="primary"
                    disabled={
                      result.revision !== project.revision ||
                      result.status !== "completed"
                    }
                    onClick={() =>
                      onAccept("acceptOptimization", { runId: result.id })
                    }
                  >
                    Accept optimized design
                  </button>
                  <h3>Evaluations · {result.evaluations?.length}</h3>
                  <div className="evaluation-table">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">Parameters [SI]</th>
                          <th scope="col">
                            {result.objective} [{result.objectiveUnit}]
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.evaluations?.map((v, i) => (
                          <tr key={i}>
                            <td>
                              {v.parameters
                                .map((x) => x.toPrecision(4))
                                .join(", ")}
                            </td>
                            <td>
                              {v.objective?.toPrecision(5) ?? "Outside domain"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {result.values && (
                <div className="evaluation-table">
                  {result.values.map((v, i) => (
                    <details key={i}>
                      <summary>
                        Sample {i + 1} · {JSON.stringify(v.conditions)}
                      </summary>
                      <AnalysisTable rows={v.components} />
                    </details>
                  ))}
                </div>
              )}
              <DownloadLink
                className="button"
                href={`/api/runs/${result.id}`}
                download={`analysis-${result.id}.json`}
              >
                Download full result JSON
              </DownloadLink>
            </>
          ) : (
            <p>No task has been computed. The design remains unchanged.</p>
          )}
        </section>
      </div>
    </div>
  );
}
function AnalysisTable({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <div className="analysis-table">
      <table>
        <thead>
          <tr>
            <th scope="col">Component</th>
            <th scope="col">CP [m]</th>
            <th scope="col">CD</th>
            <th scope="col">CN</th>
            <th scope="col">Cm</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{String(r.name)}</td>
              {["cp", "CD", "CN", "Cm"].map((k) => (
                <td key={k}>
                  {typeof r[k] === "number" ? r[k].toPrecision(5) : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
