export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch("/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error?.message || `Request failed: ${response.status}`,
    );
  return data as T;
}
export async function upload(file: File) {
  const response = await fetch("/api/import", { method: "POST", body: file });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Import failed");
  return data;
}
