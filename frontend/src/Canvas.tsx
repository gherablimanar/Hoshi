import { useState, useRef, useEffect } from "react";
import { MeshView } from "./MeshView";
import type { Project, Component } from "./contracts";
export const flatten = (c: Component): Component[] => [
  c,
  ...c.children.flatMap(flatten),
];
export function Canvas({
  project,
  selected,
  onSelect,
  onExample,
}: {
  project: Project;
  selected: string;
  onSelect: (id: string) => void;
  onExample: () => void;
}) {
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [view, setView] = useState("side");
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const svg = useRef<SVGSVGElement>(null);
  const [viewHeight, setViewHeight] = useState(460);
  useEffect(() => {
    if (!svg.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width && entry.contentRect.height)
        setViewHeight(
          (1000 * entry.contentRect.height) / entry.contentRect.width,
        );
    });
    observer.observe(svg.current);
    return () => observer.disconnect();
  }, [view, project.id, project.revision]);
  useEffect(() => {
    const fit = () => {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    window.addEventListener("scene-fit", fit);
    return () => window.removeEventListener("scene-fit", fit);
  }, []);
  const parts = flatten(project.rocket).filter(
    (c) =>
      !["Rocket", "AxialStage", "ParallelStage", "PodSet"].includes(c.type),
  );
  const length = Math.max(0.2, project.quantities.length);
  const span = Math.max(
    0.02,
    ...parts.map(
      (c) =>
        Math.abs(c.locations[0]?.[1] || 0) +
        (c.shape.height || 0) +
        (c.shape.outerRadius || c.shape.baseRadius || 0.0125),
    ),
  );
  const scale = Math.min(
    760 / length,
    Math.max(40, viewHeight - 110) / (2 * span),
  );
  const cx = (1000 - length * scale) / 2 + pan.x,
    cy = viewHeight / 2 - 12 + pan.y;
  const marker = Math.min(72, Math.max(32, viewHeight / 2 - 38));
  const dimension = Math.max(marker + 26, viewHeight / 2 - 28);
  function shape(c: Component, i: number) {
    const s = c.shape,
      x = (c.locations[i]?.[0] || 0) * scale,
      y = (c.locations[i]?.[1] || 0) * scale,
      l = c.length * scale,
      r = (s.outerRadius || s.baseRadius || s.aftRadius || 0.003) * scale;
    let node;
    if (c.type === "NoseCone")
      node = (
        <path
          d={`M ${x},${y} Q ${x + l * 0.55},${y - r} ${x + l},${y - r} L ${x + l},${y + r} Q ${x + l * 0.55},${y + r} ${x},${y} Z`}
        />
      );
    else if (c.type === "Transition")
      node = (
        <path
          d={`M${x},${y - (s.foreRadius || 0) * scale} L${x + l},${y - (s.aftRadius || 0) * scale} L${x + l},${y + (s.aftRadius || 0) * scale} L${x},${y + (s.foreRadius || 0) * scale} Z`}
        />
      );
    else if (c.type.includes("FinSet")) {
      const h = (s.height || 0.025) * scale,
        root = (s.rootChord || c.length) * scale,
        tip = (s.tipChord || 0.015) * scale,
        sw = (s.sweep || 0) * scale;
      const parent = parts.find((p) => p.id === c.parentId),
        pr = (parent?.shape.outerRadius || 0.0125) * scale;
      let points = c.finPoints
        ?.map((p) => `${x + p[0] * scale},${y - pr - p[1] * scale}`)
        .join(" ");
      if (c.type === "EllipticalFinSet")
        node = (
          <path
            d={`M${x},${y - pr} Q${x + root / 2},${y - pr - h * 2} ${x + root},${y - pr} Z`}
          />
        );
      else
        node = (
          <>
            <polygon
              points={
                points ||
                `${x},${y - pr} ${x + sw},${y - pr - h} ${x + sw + tip},${y - pr - h} ${x + root},${y - pr}`
              }
            />
            <polygon
              points={`${x},${y + pr} ${x + sw},${y + pr + h} ${x + sw + tip},${y + pr + h} ${x + root},${y + pr}`}
            />
          </>
        );
    } else
      node = (
        <rect
          x={x}
          y={y - r}
          width={Math.max(l, 2)}
          height={r * 2}
          rx={c.type === "Parachute" ? 3 : 0}
        />
      );
    return (
      <g
        key={`${c.id}-${i}`}
        className={`rocket-part ${selected === c.id ? "selected" : ""} ${["InnerTube", "TubeCoupler", "EngineBlock", "CenteringRing", "Bulkhead", "MassComponent", "ShockCord", "Parachute", "Streamer"].includes(c.type) ? "internal" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(c.id);
        }}
        tabIndex={0}
        role="button"
        aria-label={`Select ${c.name}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(c.id);
          }
        }}
      >
        {node}
        <title>
          {c.name} · {c.type} · {(c.length * 1000).toFixed(1)} mm
        </title>
      </g>
    );
  }
  return (
    <section className="assembly">
      <div className="canvas-top">
        <div className="view-tabs">
          <button
            className={view === "side" ? "active" : ""}
            onClick={() => setView("side")}
          >
            2D side
          </button>
          <button
            className={view === "rear" ? "active" : ""}
            onClick={() => setView("rear")}
          >
            Rear
          </button>
          <button
            className={view === "3d" ? "active" : ""}
            onClick={() => setView("3d")}
          >
            3D
          </button>
        </div>
        <span className="muted">ASSEMBLY / REV {project.revision}</span>
      </div>
      {view !== "side" ? (
        <MeshView
          id={project.id}
          revision={project.revision}
          rear={view === "rear"}
        />
      ) : !parts.length ? (
        <div className="canvas-empty">
          <div className="empty-rocket">↟</div>
          <h2>Your stage is ready. Add your first component.</h2>
          <p>
            Start with a nose cone and a body tube.
            <br />
            Select any part to edit it in the Inspector.
          </p>
          <button
            className="primary"
            aria-label="Add Component"
            onClick={onExample}
          >
            Add Component <span>↗</span>
          </button>
          <small>OpenRocket 24.12 · authoritative simulation engine</small>
        </div>
      ) : (
        <svg
          ref={svg}
          className="rocket-canvas"
          viewBox={`0 0 1000 ${viewHeight}`}
          role="img"
          aria-label="Rocket assembly, two dimensional side view"
          onWheel={(e) =>
            setZoom((z) =>
              Math.min(5, Math.max(0.25, z * (e.deltaY > 0 ? 0.9 : 1.1))),
            )
          }
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              drag.current = {
                x: e.clientX,
                y: e.clientY,
                px: pan.x,
                py: pan.y,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            }
          }}
          onPointerMove={(e) => {
            if (drag.current) {
              const rect = e.currentTarget.getBoundingClientRect();
              setPan({
                x:
                  drag.current.px +
                  ((e.clientX - drag.current.x) * 1000) / rect.width,
                y:
                  drag.current.py +
                  ((e.clientY - drag.current.y) * viewHeight) / rect.height,
              });
            }
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          <g transform={`translate(${cx},${cy}) scale(${zoom})`}>
            <line
              x1={-50}
              x2={length * scale + 40}
              y1={0}
              y2={0}
              className="centerline"
            />
            {parts
              .filter((c) => !c.type.includes("FinSet"))
              .flatMap((c) => c.locations.map((_, i) => shape(c, i)))}
            {parts
              .filter((c) => c.type.includes("FinSet"))
              .flatMap((c) => c.locations.map((_, i) => shape(c, i)))}
            {project.quantities.loadedMass !== null &&
              project.quantities.loadedMass > 0 &&
              project.quantities.loadedCG !== null && (
                <g
                  transform={`translate(${project.quantities.loadedCG * scale},${-marker})`}
                >
                  <line y1={13} y2={marker - 10} className="cg-line" />
                  <circle r={9} className="cg-dot" />
                  <path d="M-9 0 H9 M0 -9 V9" stroke="white" />
                  <text y={-17} textAnchor="middle" className="cg-text">
                    CG
                  </text>
                </g>
              )}
            {project.quantities.cp !== null && (
              <g
                transform={`translate(${project.quantities.cp * scale},${marker})`}
              >
                <line y1={-marker + 10} y2={-14} className="cp-line" />
                <circle r={9} className="cp-dot" />
                <circle r={4} fill="var(--canvas)" />
                <text y={29} textAnchor="middle" className="cp-text">
                  CP · M 0.3
                </text>
              </g>
            )}
            <g className="dimension" transform={`translate(0,${dimension})`}>
              <line x1={0} x2={length * scale} y1={0} y2={0} />
              <line x1={0} x2={0} y1={-6} y2={6} />
              <line x1={length * scale} x2={length * scale} y1={-6} y2={6} />
              <text x={(length * scale) / 2} y={21} textAnchor="middle">
                {(project.quantities.length * 1000).toFixed(1)} mm
              </text>
            </g>
          </g>
        </svg>
      )}
      <div className="canvas-bottom">
        <span>
          ↔ Drag canvas to pan · scroll to zoom{" "}
          <span className="drawing-note">
            · schematic, not a manufacturing drawing
          </span>
        </span>
        {view === "side" && (
          <div className="zoom-controls">
            <button
              aria-label="Zoom out"
              onClick={() => setZoom((z) => Math.max(0.25, z / 1.2))}
            >
              −
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              aria-label="Zoom in"
              onClick={() => setZoom((z) => Math.min(5, z * 1.2))}
            >
              +
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
            >
              Fit
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
