import type { SimulationRun } from "./contracts";

export function PhysicsReview({ run }: { run: SimulationRun }) {
  const options = run.options || [];
  const value = (key: string) => options.find((p) => p.key === key)?.value;
  const sim =
    run.simulationIndex == null
      ? undefined
      : run.configurationSnapshot?.simulations?.[run.simulationIndex];
  const wind =
    value("windModelType") === "MULTI_LEVEL" ? sim?.windLevels : sim?.wind;
  const turbulent =
    value("windModelType") === "MULTI_LEVEL"
      ? sim?.windLevels?.some((l) => l.standardDeviation > 0)
      : sim?.wind?.standardDeviation != null
        ? sim.wind.standardDeviation > 0
        : undefined;
  return (
    <details className="physics-review">
      <summary>Physics, recorded conditions and model limits</summary>
      <p>
        These are the inputs saved with this run, not the current editor
        settings. OpenRocket uses a six degree of freedom rigid-body flight
        model with engineering aerodynamic estimates, motor thrust curves and
        changing mass. Recovery and tumbling switch to approximate drag models
        with their own adaptive Euler steps; the time-step control applies to
        free flight.
      </p>
      <dl>
        <dt>Engine / solver</dt>
        <dd>
          OpenRocket {run.engine.version} · {run.engine.solver}
        </dd>
        <dt>Engine commit</dt>
        <dd>{run.engine.commit}</dd>
        <dt>Recorded configuration SHA-256</dt>
        <dd>{run.configurationHash || "Unavailable in this record"}</dd>
      </dl>
      <table>
        <caption>Saved simulation inputs (SI unless a unit is shown)</caption>
        <thead>
          <tr>
            <th>Input</th>
            <th>Value</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody>
          {options.map((p) => (
            <tr key={p.key}>
              <th scope="row">{p.key}</th>
              <td>{String(p.value)}</td>
              <td>{p.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Recorded wind</h3>
      {wind ? (
        <pre>
          {JSON.stringify(
            {
              model: value("windModelType"),
              altitudeReference: sim?.windAltitudeReference,
              inputs: wind,
            },
            null,
            2,
          )}
        </pre>
      ) : (
        <p>
          Wind inputs are unavailable in this record. Do not assume calm
          conditions.
        </p>
      )}
      <p>
        {turbulent === true
          ? "Turbulence is enabled. One trajectory is one stochastic realization, not a dispersion envelope. Repeat runs across measured conditions; identical simulation seeds do not fully control the bundled wind generator."
          : turbulent === false
            ? "Wind variation is zero. This is a steady-wind calculation; it does not represent gust dispersion."
            : "Wind variation could not be determined from this record."}
      </p>
      <h3>Before using this prediction for engineering</h3>
      <ul>
        <li>
          Enter the actual launch coordinates, elevation, pressure, temperature
          and wind profile. Standard atmosphere and calm wind are assumptions,
          not weather observations.
        </li>
        <li>
          Measure assembled mass and center of gravity; check dimensions,
          surface finish, motor curve and recovery drag against the hardware.
        </li>
        <li>
          Repeat with a smaller solver time step and compare apogee, speed,
          acceleration and event times. For a controlled comparison, disable
          turbulent variation in both runs. Then study mass, drag, motor and
          weather uncertainty separately.
        </li>
        <li>
          Validate against instrumented flights. Numerical agreement with
          OpenRocket checks this adapter; it does not establish agreement with a
          real rocket.
        </li>
      </ul>
      <p>
        The model does not solve structural failure, fin flutter, heating,
        combustion faults, parachute inflation or line dynamics. Aerodynamic
        estimates have geometry and flight-regime limits; high angle of attack
        and tumbling need particular care. A completed run does not certify a
        launch.
      </p>
      <a
        href="https://github.com/gherablimanar/Hoshi/blob/main/docs/physics-validation.md"
        target="_blank"
        rel="noreferrer"
      >
        Physics implementation and verification evidence
      </a>
    </details>
  );
}
