export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const base = () => process.env.NEXT_PUBLIC_API_URL || "";

async function parse(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as { error?: string; details?: unknown };
  } catch {
    return { error: text };
  }
}

let refresh: Promise<boolean> | null = null;

async function refreshSession() {
  if (!refresh) {
    refresh = fetch(`${base()}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refresh = null;
      });
  }
  return refresh;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${base()}/api/v1${path}`, { ...init, headers, credentials: "include" });
  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    const ok = await refreshSession();
    if (ok) return api<T>(path, init, false);
  }
  if (!res.ok) {
    const body = await parse(res);
    throw new ApiError(res.status, body?.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return (await res.json()) as T;
  return (await res.blob()) as T;
}

export function fileUrl(path: string) {
  return `${base()}${path}`;
}
