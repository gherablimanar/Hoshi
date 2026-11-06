import { useState, useEffect } from "react";
import type { Component, Property, Material } from "./contracts";
import { PROPERTY_HELP } from "./EditorHelp";
import { MATERIALS } from "./materials";
import { AIRFRAME } from "./placement";
const pretty = (s: string) =>
  s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (s) => s.toUpperCase());
export const ASSEMBLY_TYPES = new Set([
  "Rocket",
  "AxialStage",
  "ParallelStage",
  "PodSet",
]);
const GROUPS = [
  {
    title: "Dimensions & shape",
    hint: "Physical size, profile and wall construction.",
    open: true,
    keys: [
      "length",
      "outerDiameter",
      "outerRadius",
      "innerDiameter",
      "innerRadius",
      "baseDiameter",
      "baseRadius",
      "foreDiameter",
      "foreRadius",
      "aftDiameter",
      "aftRadius",
      "diameter",
      "radius",
      "thickness",
      "height",
      "rootChord",
      "tipChord",
      "sweep",
      "finCount",
      "cantAngle",
      "cantPivot",
      "crossSection",
      "shapeType",
      "shapeParameter",
      "filled",
      "clipped",
      "flipped",
      "area",
      "aspectRatio",
      "baseHeight",
      "flangeHeight",
      "screwHeight",
      "totalHeight",
      "packedLength",
      "packedRadius",
      "lineCount",
      "lineLength",
      "cordLength",
      "stripLength",
      "stripWidth",
    ],
  },
  {
    title: "Automatic sizing",
    hint: "Match neighbouring parts. Turn automatic sizing off to set a fixed radius.",
    keys: [
      "outerRadiusAutomatic",
      "innerRadiusAutomatic",
      "baseRadiusAutomatic",
      "foreRadiusAutomatic",
      "aftRadiusAutomatic",
      "radiusAutomatic",
    ],
  },
  {
    title: "Position & attachment",
    hint: "Placement inside the selected parent assembly.",
    open: true,
    keys: [
      "axialMethod",
      "axialOffset",
      "radialPosition",
      "radialDirection",
      "baseRotation",
      "radiusMethod",
      "radiusOffset",
      "angleMethod",
      "angleOffset",
      "angleSeparation",
      "instanceCount",
      "instanceSeparation",
    ],
  },
  {
    title: "Shoulders & fin tabs",
    hint: "Geometry of joints and through-the-wall fin tabs.",
    keys: [
      "shoulderLength",
      "shoulderRadius",
      "shoulderThickness",
      "shoulderCapped",
      "foreShoulderLength",
      "foreShoulderRadius",
      "foreShoulderThickness",
      "foreShoulderCapped",
      "aftShoulderLength",
      "aftShoulderRadius",
      "aftShoulderThickness",
      "aftShoulderCapped",
      "tabHeight",
      "tabLength",
      "tabOffset",
      "tabOffsetMethod",
      "filletRadius",
      "sweepAngle",
    ],
  },
  {
    title: "Mass & balance",
    hint: "Use measured values to override calculated mass or balance. Enable the corresponding override first.",
    keys: [
      "mass",
      "componentMass",
      "density",
      "massOverridden",
      "overrideMass",
      "subcomponentsOverriddenMass",
      "CGOverridden",
      "overrideCGX",
      "subcomponentsOverriddenCG",
    ],
  },
  {
    title: "Surface & aerodynamics",
    hint: "Surface finish and aerodynamic assumptions used by OpenRocket.",
    keys: [
      "finish",
      "perfectFinish",
      "CD",
      "CDAutomatic",
      "CDOverridden",
      "overrideCD",
      "subcomponentsOverriddenCD",
      "customReferenceLength",
    ],
  },
  {
    title: "Motor mount & cluster spacing",
    hint: "Mount geometry; assign an actual motor with Choose motor below.",
    keys: [
      "motorMount",
      "motorOverhang",
      "clusterScale",
      "clusterScaleAbsolute",
      "clusterRotation",
    ],
  },
  {
    title: "Notes",
    hint: "Notes retained in your exported design.",
    keys: ["comment"],
  },
];
function MaterialSettings({
  material,
  busy,
  apply,
}: {
  material: Material;
  busy: boolean;
  apply: (name: string, density: number) => void;
}) {
  const [name, setName] = useState(material.name);
  const [density, setDensity] = useState(String(material.density));
  const [choice, setChoice] = useState("");
  useEffect(() => {
    setName(material.name);
    setDensity(String(material.density));
    setChoice("");
  }, [material.name, material.density, material.type]);
  const materials = MATERIALS.filter((m) => m.type === material.type);
  const unit =
    material.type === "SURFACE"
      ? "kg/m²"
      : material.type === "LINE"
        ? "kg/m"
        : "kg/m³";
  const valid =
    !!name.trim() && Number.isFinite(Number(density)) && Number(density) > 0;
  const changed =
    name !== material.name || Number(density) !== material.density;
  return (
    <details key="material" open className="property-group material-settings">
      <summary>Material & density</summary>
      <p className="group-hint">
        Current: <strong>{material.name}</strong> · {material.density} {unit}
      </p>
      <label className="stacked-field">
        Material library
        <select
          aria-label="Material library"
          disabled={busy}
          value={choice}
          onChange={(e) => {
            setChoice(e.target.value);
            const m = materials.find((m) => m.name === e.target.value);
            if (m) {
              setName(m.name);
              setDensity(String(m.density));
            }
          }}
        >
          <option value="">Custom / current material</option>
          {[...new Set(materials.map((m) => m.group))].map((g) => (
            <optgroup key={g} label={g}>
              {materials
                .filter((m) => m.group === g)
                .map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="stacked-field">
        Material name
        <input
          aria-label="Material name"
          disabled={busy}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setChoice("");
          }}
        />
      </label>
      <label className="stacked-field">
        Density ({unit})
        <input
          aria-label={`Material density (${unit})`}
          type="number"
          min="0"
          step="any"
          disabled={busy}
          value={density}
          onChange={(e) => {
            setDensity(e.target.value);
            setChoice("");
          }}
        />
      </label>
      <button
        className="primary"
        disabled={busy || !valid || !changed}
        onClick={() => apply(name.trim(), Number(density))}
      >
        Apply material
      </button>
      <p className="group-hint">
        OpenRocket 24.12 library defaults. Density changes calculated mass and
        inertia. Use measured density for your actual material.
      </p>
      {!valid && (
        <p className="error-inline">
          Enter a material name and a positive density.
        </p>
      )}
    </details>
  );
}
export function ComponentProperties({
  component,
  busy,
  change,
  applyMaterial,
  repairTube,
}: {
  component: Component;
  busy: boolean;
  change: (key: string, value: unknown) => void;
  applyMaterial: (name: string, density: number) => void;
  repairTube: () => void;
}) {
  const [query, setQuery] = useState("");
  const fields = [...component.properties];
  for (const prefix of ["outer", "inner", "base", "fore", "aft"]) {
    const radius = fields.find(
      (p) => p.key === prefix + "Radius" && p.type === "number",
    );
    if (radius && !fields.some((p) => p.key === prefix + "Diameter"))
      fields.push({
        ...radius,
        key: prefix + "Diameter",
        value: Number(radius.value) * 2,
      });
  }
  function applyProperty(key: string, value: unknown) {
    if (
      key.endsWith("Diameter") &&
      !component.properties.some((p) => p.key === key)
    )
      change(key.replace("Diameter", "Radius"), Number(value) / 2);
    else change(key, value);
  }
  const name = fields.find((p) => p.key === "name");
  const assembly = ASSEMBLY_TYPES.has(component.type);
  const matches = (p: Property, title: string) =>
    (pretty(p.key) + " " + title + " " + (PROPERTY_HELP[p.key] || ""))
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  const materialSettings = component.material &&
    (!query ||
      /material|density/.test(query.toLowerCase()) ||
      component.material.name.toLowerCase().includes(query.toLowerCase())) && (
      <MaterialSettings
        key="material"
        material={component.material}
        busy={busy}
        apply={applyMaterial}
      />
    );
  return (
    <div className="component-properties">
      <nav className="inspector-shortcuts" aria-label="Inspector sections">
        {["Dimensions", "Material", "Position", "Mass"].map((label) => (
          <button
            key={label}
            onClick={(e) => {
              const root = e.currentTarget.closest(".component-properties")!;
              const target = Array.from(root.querySelectorAll("details")).find(
                (d) => d.querySelector("summary")?.textContent?.includes(label),
              );
              if (target) {
                target.open = true;
                target.scrollIntoView({ block: "start" });
              }
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {component.type === "BodyTube" && !(component.shape.outerRadius > 0) && (
        <div className="zero-diameter-warning">
          <strong>This tube has zero outer diameter.</strong>
          <p>
            It will appear as a line and have no mass. Set a positive diameter
            below, or start with 50 mm outside diameter and a 2 mm wall.
          </p>
          <button disabled={busy} onClick={repairTube}>
            Use 50 mm tube dimensions
          </button>
        </div>
      )}
      {assembly && (
        <p className="assembly-explanation">
          <strong>
            {component.type === "Rocket"
              ? "Rocket assembly"
              : "Assembly container"}
          </strong>
          This groups physical parts; it has no material or solid shape of its
          own.
          {component.children.length
            ? " Select one of its parts to edit dimensions and materials."
            : " It is empty. Use Add Component in the hierarchy to attach a nose cone, body tube or other part."}
        </p>
      )}
      {!assembly && (
        <div className="part-readout">
          <span>
            Engine mass{" "}
            <b>
              {component.mass == null
                ? "—"
                : (component.mass * 1000).toLocaleString("en", {
                    maximumFractionDigits: 2,
                  })}{" "}
              g
            </b>
          </span>
          <span>
            Length{" "}
            <b>
              {(component.length * 1000).toLocaleString("en", {
                maximumFractionDigits: 2,
              })}{" "}
              mm
            </b>
          </span>
        </div>
      )}
      {name && (
        <UnitField
          p={name}
          disabled={busy}
          onChange={(v) => change("name", v)}
        />
      )}
      <input
        className="search property-search"
        aria-label="Search component settings"
        placeholder="Find a setting: diameter, mass, finish…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {GROUPS.map((group, index) => {
        const visible = group.keys.flatMap((key) =>
          fields.filter(
            (p) =>
              p.key === key &&
              !(key === "density" && component.material) &&
              matches(p, group.title),
          ),
        );
        const section = visible.length ? (
          <details
            className="property-group"
            key={group.title + (query ? "-search" : "")}
            open={query ? true : group.open}
          >
            <summary>
              {group.title}
              <small>{visible.length}</small>
            </summary>
            <p className="group-hint">
              {group.title === "Position & attachment" &&
              AIRFRAME.has(component.type)
                ? "Airframe positions follow assembly order. Drag parts in the scene or reorder hierarchy rows to move them. Their axial reference and offset are read-only."
                : group.hint}
            </p>
            {visible.map((p) => (
              <UnitField
                key={p.key}
                p={p}
                disabled={
                  busy ||
                  (AIRFRAME.has(component.type) &&
                    ["axialMethod", "axialOffset"].includes(p.key))
                }
                onChange={(v) => applyProperty(p.key, v)}
              />
            ))}
          </details>
        ) : null;
        return [section, index === 0 ? materialSettings : null];
      })}
      {query &&
        !fields.some((p) => matches(p, "")) &&
        !/material|density/.test(query.toLowerCase()) && (
          <p className="helper">No matching settings for this component.</p>
        )}
    </div>
  );
}
export function UnitField({
  p,
  onChange,
  disabled = false,
}: {
  p: Property;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const unit =
    p.unit === "m"
      ? "mm"
      : p.unit === "kg"
        ? "g"
        : p.unit === "rad"
          ? "°"
          : p.unit;
  const factor =
    p.unit === "m" || p.unit === "kg"
      ? 1000
      : p.unit === "rad"
        ? 180 / Math.PI
        : 1;
  const value =
    typeof p.value === "number"
      ? Number((p.value * factor).toPrecision(10))
      : p.value;
  return (
    <label className="field">
      <span
        title={
          PROPERTY_HELP[p.key] ||
          `Engine setting: ${pretty(p.key)}. Values apply to the selected component or simulation.`
        }
      >
        {pretty(p.key)}{" "}
        <span className="field-help" aria-hidden="true">
          ⓘ
        </span>
      </span>
      {p.type === "boolean" ? (
        <input
          type="checkbox"
          checked={p.value === true}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
      ) : p.type === "enum" ? (
        <select
          aria-label={pretty(p.key)}
          value={String(p.value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          {p.choices?.map((c) => (
            <option key={c} value={c}>
              {p.key === "axialMethod"
                ? (
                    {
                      ABSOLUTE: "From rocket front",
                      AFTER: "After previous component",
                      TOP: "From parent front",
                      MIDDLE: "From parent middle",
                      BOTTOM: "From parent rear",
                    } as Record<string, string>
                  )[c] || c
                : c}
            </option>
          ))}
        </select>
      ) : (
        <div className="unit-input">
          <input
            aria-label={pretty(p.key)}
            key={String(value)}
            defaultValue={String(value ?? "")}
            disabled={disabled}
            type={p.type === "number" ? "number" : "text"}
            step="any"
            onBlur={(e) => {
              const v =
                p.type === "number"
                  ? Number(e.target.value) / factor
                  : e.target.value;
              if (v !== p.value && e.target.value.trim() !== "") onChange(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          {unit && <small>{unit}</small>}
        </div>
      )}
    </label>
  );
}
