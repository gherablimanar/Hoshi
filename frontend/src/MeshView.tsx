import { useRef, useEffect, useState } from "react";
import { api } from "./api";
interface Mesh {
  vertices: number[][];
  faces: number[][];
  warnings: string[];
  groups: string[];
}
export function MeshView({
  id,
  revision,
  rear,
}: {
  id: string;
  revision: number;
  rear: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    [mesh, setMesh] = useState<Mesh | null>(null),
    [error, setError] = useState(""),
    [angle, setAngle] = useState({ yaw: 0.65, pitch: 0.2 }),
    [zoom, setZoom] = useState(1),
    [warning, setWarning] = useState("");
  const drag = useRef<{
    x: number;
    y: number;
    yaw: number;
    pitch: number;
  } | null>(null);
  useEffect(() => {
    let live = true;
    setMesh(null);
    setError("");
    api<Mesh>(`/projects/${id}/mesh`)
      .then((m) => {
        if (live) {
          setMesh(m);
          setWarning(m.warnings.join(" · "));
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [id, revision]);
  useEffect(() => {
    const c = ref.current;
    if (!c || !mesh) return;
    const draw = () => {
      const ratio = devicePixelRatio || 1;
      const w = c.clientWidth,
        h = c.clientHeight;
      c.width = w * ratio;
      c.height = h * ratio;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.clearRect(0, 0, w, h);
      if (!mesh.vertices.length) return;
      const min = [0, 1, 2].map((k) =>
          Math.min(...mesh.vertices.map((v) => v[k])),
        ),
        max = [0, 1, 2].map((k) => Math.max(...mesh.vertices.map((v) => v[k]))),
        center = min.map((v, k) => (v + max[k]) / 2);
      const scale =
        (Math.min(w * 0.75, h * 0.75) /
          Math.max(...max.map((v, k) => v - min[k]))) *
        zoom;
      const yaw = rear ? 0 : angle.yaw,
        pitch = rear ? Math.PI / 2 : angle.pitch;
      const points = mesh.vertices.map((v) => {
        const x = v[0] - center[0],
          y = v[1] - center[1],
          z = v[2] - center[2];
        const a = x * Math.cos(yaw) - z * Math.sin(yaw),
          b = x * Math.sin(yaw) + z * Math.cos(yaw),
          p = y * Math.cos(pitch) - b * Math.sin(pitch),
          depth = y * Math.sin(pitch) + b * Math.cos(pitch);
        return [w / 2 + p * scale, h / 2 - a * scale, depth];
      });
      const faces = mesh.faces
        .map((f, i) => ({
          f,
          i,
          z: f.reduce((a, k) => a + points[k][2], 0) / f.length,
        }))
        .sort((a, b) => a.z - b.z);
      for (const { f } of faces) {
        const a = points[f[0]],
          b = points[f[1]],
          d = points[f[2]];
        const normal =
          (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
        ctx.beginPath();
        f.forEach((k, i) =>
          i
            ? ctx.lineTo(points[k][0], points[k][1])
            : ctx.moveTo(points[k][0], points[k][1]),
        );
        ctx.closePath();
        ctx.fillStyle = normal > 0 ? "#a8bfdc" : "#cfdded";
        ctx.fill();
        ctx.strokeStyle = "#758fae50";
        ctx.lineWidth = 0.3;
        ctx.stroke();
      }
    };
    draw();
    const resize = new ResizeObserver(draw);
    resize.observe(c);
    return () => resize.disconnect();
  }, [mesh, angle, zoom, rear]);
  return (
    <div className="mesh-view">
      <canvas
        ref={ref}
        role="img"
        aria-label={
          rear
            ? "Upstream mesh rear view"
            : "Upstream mesh three dimensional view"
        }
        onWheel={(e) =>
          setZoom((z) =>
            Math.max(0.2, Math.min(5, z * (e.deltaY > 0 ? 0.9 : 1.1))),
          )
        }
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, ...angle };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current && !rear)
            setAngle({
              yaw: drag.current.yaw + (e.clientX - drag.current.x) * 0.01,
              pitch: drag.current.pitch + (e.clientY - drag.current.y) * 0.01,
            });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      />
      {!mesh && (
        <p>{error || "Generating geometry with OpenRocket OBJ exporter…"}</p>
      )}
      <small>
        {warning ||
          "Core OBJ geometry · meters · drag to orbit / scroll to zoom · select components in tree"}
      </small>
      <button
        onClick={() => {
          setZoom(1);
          setAngle({ yaw: 0.65, pitch: 0.2 });
        }}
      >
        Reset view
      </button>
    </div>
  );
}
