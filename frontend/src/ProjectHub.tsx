import { useState } from "react";
import { RocketTutorial } from "./RocketTutorial";
const descriptions: Record<string, string> = {
  "A simple model rocket.ork":
    "Single stage · fins · parachute · multiple motors",
  "Three stage low power rocket.ork": "Three stages · sequential ignition",
  "Clustered motors.ork": "Multiple motors firing as a cluster",
  "Dual parachute deployment.ork": "Two recovery deployments",
  "Tube fin rocket.ork": "Tube-fin geometry",
  "Two stage high power rocket.ork": "Two-stage configuration",
  "Parallel booster staging.ork": "Side boosters and stage separation",
};
export function ProjectHub({
  examples,
  projects,
  currentProjectId,
  busy,
  error,
  create,
  open,
  importFile,
  help,
  disconnect,
}: {
  examples: string[];
  projects: { id: string; name: string; revision: number }[];
  currentProjectId?: string;
  busy: boolean;
  error: string;
  create: (example?: string) => void;
  open: (id: string) => void;
  importFile: () => void;
  help: () => void;
  disconnect: () => void;
}) {
  const [tab, setTab] = useState("Examples");
  return (
    <div className="project-hub">
      <header>
        <div className="brand">
          <span className="brand-mark">↑</span>
          <strong>
            Hoshi <span>Rocket design &amp; flight</span>
          </strong>
        </div>
        <nav>
          <button onClick={help}>Quick start guide</button>
          <button onClick={disconnect}>Engine connection</button>
        </nav>
      </header>
      <main>
        <div className="hub-intro">
          <span className="eyebrow">
            POWERED BY OPENROCKET 24.12 / PROJECT LAUNCHER
          </span>
          <h1>What will you build?</h1>
          <p>
            Design your rocket, tune its components and explore a real simulated
            flight.
          </p>
        </div>
        <div className="hub-layout">
          <section className="new-project-card">
            <span className="new-project-icon">＋</span>
            <h2>Start from scratch</h2>
            <p>
              An empty stage, ready for your nose cone, airframe, fins and
              recovery system.
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={() => create()}
            >
              Create blank rocket
            </button>
            <button disabled={busy} onClick={importFile}>
              Import a rocket file
            </button>
            <small>
              New to the editor? Start with the simple model example.
            </small>
          </section>
          <section className="hub-browser">
            <div className="hub-tabs">
              {[
                "Examples",
                "Recent projects",
                "First time designing a rocket",
              ].map((t) => (
                <button
                  key={t}
                  className={tab === t ? "active" : ""}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            {tab === "First time designing a rocket" ? (
              <RocketTutorial
                busy={busy}
                start={() => create("A simple model rocket.ork")}
              />
            ) : (
              <div className="hub-cards">
                {tab === "Examples" ? (
                  examples.map((e, i) => (
                    <button
                      className="project-card"
                      key={e}
                      disabled={busy}
                      onClick={() => create(e)}
                    >
                      <div
                        className={`project-art art-${i % 3}`}
                        aria-hidden="true"
                      >
                        <span>↗</span>
                        <i />
                        <b>{String(i + 1).padStart(2, "0")}</b>
                      </div>
                      <strong>{e.replace(".ork", "")}</strong>
                      <small>
                        {descriptions[e] || "Pinned OpenRocket example"}
                      </small>
                      <span className="card-action">Open example →</span>
                    </button>
                  ))
                ) : projects.length ? (
                  [...projects]
                    .sort(
                      (a, b) =>
                        Number(b.id === currentProjectId) -
                        Number(a.id === currentProjectId),
                    )
                    .map((p) => (
                      <button
                        className="project-card recent"
                        key={p.id}
                        disabled={busy}
                        onClick={() => open(p.id)}
                      >
                        <span className="project-file-icon">▤</span>
                        <strong>{p.name}</strong>
                        <small>
                          {p.id === currentProjectId ? "Last opened · " : ""}
                          Saved revision {p.revision}
                        </small>
                        <span className="card-action">Continue project →</span>
                      </button>
                    ))
                ) : (
                  <p>
                    No saved projects on this engine yet. Create a rocket or
                    open an example.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
        {error && (
          <p className="error-inline" role="alert">
            {error}
          </p>
        )}
        {busy && <p role="status">Opening your project…</p>}
      </main>
      <footer>
        <span className="green-dot" /> Real OpenRocket engine connected{" "}
        <span>
          Examples open as independent projects. Your existing designs are
          preserved.
        </span>
      </footer>
    </div>
  );
}
