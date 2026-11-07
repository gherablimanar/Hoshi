# Physics model, evidence and engineering use

Hoshi Editor 0.6 uses the unmodified OpenRocket 24.12 core, pinned to
`133b558de556f0282f51c3f53f3b3fc633b4310a`. It does not implement a second flight
solver in JavaScript. The backend loads a saved native `.ork` snapshot and calls
`Simulation.simulate()`; browser playback displays the returned samples.

## What is calculated

Free flight uses OpenRocket's six degree of freedom rigid-body equations and
Runge–Kutta stepping. The native model includes engineering aerodynamic force and
moment estimates, motor thrust curves, changing mass/inertia, atmosphere, gravity,
wind, launch-guide constraints, staging and deployment events. These are model
predictions: a drawn material's nominal density is not a measured assembled mass,
and an aerodynamic estimate is not a wind-tunnel measurement.

The default Earth strategy in existing projects is SPHERICAL. The Flight controls
now expose FLAT, SPHERICAL and WGS84 without silently replacing a project's setting.
SPHERICAL and WGS84 calculate Coriolis acceleration; FLAT omits it. Native gravity
uses WGSGravityModel. Latitude/longitude are decimal degrees, elevation is metres
above sea level, pressure is Pa (shown as kPa), temperature is K, and recorded
angles are radians. WGS84 changes Earth geometry; it does not make other uncertain
inputs accurate.

Standard atmosphere is an idealized atmosphere. When it is unchecked, native
ExtendedISAModel uses the entered launch altitude, temperature and pressure.
Neither choice retrieves actual weather. Average and multi-level wind use the
native wind models. The simulation seed does not fully control their internal
random generators; nonzero turbulence requires repeated statistical studies.

Recovery uses BasicLandingStepper, which estimates translational motion from
recovery-device drag. Tumbling uses BasicTumbleStepper's empirical drag estimate.
Both use AbstractEulerStepper rather than the free-flight attitude integrator.
Neither resolves fabric inflation, suspension lines, swinging, or body rotation.
Their adaptive Euler step selection starts from 0.5 s and is limited by
acceleration and events, independently of the free-flight RK4 time-step setting.
Halving that setting therefore does not establish recovery-phase convergence.
Structural failure, fin flutter, thermal failure and motor malfunction are not
solved by this integration. Read the native warnings and abort events, especially
for unusual geometry, high angles of attack or flight regimes outside the
engineering aerodynamic model's applicability.

## What the picture means

In free flight, the icon's body axis is the solver's recorded orientation, not its
velocity direction. In `SimulationStatus`, rotating the body Z axis by the native
quaternion produces a unit vector; theta (`Θ`) is elevation from horizontal and
phi (`Φ`) is heading clockwise from north. Thus east = cos(theta) sin(phi) and up =
sin(theta). The east/up projection angle is atan2(east, up), independent of graph
axis scaling. It is a calculated attitude, not a measured attitude.

From a branch's recovery deployment, tumble or ground-hit event onward, playback
shows a neutral position marker: stale attitude samples from those models must
not imply physically integrated orientation. Missing/nonfinite/wrong-unit attitude
or an axis pointing entirely out of the east/up plane also produces a neutral
marker. Paths are projections with independently scaled axes, not a 3D rendering;
gaps are not filled with invented samples.

## Reproduce and review a prediction

Every run retains the engine commit, original project bytes, design/configuration
SHA-256 hashes, selected simulation, recorded options, wind inputs, variables,
events and warnings. The expandable physics review uses that immutable run record,
not later editor settings. **Run record** downloads the JSON, including the original
base64 `.ork` input; **CSV** exports the samples. Preserve both, along with measured
hardware and weather data. The server uses temporary storage on the free host.

For a controlled numerical sensitivity study, create a second simulation in
Flight settings, enter identical physical inputs and set wind deviation to
zero in both copies. Halve the solver time step, run both, and compare apogee,
maximum speed/acceleration and event times in Compare/Events. The pinned native
format does not serialize the maximum angular step; after a
save/load it uses the native default of 3 degrees. The editor therefore shows
that option read-only rather than pretending an edit is retained. Time-step
refinement measures integration sensitivity; it does not eliminate aerodynamic,
thrust, mass, deployment or weather uncertainty. Restore realistic wind inputs
and perform a separate uncertainty study rather than treating a steady-wind run
as a flight envelope.

## Verification performed

Run `./scripts/test.sh` after setup. Existing immutable reference cases and
tolerances were not regenerated or relaxed for Editor 0.6.

- Six fixtures/configurations and eight branches compare geometry/mass/CG/CP,
  event/summary metrics and full numeric sample vectors against direct calls to
  the pinned upstream loader and solver. See `tests/reference.json`,
  `tests/comparison-results.json`, `tests/provenance.json` and `tests/tolerances.json`.
- Unmodified upstream tests run separately from adapter tests. This checks
  implementation compatibility with the selected upstream core, not independent
  experimental agreement.
- `PhysicsVerificationTest` checks native save/load of WGS84, site coordinates,
  custom atmosphere, steady wind and time steps, and explicitly checks the native
  angular-step reset. It records three-step diagnostics at 0.05, 0.025 and 0.0125 s for simple, multistage and dual-recovery
  fixtures in `tests/physics-step-study.json`. These additional conditions use
  1500 m elevation, 295 K, 84000 Pa and steady 3 m/s wind. They are test scenarios,
  not recommended weather or the user's measured launch conditions. Differences
  are retained without an invented universal pass threshold or claim of
  convergence for every output.
- Frontend regressions test the orientation transform, descent without false
  flipping, unavailable/out-of-plane data, and recovery/tumble/ground transitions.
  Chromium runs a native flight and verifies the saved site/Earth/step inputs,
  orientation units, neutral recovery marker and historical conditions display.

The recorded additional-condition study is not evidence that every quantity is
step-converged. For example, the multistage peak acceleration changes from about
120.90 to 132.58 m/s² when the step changes from 0.05 to 0.025 s, then to 131.91
m/s² at 0.0125 s. Dual-recovery total flight time changes from 63.04 to 61.13 s
between the last two steps, even though its apogee changes by only about 0.007 m.
Inspect event/branch histories and recovery dynamics before accepting derived
limits or landing predictions. These observed differences are retained rather
than hidden by a broad tolerance or a blanket accuracy claim.

No measured flight dataset has been supplied. **This application has numerical
verification evidence, but is not experimentally validated or certified for expert
engineering decisions.** Establish flight-data comparisons and application-specific
acceptance criteria before relying on its predictions. Compare measured apogee,
velocity/time histories, deployment times and drift over multiple flights; report
sensor uncertainty and residuals. A single match or a successful simulation does
not establish model validity across rocket types, motors, wind or speed regimes.

## Source trail

Pinned native files under `.upstream/openrocket/core/src/main/java/info/openrocket/core/`:

- `simulation/SimulationOptions.java`: atmosphere, gravity, site and step settings.
- `simulation/BasicEventSimulationEngine.java`: native stepper transitions/events.
- `simulation/RK4SimulationStepper.java`: free-flight quaternion integration.
- `simulation/SimulationStatus.java`: recorded theta/phi definitions.
- `simulation/AbstractEulerStepper.java`, `BasicLandingStepper.java`,
  `BasicTumbleStepper.java`: simplified recovery/tumble models.
- `util/GeodeticComputationStrategy.java`: Earth geometry/Coriolis strategies.

Adapter and presentation: `backend/src/main/java/rocket/Jobs.java`,
`frontend/src/flightAttitude.ts`, `FlightReplay.tsx`, `FlightControls.tsx` and
`PhysicsReview.tsx`. Further capability gaps are tracked in `docs/openrocket-parity.md`.
