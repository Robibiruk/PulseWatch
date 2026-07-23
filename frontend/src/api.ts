// API client. Point API_BASE at the Render backend (set via .env or default).
const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:8000";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("pw_token");
  const headers: Record<string, string> = { ...(opts.headers as any) };
  if (!(opts.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.detail || res.statusText);
  }
  return data as T;
}

// ── Auth ──
export function login(email: string, password: string) {
  const fd = new FormData();
  fd.append("username", email);
  fd.append("password", password);
  return fetch(`${API_BASE}/auth/token`, { method: "POST", body: fd }).then(async (r) => {
    const text = await r.text();
    const data = text ? JSON.parse(text) : null;
    if (!r.ok) throw new ApiError(r.status, data?.detail || r.statusText);
    return data as { access_token: string };
  });
}
export const register = (body: { email: string; password: string; full_name: string }) =>
  request<{ access_token: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const me = () => request<any>("/auth/me");

// ── Monitors ──
export const listMonitors = () => request<any[]>("/monitors");
export const getMonitor = (id: number) => request<any>(`/monitors/${id}`);
export const createMonitor = (body: { name: string; url: string; interval: number }) =>
  request<any>("/monitors", { method: "POST", body: JSON.stringify(body) });
export const updateMonitor = (id: number, body: any) =>
  request<any>(`/monitors/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteMonitor = (id: number) => request<void>(`/monitors/${id}`, { method: "DELETE" });

// ── Public status ──
export const publicStatus = (ownerId: number) => request<any[]>(`/status/${ownerId}`);

export { ApiError };
