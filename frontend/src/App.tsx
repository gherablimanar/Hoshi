import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FlightWindow,
  FlightDialogTarget,
  FlightDialogError,
  useFlightDialogTarget,
  useFlightDialogError,
} from "./FlightWindow";
import { flightChecks, flightConcerns } from "./flightChecks";
import type { FlightIssue } from "./flightChecks";
import { FlightReplay } from "./FlightReplay";
import { PhysicsReview } from "./PhysicsReview";
import { Presets } from "./Presets";
import { AssistantPanel } from "./AssistantPanel";
import { AdvancedPanel } from "./AdvancedPanel";
import { api, upload, apiFetch, prepareVisitorAccess } from "./api";
import { DownloadLink } from "./DownloadLink";
import { EngineConnection } from "./EngineConnection";
import { Canvas, flatten } from "./Canvas";
import { Chart } from "./Chart";
import { FlightSetup } from "./FlightSetup";
import { ProjectHub } from "./ProjectHub";
import { ComponentPicker } from "./ComponentPicker";
import { Hierarchy } from "./Hierarchy";
import type { DropPosition } from "./Hierarchy";
import {
  AIRFRAME,
  airframeMove,
  reorderDelta,
  suggestedTubeRadius,
} from "./placement";
import { EDITOR_VERSION } from "./version";
import { PanelResize } from "./PanelResize";
import { HelpReference } from "./EditorHelp";
import { Walkthrough } from "./GuidedTour";
import type { TourStep } from "./GuidedTour";
import { ComponentProperties, UnitField } from "./ComponentProperties";
import type {
  Project,
  Component,
  SimulationJob,
  SimulationRun,
  MotorReference,
  Variable,
} from "./contracts";
const pretty = (s: string) =>
  s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (s) => s.toUpperCase());
const fmt = (x: number | null | undefined, d = 2) =>
  x == null ? "—" : x.toLocaleString("en", { maximumFractionDigits: d });
function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const target = useFlightDialogTarget();
  const flightError = useFlightDialogError();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const element = (
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
      <div className="dialog-body">
        {target && flightError && (
          <p className="error-inline" role="alert">
            {flightError}
          </p>
        )}
        {children}
      </div>
    </dialog>
  );
  return target ? createPortal(element, target) : element;
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
            <DownloadLink
              className="button"
              href={`/api/runs/${run.id}`}
              download
            >
              ↓ Run record
            </DownloadLink>
          )}
          {run && (
            <DownloadLink
              className="button"
              href={`/api/runs/${run.id}/csv`}
              download
            >
              ↓ CSV
            </DownloadLink>
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
            {run.summary && run.status === "completed" && (
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
          {run.revision !== project.revision && (
            <p className="recorded-revision-note warning-inline">
              These results belong to design revision {run.revision}. The
              current design is revision {project.revision}; re-run after
              resolving launch checks to evaluate the changed design.
            </p>
          )}
          {run.configurationId !== project.selectedConfigurationId && (
            <p className="warning-inline">
              This saved flight used a different motor configuration from the
              active drawing. Inspect its configuration and provenance before
              comparing outcomes.
            </p>
          )}
          {flightConcerns(run).map((issue, i) => (
            <div className="flight-outcome-issue" key={i}>
              <strong>{issue.reason}</strong>
              <p>What to change: {issue.fix}</p>
            </div>
          ))}
          {run.error && <p className="error-inline">{run.error}</p>}
          <PhysicsReview run={run} />
          <FlightReplay
            key={run.id + "-" + branchIndex}
            branch={branch}
            status={run.status}
          />
          <div className="flight-summary-extra">
            Maximum acceleration: {fmt(run.summary?.maxAcceleration)} m/s² ·
            Duration: {fmt(run.summary?.flightTime)} s · Design revision:{" "}
            {run.revision}
          </div>
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
              <DownloadLink
                className="button"
                href={`/api/runs/${run.id}/csv?variables=${encodeURIComponent("t," + variableKey)}`}
                download
              >
                Export selected variable CSV
              </DownloadLink>
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
  const [flightPopup, setFlightPopup] = useState<Window | null>(null);
  function closeFlightWindow() {
    setDialog("");
    setFlightPopup(null);
    setMode("design");
  }
  function openFlightWindow() {
    if (flightPopup && !flightPopup.closed) {
      flightPopup.focus();
      return;
    }
    const w = window.open(
      "",
      "hoshi-flight-" + (project?.id || "workspace"),
      "popup,width=1280,height=820",
    );
    if (!w) {
      setMode("flight");
      setNotice(
        "The browser blocked the new window. Flight Simulation is open here instead.",
      );
      return;
    }
    w.document.documentElement.dataset.theme = "dark";
    w.document.head.replaceChildren();
    w.document.title = "Hoshi · Flight Simulation";
    const meta = w.document.createElement("meta");
    meta.name = "viewport";
    meta.content = "width=device-width,initial-scale=1";
    w.document.head.append(meta);
    document.querySelectorAll("link[rel=stylesheet],style").forEach((node) => {
      const copy = node.cloneNode(true) as HTMLElement;
      if (node instanceof HTMLLinkElement)
        (copy as HTMLLinkElement).href = node.href;
      w.document.head.append(copy);
    });
    w.document.body.replaceChildren();
    setMode("design");
    setFlightPopup(w);
  }
  const [mode, setMode] = useState("design");
  const [visitorMode, setVisitorMode] = useState(false);
  const [connected, setConnected] = useState(false),
    [screen, setScreen] = useState("home"),
    [showGuide, setShowGuide] = useState(
      !localStorage.getItem("rocket-onboarding-v3"),
    ),
    [guideStep, setGuideStep] = useState<TourStep>("project"),
    [aiAvailable, setAiAvailable] = useState(false),
    [inspectorTab, setInspectorTab] = useState("Inspector"),
    [pane, setPane] = useState("Scene");
  const [leftWidth, setLeftWidth] = useState(220),
    [rightWidth, setRightWidth] = useState(360);
  function closeGuide() {
    setShowGuide(false);
    localStorage.setItem("rocket-onboarding-v3", "complete");
  }
  const [project, setProject] = useState<Project | null>(null),
    [selected, setSelected] = useState(""),
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
    [clipboard, setClipboard] = useState("");
  const [motorQuery, setMotorQuery] = useState(""),
    [motors, setMotors] = useState<MotorReference[]>([]),
    [motor, setMotor] = useState<MotorReference | null>(null),
    [motorDelay, setMotorDelay] = useState(3),
    [freeform, setFreeform] = useState(""),
    [windLevels, setWindLevels] = useState(
      '[{"altitude":0,"speed":2,"direction":1.57,"standardDeviation":0.2}]',
    );
  const motorFile = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const inspectorScroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (screen !== "editor" || !connected) return;
    inspectorScroll.current?.scrollTo({ top: 0 });
    document
      .querySelector(".tree-row.selected")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selected, screen, connected]);
  const current = project
    ? flatten(project.rocket).find((c) => c.id === selected) || project.rocket
    : null;
  const active = job?.state === "running" || job?.state === "pending";
  function startGuide() {
    setDialog("");
    setMode("design");
    setInspectorTab("Inspector");
    setGuideStep(screen === "editor" && project ? "select" : "project");
    setShowGuide(true);
  }
  const guide =
    connected && showGuide ? (
      <Walkthrough
        step={guideStep}
        setStep={setGuideStep}
        close={closeGuide}
        project={project}
        screen={screen}
        busy={busy}
        error={error}
        dialog={dialog}
        job={job}
        setPane={setPane}
        canRun={
          !!project &&
          !flightChecks(project, simulationIndex).some(
            (i) => i.severity === "blocker",
          )
        }
      />
    ) : null;

  useEffect(() => {
    if ((screen !== "editor" || !connected) && flightPopup) {
      flightPopup.close();
      setFlightPopup(null);
    }
  }, [screen, connected, flightPopup]);
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
  async function initializeWorkspace() {
    await perform(async () => {
      const service = await api<{
        ephemeralStorage?: boolean;
        aiConfigured?: boolean;
        publicVisitorsEnabled?: boolean;
      }>("/health");
      const visitor = await prepareVisitorAccess(
        !!service.publicVisitorsEnabled,
      );
      setVisitorMode(visitor);
      setAiAvailable(!!service.aiConfigured);
      if (visitor)
        setNotice(
          "Your visitor workspace is separate from other visitors. It lasts up to 24 hours and may be lost when the server restarts. Export important designs and results.",
        );
      else if (service.ephemeralStorage)
        setNotice(
          "This engine uses temporary server storage. Export important projects and flight data before leaving.",
        );
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
      }
      setConnected(true);
      setScreen("home");
    });
  }
  useEffect(() => {
    void initializeWorkspace();
  }, []);
  useEffect(() => {
    const access = (event: Event) => {
      setError((event as CustomEvent<string>).detail);
      setConnected(false);
    };
    const download = (event: Event) =>
      setError((event as CustomEvent<string>).detail);
    const visitorExpired = () => {
      setConnected(false);
      setProject(null);
      setRuns([]);
      setRunId("");
      setJob(null);
      setUndo([]);
      setRedo([]);
      void initializeWorkspace();
    };
    window.addEventListener("engine-access-required", access);
    window.addEventListener("engine-download-error", download);
    window.addEventListener("visitor-access-expired", visitorExpired);
    return () => {
      window.removeEventListener("engine-access-required", access);
      window.removeEventListener("engine-download-error", download);
      window.removeEventListener("visitor-access-expired", visitorExpired);
    };
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
          if (project?.id === next.projectId) await loadRuns(next.projectId);
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
  }, [job?.id, active, project?.id]);
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
      let p = await api<Project>(
        "/projects",
        example ? { example } : { name: "Untitled rocket" },
      );
      if (!example) {
        p = await api<Project>(`/projects/${p.id}/mutate`, {
          revision: p.revision,
          op: "add",
          parentId: p.rocket.id,
          type: "AxialStage",
        });
      }
      await loadRuns(p.id);
      setDialog("");
      accept(p);
      setSelected(p.rocket.children[0]?.id || p.rocket.id);
      setMode("design");
      setScreen("editor");
      setPane("Scene");
      setUndo([]);
      setRedo([]);
      setSimulationIndex(
        Math.max(
          0,
          p.simulations.findIndex(
            (s) => s.configurationId === p.selectedConfigurationId,
          ),
        ),
      );
    });
  }
  async function openList() {
    if (active) {
      setNotice(
        "Wait for the current simulation to finish or cancel it before changing projects.",
      );
      return;
    }
    await perform(async () => {
      setProjects(await api<typeof projects>("/projects"));
      setScreen("home");
    });
  }
  async function openProject(id: string) {
    await perform(async () => {
      const p = await api<Project>("/projects/" + id);
      accept(p);
      await loadRuns(id);
      setUndo([]);
      setRedo([]);
      setMode("design");
      setScreen("editor");
      setSimulationIndex(
        Math.max(
          0,
          p.simulations.findIndex(
            (s) => s.configurationId === p.selectedConfigurationId,
          ),
        ),
      );
      setPane("Scene");
    });
  }
  async function addPart(type: string, parentId: string) {
    if (!project || busy) return;
    await perform(async () => {
      const previous = new Set(flatten(project.rocket).map((c) => c.id));
      let p = await api<Project>(`/projects/${project.id}/mutate`, {
        revision: project.revision,
        op: "add",
        type,
        parentId,
      });
      const added = flatten(p.rocket).find((c) => !previous.has(c.id));
      let setupError = "";
      try {
        if (added && type === "BodyTube") {
          const parent = flatten(project.rocket).find(
            (c) => c.id === parentId,
          )!;
          const radius = suggestedTubeRadius(parent);
          p = await api<Project>(`/projects/${p.id}/mutate`, {
            revision: p.revision,
            op: "set",
            componentId: added.id,
            changes: {
              outerRadiusAutomatic: false,
              outerRadius: radius,
              thickness: Math.min(0.002, radius / 4),
            },
          });
        }
        if (added && type === "NoseCone") {
          const parent = flatten(p.rocket).find((c) => c.id === parentId)!;
          const index = parent.children.findIndex((c) => c.id === added.id);
          if (index > 0)
            p = await api<Project>(`/projects/${p.id}/mutate`, {
              revision: p.revision,
              op: "move",
              componentId: added.id,
              delta: -index,
            });
        }
      } catch (e) {
        setupError = (e as Error).message;
      }
      setUndo((u) => [...u, project.revision]);
      setRedo([]);
      accept(p);
      setSelected(added?.id || parentId);
      setDialog("");
      setPane("Inspector");
      setInspectorTab("Inspector");
      window.dispatchEvent(new Event("scene-fit"));
      setNotice(
        type === "BodyTube"
          ? "Body tube added with a fixed diameter and wall thickness. Drag it to change assembly order; edit its dimensions in the Inspector."
          : ["AxialStage", "ParallelStage", "PodSet"].includes(type)
            ? "Assembly added. It is an empty container: attach physical parts to give it a shape."
            : type === "NoseCone"
              ? "Nose cone added at the front of its assembly. Drag parts to change their order."
              : "Component added and selected. Drag it in the scene or edit its dimensions in the Inspector.",
      );
      if (setupError)
        throw new Error(
          "The part was added, but its initial setup could not finish: " +
            setupError,
        );
    });
  }
  async function placePart(
    sourceId: string,
    targetId: string,
    position: DropPosition,
  ) {
    if (!project || busy) return;
    const nodes = flatten(project.rocket),
      source = nodes.find((c) => c.id === sourceId),
      target = nodes.find((c) => c.id === targetId);
    if (
      !source ||
      !target ||
      !source.parentId ||
      sourceId === targetId ||
      flatten(source).some((c) => c.id === targetId)
    )
      return;
    setSelected(sourceId);
    if (position === "inside") {
      if (!target.compatibleTypes.includes(source.type)) return;
      await mutate({
        op: "reparent",
        componentId: sourceId,
        parentId: targetId,
      });
    } else if (source.parentId === target.parentId) {
      const parent = nodes.find((c) => c.id === source.parentId)!;
      const delta = reorderDelta(
        parent,
        sourceId,
        targetId,
        position === "after",
      );
      if (delta) await mutate({ op: "move", componentId: sourceId, delta });
    }
  }
  async function moveInScene(id: string, distance: number) {
    if (!project || busy || !Number.isFinite(distance)) return;
    const nodes = flatten(project.rocket),
      component = nodes.find((c) => c.id === id);
    if (!component?.parentId) return;
    if (AIRFRAME.has(component.type)) {
      const parent = nodes.find((c) => c.id === component.parentId)!;
      const delta = airframeMove(parent, component, distance);
      if (delta) await mutate({ op: "move", componentId: id, delta });
      else
        setNotice(
          "Airframe parts stay joined. Drag past a neighbouring part's centre to change assembly order.",
        );
    } else {
      const offset = component.properties.find((p) => p.key === "axialOffset");
      if (offset)
        await mutate({
          op: "set",
          componentId: id,
          changes: { axialOffset: Number(offset.value) + distance },
        });
    }
  }
  async function simulate() {
    if (!project) return;
    if (!flightPopup) setMode("flight");
    const blockers = flightChecks(project, simulationIndex).filter(
      (i) => i.severity === "blocker",
    );
    if (blockers.length) {
      setNotice(
        "Launch blocked: " +
          blockers.map((i) => i.reason + " " + i.fix).join(" "),
      );
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
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (
        !connected ||
        screen !== "editor" ||
        mode !== "design" ||
        busy ||
        dialog ||
        showGuide ||
        !project ||
        (e.target instanceof HTMLElement &&
          e.target.closest("input,textarea,select,[contenteditable=true]"))
      )
        return;
      const command = e.ctrlKey || e.metaKey;
      if (command && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void restore(e.shiftKey ? "redo" : "undo");
      } else if (command && e.key.toLowerCase() === "y") {
        e.preventDefault();
        void restore("redo");
      } else if (command && e.key.toLowerCase() === "d" && current?.parentId) {
        e.preventDefault();
        void mutate({ op: "duplicate", componentId: selected });
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        current?.parentId
      ) {
        e.preventDefault();
        void mutate({ op: "remove", componentId: selected });
      } else if (command && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setDialog("component-picker");
      } else if (e.key.toLowerCase() === "f") {
        window.dispatchEvent(new Event("scene-fit"));
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [
    connected,
    mode,
    screen,
    busy,
    dialog,
    showGuide,
    project,
    selected,
    undo,
    redo,
  ]);
  const importInput = (
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
            setMode("design");
            setScreen("editor");
            setPane("Scene");
            setDialog("");
            setSimulationIndex(
              Math.max(
                0,
                p.simulations.findIndex(
                  (s) => s.configurationId === p.selectedConfigurationId,
                ),
              ),
            );
          });
        e.target.value = "";
      }}
    />
  );
  if (!connected)
    return (
      <>
        <EngineConnection
          error={error}
          busy={busy}
          onConnect={() => void initializeWorkspace()}
        />
        {guide}
      </>
    );
  if (screen === "home" || !project)
    return (
      <>
        <ProjectHub
          examples={examples}
          projects={projects}
          currentProjectId={project?.id}
          busy={busy}
          error={error}
          create={(example) => void create(example)}
          open={(id) => void openProject(id)}
          importFile={() => file.current?.click()}
          help={startGuide}
          guidedPractice={() => {
            setGuideStep("project");
            setShowGuide(true);
            void create("A simple model rocket.ork");
          }}
          disconnect={() => setConnected(false)}
        />
        {importInput}
        {guide}
      </>
    );
  function fixFlightIssue(issue: FlightIssue) {
    if (issue.action === "design") {
      if (issue.componentId) setSelected(issue.componentId);
      flightPopup?.close();
      closeFlightWindow();
      setPane("Inspector");
    } else if (issue.action === "motor") {
      const mount =
        flatten(project!.rocket).find(
          (c) => c.type === "InnerTube" && c.motorConfiguration,
        ) || flatten(project!.rocket).find((c) => c.motorConfiguration);
      if (mount) {
        setSelected(mount.id);
        setDialog("motors");
      } else {
        flightPopup?.close();
        closeFlightWindow();
        setNotice("Add a body or inner tube to hold a motor.");
      }
    } else {
      setWindLevels(
        JSON.stringify(
          project!.simulations[simulationIndex]?.windLevels || [],
          null,
          2,
        ),
      );
      setDialog("settings");
    }
  }
  const q = project.quantities;
  const stability = q.stability;
  return (
    <FlightDialogTarget.Provider value={flightPopup?.document.body || null}>
      <FlightDialogError.Provider value={error}>
        <div
          className="app"
          data-mode={mode}
          data-pane={pane}
          style={
            {
              "--left-width": `${leftWidth}px`,
              "--right-width": `${rightWidth}px`,
            } as React.CSSProperties
          }
        >
          {guide}
          <header className="topbar">
            <div className="brand">
              <span className="brand-mark">↟</span>
              <strong>Hoshi</strong>
              <span className="brand-divider" />
              <span className="project-title">{project.name}</span>
              <span
                className="saved-dot"
                title="Every accepted change is persisted on the server"
              />
              <small>Saved · rev {project.revision}</small>
            </div>
            <nav>
              <button
                onClick={() => {
                  setConnected(false);
                  setError("");
                }}
              >
                Engine connection
              </button>
              <button onClick={() => setDialog("about")}>
                Powered by OpenRocket 24.12
              </button>
              <button disabled={busy} onClick={() => setDialog("help")}>
                Help / walkthrough
              </button>
            </nav>
          </header>
          <div className="toolbar">
            <div className="toolbar-group">
              <button disabled={busy || active} onClick={openList}>
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
              <DownloadLink
                className={`button ${!project.conversionAccepted ? "disabled" : ""}`}
                href={
                  project.conversionAccepted
                    ? `/api/projects/${project.id}/export`
                    : undefined
                }
                download
                data-tour="export"
                title={
                  !project.conversionAccepted
                    ? "Accept import conversion warnings before export"
                    : "Download OpenRocket project"
                }
              >
                ↥ <span>Export</span>
              </DownloadLink>
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
              <details className="tools-menu">
                <summary>Tools ▾</summary>
                <div>
                  <button onClick={() => setDialog("advanced")}>
                    Analysis & optimization
                  </button>
                  <button onClick={() => setDialog("exports")}>
                    Additional exports
                  </button>
                  <button onClick={() => setDialog("expressions")}>
                    Custom expressions
                  </button>
                  <button disabled={busy} onClick={() => setDialog("help")}>
                    Editor reference
                  </button>
                </div>
              </details>
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
                          await api<SimulationJob>(
                            `/jobs/${job!.id}/cancel`,
                            {},
                          ),
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
                    aria-label="Simulate launch"
                    disabled={busy}
                    onClick={() =>
                      mode === "design" ? openFlightWindow() : simulate()
                    }
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
          <nav className="editor-modes" aria-label="Workspace view">
            <button
              className="primary open-flight-window"
              disabled={busy}
              onClick={openFlightWindow}
            >
              Open Flight Simulation window
            </button>
            <button
              className={mode === "design" ? "active" : ""}
              onClick={() => setMode("design")}
            >
              Design workspace
            </button>
            <button
              className={mode === "flight" ? "active" : ""}
              data-tour="flight"
              onClick={() => setMode("flight")}
            >
              Flight Simulation
            </button>
          </nav>
          {mode === "flight" && (
            <FlightSetup
              project={project}
              index={simulationIndex}
              busy={busy}
              active={!!active}
              setIndex={setSimulationIndex}
              mutate={mutate}
              chooseMotor={(id) => {
                setSelected(id);
                setDialog("motors");
              }}
              settings={() => {
                setWindLevels(
                  JSON.stringify(
                    project.simulations[simulationIndex]?.windLevels || [],
                    null,
                    2,
                  ),
                );
                setDialog("settings");
              }}
              design={() => {
                flightPopup?.close();
                closeFlightWindow();
              }}
              fix={fixFlightIssue}
            />
          )}
          <div className="mobile-pane-tabs">
            {["Scene", "Hierarchy", "Inspector"].map((p) => (
              <button
                key={p}
                className={pane === p ? "active" : ""}
                onClick={() => setPane(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <main className="workspace" hidden={mode !== "design"}>
            <aside className="left-panel" data-tour="hierarchy">
              <PanelResize
                label="Hierarchy panel width"
                value={leftWidth}
                min={165}
                max={340}
                onChange={setLeftWidth}
              />
              <div className="hierarchy-heading">
                Hierarchy <small>Rocket assembly</small>
              </div>
              <p className="hierarchy-drag-hint">
                Drag rows to reorder. Drop on a compatible parent to attach.
              </p>
              <div className="tree">
                <Hierarchy
                  root={project.rocket}
                  selected={selected}
                  busy={busy}
                  select={setSelected}
                  place={(source, target, position) =>
                    void placePart(source, target, position)
                  }
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
                disabled={busy}
                aria-label="Add Component"
                data-tour="add"
                onClick={() => setDialog("component-picker")}
              >
                ＋ Add component
              </button>
              <div className="left-footer">
                <span className="green-dot" /> Core connected{" "}
                <small>SI model · version 24.12</small>
              </div>
            </aside>
            <div className="center-workspace" data-tour="scene">
              <div className="design-heading">
                <div>
                  <span className="eyebrow">DESIGN WORKSPACE</span>
                  <h1>{project.name}</h1>
                </div>
                <span className="scene-label">SIDE SCENE</span>
              </div>
              <Canvas
                project={project}
                selected={selected}
                onSelect={setSelected}
                busy={busy}
                onMove={moveInScene}
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
            <aside className="right-panel" data-tour="inspector">
              <PanelResize
                label="Inspector panel width"
                value={rightWidth}
                min={245}
                max={460}
                onChange={setRightWidth}
                reverse
              />
              <div className="inspector-tabs">
                <button
                  className={inspectorTab === "Inspector" ? "active" : ""}
                  onClick={() => setInspectorTab("Inspector")}
                >
                  Inspector
                </button>
                {aiAvailable && (
                  <button
                    className={inspectorTab === "Assistant" ? "active" : ""}
                    onClick={() => setInspectorTab("Assistant")}
                  >
                    Assistant
                  </button>
                )}
              </div>
              <section
                className="inspector"
                hidden={inspectorTab !== "Inspector"}
              >
                <header>
                  <span>COMPONENT PROPERTIES</span>
                  <span className="tiny-tag">SI ↔ UI</span>
                </header>
                <div className="inspector-scroll" ref={inspectorScroll}>
                  <h2>{current?.name}</h2>
                  <p className="component-kind">
                    {pretty(current?.type || "")}
                  </p>
                  {current && (
                    <ComponentProperties
                      key={current.id}
                      component={current}
                      busy={busy}
                      change={(key, value) =>
                        void mutate({
                          op: "set",
                          componentId: current.id,
                          changes: { [key]: value },
                        })
                      }
                      repairTube={() =>
                        void mutate({
                          op: "set",
                          componentId: current.id,
                          changes: {
                            outerRadiusAutomatic: false,
                            outerRadius: 0.025,
                            thickness: 0.002,
                          },
                        })
                      }
                      applyMaterial={(name, density) =>
                        void mutate({
                          op: "material",
                          componentId: current.id,
                          name,
                          density,
                        })
                      }
                    />
                  )}
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
                    <button
                      className="wide"
                      onClick={() => setDialog("presets")}
                    >
                      Choose component template…
                    </button>
                  )}
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
                      <summary>
                        Recovery deployment (active configuration)
                      </summary>
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
              {aiAvailable && inspectorTab === "Assistant" && (
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
                    const blockers = flightChecks(project, index).filter(
                      (i) => i.severity === "blocker",
                    );
                    if (blockers.length) {
                      setNotice(
                        "Launch blocked: " +
                          blockers.map((i) => i.reason).join(" "),
                      );
                      setMode("flight");
                      return;
                    }
                    setMode("flight");
                    void perform(async () =>
                      setJob(
                        await api<SimulationJob>(
                          `/projects/${project.id}/jobs`,
                          {
                            revision,
                            simulationIndex: index,
                          },
                        ),
                      ),
                    );
                  }}
                />
              )}
            </aside>
          </main>
          {mode === "flight" && (
            <div className="flight-results-view">
              <Results
                project={project}
                runs={runs}
                selected={runId}
                setSelected={setRunId}
              />
            </div>
          )}
          {flightPopup && (
            <FlightWindow
              target={flightPopup}
              close={closeFlightWindow}
              projectName={project.name}
            >
              {error && (
                <div className="notification error" role="alert">
                  {error}
                  <button
                    aria-label="Dismiss flight error"
                    onClick={() => setError("")}
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="flight-command-bar">
                <label>
                  Simulation
                  <select
                    aria-label="Window simulation"
                    value={simulationIndex}
                    disabled={busy || !!active}
                    onChange={(e) => setSimulationIndex(Number(e.target.value))}
                  >
                    {!project.simulations.length && (
                      <option value="0">No simulation configured</option>
                    )}
                    {project.simulations.map((sim, i) => (
                      <option key={i} value={i}>
                        {sim.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="primary"
                  disabled={
                    busy ||
                    !!active ||
                    flightChecks(project, simulationIndex).some(
                      (i) => i.severity === "blocker",
                    )
                  }
                  onClick={simulate}
                >
                  Run flight simulation
                </button>
                {active && (
                  <button
                    onClick={() =>
                      void perform(async () =>
                        setJob(
                          await api<SimulationJob>(
                            `/jobs/${job!.id}/cancel`,
                            {},
                          ),
                        ),
                      )
                    }
                  >
                    Cancel simulation
                  </button>
                )}
                <span role="status">
                  {active
                    ? `Engine ${job?.state}…`
                    : flightChecks(project, simulationIndex).some(
                          (i) => i.severity === "blocker",
                        )
                      ? "Launch blocked — fix the listed issues"
                      : "No blocking setup errors found; review warnings before running."}
                </span>
              </div>
              <div className="flight-window-layout">
                <div className="flight-window-sidebar">
                  <FlightSetup
                    project={project}
                    index={simulationIndex}
                    busy={busy}
                    active={!!active}
                    setIndex={setSimulationIndex}
                    mutate={mutate}
                    chooseMotor={(id) => {
                      setSelected(id);
                      setDialog("motors");
                    }}
                    settings={() => {
                      setWindLevels(
                        JSON.stringify(
                          project.simulations[simulationIndex]?.windLevels ||
                            [],
                          null,
                          2,
                        ),
                      );
                      setDialog("settings");
                    }}
                    design={() => {
                      flightPopup?.close();
                      closeFlightWindow();
                    }}
                    fix={fixFlightIssue}
                  />
                </div>
                <div className="flight-results-view">
                  <Results
                    project={project}
                    runs={runs}
                    selected={runId}
                    setSelected={setRunId}
                  />
                </div>
              </div>
            </FlightWindow>
          )}
          <footer className="statusbar">
            <span>
              Hoshi Editor {EDITOR_VERSION} <span> / </span> Powered by
              OpenRocket 24.12
            </span>
            <span>
              {busy
                ? "Saving change…"
                : `Revision ${project.revision} · autosaved`}{" "}
              <span> / </span> Local workspace
            </span>
          </footer>
          {importInput}
          <input
            ref={motorFile}
            type="file"
            accept=".eng,.rse"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f)
                void perform(async () => {
                  const response = await apiFetch("/motors/import", {
                    method: "POST",
                    headers: { "X-Filename": encodeURIComponent(f.name) },
                    body: f,
                  });
                  const data = await response.json();
                  if (!response.ok)
                    throw new Error(
                      data.error?.message || "Motor import failed",
                    );
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
            <Dialog
              title="Custom flight expressions"
              close={() => setDialog("")}
            >
              <ExpressionEditor project={project} apply={mutate} />
            </Dialog>
          )}
          {dialog === "component-picker" && (
            <Dialog title="Add Component" close={() => setDialog("")}>
              <ComponentPicker
                root={project.rocket}
                selected={selected}
                types={types}
                busy={busy}
                add={(type, parent) => void addPart(type, parent)}
              />
            </Dialog>
          )}
          {dialog === "help" && (
            <Dialog title="Editor reference" close={() => setDialog("")}>
              <HelpReference
                replay={() => {
                  startGuide();
                }}
              />
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
                          "Configuration " +
                          (project.configurations.length + 1),
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
                      project.simulations[simulationIndex]?.configurationId ||
                      ""
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
                    Each simulation uses its own configuration; changing the
                    active drawing configuration does not silently change a
                    simulation.
                  </p>
                </section>
                <section>
                  <p className="helper">
                    The angular solver limit is read-only: the pinned native
                    project format does not save changes to it.
                  </p>
                  {project.simulations[simulationIndex]?.options.map((p) => (
                    <UnitField
                      key={p.key}
                      p={p}
                      disabled={busy || p.key === "maximumStepAngle"}
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
                      {(
                        ["average", "standardDeviation", "direction"] as const
                      ).map((k) => (
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
                      ))}
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
                          Set wind model type to MULTI_LEVEL. Levels: altitude
                          m, speed m/s, direction rad, standardDeviation m/s.
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
                  No geometry warnings reported by the selected configuration.
                  This is not a guarantee of stable flight.
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
          {dialog === "freeform" && (
            <Dialog title="Freeform fin geometry" close={() => setDialog("")}>
              <p>
                Coordinates [x, y] in meters in the upstream fin plane. First
                and last points attach to the body.
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
                Real thrust curves bundled with OpenRocket 24.12. The server
                checks mount diameter and length before assignment.
              </p>
              {!visitorMode && (
                <button onClick={() => motorFile.current?.click()}>
                  Import real motor data (.eng / .rse)
                </button>
              )}
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
                          setMotor(
                            await api<MotorReference>("/motors/" + m.id),
                          );
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
                        {fmt(motor.launchMass * 1000)} g · {fmt(motor.burnTime)}{" "}
                        s burn
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
                          onChange={(e) =>
                            setMotorDelay(Number(e.target.value))
                          }
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
                      <button
                        disabled={
                          busy ||
                          !project.mounts.some(
                            (m) => m.id === selected && m.motor,
                          )
                        }
                        onClick={() => {
                          setDialog("");
                          setMode("flight");
                        }}
                      >
                        Continue to flight setup
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
            <Dialog
              title="Export design & components"
              close={() => setDialog("")}
            >
              <p>
                Native exporters from the pinned core. Review any conversion
                warnings before downloading a lossy format.
              </p>
              <div className="dialog-actions">
                <DownloadLink
                  className="button"
                  href={`/api/projects/${project.id}/obj`}
                  download
                >
                  Full design OBJ
                </DownloadLink>
                <DownloadLink
                  className="button"
                  href={`/api/projects/${project.id}/obj?componentId=${selected}`}
                  download
                >
                  Selected component OBJ
                </DownloadLink>
                {current?.type.includes("FinSet") &&
                  current.type !== "TubeFinSet" && (
                    <DownloadLink
                      className="button"
                      href={`/api/projects/${project.id}/finSvg?componentId=${selected}`}
                      download
                    >
                      Fin SVG
                    </DownloadLink>
                  )}
              </div>
              {["rocksim", "rasaero"].map((format) => (
                <ExportConversion
                  key={format}
                  id={project.id}
                  format={format}
                />
              ))}
            </Dialog>
          )}
          {dialog === "about" && (
            <Dialog title="About Hoshi" close={() => setDialog("")}>
              <p>
                Independent browser workspace using the OpenRocket 24.12 core,
                pinned at <code>133b558de556f0282f51c3f53f3b3fc633b4310a</code>.
                No official endorsement is implied.
              </p>
              <p>
                The engine computes geometry, mass properties, aerodynamics and
                flight. The drawing is a schematic projection and does not claim
                exact shape or manufacturing accuracy.
              </p>
              <p>
                Working: component model, scalar properties, .ork import/export,
                local revisions, motors, simulation settings, asynchronous
                flight jobs, computed plots, events, CSV and stored-run
                comparisons.
              </p>
              <p>
                Remaining compatibility gaps include specialized component
                editors, asset archives, desktop extensions, full interchange
                round trips and live AI validation. 3D uses actual core OBJ
                geometry; optimization proposals require acceptance. Full parity
                is not claimed. See docs/openrocket-parity.md for evidence and
                remaining work.
              </p>
              <p>
                OpenRocket code is GPL-3.0-or-later with additional data
                packaging permission. Preserve the bundled engine, database and
                third-party notices when distributing. Source and build
                instructions are included in this project.
              </p>
            </Dialog>
          )}
        </div>
      </FlightDialogError.Provider>
    </FlightDialogTarget.Provider>
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
            const response = await apiFetch(
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
          <DownloadLink
            className="button"
            href={`/api/projects/${id}/interchange?format=${format}&download=true&acceptWarnings=true`}
            download
          >
            Accept conversion and download {format}
          </DownloadLink>
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
