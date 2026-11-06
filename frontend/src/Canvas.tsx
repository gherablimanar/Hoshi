import { useState, useRef, useEffect } from "react";
import { ASSEMBLY_TYPES } from "./ComponentProperties";
import { AIRFRAME } from "./placement";
import type { Project, Component } from "./contracts";
export const flatten = (c: Component): Component[] => [
  c,
  ...c.children.flatMap(flatten),
];
export function Canvas({
  project,
  selected,
  onSelect,
  onMove,
  busy,
}: {
  project: Project;
  selected: string;
  onSelect: (id: string) => void;
  onMove: (id: string, distance: number) => Promise<void>;
  busy: boolean;
}) {
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const svg = useRef<SVGSVGElement>(null);
  const partDrag = useRef<{
    id: string;
    startX: number;
    unitPerPixel: number;
    delta: number;
    pixels: number;
  } | null>(null);
  const [moving, setMoving] = useState<{ id: string; delta: number } | null>(
    null,
  );
  function cancelDrag() {
    partDrag.current = null;
    drag.current = null;
    setMoving(null);
  }
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && partDrag.current) {
        e.preventDefault();
        cancelDrag();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
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
  }, [project.id, project.revision]);
  useEffect(() => {
    const fit = () => {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    window.addEventListener("scene-fit", fit);
    return () => window.removeEventListener("scene-fit", fit);
  }, []);
  const nodes = flatten(project.rocket);
  const current = nodes.find((c) => c.id === selected);
  const movingRoot = moving && nodes.find((c) => c.id === moving.id);
  const movingIds = new Set(
    movingRoot ? flatten(movingRoot).map((c) => c.id) : [],
  );
  const assembly = current && ASSEMBLY_TYPES.has(current.type) ? current : null;
  const parts = nodes.filter(
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
        data-component-id={c.id}
        transform={
          movingIds.has(c.id)
            ? `translate(${(moving?.delta || 0) * scale},0)`
            : undefined
        }
        onPointerDown={(e) => {
          if (e.button !== 0 || busy || !svg.current) return;
          if (
            !AIRFRAME.has(c.type) &&
            !c.properties.some((p) => p.key === "axialOffset")
          )
            return;
          e.preventDefault();
          e.stopPropagation();
          onSelect(c.id);
          const width = svg.current.getBoundingClientRect().width;
          partDrag.current = {
            id: c.id,
            startX: e.clientX,
            unitPerPixel: 1000 / width / zoom / scale,
            delta: 0,
            pixels: 0,
          };
          svg.current.setPointerCapture(e.pointerId);
        }}
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
        {selected === c.id && (
          <>
            <rect
              className="selection-outline"
              x={x - 6}
              y={y - Math.max(r, s.height ? s.height * scale + r : r) - 6}
              width={
                Math.max(l, s.rootChord ? s.rootChord * scale : l, 12) + 12
              }
              height={2 * Math.max(r, s.height ? s.height * scale + r : r) + 12}
            />
          </>
        )}
        <title>
          {c.name} · {c.type} · {(c.length * 1000).toFixed(1)} mm
        </title>
      </g>
    );
  }
  return (
    <section className="assembly">
      <div className="canvas-top">
        <span className="side-view-label">2D SIDE VIEW</span>
        <span className="muted">ASSEMBLY / REV {project.revision}</span>
      </div>
      {assembly && (
        <div className="assembly-context" role="status">
          <strong>{assembly.name}</strong> ·{" "}
          {assembly.children.length
            ? "Assembly container — select a physical part to edit its shape."
            : "Empty assembly container — add physical parts using Add Component in the hierarchy."}
        </div>
      )}
      {!parts.length ? (
        <div className="canvas-empty">
          <div className="empty-rocket">↟</div>
          <h2>Your rocket needs physical parts.</h2>
          <p>
            Use Add Component below the hierarchy on the left.
            <br />
            Start with a nose cone and a body tube, then add fins and recovery.
          </p>
          <small>OpenRocket 24.12 · authoritative simulation engine</small>
        </div>
      ) : (
        <svg
          ref={svg}
          className="rocket-canvas"
          viewBox={`0 0 1000 ${viewHeight}`}
          role="img"
          aria-label="Rocket assembly, two dimensional side view"
          onWheel={(e) => {
            if (partDrag.current) return;
            setZoom((z) =>
              Math.min(5, Math.max(0.25, z * (e.deltaY > 0 ? 0.9 : 1.1))),
            );
          }}
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
            if (partDrag.current) {
              const d = partDrag.current;
              d.pixels = e.clientX - d.startX;
              d.delta = d.pixels * d.unitPerPixel;
              if (e.shiftKey) d.delta = Math.round(d.delta * 1000) / 1000;
              if (Math.abs(d.pixels) >= 4)
                setMoving({ id: d.id, delta: d.delta });
              else setMoving(null);
              return;
            }
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
          onPointerUp={async (e) => {
            const d = partDrag.current;
            partDrag.current = null;
            drag.current = null;
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
            if (d && Math.abs(d.pixels) >= 4) {
              try {
                await onMove(d.id, d.delta);
              } finally {
                setMoving(null);
              }
            } else setMoving(null);
          }}
          onPointerCancel={cancelDrag}
          onLostPointerCapture={() => {
            if (partDrag.current) cancelDrag();
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
          {moving
            ? `${moving.delta >= 0 ? "+" : ""}${(moving.delta * 1000).toFixed(1)} mm · Release to ${movingRoot && AIRFRAME.has(movingRoot.type) ? "reorder airframe" : "apply position"} · Esc cancels`
            : "Drag parts left/right to move · drag background to pan · scroll to zoom"}{" "}
          <span className="drawing-note">
            · schematic, not a manufacturing drawing
          </span>
        </span>
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
      </div>
    </section>
  );
}
