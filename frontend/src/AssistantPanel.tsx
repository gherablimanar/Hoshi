import { useState, useEffect } from "react";
import { api } from "./api";
import type { Project, AIProposedPatch } from "./contracts";
interface Answer {
  narrative: string;
  claims: {
    runId: string;
    revision: number;
    quantity: string;
    value: number;
    unit: string;
  }[];
  proposals: AIProposedPatch[];
  simulationRequests: {
    simulationIndex: number;
    revision: number;
    reason: string;
  }[];
  provider: string;
  baseRevision: number;
}
export function AssistantPanel({
  project,
  selected,
  runId,
  onAccept,
  onSimulate,
}: {
  project: Project;
  selected: string;
  runId: string;
  onAccept: (path: string, body: Record<string, unknown>) => Promise<void>;
  onSimulate: (index: number, revision: number) => void;
}) {
  const [configured, setConfigured] = useState(false),
    [message, setMessage] = useState(""),
    [allow, setAllow] = useState(false),
    [answer, setAnswer] = useState<Answer | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    api<{ aiConfigured: boolean }>("/health")
      .then((s) => setConfigured(s.aiConfigured))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    setAnswer(null);
  }, [project.id]);
  async function send() {
    setBusy(true);
    setError("");
    try {
      setAnswer(
        await api<Answer>(`/projects/${project.id}/ai`, {
          revision: project.revision,
          message,
          selectedComponentId: selected,
          selectedRunId: runId,
          allowProposals: allow,
          allowSimulationRequests: allow,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="assistant">
      <header>
        <div>
          <span className="ai-icon">✧</span>
          <strong>Design assistant</strong>
        </div>
        <span className="tiny-tag">AI</span>
      </header>
      <div className="assistant-content">
        <span className="unavailable-pill">
          {configured ? "Provider configured" : "Not configured"}
        </span>
        {!answer && (
          <>
            <h3>A second perspective on your flight.</h3>
            <p>
              Explain a warning, compare named runs or inspect a proposed design
              change.
            </p>
            {!configured && (
              <p className="helper">
                Set AI_API_KEY and AI_MODEL on the server to enable live
                answers. Engineering tools work independently.
              </p>
            )}
          </>
        )}
        {answer && (
          <div className="ai-answer">
            <p>
              <small>
                Live AI · explanation / hypotheses · revision{" "}
                {answer.baseRevision}
              </small>
            </p>
            <p>{answer.narrative}</p>
            {answer.claims.map((c, i) => (
              <p key={i} className="ai-citation">
                <strong>
                  {c.quantity}: {c.value.toFixed(3)} {c.unit}
                </strong>
                <small>
                  Engine evidence · {c.runId.slice(0, 8)} · revision{" "}
                  {c.revision}
                </small>
              </p>
            ))}
            {answer.proposals.map((p) => (
              <div key={p.id} className="patch">
                <strong>Proposed change · hypothesis</strong>
                <p>{p.reason}</p>
                <p>{p.expectedTradeoff}</p>
                {p.changes.map((c, i) => (
                  <p key={i}>
                    <code>{c.property}</code>: {String(c.before)} →{" "}
                    {String(c.after)}
                  </p>
                ))}
                <button
                  disabled={busy || project.revision !== p.baseRevision}
                  onClick={() => onAccept("acceptPatch", { proposalId: p.id })}
                >
                  Accept this patch
                </button>
                {project.revision !== p.baseRevision && (
                  <small>
                    Proposal is from an earlier revision; request a new
                    proposal.
                  </small>
                )}
              </div>
            ))}
            {answer.simulationRequests.map((s, i) => (
              <div className="patch" key={i}>
                <p>{s.reason}</p>
                <button
                  disabled={project.revision !== s.revision}
                  onClick={() => onSimulate(s.simulationIndex, s.revision)}
                >
                  Accept and run simulation
                </button>
              </div>
            ))}
          </div>
        )}
        {error && (
          <p role="alert" className="error-inline">
            {error}
          </p>
        )}
        {configured && (
          <label className="helper">
            <input
              type="checkbox"
              checked={allow}
              onChange={(e) => setAllow(e.target.checked)}
            />{" "}
            Allow inspectable proposals / simulation requests
          </label>
        )}
      </div>
      <div className="assistant-input">
        <input
          aria-label="Message design assistant"
          placeholder={
            configured
              ? "Ask about this design or selected run…"
              : "AI assistant not configured"
          }
          disabled={!configured || busy}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && message.trim()) void send();
          }}
        />
        <button
          disabled={!configured || busy || !message.trim()}
          onClick={send}
          aria-label="Send assistant message"
        >
          {busy ? "…" : "↑"}
        </button>
      </div>
    </section>
  );
}
