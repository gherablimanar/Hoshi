import { Fragment, useState } from "react";
import type { Component } from "./contracts";
import { flatten } from "./Canvas";
export type DropPosition = "before" | "after" | "inside";
export function Hierarchy({
  root,
  selected,
  busy,
  select,
  place,
}: {
  root: Component;
  selected: string;
  busy: boolean;
  select: (id: string) => void;
  place: (source: string, target: string, position: DropPosition) => void;
}) {
  const [dragged, setDragged] = useState("");
  const [over, setOver] = useState<{
    id: string;
    position: DropPosition;
  } | null>(null);
  const nodes = flatten(root);
  const source = nodes.find((n) => n.id === dragged);
  function position(
    c: Component,
    clientY: number,
    top: number,
    height: number,
  ): DropPosition | null {
    if (
      !source ||
      c.id === source.id ||
      flatten(source).some((n) => n.id === c.id)
    )
      return null;
    const fraction = (clientY - top) / height;
    if (
      fraction > 0.25 &&
      fraction < 0.75 &&
      c.compatibleTypes.includes(source.type)
    )
      return "inside";
    if (source.parentId && source.parentId === c.parentId)
      return fraction < 0.5 ? "before" : "after";
    return c.compatibleTypes.includes(source.type) ? "inside" : null;
  }
  function row(c: Component, depth: number): React.ReactNode {
    return (
      <Fragment key={c.id}>
        <button
          className={`tree-row ${selected === c.id ? "selected" : ""} ${over?.id === c.id ? "drop-" + over.position : ""} ${dragged === c.id ? "dragging-row" : ""}`}
          style={{ paddingLeft: 12 + depth * 13 }}
          data-component-id={c.id}
          onClick={() => select(c.id)}
          draggable={!!c.parentId && !busy}
          title={`${c.type}${c.parentId ? " · Drag to reorder or attach to a compatible parent" : ""}`}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("application/x-hoshi-component", c.id);
            setDragged(c.id);
            select(c.id);
          }}
          onDragOver={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const p = position(c, e.clientY, rect.top, rect.height);
            if (p && !busy) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setOver({ id: c.id, position: p });
            } else setOver(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const p = position(c, e.clientY, rect.top, rect.height);
            if (p && source && !busy) place(source.id, c.id, p);
            setDragged("");
            setOver(null);
          }}
          onDragEnd={() => {
            setDragged("");
            setOver(null);
          }}
        >
          <span className="tree-icon">
            {c.children.length
              ? "⌄"
              : c.type.includes("Fin")
                ? "◭"
                : c.type === "NoseCone"
                  ? "◁"
                  : "▯"}
          </span>
          <span>{c.name}</span>
          {["AxialStage", "ParallelStage", "PodSet"].includes(c.type) && (
            <small className="tree-container-label">
              {c.children.length ? "group" : "empty"}
            </small>
          )}
        </button>
        {c.children.map((child) => row(child, depth + 1))}
      </Fragment>
    );
  }
  return <>{row(root, 0)}</>;
}
