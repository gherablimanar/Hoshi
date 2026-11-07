# Verified implementation evidence

This is scoped evidence for the current Linux x86-64 environment, not a full-parity declaration or a new-task restoration claim. All selected final checks below completed with zero failures and zero skips.

| Check | Final outcome | Evidence |
|---|---|---|
| Installation/build | `scripts/setup.sh` executed successfully, including pinned source/submodule checks, Java install distribution, npm ci and production UI build | Delivered scripts, dependency locks; local setup log `/tmp/hoshi-setup.log` |
| Java adapter/component tests | 44 passed | `backend/build/test-results/test/`, `backend/build/reports/tests/test/` |
| Unmodified upstream tests | 30 passed in a separate JVM | `backend/build/test-results/upstreamTest/`; events, stage activeness, clusters/pods, FlightData, simulation conditions and document Simulation |
| Numerical reference cases | 6 cases, 8 flight branches, 596 numerical comparisons, 143,013 sample values | `tests/reference.json`, `tests/comparison-results.json`, `tests/provenance.json` |
| Numerical differences | Maximum observed absolute difference 0 on this toolchain; tolerances declared before comparison | `tests/tolerances.json`; absolute/relative differences retained, no tolerance widening |
| Wall-clock telemetry | 8 computation-time series checked for sample/unit structure and finite nonnegative monotonic elapsed time, not numerical equality | Source: upstream SimulationStatus writes System.nanoTime elapsed seconds; exception recorded in tolerances and comparison results |
| HTTP integration | 21 assertions passed | `tests/api-smoke.py`, `tests/api-results.json` |
| Chromium editor/physics regressions | 19 passed, 0 flaky/skipped, desktop and 390px viewport | `frontend/e2e/`, `tests/browser-results.json`, `tests/desktop.png`, `tests/mobile.png` |
| Protected Pages browser journeys | 2 passed; /Hoshi/ subpath, password rejection/reconnect, real flight, authenticated downloads and offline feedback | `frontend/hosted-e2e/pages.spec.ts`, `tests/hosted-browser-results.json` |
| AI boundary tests | Passed with explicit in-process provider stub | AssistantTest: configured protocol and server-resolved citations; unconfigured 503; proposal validation/acceptance/stale rejection/undo |
| Live AI | Not verified | Neither AI_API_KEY nor AI_MODEL was supplied. No canned response is displayed as live AI. |
| Distribution | Source packaging script exercised; no public deployment | `build/rocket-designer-source.tar.gz`, `notices/`, `scripts/package-source.sh` |

The numerical fixtures are unmodified upstream example files: a simple rocket with three motor configurations, a three-stage rocket, a clustered-motor example and dual parachute deployment. Conditions retain fixture settings except deterministic seed=24012 and zero mean/deviation wind. Existing mass/CG/CP, metric, warning and event references were checked unchanged when full sample vectors were added.

Component inventory tests cover all 21 registered native families: compatible parent addition, native save/load, stable UUID/class/name/comment/hierarchy and editable metadata presence. This does not verify every specialized property combination. Source-only Sleeve is excluded from the palette because the pinned .ork reader has no constructor registration for it.

HTTP assertions cover actual archive import/reopen, byte-identical embedded decals, dimension edit and stale/invalid rejection, real flight/apogee, selectable CSV/event context, genuine no-motor failure, malformed/DTD rejection, Host/Origin rejection and engineering operation without AI. No fabricated flight values are used.

Chromium covers the first-visit walkthrough and searchable help, the project launcher without automatic project creation, blank/example opening, compatible-parent component creation, dimension edits with Enter, keyboard duplicate/undo, real launch/plots/events, persistence through the Recent projects flow, portable export, panel resizing and dark desktop/narrow layouts without document overflow. Component regression journeys additionally verify the single Add button, removed view controls, visible selected nose/body geometry, real diameter/radius and length persistence, material-dependent mass, measured mass overrides, explicit empty stages, and surface/line material units. Mouse journeys reproduce two tubes followed by a nose, verify positive tube geometry and nose-first defaults, scene/hierarchy reordering, native axial fin movement, one write on release, Escape/click cancellation, compatible reparenting and cycle rejection, reload persistence, legacy zero-diameter repair and Undo/Redo. Advanced journeys cover aerodynamic analysis and explicit optimization acceptance followed by undo. Core mesh generation remains covered by backend tests; its editor views were removed at the user’s request. Protected Pages journeys also check the separate-engine connection, incorrect passwords, reconnect after refresh, authenticated ORK/CSV downloads, no password in browser storage, and explicit offline errors. Browser runtime errors are checked in the primary editor and hosted journeys.

The current API has been stopped and restarted through `scripts/start.sh` with retained projects to validate startup and recovery. Live processes are not assumed to survive environment snapshots. Reusable `install_script` and `start_skill` were saved as an environment draft; publication remains a user action in environment settings. No public application publication was performed.

Remaining work is retained in `docs/openrocket-parity.md`: exhaustive specialized geometry/material/override/configuration combinations, exact side drawing, graphical fin editing, textured rendering, complete desktop printing/export options and lossless interchange capability coverage, full analysis/optimization objective/constraint parity, statistical turbulent numerical compatibility, interrupted-process job recovery, desktop extension equivalence and the real-provider AI comparison journey. These are not represented as completed.

Editor 0.4 browser regression verifies all ten tutorial chapters, absence of scene name labels and results in Design workspace, genuine motor assignment from an initially unconfigured project, creation of a matching simulation, guarded job submission, completed example flights and saved results in the separate Flight Simulation view.

Editor 0.5 adds actual popup tests for shared connection/authentication, native settings dialogs in the child window, persistent wind and custom atmosphere changes, rejected invalid duration input, visible oversize-motor rejection, recorded playback controls and historical-revision notices. A real zero-diameter engine project is blocked before job submission and its exact part is selected for repair. A native 100 kg mass-override case produces an actual no-lift-off abort and grounded repair guidance; no successful samples are substituted. The protected hosted browser journey also runs a flight in the separate window without a second password prompt, then verifies authenticated downloads and reconnection. Backend/core code and numerical baselines are unchanged.


Editor 0.6 retains the unchanged pinned core and all 596 numerical reference
comparisons (plus eight telemetry checks). The adapter suite now has 44 passing
checks and the separate upstream suite has 30. Three additional free-flight
step sizes across three WGS84/custom-atmosphere/steady-wind fixture scenarios
are retained in `tests/physics-step-study.json` as sensitivity diagnostics, not
blanket convergence or physical-validation evidence. Native angular-step changes
are discarded by the pinned file format; the editor makes that option read-only.
There are 17 editor/physics regressions and two protected hosted journeys, including
real recorded theta/phi units, body orientation independent of velocity, neutral
markers after recovery/tumble/ground events, launch coordinate/Earth-model
persistence and authenticated complete run-record downloads. See
`docs/physics-validation.md` for assumptions, observed sensitivity and the missing
experimental validation required before expert engineering reliance.


Editor 0.7 replaces the modal slideshow with an interactive spotlight walkthrough
shown after a successful engine connection. It highlights actual controls and
waits for real selection, saved dimension edits, component creation, engine jobs
and authenticated native export. Practice starts from an independent example;
existing projects are not changed automatically. Dimension and material steps
can retain current values, a flight can be skipped explicitly, and Escape/Skip
ends the guide. Help restarts the lesson in the current editor.

The walkthrough follows native modal dialogs in the browser top layer, switches
mobile panes, moves the spotlight smoothly, displays animated illustrative
rocket/click diagrams and respects prefers-reduced-motion. Its focus cycle
includes the real highlighted controls and the guide. New desktop and 390 px
Chromium journeys cover the full engine-backed lesson and mobile pane selection,
viewport fit, reduced motion, Escape, replay and keyboard focus. The complete
suite has 19 editor/physics/walkthrough checks plus two protected Pages journeys.
No backend or upstream physics code changed in this release.
