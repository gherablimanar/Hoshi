# HTTP API and schema conventions

Same-origin JSON API; no authentication in the single-user loopback deployment. `Server.java` is the executable route contract; browser DTOs are in `frontend/src/contracts.ts`. Errors use `{ "error": { "code": "…", "message": "…" } }`; conversion errors may additionally include `warnings`. Invalid input is 422, stale revisions 409, unavailable AI 503, unknown records 404. Unhandled adapter errors return 500 and never a fake success.

Mutation example (SI):

```json
{"revision":3,"op":"set","componentId":"uuid","changes":{"length":0.31}}
```

Successful edits return the complete new Project including its incremented revision/hash, canonical tree, warnings, options and computed quantities. A mutation is applied to a freshly loaded in-memory document; failures do not write a project revision. Clients must refresh after 409 and resolve their intended change against current state. There is no automatic stale-merge.

| Method / path | Behavior |
|---|---|
| GET `/api/health` | Engine version/commit and safe AI configuration status; never credentials |
| GET `/api/catalog` | Registered component types |
| GET `/api/examples` | Allowlisted pinned upstream example filenames |
| GET `/api/projects` | Saved project IDs/names/revisions |
| POST `/api/projects` | `{name}` empty project or `{example}` real example; 201 Project |
| POST `/api/import` | Raw OpenRocket `.ork`/XML bytes, bounded; 201 Project with import warnings |
| GET `/api/projects/{id}` | Current Project |
| POST `/api/projects/{id}/mutate` | Guarded mutation, body includes revision and op |
| POST `/api/projects/{id}/restore` | `{revision,targetRevision}` creates a new revision from history |
| POST `/api/projects/{id}/validate` | Current core geometry warnings and quantities; no write |
| GET `/api/projects/{id}/export` | Native project download; blocked until import warnings accepted |
| GET `/api/projects/{id}/original` | Exact original imported bytes when retained |
| GET `/api/motors?q=&diameter=` | Up to 100 real motor records; diameter is meters |
| GET `/api/motors/{digest}` | Actual thrust samples, metadata, source and SI units |
| POST `/api/motors/import` | Raw `.eng`/`.rse`, X-Filename URL-encoded filename; <=1 MiB/100 motors; preserves data by hash |
| GET `/api/presets?type=&q=` | Actual pinned component template metadata, <=100 |
| POST `/api/projects/{id}/jobs` | `{revision,simulationIndex}` → 202 SimulationJob; immutable project snapshot |
| GET `/api/jobs/{id}` | Lifecycle, revision, indeterminate progress, errors, optional evaluation count |
| POST `/api/jobs/{id}/cancel` | Request cooperative cancellation; queued cancellation has no fabricated samples |
| GET `/api/projects/{id}/runs` | Immutable flight/analysis/optimization records; `kind` distinguishes workflows |
| GET `/api/runs/{id}` | Complete terminal record, provenance, outputs/events/variables |
| GET `/api/runs/{id}/csv` | All sampled variables with SI units, branch/events and run context |
| POST `/api/projects/{id}/analysis` | `{revision,kind:analysis|sweep|optimization,…}` → asynchronous job |
| POST `/api/projects/{id}/acceptOptimization` | `{revision,runId}` accepts a completed same-revision/hash proposal |
| GET `/api/projects/{id}/mesh` | Core OBJ-derived vertices/faces/groups/warnings, meters |
| GET `/api/projects/{id}/obj?componentId=` | Actual OBJ; optional selected subtree; warnings require explicit acceptance |
| GET `/api/projects/{id}/finSvg?componentId=` | Core planar fin SVG |
| GET `/api/projects/{id}/interchange?format=rocksim|rasaero` | Inspect conversion warnings; add download=true and acceptWarnings=true to accept/download |
| POST `/api/projects/{id}/ai` | `{revision,message,selectedComponentId,selectedRunId,allowProposals,allowSimulationRequests}` → live structured response or explicit unavailable error |
| POST `/api/projects/{id}/acceptPatch` | `{revision,proposalId}` validates source hash/revision, creates undoable revision |

## Mutations

`set` changes allowlisted scalar properties only. Property metadata contains `key`, actual `value`, scalar `type`, `unit` and enum `choices`; only metadata returned for that class should be edited. `add` requires type and compatible parentId; incompatible parents reject with feedback. Other operations: remove, duplicate, paste, move (delta sibling index), reparent; material (native material type, density); appearance (RGB paint/shine, existing texture retained); preset; finPoints (meters, 3–128 points); configuration/selectConfiguration; motor (componentId/motorId/ejection delay/optional ignition); cluster; stageEnabled; separation; ignition; recovery; simulation (new sim); settings (simulationIndex, changes, wind, windLevels, altitude reference); expression/removeExpression; acceptConversion.

The tree exposes actual model instances and UUIDs. Motor assignments check mount diameter and usable length. Recovery/ignition/separation triggers are upstream enums and retain upstream event semantics, not browser timers. Unit labels come from adapter metadata; unknown/specialized properties are not fabricated.

## Analysis and optimization

Analysis inputs: configurationId, Mach, angleOfAttack [rad], rollAngle [rad], optional rollRate [rad/s]. Outputs include upstream per-component CP and aerodynamic coefficients, warnings and loaded mass/CG. Sweeps add axis (mach/angleOfAttack/rollAngle), min/max and 2–100 steps, returning each sampled analysis.

Optimization inputs: simulationIndex, objective (maxAltitude/maxSpeed/maxAcceleration/flightTime/deploymentSpeed/landingDistance/landingSpeed/stability), goal (maximize/minimize), continuous double parameters `{componentId,property,min,max}` in SI, optional minStability/maxStability in calibers. 1–6 parameters are supported; 30 iterations/120 seconds bound execution. The upstream function/domain/optimizer generates evaluations and proposed before/after values. An optimization run is not a design edit. Accept only after inspecting the record; stale candidates are rejected. Not every desktop optimization goal/editor option is yet exposed.

## Job/result schemas

SimulationJob: id, projectId, revision, state (`pending`, `running`, `completed`, `failed`, `cancelled`), progress (null unless genuine progress exists), error, createdAt and evaluation count for advanced tasks. Queue size is bounded. Running state never implies a successful flight.

SimulationRun: id/kind/projectId/revision/designHash, engine/version/commit/solver, database provenance, configurationId/hash/snapshot, options, original project snapshot (base64; never credentials), status/error, start/end timestamps, warnings, summary (maxAltitude m, maxSpeed m/s, maxAcceleration m/s², flightTime s), and branches. Each branch contains name, variables (`key`, `name`, `unit`, `values` including null for nonfinite/missing engine samples) and events (`type`, `time` s, sourceId, detail). Branches may represent separated stages; do not combine them into a fabricated single trajectory.

Engine samples define total/vertical/lateral variables independently. Plotting and playback consume these values without recomputing dynamics. Maximum altitude is not a guarantee of successful recovery. Failure records may have no returned flight samples. Persistent queued-cancellation records explicitly say not executed.

## AI contracts

Optional Chat Completions function tools read designs/runs, compare actual summaries, propose validated scalar patches, return simulation acceptance requests and submit structured answers. The service resolves numeric citations from runId + quantity; provider-supplied numbers are not accepted as computed results. Tools do not write designs or launch jobs. Proposal generation requires per-request opt-in. Applying a patch or launching an accepted simulation is a separate, guarded API operation. Missing credentials/model and provider failures leave engineering state usable and unchanged.

AIProposedPatch: id, projectId, baseRevision/baseHash, reason, expectedTradeoff, changes (componentId/name/property/before/after/unit), status=proposed, acceptanceRequired=true. A proposal is an unproven hypothesis. Accepted patches use the same immutable revision mechanism and are undoable. Full natural-language scientific correctness still requires user judgment and a real comparison run.

## Units and coordinates

Canonical model values follow the pinned engine: meters, kilograms, seconds, kelvin, pascals and radians, with the upstream exception that launch latitude/longitude are **degrees**. UI converts ordinary lengths to mm, masses to g and radian angles to degrees. Material density units follow BULK kg/m³, SURFACE kg/m², LINE kg/m. All numerical API mutations require finite values; dimensional lengths reject negative values where appropriate, while signed offsets/sweep/CG options retain their semantics. Upstream setters may further clamp values; responses return actual stored model values.

Design axial x starts at the nose and increases toward the tail; transverse y/z and component placement use core conventions. Mesh coordinates use the core DefaultCoordTransform and are explicitly labelled (longitudinal mesh y, meters). Flight Px/Py are east/north from launch, h is above launch; ha is altitude above sea level. Positive vertical velocity is up. Vt/At are total magnitudes as defined by core; Vz/Az are different quantities. Events and timeline use engine simulation seconds, not browser elapsed time. Configuration IDs are UUIDs; design revision and simulation index are separate concepts.

## Input and deployment limits

Project inputs are <=8 MiB compressed and total uncompressed, <=128 archive entries. ZIP paths are never extracted; duplicates and traversal-like names reject. XML DTD/entities are forbidden. Only embedded attachment bytes are available to the core; no attachment may read a local path or network URL. Original bytes and embedded attachments are retained. Import warnings must be reviewed before lossy export. Uploaded listeners/extensions are rejected, not executed. Motor inputs are <=1 MiB and use the pinned core loaders.

The intended deployment is one local single-user process. Origin headers from a different origin reject. There is no public-user authentication, authorization layer or multi-process filesystem transaction coordinator. Do not expose it publicly without an authenticated deployment layer. No public deployment was performed.
