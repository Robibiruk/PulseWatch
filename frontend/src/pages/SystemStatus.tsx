import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:8000";

type HealthData = {
  status: string;
  service: string;
};

type PublicHealth = {
  status: string;
  database: string;
  api: string;
};

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className="inline-block h-3 w-3 rounded-full"
      style={{
        background: ok ? "var(--green)" : "var(--red)",
        boxShadow: `0 0 8px ${ok ? "rgba(52,211,153,0.5)" : "rgba(248,113,113,0.5)"}`,
      }}
    />
  );
}

export default function SystemStatus() {
  const [apiHealth, setApiHealth] = useState<HealthData | null>(null);
  const [publicHealth, setPublicHealth] = useState<PublicHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    const check = async () => {
      setLoading(true);
      try {
        const [h, ph] = await Promise.all([
          fetch(`${API_BASE}/health`).then((r) => r.json()).catch(() => null),
          fetch(`${API_BASE}/status/health`).then((r) => r.json()).catch(() => null),
        ]);
        setApiHealth(h);
        setPublicHealth(ph);
        setCheckedAt(new Date());
      } catch {
        setApiHealth(null);
        setPublicHealth(null);
      } finally {
        setLoading(false);
      }
    };
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, []);

  const apiOk = apiHealth?.status === "ok";
  const dbOk = publicHealth?.database === "connected";
  const overallOk = apiOk && dbOk;

  const services = [
    {
      name: "PulseWatch API",
      desc: "REST API serving the dashboard, public status pages, and webhooks",
      ok: apiOk,
      detail: apiOk ? "Operational" : apiHealth ? "Degraded" : "Unreachable",
    },
    {
      name: "Database",
      desc: "PostgreSQL (Neon) — shared store for monitors, incidents, and auth",
      ok: dbOk,
      detail: publicHealth?.database === "connected" ? "Connected" : publicHealth?.database === "error" ? "Error" : "Unknown",
    },
    {
      name: "Worker",
      desc: "Scheduler probing monitors every minute via GitHub Actions cron",
      ok: true,
      detail: "Scheduled (5 min interval)",
    },
    {
      name: "Telegram Bot",
      desc: "Long-polling bot for alerts and commands",
      ok: true,
      detail: "Best-effort (runs while API is awake)",
    },
  ];

  return (
    <div className="status-page" data-theme="neon">
      <div className="ps-inner" style={{ maxWidth: 600 }}>
        <div className="ps-brand">
          <img src="/favicon/pulsewatch.png" alt="PulseWatch" className="ps-logo" />
          <span className="ps-word">PulseWatch</span>
        </div>

        <div className={`status-banner ${overallOk ? "" : "down"}`}>
          <div className="ring" />
          <div className="ring r2" />
          <h1>{loading ? "Checking..." : overallOk ? "All Systems Operational" : "System Degraded"}</h1>
          <p>{checkedAt ? `Last checked ${checkedAt.toLocaleTimeString()}` : "Loading..."}</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
          {services.map((s) => (
            <div className="pub-row glass-2" key={s.name} style={{ padding: "16px 20px" }}>
              <div className="top" style={{ alignItems: "center" }}>
                <div className="name" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StatusDot ok={s.ok} />
                  <span style={{ fontWeight: 600 }}>{s.name}</span>
                </div>
                <div className="val" style={{ fontSize: 13 }}>
                  {s.detail}
                </div>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--on-surface-muted)" }}>{s.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, textAlign: "center" }}>
          <Link to="/" style={{ fontSize: 13, color: "var(--primary)", textDecoration: "none" }}>
            <Icon name="arrow-left" size={14} /> Back to PulseWatch
          </Link>
        </div>

        <p className="muted" style={{ textAlign: "center", fontSize: 11, marginTop: 16 }}>
          Auto-refreshes every 30 seconds · Data from the PulseWatch API
        </p>
      </div>
    </div>
  );
}
