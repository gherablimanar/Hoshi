import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Project, SimulationJob } from "./contracts";
import { flatten } from "./Canvas";

export const TOUR_STEPS = [
  "project",
  "select",
  "length",
  "scene",
  "add",
  "pick",
  "attach",
  "added",
  "material",
  "flight",
  "conditions",
  "run",
  "results",
  "export",
  "finish",
] as const;
export type TourStep = (typeof TOUR_STEPS)[number];
const copy: Record<TourStep, [string, string, string]> = {
  project: [
    "Start with a real rocket",
    "Click this example. It opens a separate practice project, with real parts and flight settings.",
    "Click the highlighted example",
  ],
  select: [
    "Pick a part",
    "Click the highlighted part in the Hierarchy. Its shape and settings will be selected together.",
    "Click this part",
  ],
  length: [
    "Try a real dimension",
    "Click Length, enter a positive value in millimetres, then press Enter. We wait until the engine saves your edit.",
    "Edit the value · press Enter",
  ],
  scene: [
    "See your design",
    "This is your actual rocket. Drag the background to pan and scroll to zoom. A selected physical part can be dragged left or right.",
    "Explore the highlighted scene",
  ],
  add: [
    "One place to add parts",
    "Click Add component. The next steps show how to choose a part and attach it.",
    "Click Add component",
  ],
  pick: [
    "Choose a body tube",
    "Click Body tube. A stage is only a container; a tube adds a physical piece to your rocket.",
    "Click Body tube",
  ],
  attach: [
    "Check its attachment",
    "The selected stage is the parent. Click Add Body tube to create the real component.",
    "Check the parent · click Add Body tube",
  ],
  added: [
    "Your new part is here",
    "The new tube is selected in the Hierarchy. It is also in the scene, and its own dimensions are in the Inspector.",
    "A real component was added",
  ],
  material: [
    "Give the part a material",
    "Choose from the material library, then Apply material. Density changes calculated mass. You can keep the current material for this lesson.",
    "Choose a material · Apply material",
  ],
  flight: [
    "Open the flight workspace",
    "Click Flight Simulation. Launch setup and results live here; your design stays in the same project.",
    "Click Flight Simulation",
  ],
  conditions: [
    "Set the launch conditions",
    "These are real engine inputs: launch guide, site, atmosphere and wind. Review them for the flight you intend to model.",
    "Review the actual flight controls",
  ],
  run: [
    "Calculate a real flight",
    "Click Simulate launch. The engine calculates the flight; this guide waits for the actual result.",
    "Click Simulate launch",
  ],
  results: [
    "Read what actually happened",
    "Inspect the recorded trajectory, plots and events. A failed calculation has a reason; a completed calculation is still a model prediction.",
    "Explore the recorded results",
  ],
  export: [
    "Keep your rocket",
    "Click Export to download the native .ork design. Server storage can be temporary; keep your own file.",
    "Click Export",
  ],
  finish: [
    "You have used the real editor",
    "You can select parts, edit dimensions, add components, inspect flight conditions and review results. Restart this walkthrough from Help whenever you want.",
    "Your project remains open",
  ],
};

export function Walkthrough({
  step,
  setStep,
  close,
  project,
  screen,
  busy,
  error,
  dialog,
  job,
  canRun,
  setPane,
}: {
  step: TourStep;
  setStep: (s: TourStep) => void;
  close: () => void;
  project: Project | null;
  screen: string;
  busy: boolean;
  error: string;
  dialog: string;
  job: SimulationJob | null;
  canRun: boolean;
  setPane: (p: string) => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const entry = useRef({ step, revision: project?.revision, job: job?.id });
  if (entry.current.step !== step)
    entry.current = { step, revision: project?.revision, job: job?.id };
  const [focus, setFocus] = useState<{
    element: HTMLElement | null;
    portal: HTMLElement;
    x: number;
    y: number;
    w: number;
    h: number;
    vw: number;
    vh: number;
  } | null>(null);
  const nodes = project ? flatten(project.rocket) : [];
  const part =
    nodes.find((c) => c.type === "BodyTube") ||
    nodes.find((c) => c.type === "NoseCone") ||
    project?.rocket.children[0];
  const editable = part?.properties.some((p) => p.key === "length");
  const active = job?.state === "pending" || job?.state === "running";
  const selector = (
    {
      project: '[data-tour="example"]',
      select: part
        ? `[data-component-id="${part.id}"]`
        : '[data-tour="hierarchy"]',
      length: '.inspector input[aria-label="Length"]',
      scene: '[data-tour="scene"]',
      add: '[data-tour="add"]',
      pick: '.picker-list [data-part-type="BodyTube"]',
      attach: ".picker-confirm",
      added: ".tree-row.selected",
      material: ".material-settings",
      flight: '[data-tour="flight"]',
      conditions: project?.simulations.length
        ? ".flight-controls"
        : ".preflight-checks",
      run:
        canRun && !active ? '[aria-label="Simulate launch"]' : ".flight-setup",
      results: ".results",
      export: '[data-tour="export"]',
      finish: ".topbar",
    } as Record<TourStep, string>
  )[step];

  // State gates follow completed application operations, not timers or mock clicks.
  useEffect(() => {
    if (screen === "home" && step !== "project") setStep("project");
    if (step === "project" && screen === "editor" && project) setStep("select");
    if (
      step === "length" &&
      !busy &&
      project &&
      project.revision > (entry.current.revision ?? project.revision)
    )
      setStep("scene");
    if (step === "add" && dialog === "component-picker") setStep("pick");
    if (
      step === "attach" &&
      !busy &&
      dialog !== "component-picker" &&
      project &&
      project.revision > (entry.current.revision ?? project.revision)
    )
      setStep("added");
    if (
      step === "material" &&
      !busy &&
      project &&
      project.revision > (entry.current.revision ?? project.revision)
    )
      setStep("flight");
    if (
      step === "run" &&
      job &&
      job.id !== entry.current.job &&
      ["completed", "failed"].includes(job.state)
    )
      setStep("results");
  }, [step, screen, project, busy, dialog, job, setStep]);

  useEffect(() => {
    if (["select", "add", "added"].includes(step)) setPane("Hierarchy");
    if (["length", "material"].includes(step)) setPane("Inspector");
    if (step === "scene") setPane("Scene");
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el || cancelled) return;
      for (let p = el.parentElement; p; p = p.parentElement)
        if (p instanceof HTMLDetailsElement) p.open = true;
      el.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [step, selector, setPane]);

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const modal = [
        ...document.querySelectorAll<HTMLDialogElement>("dialog[open]"),
      ].at(-1);
      let element = document.querySelector<HTMLElement>(selector);
      // A native modal makes the rest of the document inert. Keep guidance in its top layer.
      if (modal && !modal.contains(element))
        element = modal.querySelector<HTMLElement>(".dialog-body") || modal;
      const r = element?.getBoundingClientRect();
      const vw = innerWidth,
        vh = innerHeight;
      const x = r ? Math.max(6, Math.min(vw - 6, r.left - 6)) : vw / 2;
      const y = r ? Math.max(6, Math.min(vh - 6, r.top - 6)) : vh / 2;
      const w = r ? Math.max(0, Math.min(vw - 6, r.right + 6) - x) : 0;
      const h = r ? Math.max(0, Math.min(vh - 6, r.bottom + 6) - y) : 0;
      const next = {
        element: w && h ? element : null,
        portal: modal || document.body,
        x,
        y,
        w,
        h,
        vw,
        vh,
      };
      setFocus((old) =>
        old &&
        Object.keys(next).every(
          (k) => old[k as keyof typeof next] === next[k as keyof typeof next],
        )
          ? old
          : next,
      );
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "open",
        "hidden",
        "class",
        "data-pane",
        "data-mode",
        "disabled",
      ],
    });
    const resize = new ResizeObserver(schedule);
    resize.observe(document.documentElement);
    schedule();
    document.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      observer.disconnect();
      resize.disconnect();
      cancelAnimationFrame(raf);
      document.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [selector, step, dialog]);

  useEffect(() => {
    const el = focus?.element;
    if (!el) return;
    const before = el.getAttribute("aria-describedby");
    el.setAttribute(
      "aria-describedby",
      [before, "guided-description"].filter(Boolean).join(" "),
    );
    return () => {
      if (before == null) el.removeAttribute("aria-describedby");
      else el.setAttribute("aria-describedby", before);
    };
  }, [focus?.element]);

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      card.current?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(id);
  }, [step, focus?.portal]);

  useEffect(() => {
    const click = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (busy || !el || !focus?.element?.contains(el)) return;
      if (step === "select" && el.closest(".tree-row"))
        setStep(editable ? "length" : "add");
      if (step === "pick" && el.closest('[data-part-type="BodyTube"]'))
        setStep("attach");
      if (step === "flight" && el.closest('[data-tour="flight"]'))
        setStep("conditions");
    };
    const downloaded = (e: Event) => {
      if (
        step === "export" &&
        (e as CustomEvent<{ path: string }>).detail.path.endsWith("/export")
      )
        setStep("finish");
    };
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
      }
      if (e.key !== "Tab") return;
      const query =
        'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]';
      const target = focus?.element;
      const choices = [
        ...(target?.matches(query) ? [target] : []),
        ...Array.from(target?.querySelectorAll<HTMLElement>(query) || []),
        ...Array.from(card.current?.querySelectorAll<HTMLElement>(query) || []),
      ].filter((el) => el.getClientRects().length && !el.closest("[hidden]"));
      if (!choices.length) return;
      e.preventDefault();
      const i = choices.indexOf(document.activeElement as HTMLElement);
      choices[
        (i + (e.shiftKey ? -1 : 1) + choices.length) % choices.length
      ].focus();
    };
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", keys, true);
    window.addEventListener("engine-download-complete", downloaded);
    return () => {
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", keys, true);
      window.removeEventListener("engine-download-complete", downloaded);
    };
  }, [step, busy, focus?.element, editable, setStep, close]);

  if (!focus) return null;
  const { x, y, w, h, vw, vh } = focus;
  const cardW = Math.min(330, vw - 24),
    cardH = Math.min(320, vh * 0.49);
  const clamp = (v: number, max: number) => Math.max(12, Math.min(max, v));
  const positions = [
    { left: x + w + 20, top: y },
    { left: x - cardW - 20, top: y },
    { left: x, top: y + h + 22 },
    { left: x, top: y - cardH - 22 },
  ].map((p) => ({
    left: clamp(p.left, vw - cardW - 12),
    top: clamp(p.top, vh - cardH - 12),
  }));
  const overlap = (p: { left: number; top: number }) =>
    Math.max(0, Math.min(p.left + cardW, x + w) - Math.max(p.left, x)) *
    Math.max(0, Math.min(p.top + cardH, y + h) - Math.max(p.top, y));
  const position = positions.sort((a, b) => overlap(a) - overlap(b))[0];
  const title =
    !canRun && step === "run"
      ? "Resolve the launch checks"
      : active && step === "run"
        ? "The engine is calculating…"
        : copy[step][0];
  const text =
    !canRun && step === "run"
      ? "The highlighted setup explains what is missing. Follow its repair buttons, or continue this lesson without running."
      : copy[step][1];
  const manual: Partial<Record<TourStep, [string, TourStep]>> = {
    length: ["Keep current dimensions", "scene"],
    scene: ["Show me how to add a part", "add"],
    added: ["Personalise this part", "material"],
    material: ["Keep current material", "flight"],
    conditions: ["Reviewed · continue", "run"],
    run: ["Continue without running", "export"],
    results: ["Show me how to save", "export"],
  };
  const action = manual[step];
  return createPortal(
    <div className="guided-tour" data-step={step}>
      {focus.element && (
        <>
          <div
            className="guided-shade"
            style={{ left: 0, top: 0, width: vw, height: y }}
          />
          <div
            className="guided-shade"
            style={{ left: 0, top: y, width: x, height: h }}
          />
          <div
            className="guided-shade"
            style={{
              left: x + w,
              top: y,
              width: Math.max(0, vw - x - w),
              height: h,
            }}
          />
          <div
            className="guided-shade"
            style={{
              left: 0,
              top: y + h,
              width: vw,
              height: Math.max(0, vh - y - h),
            }}
          />
          <div
            className="guided-focus"
            style={{ left: x, top: y, width: w, height: h }}
            aria-hidden="true"
          />
          {w < 420 && h < 260 && (
            <div
              className="guided-pointer"
              style={{
                left: clamp(x + w * 0.65, vw - 36),
                top: clamp(y + h * 0.65, vh - 40),
              }}
              aria-hidden="true"
            >
              <svg width="28" height="32" viewBox="0 0 24 30">
                <path
                  d="M3 2 L4 23 L10 17 L16 26 L21 23 L15 14 L23 12 Z"
                  fill="#eef7ff"
                  stroke="#1d2a36"
                  strokeWidth="1.5"
                />
              </svg>
              <i />
            </div>
          )}
        </>
      )}
      <div
        ref={card}
        className="guided-card"
        role="dialog"
        aria-modal="false"
        aria-labelledby="guided-title"
        aria-describedby="guided-description"
        tabIndex={-1}
        style={{ ...position, width: cardW, maxHeight: cardH }}
      >
        <div className="guided-topline">
          <span>
            LEARN BY DOING · {TOUR_STEPS.indexOf(step) + 1}/{TOUR_STEPS.length}
          </span>
          <button onClick={close} aria-label="Close walkthrough">
            ×
          </button>
        </div>
        <div className="guided-progress" aria-hidden="true">
          <i
            style={{
              width: `${((TOUR_STEPS.indexOf(step) + 1) / TOUR_STEPS.length) * 100}%`,
            }}
          />
        </div>
        <TourPicture step={step} />
        <h2 id="guided-title">{title}</h2>
        <p id="guided-description">{text}</p>
        {error && (
          <p className="guided-error" role="alert">
            {error}
          </p>
        )}
        <div className="guided-instruction" role="status">
          {busy || (active && step === "run")
            ? "Waiting for the engine…"
            : focus.element
              ? copy[step][2]
              : "Finding this control…"}
        </div>
        <footer>
          <button onClick={close}>Skip introduction</button>
          {step === "finish" ? (
            <button className="primary" onClick={close}>
              Finish guide
            </button>
          ) : (
            action && (
              <button
                disabled={busy || !!active}
                className="primary"
                onClick={() => setStep(action[1])}
              >
                {action[0]}
              </button>
            )
          )}
        </footer>
      </div>
    </div>,
    focus.portal,
  );
}

export function TourPicture({ step }: { step: TourStep }) {
  const flight = ["flight", "conditions", "run", "results"].includes(step);
  return (
    <svg className="guided-picture" viewBox="0 0 280 52" aria-hidden="true">
      {flight ? (
        <>
          <path
            d="M15 44 Q110 -25 245 44"
            fill="none"
            stroke="#50667e"
            strokeDasharray="4 4"
          />
          <g className="guided-flight-dot">
            <path d="M-8 0 L5 -4 L1 0 L5 4 Z" fill="#9ed4ff" />
          </g>
          <path d="M8 46 H272" stroke="#697c63" />
        </>
      ) : (
        <>
          <rect x="8" y="8" width="42" height="36" rx="3" fill="#303a46" />
          {[16, 25, 34].map((y) => (
            <path key={y} d={`M16 ${y} H40`} stroke="#91b8df" />
          ))}
          <path
            d="M70 27 L95 17 H211 L226 8 L220 25 L226 44 L210 36 H95 Z"
            fill="#303e4b"
            stroke="#96c3ec"
          />
          <rect
            className="guided-part-glow"
            x={
              step === "pick" || step === "attach" || step === "added"
                ? 162
                : 101
            }
            y="17"
            width="45"
            height="19"
            fill="#3f7baf"
            stroke="#b5dcff"
          />
          <path
            d="M240 10 H272 M240 19 H266 M240 28 H272 M240 37 H260"
            stroke="#7b9bb8"
          />
          <path
            className="guided-demo-cursor"
            d="M0 0 L2 13 L6 9 L11 13 L14 10 L9 6 L13 3 Z"
            fill="#ecf6ff"
          />
        </>
      )}
    </svg>
  );
}
