import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as api from "../api";
import UptimeBar from "../components/UptimeBar";

function fmtTime(t?: string) {
  if (!t) return "—";
  return new Date(t).toLocaleString();
}

export default function MonitorDetail() {
  const { id } = useParams();
  const [m, setM] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setM(await api.getMonitor(Number(id))); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="center-screen"><span className="spinner" /></div>;
  if (!m) return <div className="container"><p className="muted">Monitor not found.</p><Link to="/">← Back</Link></div>;

  const open = m.recent_incidents?.find((i: any) => !i.resolved_at);

  return (
    <div className="container">
      <Link to="/" className="muted">← My monitors</Link>

      <div className="header-row" style={{ marginTop: 12 }}>
        <div>
          <div className="pill" style={{ gap: 10 }}>
            <span className={`dot ${m.enabled ? m.status : "paused"}`} style={{ width: 16, height: 16 }} />
            <h1 style={{ margin: 0 }}>{m.name}</h1>
          </div>
          <p className="muted" style={{ margin: "4px 0 0" }}>{m.url}</p>
        </div>
        <span className="badge">every {m.interval}s</span>
      </div>

      <div className={`status-banner ${m.status === "down" ? "down" : "up"}`}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          {m.status === "up" ? "✅ Operational" : m.enabled ? "🚨 Down" : "⏸ Paused"}
        </div>
        {open && (
          <div className="muted" style={{ marginTop: 6 }}>
            Since {fmtTime(open.started_at)}
            {open.status_code ? ` · HTTP ${open.status_code}` : ""}
            {open.reason ? ` · ${open.reason}` : ""}
          </div>
        )}
        {open?.ai_explanation && (
          <div className="ai-box">
            <strong>🤖 AI Incident Analysis</strong>
            {"\n"}{open.ai_explanation}
          </div>
        )}
      </div>

      <div className="metrics" style={{ gap: 28 }}>
        <div className="metric"><div className="v">{m.recent_checks?.length || 0}</div><div className="l">Checks (24h)</div></div>
        <div className="metric"><div className="v">{m.interval}s</div><div className="l">Interval</div></div>
        <div className="metric"><div className="v">{m.last_checked ? fmtTime(m.last_checked) : "—"}</div><div className="l">Last checked</div></div>
      </div>

      <div className="section-title">Last 24 hours</div>
      <UptimeBar checks={m.recent_checks || []} />

      <div className="section-title">Recent checks</div>
      <table>
        <thead><tr><th>Time</th><th>Status</th><th>Code</th><th>Latency</th></tr></thead>
        <tbody>
          {(m.recent_checks || []).slice(0, 20).map((c: any) => (
            <tr key={c.id}>
              <td>{fmtTime(c.checked_at)}</td>
              <td style={{ color: c.status === "down" ? "var(--red)" : "var(--green)" }}>{c.status.toUpperCase()}</td>
              <td>{c.status_code ?? "—"}</td>
              <td>{c.response_time != null ? `${Math.ceil(c.response_time)}ms` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {m.recent_incidents?.length > 0 && (
        <>
          <div className="section-title">Incidents</div>
          <table>
            <thead><tr><th>Started</th><th>Resolved</th><th>Downtime</th><th>AI note</th></tr></thead>
            <tbody>
              {m.recent_incidents.map((i: any) => (
                <tr key={i.id}>
                  <td>{fmtTime(i.started_at)}</td>
                  <td>{i.resolved_at ? fmtTime(i.resolved_at) : "ongoing"}</td>
                  <td>{i.recovery_minutes != null ? `${i.recovery_minutes}m` : "—"}</td>
                  <td style={{ maxWidth: 280 }}>
                    {i.ai_explanation ? i.ai_explanation.split("\n")[0] : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
