/** Public engine address may be remembered; the access password is memory-only. */
const env = (
  import.meta as ImportMeta & { env: Record<string, string | undefined> }
).env;
let engineOrigin =
  localStorage.getItem("rocket-engine-origin") ||
  env.VITE_ENGINE_URL ||
  (location.hostname === "gherablimanar.github.io"
    ? "https://hoshi-openrocket-engine.onrender.com"
    : "");
let authorization = "";
export const isPagesHost = () => location.hostname.endsWith(".github.io");
export const currentEngineOrigin = () => engineOrigin;
export function configureEngine(origin: string, password: string) {
  const value = origin.trim().replace(/\/+$/, "");
  if (value) {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      throw new Error(
        "Enter the engine website address, without a path or credentials.",
      );
    if (location.protocol === "https:" && url.protocol !== "https:")
      throw new Error("This website needs an HTTPS engine address.");
    engineOrigin = url.origin;
    localStorage.setItem("rocket-engine-origin", engineOrigin);
  } else {
    engineOrigin = "";
    localStorage.removeItem("rocket-engine-origin");
  }
  authorization = password
    ? "Basic " +
      btoa(
        String.fromCharCode(...new TextEncoder().encode("rocket:" + password)),
      )
    : "";
}
/** A visitor capability selects one isolated workspace; owner passwords remain memory-only. */
export async function prepareVisitorAccess(enabled: boolean): Promise<boolean> {
  if (!enabled || authorization.startsWith("Basic ")) return false;
  const key = "hoshi-visitor-v1:" + (engineOrigin || location.origin);
  const saved = localStorage.getItem(key);
  if (saved) {
    authorization = "Bearer " + saved;
    const check = await apiFetch("/visitor-session");
    if (check.ok) return true;
    if (check.status !== 401) {
      await responseData(check);
    }
    authorization = "";
    localStorage.removeItem(key);
  }
  const result = await api<{ token: string }>("/visitor-session", {});
  authorization = "Bearer " + result.token;
  localStorage.setItem(key, result.token);
  return true;
}

export function apiUrl(path: string) {
  if (isPagesHost() && !engineOrigin)
    throw new Error(
      "Connect your OpenRocket engine to use the designer and run real simulations.",
    );
  return engineOrigin + (path.startsWith("/api/") ? path : "/api" + path);
}
export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (authorization) headers.set("Authorization", authorization);
  try {
    return await fetch(apiUrl(path), {
      ...init,
      headers,
      credentials: "omit",
      redirect: "error",
      signal: init.signal || AbortSignal.timeout(120000),
    });
  } catch (e) {
    if (e instanceof TypeError)
      throw new Error(
        "Cannot reach the OpenRocket engine. Check its address and that the hosting service is running; a sleeping free service may take a minute to start.",
      );
    throw e;
  }
}
export async function responseData(response: Response) {
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `The engine returned an unexpected response (HTTP ${response.status}). Check its website address.`,
    );
  }
  if (!response.ok) {
    if (response.status === 401 && authorization.startsWith("Bearer ")) {
      authorization = "";
      localStorage.removeItem(
        "hoshi-visitor-v1:" + (engineOrigin || location.origin),
      );
      window.dispatchEvent(new CustomEvent("visitor-access-expired"));
      throw new Error(
        "Your temporary visitor session expired. Opening a fresh visitor workspace; import an exported design to continue.",
      );
    }
    const message =
      response.status === 401
        ? "Enter the engine access password from your hosting settings."
        : data.error?.message || `Request failed: ${response.status}`;
    if (response.status === 401)
      window.dispatchEvent(
        new CustomEvent("engine-access-required", { detail: message }),
      );
    throw new Error(message);
  }
  return data;
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  return responseData(
    await apiFetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  ) as Promise<T>;
}
export async function upload(file: File) {
  return responseData(
    await apiFetch("/import", { method: "POST", body: file }),
  );
}
export async function downloadFile(path: string) {
  const response = await apiFetch(path);
  if (!response.ok) {
    await responseData(response);
    return;
  }
  const name =
    response.headers
      .get("Content-Disposition")
      ?.match(/filename="([^"]+)"/)?.[1] ||
    (path.endsWith("/csv")
      ? "flight.csv"
      : /\/runs\/[^/]+$/.test(path)
        ? "flight-run.json"
        : "rocket-download");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.dispatchEvent(
    new CustomEvent("engine-download-complete", { detail: { path } }),
  );
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
