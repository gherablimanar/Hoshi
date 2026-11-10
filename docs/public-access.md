# Password-free public simulator access

The website supports public visitors while retaining the existing owner workspace.
The backend feature is opt-in: set `PUBLIC_VISITORS=true` on the engine and deploy
the new backend. `REQUIRE_AUTH=true` and `APP_ACCESS_PASSWORD` remain in place for
owner access. Removing the owner password is not how visitor mode is activated.

## Activate on the existing Render service

1. Before a deployment, open any important existing owner project and **Export**
   its `.ork` file; also download important CSV/run records. This free service has
   ephemeral storage and a deployment can discard its projects.
2. Open Render → **hoshi-openrocket-engine** → **Environment**.
3. Add `PUBLIC_VISITORS` with value `true`. Keep the existing owner password and
   `REQUIRE_AUTH` settings.
4. Save the environment and deploy the latest commit (use **Manual Deploy →
   Deploy latest commit** if saving does not deploy it).
5. Once Render reports **Live**, open https://gherablimanar.github.io/Hoshi/ in
   a private browser window. It should open the project launcher without asking
   for an engine address or password. Run the simple example to verify the engine.

The code is pushed with `[skip render]` so this activation does not happen before
an owner can export important work. GitHub Pages can publish the new frontend
independently. Until the backend is deployed and the flag enabled, the engine
continues to require its owner password.

## What visitors receive

The frontend discovers public mode through the health endpoint, automatically
requests a random visitor capability, and sends it as a Bearer token. No owner
password or provider key is embedded in the website. On the official Pages site,
the public engine address defaults to the existing Hoshi Render service; a
configured `VITE_ENGINE_URL` or remembered engine address still takes precedence.

Each capability maps to its own project/revision/run directory and job map. It
cannot select another visitor's or the owner's directory by supplying a project,
job or run ID. Native design/import/edit, bundled motors, actual OpenRocket
simulation, analysis, optimization and authenticated downloads use that store.
The browser remembers its visitor capability to reconnect on reload. It is an
access credential: anyone who obtains it can access that visitor workspace, so
do not share or log it. The owner password remains memory-only.

Visitor workspaces expire after 24 hours. They can also disappear on free-host
restart; exporting remains necessary. Expired workspace cleanup is limited to
visitor directories, with a grace period and no deletion while a job is active.
Private owner projects are not exposed in public mode. To open the owner space,
use **Engine connection** and enter the existing owner password.

The assistant using the owner's provider credentials and shared motor-database
imports remain owner-only. Public visitors use the bundled motor catalog;
private imported-motor source names are omitted from visitor records. An uploaded
project must still satisfy the existing engine import restrictions.

## Capacity and verification

This is one shared hosted engine, not unlimited compute. All workspaces share the
existing single bounded computation queue. A visitor can have one active task,
240 requests per minute, and a bounded workspace (64 MiB, 2,000 files, 100 tracked
jobs). Visitor storage is capped globally at 256 MiB and 128 unexpired sessions.
Limits return explicit errors instead of provisioning paid resources. They are
small-service limits, not a guarantee of resistance to a distributed traffic
attack. Network-level rate limiting, persistent storage and stronger hosting
capacity may be needed for a busy public service.

Visitor job snapshots are released from memory after persistence. Unconfigured
assistants do not allocate an HTTP client per visitor. The HTTP request executor
and global job queue are bounded. GET exports remain available when the visitor
workspace reaches its write/storage quota.

`VisitorAccessTest` exercises owner/two-visitor isolation, invalid tokens,
protected exports and writes, a genuine flight and result/CSV access, reconnection
and expiration. `frontend/public-e2e/visitors.spec.ts` tests automatic browser
entry, a real flight in the separate window, exports, reload and a second
browser's isolation. Run it against an explicitly public test engine with:

```sh
ROCKET_PUBLIC_TEST_URL=http://127.0.0.1:18090/ npx playwright test --config playwright.public.config.ts
```

No hosted activation or preservation of ephemeral server files is claimed merely
because the frontend build or local tests succeed.
