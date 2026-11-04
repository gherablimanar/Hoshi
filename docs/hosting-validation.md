# Hosting change: verified evidence and outstanding prerequisites

Verified locally on 2026-11-04:

- Production frontend builds with both `/` and `/Hoshi/` asset bases.
- Docker multi-stage build fetches/checks exact OpenRocket and component database commits, compiles the real core and produces a non-root Java runtime. TLS/checksum verification stays enabled. The optional managed proxy CA is temporary during builds.
- The actual container starts with password authentication and a 512 MiB / 1 CPU limit. After real-flight browser tests it used about 312 MiB, with no OOM termination. This is local evidence, not a guarantee about every host's capacity/limits.
- 43 adapter/component/hosting Java tests passed, zero skipped/failed. Three new tests cover startup failure without a hosted password, exact-origin/Host/credential checks and real HTTP preflight/health/protected API behavior. Existing numerical fixture tests still passed.
- Two new Chromium journeys passed using a static `/Hoshi/` frontend on one port and the real password-protected Docker engine on a different port: wrong password, successful login, upstream example, actual simulation, authenticated `.ork` and CSV downloads, refresh/re-entry and run recovery; then an unreachable engine with no fabricated success. Browser storage was checked to exclude the access password/header. Runtime errors were checked. Evidence: `tests/hosted-browser-results.json`, `tests/github-pages-connected.png`.
- All three existing local desktop/mobile/optimization browser journeys passed against an isolated same-origin instance. The native local workflow and downloads remain functional. Evidence: `tests/browser-results.json`, desktop/mobile images.
- `tests/hosting-validation.json` records current scoped counts and deployment state. These checks do not change the full-parity limitations in `docs/openrocket-parity.md`.

External prerequisites remain: a real hosting account/service deployment and GitHub Pages enabled for Actions. No Render account was available, no account/service was created, and no paid plan/disk was provisioned. The browser's generated-password setup requires the owner to sign into their host. Optional AI remains independently unconfigured.

The managed execution network explicitly denied requests to api.github.com and gherablimanar.github.io, so the public Pages/Actions status could not be queried here. This is a network-policy limitation, not evidence that the website is deployed or that GitHub has failed. Git operations to github.com are available; commits and pushes can be verified independently by Git refs.

Deployment files are complete and tested locally. A committed/pushed workflow is not itself proof of a successful public Pages deployment or a running public engine. Use `docs/github-pages.md` to finish the account-controlled steps, then check the actual resulting URLs and a real flight before claiming the complete online application is live.
