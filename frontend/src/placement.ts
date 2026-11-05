import type { Component } from "./contracts";
export const AIRFRAME = new Set(["NoseCone", "BodyTube", "Transition"]);
/** Convert an insertion boundary into the final sibling index after removal. */
export function reorderDelta(
  parent: Component,
  sourceId: string,
  targetId: string,
  after: boolean,
) {
  const from = parent.children.findIndex((c) => c.id === sourceId);
  const target = parent.children.findIndex((c) => c.id === targetId);
  if (from < 0 || target < 0) return 0;
  let insertion = target + (after ? 1 : 0);
  if (from < insertion) insertion--;
  return insertion - from;
}
export function airframeMove(
  parent: Component,
  source: Component,
  delta: number,
) {
  const others = parent.children.filter(
    (c) => c.id !== source.id && AIRFRAME.has(c.type),
  );
  const centre = (source.locations[0]?.[0] || 0) + source.length / 2 + delta;
  const next = others.find(
    (c) => (c.locations[0]?.[0] || 0) + c.length / 2 > centre,
  );
  if (next) return reorderDelta(parent, source.id, next.id, false);
  return others.length
    ? reorderDelta(parent, source.id, others[others.length - 1].id, true)
    : 0;
}
export function suggestedTubeRadius(parent: Component) {
  for (const c of [...parent.children].reverse()) {
    const radius =
      c.shape.outerRadius || c.shape.baseRadius || c.shape.aftRadius;
    if (radius > 0) return radius;
  }
  return 0.025;
}
