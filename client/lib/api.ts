export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const fallback = response.status >= 500
      ? "Something went wrong. Please try again in a moment."
      : "We couldn't complete that request. Please try again.";
    const message = typeof data?.error === "string" ? data.error.trim() : "";
    throw new Error(response.status >= 500 || !message ? fallback : message);
  }
  return data;
}
