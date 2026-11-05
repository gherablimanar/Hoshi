import { useRef } from "react";
export function PanelResize({
  label,
  value,
  min,
  max,
  onChange,
  vertical = false,
  reverse = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  vertical?: boolean;
  reverse?: boolean;
}) {
  const start = useRef<{ coordinate: number; value: number } | null>(null);
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div
      className={`panel-resize ${vertical ? "horizontal" : "vertical"}`}
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={vertical ? "horizontal" : "vertical"}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={(e) => {
        start.current = { coordinate: vertical ? e.clientY : e.clientX, value };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (start.current)
          onChange(
            clamp(
              start.current.value +
                ((vertical ? e.clientY : e.clientX) -
                  start.current.coordinate) *
                  (reverse ? -1 : 1),
            ),
          );
      }}
      onPointerUp={() => (start.current = null)}
      onLostPointerCapture={() => (start.current = null)}
      onKeyDown={(e) => {
        if (
          ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp"].includes(e.key)
        ) {
          e.preventDefault();
          onChange(
            clamp(
              value +
                (["ArrowRight", "ArrowDown"].includes(e.key) ? 10 : -10) *
                  (reverse ? -1 : 1),
            ),
          );
        }
      }}
    />
  );
}
