import { useState } from "react";
import { configureEngine, currentEngineOrigin, isPagesHost } from "./api";
export function EngineConnection({
  error,
  busy,
  onConnect,
}: {
  error: string;
  busy: boolean;
  onConnect: () => void;
}) {
  const [origin, setOrigin] = useState(
      currentEngineOrigin() || (isPagesHost() ? "" : location.origin),
    ),
    [password, setPassword] = useState(""),
    [validation, setValidation] = useState("");
  return (
    <div className="engine-connection">
      <div className="connection-card">
        <div className="brand">
          <span className="brand-mark">↟</span>
          <strong>Rocket Designer</strong>
        </div>
        <span className="eyebrow">OPENROCKET 24.12</span>
        <h1>
          {busy ? "Connecting to your engine…" : "Connect your flight engine"}
        </h1>
        <p>
          The website is ready. Designs and real flight simulations run on your
          OpenRocket engine.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              configureEngine(origin, password);
              setValidation("");
              onConnect();
            } catch (e) {
              setValidation((e as Error).message);
            }
          }}
        >
          <label>
            Engine website address
            <input
              aria-label="Engine website address"
              type="url"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="https://your-engine.onrender.com"
              required
            />
          </label>
          <label>
            Engine access password
            <input
              aria-label="Engine access password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="From your hosting settings"
            />
          </label>
          <button className="primary" disabled={busy} type="submit">
            {busy ? "Connecting…" : "Open Rocket Designer"}
          </button>
        </form>
        {(validation || error) && (
          <p className="connection-error" role="alert">
            {validation || error}
          </p>
        )}
        <details>
          <summary>First time? Create your engine</summary>
          <ol>
            <li>
              <a
                href="https://render.com/deploy?repo=https://github.com/gherablimanar/Hoshi"
                target="_blank"
                rel="noreferrer"
              >
                Deploy the engine on Render
              </a>{" "}
              and connect your GitHub account.
            </li>
            <li>Choose the Free service and wait for the build to finish.</li>
            <li>
              Copy its website address and the generated APP_ACCESS_PASSWORD
              from the service's Environment settings into this form.
            </li>
          </ol>
          <p>
            Free hosting can sleep and its server files are temporary. Export
            important projects and flight data. GitHub Pages itself cannot run
            the Java engine.
          </p>
        </details>
        <small>
          The password stays in memory for this tab and is sent only to the
          engine address you enter. It is never saved in project files or
          browser storage.
        </small>
      </div>
    </div>
  );
}
