# Hoshi

Browser rocket assembly and flight simulation backed by the **actual OpenRocket 24.12 core**. React/TypeScript UI, Java headless HTTP adapter, durable local projects and immutable flight/analysis records. Independent presentation; no official OpenRocket endorsement.

**This is a working implementation, not full OpenRocket parity.** Read [the feature ledger](docs/openrocket-parity.md) for row-level status, evidence and limitations. No alternate physics engine or invented motor/simulation data is used. Incomplete capabilities are documented rather than represented as verified.

## Open it as a website (no terminal)

See [the GitHub Pages + engine guide](docs/github-pages.md) for browser-only setup. The repository includes a GitHub Pages workflow and a Free Render blueprint. Pages hosts the interface; the actual Java engine needs its own service. The connection screen supports a protected remote engine and keeps its access password out of browser storage. A real hosting account/service and Pages enablement still need to be completed; source/deployment files alone are not a live application.

## Start locally

Requirements: Git, curl, Node 20.19+ or 22.12+ (tested Node 24.19), npm, Linux/macOS and a JDK 17+ (tested Temurin 21.0.5). Linux x86-64 setup can install the pinned, checksum-verified Temurin JDK in `.tools` if only a JRE is available. The build has been tested on Linux x86-64; other platforms are not yet verified.

```bash
cd /workspace/Hoshi          # or your existing checkout
./scripts/setup.sh
./scripts/start.sh
```

The single Java process serves the built browser app and `/api` on port 8080, bound to loopback by default. Open it in your **local** browser at `http://127.0.0.1:8080`. In managed cloud onboarding, use local HTTP requests for validation; loopback addresses are not externally accessible preview links.

Setup pins OpenRocket tag `release-24.12` to `133b558de556f0282f51c3f53f3b3fc633b4310a`, retrieves its exact component database submodule `1512874ace50917e25ccf7d7df1f616b5f39a8b5`, compiles the unmodified core source on the classpath without its module descriptor, and installs only core dependencies and the server adapter. No Swing GUI startup is used. Sources are under `.upstream/openrocket`; dependencies are locked in `backend/gradle.lockfile` and `frontend/package-lock.json`. Engine source and database notices are retained.

For frontend hot reload, keep `scripts/start.sh` running and run `cd frontend && npm run dev` in a second terminal. Vite proxies `/api` to the Java server. Access the Vite URL from a local browser. Do not run two Java instances against the same data directory.

The application reads exported environment variables. `.env.example` is a template; the shell scripts do **not** automatically source arbitrary files. For a local private `.env`, export values securely in your shell. Never commit credentials. Optional configuration:

| Variable | Default / purpose |
|---|---|
| `BIND_HOST` | `127.0.0.1` (single-user local service) |
| `PORT` | `8080` |
| `ALLOWED_HOSTS` | `127.0.0.1,localhost,[::1]`; explicitly add an authenticated proxy hostname if deployed |
| `DATA_DIR` | `data`, relative to repository root; retained across starts |
| `WEB_DIR` | `frontend/dist`, relative to repository root |
| `JAVA_HOME` | Your JDK; a bootstrapped `.tools` JDK is selected when present |
| `AI_API_KEY` | Optional server-only provider credential |
| `AI_MODEL` | Required for live AI, supplied by your provider account; no invented default |
| `AI_ENDPOINT` | `https://api.openai.com/v1/chat/completions`, or compatible HTTPS endpoint |

Inherited proxy and CA settings remain enabled. Java requires explicit JVM proxy properties; `scripts/java-env.sh` translates the inherited HTTPS proxy host/port and uses the system Java CA truststore when present. No TLS verification is disabled. AI destinations must also be allowed by your environment's network policy. The default Host allowlist and same-origin checks reject DNS rebinding/cross-origin browser access. No provider key is required to design, simulate, export or compare flights.

## Try a real example

After the first successful engine connection, an interactive walkthrough spotlights the real controls. Follow actual clicks to open an example, select and edit a part, add a component, review launch conditions, calculate a flight and export the design. Animated pointers and diagrams demonstrate the actions; the lesson waits for saved edits and real engine results. Replay it from **Quick start guide**, **Start interactive lesson**, or **Help / walkthrough**. It supports mobile panels, keyboard navigation, reduced motion and skipping. Help also includes a searchable property reference.

1. In the project launcher, choose **A simple model rocket** under **Examples**. This creates a separate saved project using the upstream file. Choose **Create blank rocket** to start with an empty stage, or **Import a rocket file** to use your own design.
2. Select **Body tube** in the design tree. Change Length in mm and press Enter. Every accepted mutation creates a durable, guarded project revision.
3. Choose a simulation in the toolbar and click **Simulate launch**. Each simulation has its own motor configuration; the active drawing configuration is not silently substituted. Inspect Flight settings to change that association.
4. Inspect altitude, **total** velocity and **total** acceleration, the variable selector, branches, event sequence and run provenance. A changed design marks old results as previous-revision results.
5. Run again after another edit. Compare saved runs, then export CSV or `.ork`; find OBJ, SVG fins, RockSim and RASAero under **Tools → Additional exports**. After refreshing, select **Recent projects** and continue the saved project to recover its run records.
6. Inspect the side scene with labelled selection outlines, pan, zoom and Fit. Rear and 3D editor views have been removed. Side view is a schematic, not an exact manufacturing drawing; the upstream OBJ mesh export remains under Additional exports.

Drag parts left/right in the scene: airframe parts snap into native assembly order; fins and internal parts change their axial offset. Release saves one revision; Escape cancels. Drag hierarchy rows to reorder siblings or attach to a compatible parent. Undo and Redo apply to these moves.

The dark editor fills the browser window. Hierarchy, scene and Inspector share the Design workspace; setup and results live in Flight Simulation; drag the dividers to resize them. Individual panels scroll when their content needs more room. Narrow screens switch between panels using Scene / Hierarchy / Inspector tabs.

From empty: the stage is created for you. Use the single **Add Component** button below the hierarchy, search for a part and confirm its compatible attachment. Add nose/body, then fins/recovery/inner tube. The picker searches the selected part and its ancestors for compatible parents. Newly added parts are selected, labelled in the scene and fitted into view. New nose cones start at the front of their assembly. New body tubes have a fixed positive diameter and wall thickness so automatic radius matching cannot collapse them to zero. Existing zero-diameter tubes have an explicit, undoable repair in the Inspector. Empty assembly containers are labelled explicitly. The Inspector groups dimensions, placement, joints, mass and aerodynamic settings and includes search. Its material library provides 81 pinned OpenRocket defaults with the appropriate bulk/surface/line density units, plus custom material names and densities. Select an inner tube, set compatible dimensions and assign a real motor. Add a flight simulation in Flight settings. The existing Java regression test constructs and launches such a design from scratch. Browser operation remains subject to the documented per-feature verification coverage.

**Tools → Analysis & optimization** opens per-component aerodynamics, parameter sweeps and bounded upstream optimization. Optimization keeps the source project unchanged until **Accept optimized design**. Advanced inputs use SI; normal component fields display mm/g/degrees. Imported/mathematical expressions use the upstream math parser, not uploaded Java/JavaScript. See [the editor guide and control audit](docs/editor.md) for keyboard shortcuts and hidden incomplete controls.

## Tests and evidence

```bash
./scripts/test.sh
# With scripts/start.sh already running, and Chromium installed:
RUN_BROWSER_TESTS=1 ./scripts/test.sh
# Or browser tests only:
cd frontend && npm run test:e2e
```

Playwright uses `/usr/bin/chromium` by default; set `CHROMIUM_PATH` to your local Chromium executable. Tests exercise a real local backend; they create persistent test projects. Use a disposable `DATA_DIR` for isolated testing. Do not point them at valuable personal data.

- Java adapter/component tests (40), plus 30 unmodified upstream tests in a separate JVM: `backend/src/test/java/rocket/`; HTML/XML reports in `backend/build/reports/tests/test/` and `backend/build/test-results/test/`.
- Numerical fixtures: `tests/fixtures/` (unchanged upstream examples), `tests/reference.json`, predeclared `tests/tolerances.json`, absolute/relative comparisons in `tests/comparison-results.json`.
- Browser evidence: `tests/browser-results.json`, `tests/desktop.png`, `tests/mobile.png` after a successful test journey. These are generated artifacts, not proof of untested features.
- Reference regeneration is deliberate, **not** part of setup or normal tests: `source scripts/java-env.sh && ./gradlew :backend:generateReference`. Only do this after intentionally revising the baseline/fixture contract and reviewing numerical differences. Never regenerate to conceal adapter failures.

The six deterministic numerical cases cover three single-stage motor configurations plus multi-stage, cluster and dual recovery examples. They compare dry/loaded mass and CG, CP, flight metrics, warnings, event sequences/times and all sampled flight variables through save/load. Wall-clock computation telemetry is checked structurally, not for deterministic equality. Wind mean/deviation are set to zero for deterministic comparisons. Nonzero turbulent wind does not yet have statistical compatibility evidence: not all wind RNG seeds are exposed by the pinned public API.

AI tests use a clearly labelled in-process provider stub solely to validate tool contracts, server-derived citations and explicit patch acceptance. They do not establish that a real provider account/model works. The Assistant tab appears only when the engine reports AI configured; no canned text is presented as a live answer.

## Persistence / deployment

`data/projects/<uuid>/<revision>.ork` is append-only. `current.json` is replaced atomically after a new revision is written. `data/runs/<uuid>.json` records immutable terminal flight/analysis results with provenance; full flight source snapshots are included. Imported motor files are retained separately by SHA-256. Original imported project bytes are preserved for recovery. Browser storage remembers project selection, the non-secret engine address and walkthrough completion, never access passwords or provider keys.

Back up the entire `DATA_DIR` while the service is stopped. This first single-user deployment uses one process and one local filesystem. Hosted mode now supports a single-owner access password and exact-origin CORS. It has no per-user tenancy, no multi-process coordination and no general public multi-user deployment layer. `deploy.service` is an example user-systemd configuration: adjust installation paths and start it only after building. It binds loopback. For remote access, configure an authenticated TLS reverse proxy yourself; do not expose the unauthenticated API publicly. No service was published by this task.

When distributing, keep GPL notices and convey corresponding source. `./scripts/package-source.sh` creates `build/rocket-designer-source.tar.gz` containing the application and the complete pinned core/database source, excluding credentials and private projects. See [attribution and source requirements](notices/UPSTREAM.md). This project does not assume the code license grants ownership of every external database/asset or trademark.

## Troubleshooting and current limits

- JRE without `javac`: run setup; supported Linux x86-64 downloads a checksum-verified JDK. Other architectures must provide a JDK.
- Gradle cannot reach dependencies: preserve the platform proxy; use `scripts/java-env.sh` and the configured truststore. A policy denial needs the environment network settings, not disabled TLS or a direct-route workaround.
- Wrong engine or database revision: setup intentionally stops instead of mixing releases. Preserve local changes and inspect `.upstream/openrocket` before any reset/replacement.
- Import rejected: files are bounded to 8 MiB; DTD/entities, simulation extensions/listeners are rejected; embedded attachments remain in bounded memory. No uploaded code runs. Project/interchange imports (.ork, .rkt, .CDX1/XML) use their actual upstream readers. Unknown-content warnings gate export until conversion is explicitly accepted. Recover the exact original with `/api/projects/<id>/original` for imports retained by this server.
- Simulation failed/aborted: inspect actual events/warnings. No success trajectory is substituted. A PID or open port is not flight evidence.
- Old results: run records identify their original design revision and configuration. Re-simulate after edits; playback itself does not run physics.
- AI unavailable: configure both `AI_API_KEY` and `AI_MODEL` securely, allow the provider host and restart. Provider errors leave designs and run history unchanged. Every patch requires acceptance and is revision guarded.
- See [the parity matrix](docs/openrocket-parity.md) for remaining compatibility work, including textured rendering, exact side drawing, complete desktop extension equivalence, exhaustive specialized property and format coverage, graphical fin-point editing, and turbulent statistical reference tests. Do not describe this application as exact OpenRocket parity.

The launcher also offers **First time designing a rocket**, a ten-chapter beginner tutorial with a real example. Editor 0.4 removes large component labels and adds Inspector section shortcuts. Simulation setup guides motor assignment, simulation creation and configuration matching before job submission.

Hoshi Editor 0.5 uses Hoshi as its application name and credits OpenRocket as the calculation engine. **Simulate launch** in Design workspace opens a separate flight window sharing the same in-memory engine connection. The inline Flight Simulation workspace remains available if popups are blocked. The window contains launch checks, specific repair actions, engine-backed atmosphere/wind/guide/solver inputs, real results, exports, event history and recorded rocket playback. Physical construction strength, heat resistance and all real-world failure modes are not verified by the flight model.

An Arabic simulator reference, retaining English control and property names, is available from **دليل المحاكي بالعربية** in the launcher and Help, or at `guide-ar.html` beside the deployed application. Its text source is `docs/user-guide-ar.md`.
