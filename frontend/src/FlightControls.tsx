import { useState, useEffect } from "react";
import type { Project } from "./contracts";
function FlightNumber({
  label,
  value,
  factor = 1,
  positive = false,
  nonnegative = false,
  disabled,
  save,
}: {
  label: string;
  value: number;
  factor?: number;
  positive?: boolean;
  nonnegative?: boolean;
  disabled: boolean;
  save: (n: number) => Promise<void>;
}) {
  const shown = Number((value * factor).toPrecision(10));
  const [draft, setDraft] = useState(String(shown)),
    [error, setError] = useState("");
  useEffect(() => {
    setDraft(String(shown));
  }, [shown, disabled]);
  return (
    <div className="flight-number">
      <label>
        {label}
        <input
          aria-label={label}
          type="number"
          step="any"
          disabled={disabled}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const n = Number(draft) / factor;
            if (
              !draft.trim() ||
              !Number.isFinite(n) ||
              (positive && n <= 0) ||
              (nonnegative && n < 0)
            ) {
              setError(
                `${label} must be ${positive ? "greater than zero" : nonnegative ? "zero or greater" : "a finite number"}. Change not applied; the saved value is ${shown}.`,
              );
              setDraft(String(shown));
              return;
            }
            setError("");
            if (n !== value) void save(n);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </label>
      {error && (
        <p className="error-inline" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function FlightControls({
  project,
  index,
  busy,
  mutate,
}: {
  project: Project;
  index: number;
  busy: boolean;
  mutate: (data: Record<string, unknown>) => Promise<void>;
}) {
  const sim = project.simulations[index];
  if (!sim) return null;
  const option = (key: string) => sim.options.find((p) => p.key === key);
  const fields: [string, string, string, number][] = [
    ["launchRodLength", "Launch guide length", "m", 1],
    ["launchRodAngle", "Guide tilt from vertical", "°", 180 / Math.PI],
    ["launchRodDirection", "Guide direction", "°", 180 / Math.PI],
    ["launchAltitude", "Site altitude", "m", 1],
    ["launchTemperature", "Air temperature", "K", 1],
    ["launchPressure", "Air pressure", "kPa", 0.001],
    ["maxSimulationTime", "Maximum flight duration", "s", 1],
    ["timeStep", "Solver time step", "s", 1],
  ];
  return (
    <details className="flight-controls" open>
      <summary>Flight controls</summary>
      <p>
        These inputs change the real engine calculation. Set the site and
        weather to your intended conditions.
      </p>
      {["ISAAtmosphere", "launchIntoWind"]
        .filter((key) => option(key))
        .map((key) => (
          <label key={key}>
            {key === "ISAAtmosphere"
              ? "Use standard atmosphere"
              : "Align launch guide into wind"}
            <input
              type="checkbox"
              checked={option(key)!.value === true}
              disabled={busy}
              onChange={(e) =>
                void mutate({
                  op: "settings",
                  simulationIndex: index,
                  changes: { [key]: e.target.checked },
                })
              }
            />
          </label>
        ))}
      {option("windModelType") && (
        <label>
          Wind model
          <select
            aria-label="Wind model"
            disabled={busy}
            value={String(option("windModelType")!.value)}
            onChange={(e) =>
              void mutate({
                op: "settings",
                simulationIndex: index,
                changes: { windModelType: e.target.value },
              })
            }
          >
            {option("windModelType")!.choices?.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      )}
      {fields
        .filter(([key]) => option(key))
        .map(([key, label, unit, factor]) => (
          <FlightNumber
            key={key}
            label={`${label} (${unit})`}
            value={Number(option(key)!.value)}
            factor={factor}
            positive={[
              "launchRodLength",
              "launchTemperature",
              "launchPressure",
              "maxSimulationTime",
              "timeStep",
            ].includes(key)}
            disabled={
              busy ||
              (["launchPressure", "launchTemperature"].includes(key) &&
                option("ISAAtmosphere")?.value === true) ||
              (key === "launchRodDirection" &&
                option("launchIntoWind")?.value === true)
            }
            save={(n) =>
              mutate({
                op: "settings",
                simulationIndex: index,
                changes: { [key]: n },
              })
            }
          />
        ))}
      {(["average", "standardDeviation", "direction"] as const).map((key) => (
        <FlightNumber
          key={key}
          label={
            key === "average"
              ? "Mean wind speed (m/s)"
              : key === "standardDeviation"
                ? "Wind variation (m/s)"
                : "Wind direction (°)"
          }
          value={sim.wind[key]}
          factor={key === "direction" ? 180 / Math.PI : 1}
          nonnegative={key !== "direction"}
          disabled={busy || option("windModelType")?.value === "MULTI_LEVEL"}
          save={(n) =>
            mutate({
              op: "settings",
              simulationIndex: index,
              wind: { [key]: n },
            })
          }
        />
      ))}
      <button
        disabled={busy || option("windModelType")?.value === "MULTI_LEVEL"}
        onClick={() =>
          mutate({
            op: "settings",
            simulationIndex: index,
            wind: { average: 0, standardDeviation: 0 },
          })
        }
      >
        Set calm wind
      </button>
      <small>
        Uncheck standard atmosphere for custom temperature and pressure. Disable
        guide-into-wind alignment to choose its direction. Multi-level wind
        profiles and other solver options are in advanced Flight settings.
      </small>
    </details>
  );
}
