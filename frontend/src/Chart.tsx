import { useState } from "react";
import type { Variable, FlightEvent } from "./contracts";
export function Chart({
  time,
  variable,
  compare,
  events = [],
  color = "#3578d8",
}: {
  time?: Variable;
  variable?: Variable;
  compare?: { time: Variable; variable: Variable };
  events?: FlightEvent[];
  color?: string;
}) {
  const [cursor, setCursor] = useState<number | null>(null);
  if (!time || !variable || !time.values.length)
    return <div className="chart-empty">No computed samples</div>;
  const vals = [...variable.values, ...(compare?.variable.values || [])].filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  const min = Math.min(0, ...vals),
    max = Math.max(1, ...vals),
    end = Math.max(
      1,
      ...time.values.filter((v): v is number => v !== null),
      ...(compare?.time.values.filter((v): v is number => v !== null) || []),
    );
  const W = 460,
    H = 152,
    L = 48,
    R = 12,
    T = 15,
    B = 28;
  const xx = (v: number) => L + (v / end) * (W - L - R),
    yy = (v: number) => H - B - ((v - min) / (max - min || 1)) * (H - T - B);
  const path = (t: Variable, v: Variable) => {
    let gap = true;
    return t.values
      .map((x, i) => {
        const y = v.values[i];
        if (x === null || y === null || !Number.isFinite(y)) {
          gap = true;
          return "";
        }
        const command = gap ? "M" : "L";
        gap = false;
        return `${command}${xx(x).toFixed(2)},${yy(y).toFixed(2)}`;
      })
      .join(" ");
  };
  const index =
    cursor === null
      ? 0
      : time.values.reduce<number>(
          (best, v, i) =>
            v !== null &&
            Math.abs(v - cursor) < Math.abs((time.values[best] || 0) - cursor)
              ? i
              : best,
          0,
        );
  return (
    <div className="chart">
      <div className="chart-label">
        <span>
          {variable.name} <small>{variable.unit}</small>
        </span>
        <span>
          {cursor !== null
            ? `${(time.values[index] || 0).toFixed(2)} s · ${variable.values[index]?.toFixed(2) ?? "—"} ${variable.unit}`
            : ""}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${variable.name} versus time`}
        onPointerMove={(e) => {
          const b = e.currentTarget.getBoundingClientRect();
          setCursor(
            Math.max(
              0,
              Math.min(
                end,
                ((((e.clientX - b.left) / b.width) * W - L) / (W - L - R)) *
                  end,
              ),
            ),
          );
        }}
        onPointerLeave={() => setCursor(null)}
      >
        {[0, 1, 2, 3].map((i) => {
          const v = min + ((max - min) * i) / 3;
          return (
            <g key={i}>
              <line
                x1={L}
                x2={W - R}
                y1={yy(v)}
                y2={yy(v)}
                className="chart-grid"
              />
              <text x={L - 7} y={yy(v) + 3} textAnchor="end">
                {v.toFixed(Math.abs(v) > 10 ? 0 : 1)}
              </text>
            </g>
          );
        })}
        {[0, 1, 2, 3, 4].map((i) => (
          <text key={i} x={xx((end * i) / 4)} y={H - 8} textAnchor="middle">
            {((end * i) / 4).toFixed(1)}
          </text>
        ))}
        {events
          .filter((e) =>
            [
              "BURNOUT",
              "APOGEE",
              "RECOVERY_DEVICE_DEPLOYMENT",
              "STAGE_SEPARATION",
            ].includes(e.type),
          )
          .map((e, i) => (
            <line
              key={i}
              x1={xx(e.time)}
              x2={xx(e.time)}
              y1={T}
              y2={H - B}
              className="event-line"
            >
              <title>
                {e.type} at {e.time.toFixed(3)} s
              </title>
            </line>
          ))}
        {compare && (
          <path
            d={path(compare.time, compare.variable)}
            fill="none"
            stroke="#a590ce"
            strokeWidth="1.6"
            strokeDasharray="5 3"
          />
        )}
        <path
          d={path(time, variable)}
          fill="none"
          stroke={color}
          strokeWidth="2"
        />
        {cursor !== null && (
          <line
            x1={xx(time.values[index] || 0)}
            x2={xx(time.values[index] || 0)}
            y1={T}
            y2={H - B}
            stroke={color}
            strokeDasharray="3 3"
          />
        )}
        <text x={W - 10} y={H - 8} textAnchor="end">
          s
        </text>
      </svg>
    </div>
  );
}
