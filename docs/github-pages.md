# Open Rocket Designer as a normal website

The intended public interface address is **https://gherablimanar.github.io/Hoshi/**. GitHub Pages hosts the React interface. Real OpenRocket 24.12 calculations run on a separately hosted Java engine. Pages cannot execute Java server processes. The interface never substitutes browser toy physics or invented flight data when the engine is unavailable.

## Finish setup in your browser (no terminal)

1. Open https://github.com/gherablimanar/Hoshi/settings/pages. Under **Build and deployment**, choose **GitHub Actions** as the source. If settings are unavailable, sign into the account that owns this repository.
2. Open https://github.com/gherablimanar/Hoshi/actions/workflows/pages.yml. Choose **Run workflow** on `main` if deployment has not already run. Wait for the build and deployment jobs to finish. The workflow needs Pages enabled before deployment can succeed.
3. Open https://render.com/deploy?repo=https://github.com/gherablimanar/Hoshi. Create/sign into Render, connect your GitHub account and use the provided **Free** Docker web-service blueprint. It creates one engine service with a generated access password. No hosting account, service or subscription was created by this implementation. If Free is not available for your account, do not accept a paid plan inadvertently; choose your preferred host instead.
4. Wait for Render's build and service startup to finish. Copy the engine's HTTPS website address (the actual `onrender.com` URL displayed by Render). Under that service's **Environment** settings, reveal/copy its generated **APP_ACCESS_PASSWORD**.
5. Open the GitHub Pages address above. Enter the engine address and access password, then click **Open Rocket Designer**. Use the Pages address for the updated editor; the Render address is the engine connection address. Its bundled interface can lag frontend-only updates.
6. Follow or skip the first-visit introduction. In the project launcher choose **Examples → A simple model rocket**, then **Simulate launch** in the editor to compute a real flight. The engine may take time to wake after inactivity. After a refresh, reconnect and choose **Recent projects** to continue a saved design.

The address is a deployment target, not a claim that deployment is already live. `docs/hosting-validation.md` records what was actually verified. Account authorization, Pages enablement and a real hosting service remain user-controlled prerequisites.

## If the old interface is still visible

Check the latest [Pages workflow](https://github.com/gherablimanar/Hoshi/actions/workflows/pages.yml). A successful build does not mean a successful deployment. The November 5 component update built successfully but its deploy job reported **"deploy is waiting for github-pages deployment approval"**. In the owner account, open the latest run, choose **Review deployments**, select **github-pages**, then **Approve and deploy**. Preserve the environment's protection settings. After deploy succeeds, refresh the Pages site and check for **Hoshi Editor 0.3** in the editor footer.

Frontend-only commits use Render's `[skip render]` marker to avoid restarting an unchanged engine with temporary storage. Open the Pages interface to receive those updates; a separately served Render root page may still carry its previous bundled interface. The engine address remains the same.

## Access and data

The Pages interface is public static code. Your engine is password-protected: project lists/documents, imports/exports, flight/analysis records and AI calls all require the engine's access password. The health endpoint exposes only safe readiness/version metadata. One shared owner password is intended for a single owner/trusted group; there is no separate user-account or per-user tenancy system.

The password is held only in JavaScript memory for the current tab and transmitted as an Authorization header over HTTPS. It is not persisted in localStorage/sessionStorage or project files, and is never compiled into the Pages assets. Refreshing requires entering it again. The non-secret engine address may be remembered. Provider API keys remain server-side; they are unrelated to this owner access password. Do not post either kind of secret in issues/chat.

`ALLOWED_ORIGINS` permits the exact Pages origin `https://gherablimanar.github.io`, not arbitrary origins. Both the Pages project path and authenticated downloads are supported. The backend also checks Host, including Render's actual `RENDER_EXTERNAL_HOSTNAME`. Hosted mode refuses to start without a sufficiently long password. Local single-machine development remains available without a password unless explicitly configured.

**Free Render storage is temporary.** Projects/runs survive a browser refresh while that service filesystem exists, but can disappear on service restart/redeploy. Export important `.ork` files and flight CSV/JSON. This limitation is shown in the connection guide and in the workspace for ephemeral hosting. Durable hosting needs an appropriate persistent `DATA_DIR`/volume on a service you choose; the free blueprint deliberately does not provision paid storage.

## Deployment files

- `.github/workflows/pages.yml`: locked Node/npm production build with `/Hoshi/` asset base and pinned GitHub action revisions; deploys the static interface using GitHub Pages.
- `Dockerfile`: separate Node frontend/JDK core build stages and a non-root Java runtime. It fetches the exact core/database commits and verifies them before compilation. Runtime contains the static application and actual core dependencies.
- `render.yaml`: one Free Docker web service, health check, generated access password, exact frontend origin and explicit ephemeral-storage state. It does not provision databases or paid disks.
- `deploy/build-backend.sh`: reproducible core build; optional BuildKit proxy-CA mount is temporary and verification remains enabled.

The Pages workflow accepts optional repository **Actions variable** `VITE_ENGINE_URL` for a public default engine address. It is not a secret. Do not put passwords or provider keys into any VITE variable: those are public browser assets. Without a default, the user connects via the normal form.

## Other hosts / local development

A Java-compatible host can run the Docker image with:

- `PORT` (host assigned), `BIND_HOST=0.0.0.0`;
- `REQUIRE_AUTH=true` and securely supplied `APP_ACCESS_PASSWORD` (at least 16 characters);
- `ALLOWED_HOSTS` including its real public hostname (Render is recognized automatically);
- `ALLOWED_ORIGINS=https://gherablimanar.github.io`;
- writable `DATA_DIR`, with `EPHEMERAL_STORAGE=true` only when files are temporary;
- optional server-only `AI_API_KEY`, `AI_MODEL`, `AI_ENDPOINT`.

Keep HTTPS and authentication on the public service. The image runs as UID/GID 10001, so a mounted data directory must be writable by that user. Public access controls protect the single-owner store; they do not add multi-user isolation.

For local development, `./scripts/setup.sh` and `./scripts/start.sh` still serve both UI and API on loopback. A Pages build uses `VITE_BASE_PATH=/Hoshi/ npm run build` in `frontend/`. For a separate static frontend, configure the exact local origin in ALLOWED_ORIGINS on the engine; the public site requires an HTTPS engine address.

No public host was deployed, no hosting account was created and no service was purchased by the implementation. The public Pages deployment is complete only when GitHub reports successful deployment; engine hosting is complete only after its actual health/functional checks succeed.
