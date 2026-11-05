import { useState } from "react";
import type { Component } from "./contracts";
import { flatten } from "./Canvas";
const labels: Record<string, string> = {
  AxialStage: "Stage (assembly container)",
  ParallelStage: "Side boosters",
  PodSet: "Pods",
  NoseCone: "Nose cone",
  BodyTube: "Body tube",
  Transition: "Transition",
  InnerTube: "Inner / motor tube",
  TubeCoupler: "Tube coupler",
  CenteringRing: "Centering ring",
  Bulkhead: "Bulkhead",
  EngineBlock: "Engine block",
  LaunchLug: "Launch lug",
  RailButton: "Rail button",
  MassComponent: "Extra mass",
  Parachute: "Parachute",
  Streamer: "Streamer",
  ShockCord: "Shock cord",
  TrapezoidFinSet: "Trapezoidal fins",
  EllipticalFinSet: "Elliptical fins",
  FreeformFinSet: "Freeform fins",
  TubeFinSet: "Tube fins",
};
const group = (t: string) =>
  t.includes("Fin")
    ? "Fins"
    : /Stage|Pod/.test(t)
      ? "Assemblies"
      : /Nose|Body|Transition/.test(t)
        ? "Airframe"
        : /Parachute|Streamer|Shock/.test(t)
          ? "Recovery"
          : "Internal & guides";
export function ComponentPicker({
  root,
  selected,
  types,
  busy,
  add,
}: {
  root: Component;
  selected: string;
  types: string[];
  busy: boolean;
  add: (type: string, parent: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("Airframe"),
    [part, setPart] = useState(""),
    [chosenParent, setChosenParent] = useState("");
  const nodes = flatten(root),
    current = nodes.find((c) => c.id === selected) || root;
  const candidates = (type: string) =>
    nodes.filter((n) => n.compatibleTypes.includes(type));
  function preferred(type: string) {
    let c: Component | undefined = current;
    while (c) {
      if (c.compatibleTypes.includes(type)) return c;
      c = nodes.find((n) => n.id === c?.parentId);
    }
    const available = candidates(type);
    return available.find((n) => n.type === "BodyTube") || available[0];
  }
  const parents = candidates(part),
    parentId = parents.some((p) => p.id === chosenParent)
      ? chosenParent
      : preferred(part)?.id;
  return (
    <div className="component-picker">
      <p>
        Choose a part. We find a compatible place in your rocket, and you can
        change the attachment before adding it.
      </p>
      <p className="helper">
        Start with a nose cone and a body tube. Stages and pods are containers,
        not solid rocket parts.
      </p>
      <input
        autoFocus
        className="search"
        aria-label="Search components"
        placeholder="Search fins, body tube, parachute…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPart("");
          setChosenParent("");
          setCategory("All");
        }}
      />
      <div className="picker-categories">
        {[
          "All",
          "Airframe",
          "Fins",
          "Recovery",
          "Internal & guides",
          "Assemblies",
        ].map((g) => (
          <button
            key={g}
            className={category === g ? "active" : ""}
            onClick={() => {
              setCategory(g);
              setPart("");
              setChosenParent("");
            }}
          >
            {g}
          </button>
        ))}
      </div>
      <div className="picker-list">
        {types
          .filter(
            (t) =>
              (labels[t] || t).toLowerCase().includes(query.toLowerCase()) &&
              (category === "All" || group(t) === category),
          )
          .map((t) => (
            <button
              key={t}
              className={part === t ? "selected" : ""}
              disabled={!candidates(t).length || busy}
              onClick={() => {
                setPart(t);
                setChosenParent(preferred(t)?.id || "");
              }}
            >
              <span>
                {t.includes("Fin") ? "◭" : t === "NoseCone" ? "◁" : "▯"}
              </span>
              <div>
                <strong>{labels[t] || t}</strong>
                <small>
                  {candidates(t).length
                    ? `Fits under ${preferred(t)?.name}`
                    : "Add a compatible airframe first"}
                </small>
                {/Stage|Pod/.test(t) && (
                  <small>Empty container · add physical parts inside</small>
                )}
              </div>
            </button>
          ))}
      </div>
      {part && (
        <div className="picker-confirm">
          {/Stage|Pod/.test(part) && (
            <p className="assembly-picker-note">
              This adds an assembly container. Its physical shape appears after
              you attach parts inside it.
            </p>
          )}
          <label>
            Attach to
            <select
              aria-label="Component attachment"
              value={parentId || ""}
              onChange={(e) => setChosenParent(e.target.value)}
            >
              {parents.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            disabled={!parentId || busy}
            onClick={() => parentId && add(part, parentId)}
          >
            Add {labels[part] || part}
          </button>
        </div>
      )}
    </div>
  );
}
