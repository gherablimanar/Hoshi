# Architecture and engineering boundaries

## Modules and state

React/TypeScript in `frontend/` renders the technical workspace: tree/library on the left, central assembly, properties and AI on the right, results below. `contracts.ts` defines Project, Component, Material, MotorReference, FlightConfiguration, SimulationSettings, SimulationJob, SimulationRun, FlightEvent, Warning, AnalysisRequest, OptimizationRequest and AIProposedPatch. The UI contains display/unit conversion, drawing projection and chart/cursor logic. It does not compute thrust, mass, CP, aerodynamic coefficients, stability or trajectory dynamics.

`rocket.Engine` is the explicit adapter around pinned OpenRocket model/reader/writer APIs. Registered concrete component classes and an explicit scalar property allowlist form the edit boundary; no arbitrary class names or method names from the client are executed. Specialized adapters cover fin points, materials, presets, configurations, wind levels, recovery, ignition and stage separation. Public upstream methods are used; protected implementation details are not rewritten.

`rocket.Server` supplies the same-origin HTTP API and static frontend. `rocket.Store` owns append-only `.ork` revisions, atomic current pointers and immutable terminal result files. `rocket.Jobs` owns one bounded worker (16 pending slots) and lifecycle states. `rocket.Advanced` calls the core aerodynamic analysis and optimization classes. `rocket.Exports` calls the pinned OBJ/SVG/RockSim/RASAero exporters. `rocket.MotorImports` uses the actual RASP/RockSim motor parsers and preserves imported-file provenance. `rocket.Assistant` is an optional server-only provider adapter.

Canonical state is a serialized core project with stable component UUIDs and monotonically increasing server revision. Geometry edits, motor changes, settings and accepted AI/optimization patches all create revisions. Every mutation requires the observed revision; stale writes receive 409. Undo/redo restores an earlier immutable file as a **new** revision. Browser undo/redo stacks are transient; saved project files and run references survive reload. Theme/selection are transient UI concerns and do not change engineering state.

## Core startup and isolation

`OpenRocketCore.initialize()` installs the pinned CoreModule/PluginModule and starts its translator/preferences/databases. The application waits for motor-database access before serving. Swing modules are not on the classpath. Full core dependencies are built from verified source because a placeholder Maven coordinate from documentation is not a published artifact contract.

Core operations are conservatively serialized on `Engine.LOCK`. Each job loads a fresh document from immutable snapshot bytes; no mutable rocket is shared across projects/jobs. HTTP job-state reads do not wait for the core lock. Optimization's upstream function cache has one evaluation worker, and the actual upstream optimizer duplicates its simulation/rocket for evaluations. A single process is required; this filesystem store is not a multi-process database.

Some upstream automatic-radius geometry getters mutate lazy dimensions. Regression testing found that collecting inspector metadata on the live simulation document changes recovery CG. Engineering quantities are measured before drawing metadata, drawing uses an isolated tree, and run-provenance inspection uses a separately loaded document, never the simulation document. The six-case regression retains the original reference tolerances and checks the problematic dual-recovery case.

## Simulation and provenance

Flight uses upstream `Simulation.simulate`, BasicEventSimulationEngine and the 6-DOF RK4 model. No alternate vertical point-mass approximation exists. Job state is pending/running/terminal; progress is indeterminate because no justified percentage is available. Cancellation is checked per flight step; wall-clock flight time is bounded to 120 seconds. Queued cancellations persist a terminal record without flight samples. Terminal job visibility follows record persistence to prevent a poll/read race.

A flight result contains engine commit/version, component database revision, bundled/imported motor provenance, design revision/hash, configuration ID/hash and snapshot, original serialized project, numerical options, simulation seed, units, start/end/status, all sampled variables/branches and real warning/event data. No prior run is overwritten. Old-revision results are visibly marked. Failed/aborted results are never converted into a success animation. Exception paths retain partial core FlightData when the engine makes it available; otherwise there are no returned samples. Exhaustive partial-result coverage remains a parity limitation.

The pinned `.ork` saver does not persist simulation random seeds. The adapter retains them in an OpenRocket-compatible XML comment (`RocketDesignerSeeds`) and restores them on its own reads; desktop OpenRocket may ignore that extension comment. Wind-model RNG seeds are not public upstream API fields. Deterministic fixtures set mean/deviation zero. Do not claim bitwise cross-platform equality or turbulent reproducibility.

Optimization uses actual MaximumAltitude/Velocity/Acceleration, time/deployment/landing/stability objective classes, upstream goals, StabilityDomain and GoldenSectionSearchOptimizer (one continuous parameter) or MultidirectionalSearchOptimizer (multiple). It retains evaluations, bounds, objective and candidate before/after values. Limits are 30 iterations/120 seconds, not a convergence guarantee. A result is a proposal until an explicit revision-guarded acceptance creates a project revision. No optimized project replaces the current project automatically.

## AI action boundaries

Provider configuration is server-only (`AI_API_KEY`, `AI_MODEL`, optional HTTPS `AI_ENDPOINT`). The implemented Chat Completions function-tool shape was checked against the OpenAI Node SDK's current `src/resources/chat/completions/completions.ts` on 2026-11-02, as well as a pinned older SDK shape. No SDK-specific method name or model is invented. Provider availability still requires an account, credential, model and network access; no live credential was available during this implementation.

Allowlisted tools: read_design, read_run, compare_runs, propose_patch, request_simulation, answer. Run reads are scoped to the current project. Numeric result citations supply runId/quantity references; the server resolves values/units from immutable runs instead of trusting model-supplied engineering numbers. Generated prose is general explanation/hypotheses, not solver evidence. Imported notes/names are explicitly untrusted data. Arbitrary model text is rendered as text, never executable HTML.

Proposals require the user's per-request proposal opt-in, validation against a fresh core document, stable IDs, before/after values and base revision/hash. Proposal creation does not mutate. Accepting a patch is a separate endpoint/user action with a stale guard and normal undoable revision. A simulation request is a confirmation object, not a launched job; the user separately accepts it. Explanation-only requests cannot write or launch through provider tools. Failures do not modify project/history. Stub-provider tests validate the protocol and boundaries, not live model quality or complete natural-language grounding.

## Imports and distribution

Project import uses the actual core reader after a bounded XML/archive preflight. DTD/entities and executable extensions/listeners are rejected; safe embedded archive attachments are retained in memory. Plain/gzip OpenRocket XML and ZIP containing rocket.ork and bounded embedded attachments are accepted. Original import bytes remain recoverable. Loader warnings are surfaced and gate conversion/export acceptance. Textured rendering and exhaustive unknown-content handling remain explicit compatibility work.

Deploy one local Java server with static assets and persistent data. The example systemd unit binds loopback. No accounts, collaboration layer, remote deployment or public publishing is introduced. Distribution must retain GPL and separate database/library notices plus corresponding source; `scripts/package-source.sh` includes the pinned upstream source and component database.
