import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../api";
import Icon from "../components/Icon";
import { Shell, Topbar } from "../components/Layout";

function fmt(t?: string) {
  if (!t) return "—";
  return new Date(t).toLocaleString();
}
function severityOf(i: any) {
  if (!i.resolved_at) {
    if (i.status_code && i.status_code >= 500) return "Critical";
    return "Major";
  }
  if (i.recovery_minutes != null && i.recovery_minutes > 30) return "Warning";
  return "Info";
}
const SEV_COLOR: any = { Critical: "#ff453a", Major: "#ff9f0a", Warning: "#ffd60a", Info: "#30d158" };
function ago(t?: string) {
  if (!t) return "";
  const s = Math.floor((Date.now() - new Date(t).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Incidents() {
  const nav = useNavigate();
  const [inc, setInc] = useState<any[] | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("all");

  useEffect(() => {
    api.listIncidents().then(setInc).catch(() => setInc([]));
  }, []);

  const list = (inc || []).filter((i) =>
    filter === "all" ? true : filter === "active" ? !i.resolved_at : !!i.resolved_at
  );
  const active = (inc || []).filter((i) => !i.resolved_at).length;

  return (
    <Shell>
      <Topbar
        title="Incidents"
        sub={active ? `${active} ongoing · ${list.length} shown` : "No active incidents — all clear"}
        actions={
          <div className="seg">
            {(["all", "active", "resolved"] as const).map((f) => (
              <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)} style={{ textTransform: "capitalize" }}>
                {f}
              </button>
            ))}
          </div>
        }
      />
      <div className="content">
        {inc === null ? (
          <div className="center-screen"><span className="spinner" /></div>
        ) : list.length === 0 ? (
          <div className="empty">
            <div style={{ color: "var(--green)", display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <Icon name="check-circle" size={36} />
            </div>
            <h3 style={{ margin: "0 0 6px" }}>No {filter === "all" ? "" : filter} incidents</h3>
            <p>Your monitors are behaving.</p>
          </div>
        ) : (
          <div className="fleet glass-2">
            <table className="fleet-grid">
              <thead>
                <tr><th>Service</th><th>Severity</th><th>Incident</th><th>Started</th><th>Duration</th><th>AI note</th></tr>
              </thead>
              <tbody>
                {list.map((i) => (
                  <tr key={i.id} style={{ cursor: "pointer" }} onClick={() => nav(`/monitor/${i.monitor_id}`)}>
                    <td>
                      <div className="svc-name" style={{ color: "var(--primary)" }}>{i.monitor_name || "—"}</div>
                    </td>
                    <td>
                      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, color: SEV_COLOR[severityOf(i)], background: `${SEV_COLOR[severityOf(i)]}22` }}>
                        {severityOf(i)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className={`status-pill ${i.resolved_at ? "" : "down"}`} style={{ width: "fit-content" }}>
                          <span className={`pulse-dot ${i.resolved_at ? "" : "down"}`} />
                          {i.resolved_at ? "Resolved" : "Active"}
                        </span>
                        <span className="muted" style={{ fontSize: 13 }}>{i.reason || "Outage"}</span>
                      </div>
                      {i.status_code ? <div className="svc-url">HTTP {i.status_code}</div> : null}
                    </td>
                    <td className="cell-mono" style={{ fontSize: 12 }}>{fmt(i.started_at)}</td>
                    <td className="cell-mono">
                      {i.resolved_at ? (i.recovery_minutes != null ? `${Math.round(i.recovery_minutes)}m` : fmt(i.resolved_at)) : <span style={{ color: "var(--red)" }}>{ago(i.started_at)}</span>}
                    </td>
                    <td style={{ maxWidth: 280 }}>
                      <span className="muted" style={{ fontSize: 12 }}>{i.ai_explanation ? i.ai_explanation.split("\n")[0] : "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
