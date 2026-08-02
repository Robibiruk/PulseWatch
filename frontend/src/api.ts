// API client. Point API_BASE at the Render backend (set via .env or default).
const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:8000";
export { API_BASE };

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

// ── Telegram ──
export const tgLink = () => request<any>("/auth/telegram/link");
export const tgUnlink = () => request<any>("/auth/telegram/unlink", { method: "POST" });
export const setPlan = (plan: string) =>
  request<any>("/auth/plan", { method: "POST", body: JSON.stringify({ plan }) });
export const checkOnboarding = () => request<any>("/auth/onboarding");
export const tgPause = () => request<any>("/auth/telegram/pause", { method: "POST" });
export const tgResume = () => request<any>("/auth/telegram/resume", { method: "POST" });
export const tgChannels = () => request<any>("/auth/telegram/channels");
export const tgSetChannels = (body: any) =>
  request<any>("/auth/telegram/channels", { method: "POST", body: JSON.stringify(body) });

// ── Heartbeat & Status page ──
export const createHeartbeat = (body: { name: string; url?: string; interval: number }) =>
  request<any>("/api/heartbeat/create", { method: "POST", body: JSON.stringify(body) });
export const heartbeatToken = (id: number) => request<any>(`/api/monitors/${id}/heartbeat-token`);
export const statusPage = () => request<any>("/status-page");
export const saveStatusPage = (body: any) =>
  request<any>("/status-page", { method: "PUT", body: JSON.stringify(body) });

export const testNotification = (body: { email?: string; channels?: string[] }) =>
  request<any>("/notifications/test", { method: "POST", body: JSON.stringify(body) });

// ── Platform (account, tokens, sessions, health, support) ──
export const systemHealth = () => request<any>("/api/platform/health");
export const about = () => request<any>("/api/platform/about");
export const listTokens = () => request<any[]>("/api/platform/tokens");
export const createToken = (name: string) =>
  request<any>("/api/platform/tokens", { method: "POST", body: JSON.stringify({ name }) });
export const revokeToken = (id: number) =>
  request<any>(`/api/platform/tokens/${id}`, { method: "DELETE" });
export const listSessions = () => request<any>("/api/platform/sessions");
export const changePassword = (current_password: string, new_password: string) =>
  request<any>("/api/platform/account/password", {
    method: "POST",
    body: JSON.stringify({ current_password, new_password }),
  });
export const changeDisplayName = (full_name: string) =>
  request<any>("/api/platform/account/display-name", {
    method: "POST",
    body: JSON.stringify({ full_name }),
  });
export const exportData = () => request<any>("/api/platform/account/export");
export const deleteAccount = (password: string) =>
  request<any>("/api/platform/account", { method: "DELETE", body: JSON.stringify({ password }) });
export const submitSupport = (body: { subject?: string; message: string; email?: string }) =>
  request<any>("/api/platform/support", { method: "POST", body: JSON.stringify(body) });
export const submitFeedback = (body: { rating: number; message?: string }) =>
  request<any>("/api/platform/feedback", { method: "POST", body: JSON.stringify(body) });
export const regenerateStatusSlug = () =>
  request<any>("/api/platform/status-slug", { method: "POST" });

// ── Monitors ──
export const listMonitors = () => request<any[]>("/monitors");
export const getMonitor = (id: number) => request<any>(`/monitors/${id}`);
export const monitorSummary = () => request<any>("/monitors/summary");
export const listIncidents = () => request<any[]>("/monitors/incidents");
export const createMonitor = (body: {
  name: string; url: string; interval?: number; monitor_type?: string;
  tags?: string; request_timeout?: number; ip_version?: string; follow_redirects?: boolean;
  check_ssl?: boolean; ssl_expiry_reminders?: boolean; domain_expiry_reminders?: boolean;
  http_method?: string; auth_type?: string; auth_user?: string | null; auth_pass?: string | null;
  auth_bearer?: string | null; up_status_codes?: string;
}) => request<any>("/monitors", { method: "POST", body: JSON.stringify(body) });
export const updateMonitor = (id: number, body: any) =>
  request<any>(`/monitors/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteMonitor = (id: number) => request<void>(`/monitors/${id}`, { method: "DELETE" });

// ── Public status ──
export const publicStatus = (ownerId: number) => request<{ config: any; services: any[] }>(`/status/${ownerId}`);
export const publicStatusBySlug = (slug: string) => request<{ config: any; services: any[] }>(`/status/slug/${slug}`);

export { ApiError };
