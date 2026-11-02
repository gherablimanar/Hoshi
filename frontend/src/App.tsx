import { useState, useEffect, useRef } from "react";
import { Presets } from "./Presets";
import { AssistantPanel } from "./AssistantPanel";
import { AdvancedPanel } from "./AdvancedPanel";
import { api, upload } from "./api";
import { Canvas, flatten } from "./Canvas";
import { Chart } from "./Chart";
import type {
  Project,
  Component,
  Property,
  SimulationJob,
  SimulationRun,
  MotorReference,
  Variable,
} from "./contracts";
const pretty = (s: string) =>
  s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (s) => s.toUpperCase());
const fmt = (x: number | null | undefined, d = 2) =>
  x == null ? "—" : x.toLocaleString("en", { maximumFractionDigits: d });
function UnitField({
  p,
  onChange,
  disabled = false,
}: {
  p: Property;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const unit =
    p.unit === "m"
      ? "mm"
      : p.unit === "kg"
        ? "g"
        : p.unit === "rad"
          ? "°"
          : p.unit;
  const factor =
    p.unit === "m" || p.unit === "kg"
      ? 1000
      : p.unit === "rad"
        ? 180 / Math.PI
        : 1;
  const value =
    typeof p.value === "number"
      ? Number((p.value * factor).toPrecision(10))
      : p.value;
  return (
    <label className="field">
      <span>{pretty(p.key)}</span>
      {p.type === "boolean" ? (
        <input
          type="checkbox"
          checked={p.value === true}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
      ) : p.type === "enum" ? (
        <select
          aria-label={pretty(p.key)}
          value={String(p.value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          {p.choices?.map((c) => <option key={c}>{c}</option>)}
        </select>
      ) : (
        <div className="unit-input">
          <input
            aria-label={pretty(p.key)}
            key={String(value)}
            defaultValue={String(value ?? "")}
            disabled={disabled}
            type={p.type === "number" ? "number" : "text"}
            step="any"
            onBlur={(e) => {
              const v =
                p.type === "number"
                  ? Number(e.target.value) / factor
                  : e.target.value;
              if (v !== p.value && e.target.value.trim() !== "") onChange(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          {unit && <small>{unit}</small>}
        </div>
      )}
    </label>
  );
}
function Tree({
  c,
  selected,
  onSelect,
  depth = 0,
}: {
  c: Component;
  selected: string;
  onSelect: (id: string) => void;
  depth?: number;
}) {
  return (
    <>
      <button
        className={`tree-row ${selected === c.id ? "selected" : ""}`}
        style={{ paddingLeft: 12 + depth * 13 }}
        onClick={() => onSelect(c.id)}
        title={c.type}
      >
        <span className="tree-icon">
          {c.children.length
            ? "⌄"
            : c.type.includes("Fin")
              ? "◭"
              : c.type === "NoseCone"
                ? "◁"
                : "▯"}
        </span>
        <span>{c.name}</span>
      </button>
      {c.children.map((ch) => (
        <Tree
          key={ch.id}
          c={ch}
          selected={selected}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </>
  );
}
function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button onClick={close} aria-label="Close dialog">
          ×
        </button>
      </header>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
function Results({
  project,
  runs,
  selected,
  setSelected,
}: {
  project: Project;
  runs: SimulationRun[];
  selected: string;
  setSelected: (id: string) => void;
}) {
  const [tab, setTab] = useState("Flight plots"),
    [compare, setCompare] = useState(""),
    [branchIndex, setBranchIndex] = useState(0),
    [variableKey, setVariableKey] = useState("h"),
    [sample, setSample] = useState(0);
  const run = runs.find((r) => r.id === selected),
    other = runs.find((r) => r.id === compare),
    branch = run?.branches?.[branchIndex],
    old = other?.branches?.[branchIndex];
  const time = branch?.variables.find((v) => v.key === "t");
  const variable = (key: string) =>
    branch?.variables.find((v) => v.key === key);
  const comparison = (key: string) => {
    const t = old?.variables.find((v) => v.key === "t"),
      v = old?.variables.find((v) => v.key === key);
    return t && v ? { time: t, variable: v } : undefined;
  };
  return (
    <section className="results">
      <div className="result-heading">
        <div className="section-title">
          <span className="blue-dot" /> FLIGHT RESULTS{" "}
          <span className="subtle">
            {runs.length} saved {runs.length === 1 ? "run" : "runs"}
          </span>
        </div>
        <div className="result-controls">
          <select
            aria-label="Select simulation run"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setBranchIndex(0);
              setSample(0);
            }}
          >
            <option value="">Select a run</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id.slice(0, 8)} · rev {r.revision} · {r.status}
              </option>
            ))}
          </select>
          {run && (
            <a className="button" href={`/api/runs/${run.id}/csv`} download>
              ↓ CSV
            </a>
          )}
        </div>
      </div>
      <div className="result-tabs">
        {[
          "Flight plots",
          "Variables",
          "Events",
          "Compare",
          "Playback",
          "Provenance",
        ].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? "active" : ""}
          >
            {t}
          </button>
        ))}
        {run && run.revision !== project.revision && (
          <span className="revision-tag">Previous revision {run.revision}</span>
        )}
      </div>
      {!run ? (
        <div className="results-empty">
          <span>⌁</span>
          <div>
            <strong>Your flight data will appear here</strong>
            <p>
              Simulate a valid design to inspect computed trajectories, events
              and warnings.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="run-meta">
            <span className={`status ${run.status}`}>{run.status}</span>
            {run.summary && (
              <>
                <span>
                  Apogee <b>{fmt(run.summary.maxAltitude)} m</b>
                </span>
                <span>
                  Max speed <b>{fmt(run.summary.maxSpeed)} m/s</b>
                </span>
                <span>
                  Duration <b>{fmt(run.summary.flightTime)} s</b>
                </span>
              </>
            )}
            {(run.branches?.length || 0) > 1 && (
              <select
                aria-label="Flight branch"
                value={branchIndex}
                onChange={(e) => setBranchIndex(Number(e.target.value))}
              >
                {run.branches?.map((b, i) => (
                  <option key={i} value={i}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {run.error && <p className="error-inline">{run.error}</p>}
          {run.warnings?.map((w, i) => (
            <p className="warning-inline" key={i}>
              ⚠ {w}
            </p>
          ))}
          {tab === "Flight plots" && (
            <div className="plots">
              {["h", "Vt", "At"].map((k, i) => (
                <Chart
                  key={k}
                  time={time}
                  variable={variable(k)}
                  compare={comparison(k)}
                  events={branch?.events}
                  color={["#367bd6", "#168e8c", "#a574d6"][i]}
                />
              ))}
            </div>
          )}
          {tab === "Variables" && (
            <div className="variable-view">
              <select
                aria-label="Plot variable"
                value={variableKey}
                onChange={(e) => setVariableKey(e.target.value)}
              >
                {branch?.variables.map((v) => (
                  <option key={v.key} value={v.key}>
                    {v.name} [{v.unit}]
                  </option>
                ))}
              </select>
              <a
                className="button"
                href={`/api/runs/${run.id}/csv?variables=${encodeURIComponent("t," + variableKey)}`}
                download
              >
                Export selected variable CSV
              </a>
              <Chart
                time={time}
                variable={variable(variableKey)}
                compare={comparison(variableKey)}
                events={branch?.events}
              />
            </div>
          )}
          {tab === "Events" && (
            <div className="events-list">
              {branch?.events.map((e, i) => (
                <div key={i}>
                  <code>{e.time.toFixed(3)} s</code>
                  <strong>
                    {pretty(e.type.toLowerCase().replaceAll("_", " "))}
                  </strong>
                  <span>{e.detail}</span>
                </div>
              ))}
            </div>
          )}
          {tab === "Compare" && (
            <div className="comparison">
              <label>
                Compare with{" "}
                <select
                  aria-label="Comparison run"
                  value={compare}
                  onChange={(e) => setCompare(e.target.value)}
                >
                  <option value="">Choose a saved run</option>
                  {runs
                    .filter((r) => r.id !== run.id)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.id.slice(0, 8)} · revision {r.revision}
                      </option>
                    ))}
                </select>
              </label>
              {other && (
                <>
                  <p>
                    Solid: {run.id.slice(0, 8)} (rev {run.revision}) · dashed:{" "}
                    {other.id.slice(0, 8)} (rev {other.revision}).
                  </p>
                  <p>
                    Design hashes{" "}
                    {run.designHash === other.designHash ? "match" : "differ"} ·
                    configuration IDs{" "}
                    {run.configurationId === other.configurationId
                      ? "match"
                      : "differ"}
                    .
                  </p>
                  <table>
                    <thead>
                      <tr>
                        <th>Computed quantity</th>
                        <th>Selected run</th>
                        <th>Comparison</th>
                        <th>Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ["maxAltitude", "m"],
                          ["maxSpeed", "m/s"],
                          ["maxAcceleration", "m/s²"],
                          ["flightTime", "s"],
                        ] as const
                      ).map(([k, u]) => (
                        <tr key={k}>
                          <td>{pretty(k)}</td>
                          <td>
                            {fmt(run.summary?.[k])} {u}
                          </td>
                          <td>
                            {fmt(other.summary?.[k])} {u}
                          </td>
                          <td>
                            {run.summary?.[k] != null &&
                            other.summary?.[k] != null
                              ? fmt(run.summary[k]! - other.summary[k]!)
                              : "—"}{" "}
                            {u}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Chart
                    time={time}
                    variable={variable("h")}
                    compare={comparison("h")}
                  />
                </>
              )}
            </div>
          )}
          {tab === "Playback" && (
            <div className="playback">
              <p>
                Recorded trajectory samples · {run.id.slice(0, 8)} ·{" "}
                {run.status}. This playback does not launch a new simulation.
              </p>
              {time && (
                <>
                  <input
                    aria-label="Trajectory timeline"
                    type="range"
                    min="0"
                    max={time.values.length - 1}
                    value={Math.min(sample, time.values.length - 1)}
                    onChange={(e) => setSample(Number(e.target.value))}
                  />
                  <p>
                    t = {fmt(time.values[sample])} s · altitude{" "}
                    {fmt(variable("h")?.values[sample])} m · east{" "}
                    {fmt(variable("Px")?.values[sample])} m · north{" "}
                    {fmt(variable("Py")?.values[sample])} m
                  </p>
                  <Trajectory
                    time={time}
                    altitude={variable("h")}
                    east={variable("Px")}
                    sample={sample}
                  />
                  <p>
                    {branch?.events
                      .filter((e) => e.time <= (time.values[sample] || 0))
                      .map((e) => e.type)
                      .join(" → ")}
                  </p>
                </>
              )}
            </div>
          )}
          {tab === "Provenance" && (
            <div className="provenance">
              <dl>
                <dt>Run</dt>
                <dd>{run.id}</dd>
                <dt>Engine</dt>
                <dd>
                  OpenRocket {run.engine.version} · {run.engine.commit}
                </dd>
                <dt>Solver</dt>
                <dd>{run.engine.solver}</dd>
                <dt>Design revision / SHA-256</dt>
                <dd>
                  {run.revision} / {run.designHash}
                </dd>
                <dt>Configuration</dt>
                <dd>{run.configurationId}</dd>
                <dt>Recorded</dt>
                <dd>{run.completedAt}</dd>
              </dl>
              <p>
                All variables use engine SI units. Altitude is above the launch
                site; total velocity differs from vertical velocity. Stochastic
                wind reproducibility remains limited; see documentation.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
function Trajectory({
  time,
  altitude,
  east,
  sample,
}: {
  time: Variable;
  altitude?: Variable;
  east?: Variable;
  sample: number;
}) {
  if (!altitude || !east) return null;
  const xs = east.values.filter((x): x is number => x !== null),
    ys = altitude.values.filter((x): x is number => x !== null);
  const min = Math.min(0, ...xs),
    max = Math.max(1, ...xs),
    top = Math.max(1, ...ys);
  const x = (i: number) =>
      35 + (((east.values[i] || 0) - min) / (max - min)) * 570,
    y = (i: number) => 150 - ((altitude.values[i] || 0) / top) * 130;
  return (
    <svg
      viewBox="0 0 640 180"
      role="img"
      aria-label="Recorded east versus altitude trajectory"
    >
      <path
        d={time.values
          .map((_, i) => `${i ? "L" : "M"}${x(i)},${y(i)}`)
          .join(" ")}
        stroke="#9fb8d9"
        fill="none"
      />
      <circle cx={x(sample)} cy={y(sample)} r="5" fill="#3578d8" />
      <text x="10" y="175">
        East [m] → · altitude [m] ↑
      </text>
    </svg>
  );
}
export default function App() {
  const [project, setProject] = useState<Project | null>(null),
    [selected, setSelected] = useState(""),
    [leftTab, setLeftTab] = useState("Design tree"),
    [types, setTypes] = useState<string[]>([]),
    [dialog, setDialog] = useState(""),
    [examples, setExamples] = useState<string[]>([]),
    [projects, setProjects] = useState<
      { id: string; name: string; revision: number }[]
    >([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [job, setJob] = useState<SimulationJob | null>(null),
    [runs, setRuns] = useState<SimulationRun[]>([]),
    [runId, setRunId] = useState(""),
    [simulationIndex, setSimulationIndex] = useState(0),
    [undo, setUndo] = useState<number[]>([]),
    [redo, setRedo] = useState<number[]>([]),
    [clipboard, setClipboard] = useState(""),
    [theme, setTheme] = useState(
      localStorage.getItem("rocket-theme") || "light",
    );
  const [motorQuery, setMotorQuery] = useState(""),
    [motors, setMotors] = useState<MotorReference[]>([]),
    [motor, setMotor] = useState<MotorReference | null>(null),
    [motorDelay, setMotorDelay] = useState(3),
    [materialName, setMaterialName] = useState(""),
    [density, setDensity] = useState(500),
    [freeform, setFreeform] = useState(""),
    [windLevels, setWindLevels] = useState(
      '[{"altitude":0,"speed":2,"direction":1.57,"standardDeviation":0.2}]',
    );
  const motorFile = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const current = project
    ? flatten(project.rocket).find((c) => c.id === selected) || project.rocket
    : null;
  const active = job?.state === "running" || job?.state === "pending";
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("rocket-theme", theme);
  }, [theme]);
  async function loadRuns(id: string) {
    const r = await api<SimulationRun[]>(`/projects/${id}/runs`);
    const flights = r.filter((x) => !x.kind || x.kind === "flight");
    setRuns(flights);
    if (flights.length) setRunId(flights.at(-1)!.id);
    else setRunId("");
  }
  function accept(p: Project) {
    setProject(p);
    setSelected((s) =>
      flatten(p.rocket).some((c) => c.id === s) ? s : p.rocket.id,
    );
    localStorage.setItem("rocket-project", p.id);
  }
  async function perform(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void perform(async () => {
      const [catalog, ex, list] = await Promise.all([
        api<{ components: string[] }>("/catalog"),
        api<string[]>("/examples"),
        api<typeof projects>("/projects"),
      ]);
      setTypes(catalog.components);
      setExamples(ex);
      setProjects(list);
      const saved = localStorage.getItem("rocket-project");
      if (saved && list.some((p) => p.id === saved)) {
        accept(await api<Project>("/projects/" + saved));
        await loadRuns(saved);
      } else {
        accept(await api<Project>("/projects", { name: "Untitled rocket" }));
      }
    });
  }, []);
  useEffect(() => {
    if (!job || !active) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const next = await api<SimulationJob>("/jobs/" + job.id);
        if (cancelled) return;
        setJob(next);
        if (!["pending", "running"].includes(next.state)) {
          await loadRuns(next.projectId);
          if (next.error) setError(next.error);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [job?.id, active]);
  async function mutate(data: Record<string, unknown>) {
    if (!project) return;
    await perform(async () => {
      const p = await api<Project>(`/projects/${project.id}/mutate`, {
        revision: project.revision,
        ...data,
      });
      setUndo((u) => [...u, project.revision]);
      setRedo([]);
      accept(p);
      setNotice("Autosaved · revision " + p.revision);
    });
  }
  async function acceptExternal(path: string, body: Record<string, unknown>) {
    if (!project) return;
    await perform(async () => {
      const p = await api<Project>(`/projects/${project.id}/${path}`, {
        revision: project.revision,
        ...body,
      });
      setUndo((u) => [...u, project.revision]);
      setRedo([]);
      accept(p);
    });
  }
  async function restore(direction: "undo" | "redo") {
    if (!project) return;
    const stack = direction === "undo" ? undo : redo;
    if (!stack.length) return;
    await perform(async () => {
      const p = await api<Project>(`/projects/${project.id}/restore`, {
        revision: project.revision,
        targetRevision: stack.at(-1),
      });
      if (direction === "undo") {
        setUndo((s) => s.slice(0, -1));
        setRedo((s) => [...s, project.revision]);
      } else {
        setRedo((s) => s.slice(0, -1));
        setUndo((s) => [...s, project.revision]);
      }
      accept(p);
    });
  }
  async function create(example?: string) {
    await perform(async () => {
      const p = await api<Project>(
        "/projects",
        example ? { example } : { name: "Untitled rocket" },
      );
      accept(p);
      setUndo([]);
      setRedo([]);
      setSimulationIndex(0);
      await loadRuns(p.id);
      setDialog("");
    });
  }
  async function openList() {
    await perform(async () => {
      setProjects(await api<typeof projects>("/projects"));
      setDialog("open");
    });
  }
  async function simulate() {
    if (!project) return;
    if (!project.simulations.length) {
      setNotice(
        "Create simulation settings and select a motor configuration first.",
      );
      setDialog("settings");
      return;
    }
    await perform(async () => {
      setJob(
        await api<SimulationJob>(`/projects/${project.id}/jobs`, {
          revision: project.revision,
          simulationIndex,
        }),
      );
    });
  }
  useEffect(() => {
    if (dialog !== "motors") return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      api<MotorReference[]>("/motors?q=" + encodeURIComponent(motorQuery))
        .then((ms) => {
          if (!cancelled) setMotors(ms);
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [dialog, motorQuery]);
  const basic = [
    "name",
    "length",
    "outerRadius",
    "baseRadius",
    "foreRadius",
    "aftRadius",
    "thickness",
    "rootChord",
    "tipChord",
    "height",
    "sweep",
    "finCount",
    "cantAngle",
    "axialMethod",
    "axialOffset",
  ];
  if (!project)
    return (
      <div className="loading">
        <span className="brand-mark">↟</span>
        <h1>Rocket Designer</h1>
        <p>{error || "Connecting to the engineering engine…"}</p>
        {error && (
          <button onClick={() => location.reload()}>Retry connection</button>
        )}
      </div>
    );
  const q = project.quantities;
  const stability = q.stability;
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">↟</span>
          <strong>Rocket Designer</strong>
          <span className="brand-divider" />
          <span className="project-title">{project.name}</span>
          <span
            className="saved-dot"
            title="Every accepted change is persisted on the server"
          />
          <small>Saved · rev {project.revision}</small>
        </div>
        <nav>
          <button onClick={() => setDialog("about")}>
            OpenRocket 24.12 <span className="version-badge">ENGINE</span>
          </button>
          <button
            aria-label="Toggle color theme"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          >
            {theme === "light" ? "☾" : "☀"}
          </button>
        </nav>
      </header>
      <div className="toolbar">
        <div className="toolbar-group">
          <button disabled={busy} onClick={() => create()}>
            ＋ <span>New</span>
          </button>
          <button disabled={busy} onClick={openList}>
            ▱ <span>Open / Import</span>
          </button>
          <button
            disabled={busy}
            onClick={() =>
              perform(async () => {
                accept(await api<Project>("/projects/" + project.id));
                setNotice(
                  "Project saved on this server. Use Export for a portable .ork file.",
                );
              })
            }
          >
            ▣ <span>Save</span>
          </button>
          <a
            className={`button ${!project.conversionAccepted ? "disabled" : ""}`}
            href={
              project.conversionAccepted
                ? `/api/projects/${project.id}/export`
                : undefined
            }
            download
            title={
              !project.conversionAccepted
                ? "Accept import conversion warnings before export"
                : "Download OpenRocket project"
            }
          >
            ↥ <span>Export</span>
          </a>
        </div>
        <div className="toolbar-group">
          <button
            aria-label="Undo"
            disabled={busy || !undo.length}
            onClick={() => restore("undo")}
          >
            ↶
          </button>
          <button
            aria-label="Redo"
            disabled={busy || !redo.length}
            onClick={() => restore("redo")}
          >
            ↷
          </button>
        </div>
        <div className="toolbar-group">
          <button
            disabled={busy}
            onClick={() =>
              perform(async () => {
                const p = await api<Project>(
                  `/projects/${project.id}/validate`,
                  {},
                );
                accept(p);
                setDialog("validation");
              })
            }
          >
            ◇ <span>Validate design</span>
          </button>
          <button
            onClick={() => {
              setWindLevels(
                JSON.stringify(
                  project.simulations[simulationIndex]?.windLevels || [],
                  null,
                  2,
                ),
              );
              setDialog("settings");
            }}
          >
            ⚙ <span>Flight settings</span>
          </button>
          <button onClick={() => setDialog("advanced")}>Analysis</button>
          <button onClick={() => setDialog("exports")}>Exports…</button>
          <button onClick={() => setDialog("expressions")}>Expressions</button>
        </div>
        <div className="toolbar-end">
          {active ? (
            <>
              <span className="running">
                <i /> {job?.state}…
              </span>
              <button
                onClick={() =>
                  perform(async () => {
                    setJob(
                      await api<SimulationJob>(`/jobs/${job!.id}/cancel`, {}),
                    );
                  })
                }
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <select
                aria-label="Simulation to run"
                value={simulationIndex}
                onChange={(e) => setSimulationIndex(Number(e.target.value))}
              >
                {!project.simulations.length && (
                  <option value="0">No simulation configured</option>
                )}
                {project.simulations.map((s, i) => (
                  <option key={i} value={i}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                className="primary simulate"
                disabled={busy}
                onClick={simulate}
                title={
                  !project.simulations.length
                    ? "Configure a motor and simulation before launch"
                    : "Run the selected OpenRocket simulation"
                }
              >
                ▷ <span>Simulate launch</span>
              </button>
            </>
          )}
        </div>
      </div>
      {(error || notice) && (
        <div
          className={`notification ${error ? "error" : ""}`}
          role={error ? "alert" : "status"}
        >
          <span>{error || notice}</span>
          {error?.includes("reload") && (
            <button
              onClick={() =>
                perform(async () =>
                  accept(await api<Project>("/projects/" + project.id)),
                )
              }
            >
              Reload project
            </button>
          )}
          <button
            aria-label="Dismiss message"
            onClick={() => {
              setError("");
              setNotice("");
            }}
          >
            ×
          </button>
        </div>
      )}
      <main className="workspace">
        <aside className="left-panel">
          <div className="panel-tabs">
            {["Design tree", "Components"].map((t) => (
              <button
                key={t}
                className={leftTab === t ? "active" : ""}
                onClick={() => setLeftTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {leftTab === "Design tree" ? (
            <>
              <div className="tree">
                <Tree
                  c={project.rocket}
                  selected={selected}
                  onSelect={setSelected}
                />
              </div>
              <div className="tree-actions">
                <button
                  aria-label="Move component up"
                  disabled={busy || !current?.parentId}
                  onClick={() =>
                    mutate({ op: "move", componentId: selected, delta: -1 })
                  }
                >
                  ↑
                </button>
                <button
                  aria-label="Move component down"
                  disabled={busy || !current?.parentId}
                  onClick={() =>
                    mutate({ op: "move", componentId: selected, delta: 1 })
                  }
                >
                  ↓
                </button>
                <button
                  aria-label="Duplicate component"
                  disabled={busy || !current?.parentId}
                  onClick={() =>
                    mutate({ op: "duplicate", componentId: selected })
                  }
                >
                  ⧉
                </button>
                <button
                  aria-label="Copy component"
                  disabled={!current?.parentId}
                  onClick={() => {
                    setClipboard(selected);
                    setNotice(
                      "Component copied. Select a compatible parent, then paste.",
                    );
                  }}
                >
                  Copy
                </button>
                <button
                  disabled={busy || !clipboard}
                  onClick={() =>
                    mutate({
                      op: "paste",
                      componentId: clipboard,
                      parentId: selected,
                    })
                  }
                >
                  Paste
                </button>
                <button
                  aria-label="Remove component"
                  disabled={busy || !current?.parentId}
                  onClick={() =>
                    mutate({ op: "remove", componentId: selected })
                  }
                >
                  ×
                </button>
              </div>
              <button
                className="add-component"
                onClick={() => setLeftTab("Components")}
              >
                ＋ Add component
              </button>
            </>
          ) : (
            <div className="library">
              <p className="helper">
                Adding under <strong>{current?.name}</strong>. Select a parent
                in the tree or drawing.
              </p>
              {types.map((t) => (
                <button
                  key={t}
                  disabled={busy || !current?.compatibleTypes.includes(t)}
                  onClick={() =>
                    mutate({ op: "add", parentId: selected, type: t })
                  }
                  title={
                    current?.compatibleTypes.includes(t)
                      ? "Add " + pretty(t)
                      : "Select a compatible parent"
                  }
                >
                  <span className="part-symbol">
                    {t.includes("Fin")
                      ? "◭"
                      : t === "NoseCone"
                        ? "◁"
                        : t.includes("Stage")
                          ? "▤"
                          : "▯"}
                  </span>
                  <span>{pretty(t)}</span>
                  <span className="plus">＋</span>
                </button>
              ))}
            </div>
          )}
          <div className="left-footer">
            <span className="green-dot" /> Core connected{" "}
            <small>SI model · version 24.12</small>
          </div>
        </aside>
        <div className="center-workspace">
          <div className="design-heading">
            <div>
              <span className="eyebrow">DESIGN WORKSPACE</span>
              <h1>{project.name}</h1>
            </div>
            <button onClick={() => setDialog("examples")}>
              Explore examples ↗
            </button>
          </div>
          <Canvas
            project={project}
            selected={selected}
            onSelect={setSelected}
            onExample={() => setDialog("examples")}
          />
          <div className="quantities">
            <div>
              <small>DRY MASS</small>
              <strong>
                {q.dryMass && q.dryMass > 0 ? fmt(q.dryMass * 1000) : "—"}{" "}
                <em>g</em>
              </strong>
            </div>
            <div>
              <small>LOADED MASS</small>
              <strong>
                {q.loadedMass && q.loadedMass > 0
                  ? fmt(q.loadedMass * 1000)
                  : "—"}{" "}
                <em>g</em>
              </strong>
            </div>
            <div>
              <small>STABILITY · M 0.3</small>
              <strong>
                {q.loadedMass && q.loadedMass > 0 ? fmt(stability) : "—"}{" "}
                <em>cal</em>
              </strong>
            </div>
            <div>
              <small>CONFIGURATION</small>
              <strong className="config-name">
                {project.configurations.find(
                  (c) => c.id === project.selectedConfigurationId,
                )?.name || "No motor configuration"}
              </strong>
            </div>
            <button onClick={() => setDialog("validation")}>
              {project.warnings.length
                ? "⚠ " + project.warnings.length + " warnings"
                : "◇ Inspect design"}
            </button>
          </div>
        </div>
        <aside className="right-panel">
          <section className="inspector">
            <header>
              <span>COMPONENT PROPERTIES</span>
              <span className="tiny-tag">SI ↔ UI</span>
            </header>
            <div className="inspector-scroll">
              <h2>{current?.name}</h2>
              <p className="component-kind">{pretty(current?.type || "")}</p>
              {current?.properties
                .filter((p) => basic.includes(p.key))
                .sort((a, b) => basic.indexOf(a.key) - basic.indexOf(b.key))
                .map((p) => (
                  <UnitField
                    key={p.key}
                    p={p}
                    disabled={busy}
                    onChange={(v) =>
                      mutate({
                        op: "set",
                        componentId: selected,
                        changes: { [p.key]: v },
                      })
                    }
                  />
                ))}
              {current?.material && (
                <div className="material-card">
                  <span>Material · {current.material.type}</span>
                  <strong>{current.material.name}</strong>
                  <small>
                    {fmt(current.material.density)}{" "}
                    {current.material.type === "SURFACE"
                      ? "kg/m²"
                      : current.material.type === "LINE"
                        ? "kg/m"
                        : "kg/m³"}
                  </small>
                  <button
                    onClick={() => {
                      setMaterialName(current.material!.name);
                      setDensity(current.material!.density);
                      setDialog("material");
                    }}
                  >
                    Edit material
                  </button>
                </div>
              )}
              <details>
                <summary>Position, overrides & advanced</summary>
                {current?.properties
                  .filter((p) => !basic.includes(p.key))
                  .map((p) => (
                    <UnitField
                      key={p.key}
                      p={p}
                      disabled={busy}
                      onChange={(v) =>
                        mutate({
                          op: "set",
                          componentId: selected,
                          changes: { [p.key]: v },
                        })
                      }
                    />
                  ))}
              </details>
              {current?.stageEnabled !== undefined && (
                <label className="field">
                  Stage enabled
                  <input
                    type="checkbox"
                    checked={current.stageEnabled}
                    onChange={(e) =>
                      mutate({
                        op: "stageEnabled",
                        componentId: selected,
                        enabled: e.target.checked,
                      })
                    }
                  />
                </label>
              )}
              {current?.cluster && (
                <label className="field">
                  Motor cluster
                  <select
                    value={current.cluster.pattern}
                    onChange={(e) =>
                      mutate({
                        op: "cluster",
                        componentId: selected,
                        pattern: e.target.value,
                      })
                    }
                  >
                    {current.cluster.choices.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
              )}
              {current?.parentId && (
                <details>
                  <summary>Move to a different parent</summary>
                  <select
                    aria-label="Move component parent"
                    value={current.parentId}
                    onChange={(e) =>
                      mutate({
                        op: "reparent",
                        componentId: selected,
                        parentId: e.target.value,
                      })
                    }
                  >
                    {flatten(project.rocket)
                      .filter(
                        (c) =>
                          c.compatibleTypes.includes(current.type) &&
                          c.id !== selected,
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </details>
              )}
              {current?.presetType && (
                <button className="wide" onClick={() => setDialog("presets")}>
                  Choose component template…
                </button>
              )}
              <details>
                <summary>Appearance</summary>
                <label className="field">
                  Paint
                  <input
                    aria-label="Component paint color"
                    type="color"
                    value={current?.appearance?.color || "#a8bfdc"}
                    onChange={(e) =>
                      mutate({
                        op: "appearance",
                        componentId: selected,
                        color: e.target.value,
                        shine: current?.appearance?.shine || 0.3,
                      })
                    }
                  />
                </label>
                <label className="field">
                  Shine
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step=".1"
                    defaultValue={current?.appearance?.shine || 0.3}
                    onBlur={(e) =>
                      mutate({
                        op: "appearance",
                        componentId: selected,
                        color: current?.appearance?.color || "#a8bfdc",
                        shine: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <p className="helper">
                  Paint is retained in .ork. Texture archives and rendered
                  material mapping are not yet supported.
                </p>
              </details>
              {current?.type === "FreeformFinSet" && (
                <button
                  onClick={() => {
                    setFreeform(JSON.stringify(current.finPoints, null, 2));
                    setDialog("freeform");
                  }}
                >
                  Edit freeform fin points
                </button>
              )}
              {["BodyTube", "InnerTube"].includes(current?.type || "") && (
                <button
                  className="wide"
                  onClick={() => {
                    setMotor(null);
                    setDialog("motors");
                  }}
                >
                  Choose motor…
                </button>
              )}
              {current?.deployment && (
                <details>
                  <summary>Recovery deployment (active configuration)</summary>
                  {current.deployment.map((p) => (
                    <UnitField
                      key={p.key}
                      p={p}
                      onChange={(v) =>
                        mutate({
                          op: "recovery",
                          componentId: selected,
                          ...Object.fromEntries(
                            current.deployment!.map((a) => [
                              a.key === "deployEvent"
                                ? "event"
                                : a.key === "deployDelay"
                                  ? "delay"
                                  : "altitude",
                              a.key === p.key ? v : a.value,
                            ]),
                          ),
                        })
                      }
                    />
                  ))}
                </details>
              )}
              {current?.separation && (
                <details>
                  <summary>Stage separation</summary>
                  {current.separation.map((p) => (
                    <UnitField
                      key={p.key}
                      p={p}
                      onChange={(v) =>
                        mutate({
                          op: "separation",
                          componentId: selected,
                          changes: { [p.key]: v },
                        })
                      }
                    />
                  ))}
                </details>
              )}
              {current?.motorConfiguration && (
                <details>
                  <summary>Ignition & ejection timing</summary>
                  {current.motorConfiguration.map((p) => (
                    <UnitField
                      key={p.key}
                      p={p}
                      onChange={(v) =>
                        mutate({
                          op: "ignition",
                          componentId: selected,
                          changes: { [p.key]: v },
                        })
                      }
                    />
                  ))}
                </details>
              )}
            </div>
          </section>
          <AssistantPanel
            project={project}
            selected={selected}
            runId={runId}
            onAccept={acceptExternal}
            onSimulate={(index, revision) => {
              if (revision !== project.revision) {
                setError("Stale simulation request");
                return;
              }
              void perform(async () =>
                setJob(
                  await api<SimulationJob>(`/projects/${project.id}/jobs`, {
                    revision,
                    simulationIndex: index,
                  }),
                ),
              );
            }}
          />
        </aside>
      </main>
      <Results
        project={project}
        runs={runs}
        selected={runId}
        setSelected={setRunId}
      />
      <footer className="statusbar">
        <span>
          Rocket Designer <span> / </span> OpenRocket core 24.12
        </span>
        <span>
          {busy ? "Saving change…" : `Revision ${project.revision} · autosaved`}{" "}
          <span> / </span> Local workspace
        </span>
      </footer>
      <input
        ref={file}
        type="file"
        accept=".ork,.xml,.rkt,.CDX1"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f)
            void perform(async () => {
              const p = (await upload(f)) as Project;
              accept(p);
              setUndo([]);
              setRedo([]);
              await loadRuns(p.id);
              setDialog("");
            });
          e.target.value = "";
        }}
      />
      <input
        ref={motorFile}
        type="file"
        accept=".eng,.rse"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f)
            void perform(async () => {
              const response = await fetch("/api/motors/import", {
                method: "POST",
                headers: { "X-Filename": encodeURIComponent(f.name) },
                body: f,
              });
              const data = await response.json();
              if (!response.ok)
                throw new Error(data.error?.message || "Motor import failed");
              setMotors(data);
              setMotor(data[0]);
              setNotice(
                "Real motor data imported and persisted. Check its provenance before use.",
              );
            });
          e.target.value = "";
        }}
      />
      {dialog === "presets" && current?.presetType && (
        <Dialog title="Component templates" close={() => setDialog("")}>
          <Presets
            type={current.presetType}
            onApply={(presetId) =>
              mutate({ op: "preset", componentId: selected, presetId })
            }
          />
        </Dialog>
      )}
      {dialog === "expressions" && (
        <Dialog title="Custom flight expressions" close={() => setDialog("")}>
          <ExpressionEditor project={project} apply={mutate} />
        </Dialog>
      )}
      {dialog === "examples" && (
        <Dialog title="Explore an upstream example" close={() => setDialog("")}>
          <p>
            Real designs bundled with OpenRocket 24.12. Each opens as a new
            local project with its motor configurations and flight settings.
          </p>
          <div className="example-list">
            {examples.map((e, i) => (
              <button key={e} disabled={busy} onClick={() => create(e)}>
                <span className="example-number">0{i + 1}</span>
                <span>
                  <strong>{e.replace(".ork", "")}</strong>
                  <small>OpenRocket 24.12 example · .ork</small>
                </span>
                <span>↗</span>
              </button>
            ))}
          </div>
        </Dialog>
      )}
      {dialog === "open" && (
        <Dialog title="Open a project" close={() => setDialog("")}>
          <div className="dialog-actions">
            <button className="primary" onClick={() => file.current?.click()}>
              Import rocket project
            </button>
            <button onClick={() => setDialog("examples")}>
              Browse examples
            </button>
          </div>
          <p className="helper">Saved on this server</p>
          <div className="example-list">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() =>
                  perform(async () => {
                    accept(await api<Project>("/projects/" + p.id));
                    setUndo([]);
                    setRedo([]);
                    await loadRuns(p.id);
                    setDialog("");
                  })
                }
              >
                <strong>{p.name}</strong>
                <small>
                  rev {p.revision} · {p.id.slice(0, 8)}
                </small>
              </button>
            ))}
          </div>
        </Dialog>
      )}
      {dialog === "settings" && (
        <Dialog
          title="Flight configurations & simulation settings"
          close={() => setDialog("")}
        >
          <div className="settings-grid">
            <section>
              <h3>Active design configuration</h3>
              <select
                aria-label="Active flight configuration"
                value={project.selectedConfigurationId}
                onChange={(e) =>
                  mutate({
                    op: "selectConfiguration",
                    configurationId: e.target.value,
                  })
                }
              >
                <option value={project.selectedConfigurationId}>
                  Current:{" "}
                  {project.configurations.find(
                    (c) => c.id === project.selectedConfigurationId,
                  )?.name || "Default"}
                </option>
                {project.configurations
                  .filter((c) => c.id !== project.selectedConfigurationId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <button
                onClick={() =>
                  mutate({
                    op: "configuration",
                    name:
                      "Configuration " + (project.configurations.length + 1),
                  })
                }
              >
                ＋ New configuration
              </button>
              <h3>Simulation setup</h3>
              <select
                aria-label="Edit simulation"
                value={simulationIndex}
                onChange={(e) => setSimulationIndex(Number(e.target.value))}
              >
                {project.simulations.map((s, i) => (
                  <option key={i} value={i}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() =>
                  mutate({
                    op: "simulation",
                    name: "Launch " + (project.simulations.length + 1),
                  })
                }
              >
                ＋ Add simulation
              </button>
              <p>Simulation motor configuration:</p>
              <select
                aria-label="Simulation flight configuration"
                value={
                  project.simulations[simulationIndex]?.configurationId || ""
                }
                onChange={(e) =>
                  mutate({
                    op: "settings",
                    simulationIndex,
                    configurationId: e.target.value,
                  })
                }
              >
                <option value="" disabled>
                  Choose configuration
                </option>
                {project.configurations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="helper">
                Each simulation uses its own configuration; changing the active
                drawing configuration does not silently change a simulation.
              </p>
            </section>
            <section>
              {project.simulations[simulationIndex]?.options.map((p) => (
                <UnitField
                  key={p.key}
                  p={p}
                  disabled={busy}
                  onChange={(v) =>
                    mutate({
                      op: "settings",
                      simulationIndex,
                      changes: { [p.key]: v },
                    })
                  }
                />
              ))}
              {project.simulations[simulationIndex] && (
                <>
                  <h3>Average wind</h3>
                  {(["average", "standardDeviation", "direction"] as const).map(
                    (k) => (
                      <UnitField
                        key={k}
                        p={{
                          key: k,
                          type: "number",
                          value: project.simulations[simulationIndex].wind[k],
                          unit: k === "direction" ? "rad" : "m/s",
                        }}
                        onChange={(v) =>
                          mutate({
                            op: "settings",
                            simulationIndex,
                            wind: { [k]: v },
                          })
                        }
                      />
                    ),
                  )}
                  <details>
                    <summary>Multi-level wind (SI)</summary>
                    <label className="field">
                      Altitude reference
                      <select
                        value={
                          project.simulations[simulationIndex]
                            .windAltitudeReference
                        }
                        onChange={(e) =>
                          mutate({
                            op: "settings",
                            simulationIndex,
                            windAltitudeReference: e.target.value,
                          })
                        }
                      >
                        <option>MSL</option>
                        <option>AGL</option>
                      </select>
                    </label>
                    <p>
                      Set wind model type to MULTI_LEVEL. Levels: altitude m,
                      speed m/s, direction rad, standardDeviation m/s.
                    </p>
                    <textarea
                      aria-label="Multi-level wind JSON"
                      rows={8}
                      value={windLevels}
                      onChange={(e) => setWindLevels(e.target.value)}
                    />
                    <button
                      onClick={() => {
                        try {
                          void mutate({
                            op: "settings",
                            simulationIndex,
                            windLevels: JSON.parse(windLevels),
                          });
                        } catch {
                          setError("Invalid wind-level JSON");
                        }
                      }}
                    >
                      Apply wind levels
                    </button>
                  </details>
                </>
              )}
            </section>
          </div>
        </Dialog>
      )}
      {dialog === "validation" && (
        <Dialog title="Design validation" close={() => setDialog("")}>
          <h3>OpenRocket geometry warnings</h3>
          {project.warnings.length ? (
            project.warnings.map((w, i) => (
              <p className="warning-inline" key={i}>
                {w}
              </p>
            ))
          ) : (
            <p>
              No geometry warnings reported by the selected configuration. This
              is not a guarantee of stable flight.
            </p>
          )}
          {!project.hasMotors && (
            <p className="warning-inline">
              No motors in the active configuration. Select a mount and a
              compatible motor before launching.
            </p>
          )}
          {!project.simulations.length && (
            <p>Create simulation settings before running.</p>
          )}
          <h3>Import notices</h3>
          {project.importWarnings.length ? (
            project.importWarnings.map((w, i) => <p key={i}>{w}</p>)
          ) : (
            <p>No import warnings.</p>
          )}
          {!project.conversionAccepted && (
            <button onClick={() => mutate({ op: "acceptConversion" })}>
              Accept documented conversion and allow export
            </button>
          )}
        </Dialog>
      )}
      {dialog === "material" && (
        <Dialog title="Component material" close={() => setDialog("")}>
          <label className="field">
            Name
            <input
              value={materialName}
              onChange={(e) => setMaterialName(e.target.value)}
            />
          </label>
          <label className="field">
            Density [
            {current?.material?.type === "SURFACE"
              ? "kg/m²"
              : current?.material?.type === "LINE"
                ? "kg/m"
                : "kg/m³"}
            ]
            <input
              type="number"
              min="0.001"
              step="any"
              value={density}
              onChange={(e) => setDensity(Number(e.target.value))}
            />
          </label>
          <p>
            Mass and inertia are calculated by the core from the component
            geometry and material density.
          </p>
          <button
            className="primary"
            onClick={() =>
              mutate({
                op: "material",
                componentId: selected,
                name: materialName,
                density,
              })
            }
          >
            Apply material
          </button>
        </Dialog>
      )}
      {dialog === "freeform" && (
        <Dialog title="Freeform fin geometry" close={() => setDialog("")}>
          <p>
            Coordinates [x, y] in meters in the upstream fin plane. First and
            last points attach to the body.
          </p>
          <textarea
            aria-label="Fin points JSON"
            rows={12}
            value={freeform}
            onChange={(e) => setFreeform(e.target.value)}
          />
          <button
            className="primary"
            onClick={() => {
              try {
                void mutate({
                  op: "finPoints",
                  componentId: selected,
                  points: JSON.parse(freeform),
                });
              } catch {
                setError("Invalid fin-point JSON");
              }
            }}
          >
            Apply fin points
          </button>
        </Dialog>
      )}
      {dialog === "motors" && (
        <Dialog
          title={`Motor catalog · ${current?.name}`}
          close={() => setDialog("")}
        >
          <p>
            Real thrust curves bundled with OpenRocket 24.12. The server checks
            mount diameter and length before assignment.
          </p>
          <button onClick={() => motorFile.current?.click()}>
            Import real motor data (.eng / .rse)
          </button>
          <input
            className="search"
            aria-label="Search motors"
            placeholder="Search designation or manufacturer…"
            value={motorQuery}
            onChange={(e) => setMotorQuery(e.target.value)}
          />
          <div className="motor-grid">
            <div className="motor-list">
              {motors.map((m, i) => (
                <button
                  key={m.id + "-" + i}
                  className={motor?.id === m.id ? "selected" : ""}
                  onClick={() =>
                    perform(async () => {
                      setMotor(await api<MotorReference>("/motors/" + m.id));
                    })
                  }
                >
                  <strong>
                    {m.manufacturer} {m.designation}
                  </strong>
                  <small>
                    {fmt(m.diameter * 1000)} × {fmt(m.length * 1000)} mm ·{" "}
                    {fmt(m.impulse)} N·s
                  </small>
                </button>
              ))}
            </div>
            <section>
              {motor ? (
                <>
                  <h3>
                    {motor.manufacturer} {motor.designation}
                  </h3>
                  <p>
                    {fmt(motor.launchMass * 1000)} g · {fmt(motor.burnTime)} s
                    burn
                  </p>
                  <Chart
                    time={{
                      key: "t",
                      name: "Time",
                      unit: "s",
                      values: motor.time || [],
                    }}
                    variable={{
                      key: "F",
                      name: "Thrust",
                      unit: "N",
                      values: motor.thrust || [],
                    }}
                  />
                  <label className="field">
                    Ejection delay [s]
                    <input
                      type="number"
                      value={motorDelay}
                      min="0"
                      step="any"
                      onChange={(e) => setMotorDelay(Number(e.target.value))}
                    />
                  </label>
                  <button
                    className="primary"
                    onClick={() =>
                      mutate({
                        op: "motor",
                        componentId: selected,
                        motorId: motor.id,
                        delay: motorDelay,
                      })
                    }
                  >
                    Assign to active configuration
                  </button>
                  <p className="helper">{motor.source}</p>
                  <details>
                    <summary>Source description</summary>
                    <p>{motor.description}</p>
                  </details>
                </>
              ) : (
                <p>Select a motor to inspect its real thrust curve.</p>
              )}
            </section>
          </div>
        </Dialog>
      )}
      {dialog === "recovery" && (
        <Dialog title="Recovery deployment" close={() => setDialog("")}>
          <RecoveryEditor
            apply={(event, delay, altitude) =>
              mutate({
                op: "recovery",
                componentId: selected,
                event,
                delay,
                altitude,
              })
            }
          />
        </Dialog>
      )}
      {dialog === "advanced" && (
        <Dialog
          title="Analysis, sweeps & optimization"
          close={() => setDialog("")}
        >
          <AdvancedPanel
            project={project}
            selected={selected}
            onAccept={acceptExternal}
          />
        </Dialog>
      )}
      {dialog === "exports" && (
        <Dialog title="Export design & components" close={() => setDialog("")}>
          <p>
            Native exporters from the pinned core. Review any conversion
            warnings before downloading a lossy format.
          </p>
          <div className="dialog-actions">
            <a
              className="button"
              href={`/api/projects/${project.id}/obj`}
              download
            >
              Full design OBJ
            </a>
            <a
              className="button"
              href={`/api/projects/${project.id}/obj?componentId=${selected}`}
              download
            >
              Selected component OBJ
            </a>
            {current?.type.includes("FinSet") &&
              current.type !== "TubeFinSet" && (
                <a
                  className="button"
                  href={`/api/projects/${project.id}/finSvg?componentId=${selected}`}
                  download
                >
                  Fin SVG
                </a>
              )}
          </div>
          {["rocksim", "rasaero"].map((format) => (
            <ExportConversion key={format} id={project.id} format={format} />
          ))}
          <button onClick={() => window.print()}>
            Print workspace / save PDF
          </button>
        </Dialog>
      )}
      {dialog === "about" && (
        <Dialog title="About Rocket Designer" close={() => setDialog("")}>
          <p>
            Independent browser workspace using the OpenRocket 24.12 core,
            pinned at <code>133b558de556f0282f51c3f53f3b3fc633b4310a</code>. No
            official endorsement is implied.
          </p>
          <p>
            The engine computes geometry, mass properties, aerodynamics and
            flight. The drawing is a schematic projection and does not claim
            exact shape or manufacturing accuracy.
          </p>
          <p>
            Working: component model, scalar properties, .ork import/export,
            local revisions, motors, simulation settings, asynchronous flight
            jobs, computed plots, events, CSV and stored-run comparisons.
          </p>
          <p>
            Remaining compatibility gaps include specialized component editors,
            asset archives, desktop extensions, full interchange round trips and
            live AI validation. 3D uses actual core OBJ geometry; optimization
            proposals require acceptance. Full parity is not claimed. See
            docs/openrocket-parity.md for evidence and remaining work.
          </p>
          <p>
            OpenRocket code is GPL-3.0-or-later with additional data packaging
            permission. Preserve the bundled engine, database and third-party
            notices when distributing. Source and build instructions are
            included in this project.
          </p>
        </Dialog>
      )}
    </div>
  );
}
function RecoveryEditor({
  apply,
}: {
  apply: (event: string, delay: number, altitude: number) => void;
}) {
  const [event, setEvent] = useState("APOGEE"),
    [delay, setDelay] = useState(0),
    [altitude, setAltitude] = useState(100);
  return (
    <>
      <p>
        Applies to the selected recovery device and active flight configuration.
        Timing semantics are handled by OpenRocket.
      </p>
      <label className="field">
        Trigger
        <select value={event} onChange={(e) => setEvent(e.target.value)}>
          {[
            "LAUNCH",
            "EJECTION",
            "APOGEE",
            "ALTITUDE",
            "LOWER_STAGE_SEPARATION",
            "NEVER",
          ].map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
      </label>
      <label className="field">
        Delay [s]
        <input
          type="number"
          min="0"
          step="any"
          value={delay}
          onChange={(e) => setDelay(Number(e.target.value))}
        />
      </label>
      <label className="field">
        Altitude [m]
        <input
          type="number"
          step="any"
          value={altitude}
          onChange={(e) => setAltitude(Number(e.target.value))}
        />
      </label>
      <button className="primary" onClick={() => apply(event, delay, altitude)}>
        Apply deployment settings
      </button>
    </>
  );
}

function ExportConversion({ id, format }: { id: string; format: string }) {
  const [warnings, setWarnings] = useState<string[] | null>(null),
    [error, setError] = useState("");
  return (
    <section>
      <h3>{format}</h3>
      <button
        onClick={async () => {
          try {
            const response = await fetch(
              `/api/projects/${id}/interchange?format=${format}`,
            );
            const data = await response.json();
            setWarnings(data.warnings || data.error?.warnings || []);
            if (!response.ok && !data.error?.warnings)
              setError(data.error?.message || "Export failed");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Inspect conversion
      </button>
      {warnings && (
        <>
          {warnings.length ? (
            warnings.map((w, i) => (
              <p className="warning-inline" key={i}>
                {w}
              </p>
            ))
          ) : (
            <p>
              No conversion warnings reported by the exporter. Round-trip
              compatibility remains limited.
            </p>
          )}
          <a
            className="button"
            href={`/api/projects/${id}/interchange?format=${format}&download=true&acceptWarnings=true`}
            download
          >
            Accept conversion and download {format}
          </a>
        </>
      )}
      {error && <p className="error-inline">{error}</p>}
    </section>
  );
}

function ExpressionEditor({
  project,
  apply,
}: {
  project: Project;
  apply: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(""),
    [symbol, setSymbol] = useState(""),
    [unit, setUnit] = useState(""),
    [expression, setExpression] = useState("");
  return (
    <>
      <p>
        Uses the upstream mathematical expression parser, not arbitrary uploaded
        scripts. Use engine symbols such as h, Vt and m. Results appear in
        computed variables after a new flight.
      </p>
      {project.expressions?.map((e) => (
        <div className="patch" key={e.symbol}>
          <strong>
            {e.name} · {e.symbol} [{e.unit}]
          </strong>
          <p>
            <code>{e.expression}</code>
          </p>
          <button
            onClick={() => apply({ op: "removeExpression", symbol: e.symbol })}
          >
            Remove expression
          </button>
        </div>
      ))}
      {[
        ["Name", name, setName],
        ["Symbol", symbol, setSymbol],
        ["Unit", unit, setUnit],
        ["Expression", expression, setExpression],
      ].map(([label, value, setter]) => (
        <label className="field" key={String(label)}>
          {String(label)}
          <input
            aria-label={String(label)}
            value={String(value)}
            onChange={(e) => (setter as (s: string) => void)(e.target.value)}
          />
        </label>
      ))}
      <button
        className="primary"
        onClick={() =>
          apply({ op: "expression", name, symbol, unit, expression })
        }
      >
        Add validated expression
      </button>
    </>
  );
}
