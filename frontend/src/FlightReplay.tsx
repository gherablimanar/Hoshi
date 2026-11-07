import { useState, useMemo, useEffect, useRef } from "react";
import type { Branch } from "./contracts";
import { recordedAttitude } from "./flightAttitude";
export function FlightReplay({
  branch,
  status,
}: {
  branch?: Branch;
  status: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [clock, setClock] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1);
  const data = useMemo(() => {
    const t = branch?.variables.find((v) => v.key === "t"),
      h = branch?.variables.find((v) => v.key === "h"),
      east = branch?.variables.find((v) => v.key === "Px");
    const samples =
      t?.values.flatMap((v, i) =>
        v !== null &&
        Number.isFinite(v) &&
        h?.values[i] != null &&
        Number.isFinite(h.values[i]) &&
        (!east || (east.values[i] != null && Number.isFinite(east.values[i])))
          ? [
              {
                t: v,
                h: h.values[i]!,
                x:
                  east?.values[i] != null && Number.isFinite(east.values[i])
                    ? east.values[i]!
                    : 0,
                i,
              },
            ]
          : [],
      ) || [];
    return { samples, east: !!east };
  }, [branch]);
  const geometry = useMemo(() => {
    const pts = data.samples,
      actualMin = pts.reduce((n, p) => Math.min(n, p.x), 0),
      actualMax = pts.reduce((n, p) => Math.max(n, p.x), 0),
      minX =
        actualMax - actualMin < 1
          ? (actualMin + actualMax) / 2 - 0.5
          : actualMin,
      maxX =
        actualMax - actualMin < 1
          ? (actualMin + actualMax) / 2 + 0.5
          : actualMax,
      maxH = pts.reduce((n, p) => Math.max(n, p.h), 1),
      minH = pts.reduce((n, p) => Math.min(n, p.h), 0);
    const x = (v: number) => 45 + ((v - minX) / (maxX - minX)) * 600,
      y = (v: number) => 210 - ((v - minH) / (maxH - minH)) * 175;
    return {
      x,
      y,
      path: pts
        .map(
          (p, i) =>
            `${i && p.i === pts[i - 1].i + 1 ? "L" : "M"}${x(p.x)},${y(p.h)}`,
        )
        .join(" "),
    };
  }, [data]);
  const last = data.samples.at(-1)?.t || 0;
  useEffect(() => {
    if (!playing || !last) return;
    const w = ref.current?.ownerDocument.defaultView || window;
    let id = 0,
      previous = w.performance.now();
    const tick = (now: number) => {
      const delta = ((now - previous) / 1000) * speed;
      previous = now;
      setClock((t) => {
        const n = Math.min(last, t + delta);
        return n;
      });
      id = w.requestAnimationFrame(tick);
    };
    id = w.requestAnimationFrame(tick);
    return () => w.cancelAnimationFrame(id);
  }, [playing, speed, last]);
  useEffect(() => {
    if (clock >= last && playing) setPlaying(false);
  }, [clock, last, playing]);
  if (!data.samples.length)
    return (
      <div className="replay-empty">
        No recorded trajectory samples are available for this branch. No flight
        animation is fabricated.
      </div>
    );
  const points = data.samples,
    { x, y } = geometry;
  let low = 0,
    high = points.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].t <= clock) low = mid + 1;
    else high = mid;
  }
  const idx = Math.max(0, low - 1);
  const sample = points[idx];
  const attitude = recordedAttitude(branch, sample.i, sample.t);
  const variable = (key: string) =>
    branch?.variables.find((v) => v.key === key)?.values[sample.i];
  const number = (n: number | null | undefined) =>
    n == null ? "—" : n.toLocaleString("en", { maximumFractionDigits: 2 });
  return (
    <section className="flight-replay">
      <header>
        <h2>Recorded rocket flight</h2>
        <small>
          {status} ·{" "}
          {data.east
            ? "east / altitude projection"
            : "vertical projection; no east-position series"}
        </small>
      </header>
      <svg
        ref={ref}
        viewBox="0 0 700 250"
        role="img"
        aria-label="Rocket position on recorded flight trajectory"
      >
        <line x1="40" x2="665" y1={y(0)} y2={y(0)} stroke="#68775e" />
        <path d={geometry.path} fill="none" stroke="#526e88" strokeWidth="2" />
        <g
          transform={`translate(${x(sample.x)},${y(sample.h)}) rotate(${attitude.angle ?? 0})`}
        >
          <title>{attitude.explanation}</title>
          {attitude.angle === null ? (
            <circle r="6" fill="#dce8f5" stroke="#77b5f0" />
          ) : (
            <path
              d="M0 -14 L5 7 L8 12 L0 9 L-8 12 L-5 7 Z"
              fill="#dce8f5"
              stroke="#77b5f0"
            />
          )}
        </g>
        <text x="45" y="242" fill="#aabacc">
          Horizontal position [m] → · altitude above launch site [m] ↑
        </text>
      </svg>
      <div className="replay-readout">
        <span>
          Time <b>{number(sample.t)} s</b>
        </span>
        <span>
          Altitude <b>{number(sample.h)} m</b>
        </span>
        <span>
          Total speed <b>{number(variable("Vt"))} m/s</b>
        </span>
        <span>
          Total acceleration <b>{number(variable("At"))} m/s²</b>
        </span>
      </div>
      <input
        type="range"
        aria-label="Recorded flight time"
        min="0"
        max={last || 1}
        step="any"
        value={Math.min(clock, last)}
        onChange={(e) => {
          setPlaying(false);
          setClock(Number(e.target.value));
        }}
      />
      <div className="replay-controls">
        <button
          disabled={!last}
          onClick={() => {
            if (clock >= last) setClock(0);
            setPlaying(!playing);
          }}
        >
          {playing ? "Pause recorded flight" : "Play recorded flight"}
        </button>
        <button
          onClick={() => {
            setPlaying(false);
            setClock(0);
          }}
        >
          Reset playback
        </button>
        <label>
          Playback speed
          <select
            aria-label="Playback speed"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            {[0.25, 1, 2, 5, 10].map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
      </div>
      <p>
        {attitude.explanation} Recorded samples only; this is a model
        prediction, not measured flight footage. Playback cannot change an
        outcome or extend an incomplete flight.
      </p>
    </section>
  );
}
