import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as api from "../api";
import { useAuth } from "../auth";
import Icon from "../components/Icon";
import { Shell, Topbar } from "../components/Layout";
import NewMonitorWizard from "../components/NewMonitorWizard";
import MonitorEditor from "../components/MonitorEditor";

function statusOf(m: any) {
  if (!m.enabled) return "paused";
  return m.status; // up | down
}

function Kpi({ icon, label, value, unit, sub, pct, spark, sparkOn }: any) {
  return (
    <div className="kpi-card glass-2">
      <div className="ico"><Icon name={icon} size={56} /></div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}{unit && <span className="unit">{unit}</span>}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      {pct != null && (
        <div className="kpi-bar"><i style={{ width: `${pct}%` }} /></div>
      )}
      {spark && (
        <div className="kpi-spark">
          {spark.map((s: string, i: number) => (
            <i key={i} className={sparkOn?.includes(i) ? "on" : ""} style={{ height: s === "h" ? "100%" : "55%" }} />
          ))}
        </div>
      )}
    </div>
  );
}

function Spark({ checks }: { checks: any[] }) {
  return (
    <div className="spark">
      {checks.slice(0, 30).map((c, i) => {
        const v = c.response_time != null ? Math.min(100, c.response_time / 5) : 4;
        return <i key={i} style={{ height: `${v}%` }} className={c.status === "down" ? "hot" : ""} />;
      })}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [monitors, setMonitors] = useState<any[] | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [wizard, setWizard] = useState(false);
  const [editor, setEditor] = useState<any | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState("");

  async function load() {
    try {
      const [m, s] = await Promise.all([api.listMonitors(), api.monitorSummary()]);
      setMonitors(m);
      setSummary(s);
    } catch (e: any) {
      setErr(e.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function togglePause(m: any) {
    setBusyId(m.id);
    try {
      await api.updateMonitor(m.id, { enabled: !m.enabled });
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusyId(null);
    }
  }

  if (monitors === null) return <Shell><div className="center-screen"><span className="spinner" /></div></Shell>;

  const fleetSpark = (monitors || []).map((m) => statusOf(m) === "up" ? "h" : "l").slice(0, 30);
  const upPct = summary && summary.total ? Math.round((summary.up / summary.total) * 100) : 0;
  const lastTick = summary?.last_check ? new Date(summary.last_check).toLocaleTimeString() : null;

  const [filter, setFilter] = useState<"all" | "up" | "down" | "paused" | "ssl">("all");
  const now = Date.now();
  const visible = (monitors || []).filter((m) => {
    if (filter === "all") return true;
    if (filter === "up") return m.enabled && m.status === "up";
    if (filter === "down") return m.status === "down";
    if (filter === "paused") return !m.enabled;
    if (filter === "ssl") {
      // SSL expiring within 14 days (best-effort; falls back to false without data)
      return !!m.ssl_expires_at && (new Date(m.ssl_expires_at).getTime() - now) < 14 * 864e5;
    }
    return true;
  });

  return (
    <Shell>
      <Topbar
        title={`Welcome back${user?.full_name ? ", " + user.full_name.split(" ")[0] : ""}`}
        sub={`${summary?.total ?? 0} monitors under watch${lastTick ? ` · Last worker tick ${lastTick}` : ""}`}
        actions={
          <button className="btn" onClick={() => setWizard(true)}>
            <Icon name="plus" size={18} /> New Monitor
          </button>
        }
      />

      <div className="content">
        {err && <div className="error">{err}</div>}

        <div className="kpi-grid">
          <Kpi icon="globe" label="Total Monitors" value={summary?.total ?? 0} sub={`${summary?.paused ?? 0} paused`} pct={upPct} />
          <Kpi icon="activity" label="Uptime (24h)" value={summary?.uptime_24h != null ? summary.uptime_24h : "—"} unit={summary?.uptime_24h != null ? "%" : ""}
            sub="Across all services" pct={summary?.uptime_24h ?? 100} />
          <Kpi icon="timer" label="Avg Response" value={summary?.avg_response != null ? summary.avg_response : "—"} unit={summary?.avg_response != null ? "ms" : ""}
            sub="Mean round-trip" />
          <Kpi icon="alert" label="Active Incidents" value={summary?.active_incidents ?? 0} sub={summary?.down ? `${summary.down} down` : "All healthy"}
            pct={summary?.active_incidents ? 8 : 100} spark={fleetSpark} sparkOn={fleetSpark.map((_: any, i: number) => i).filter((i: number) => fleetSpark[i] === "h")} />
        </div>

        {monitors.length === 0 ? (
          <div className="empty" style={{ marginTop: 28 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}><Icon name="server" size={40} /></div>
            <h3 style={{ margin: "0 0 8px" }}>No monitors yet</h3>
            <p>Add your first endpoint to start watching it in real time.</p>
            <button className="btn" style={{ marginTop: 14 }} onClick={() => setWizard(true)}>
              <Icon name="plus" size={18} /> New Monitor
            </button>
          </div>
        ) : (
          <div className="fleet glass-2" style={{ marginTop: 28 }}>
            <div className="fleet-head">
              <h3 style={{ margin: 0, fontSize: 17 }}>Monitored services</h3>
              <span className="badge">{visible.length} shown</span>
            </div>
            <div className="seg" style={{ margin: "10px 0" }}>
              {(["all", "up", "down", "paused", "ssl"] as const).map((f) => (
                <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)} style={{ textTransform: "capitalize", padding: "4px 12px", fontSize: 12 }}>
                  {f === "ssl" ? "SSL Expiring" : f}
                </button>
              ))}
            </div>
            <table className="fleet-grid">
              <thead>
                <tr><th>Service</th><th>Status</th><th style={{ textAlign: "right" }}>Uptime 24h</th><th style={{ textAlign: "right" }}>Avg ms</th><th style={{ textAlign: "right" }}>Interval</th><th></th></tr>
              </thead>
              <tbody>
                {visible.map((m) => {
                  const st = statusOf(m);
                  return (
                    <tr key={m.id} style={{ cursor: "pointer" }} onClick={() => nav(`/monitor/${m.id}`)}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span className="svc-ico"><Icon name={m.url?.includes("api") ? "webhook" : "globe"} /></span>
                          <div>
                            <div className="svc-name">{m.name}</div>
                            <div className="svc-url">{m.url}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${st === "down" ? "down" : st === "paused" ? "purple" : ""}`}>
                          <span className={`pulse-dot ${st === "down" ? "down" : st === "paused" ? "purple" : ""}`} />
                          {st === "up" ? "Operational" : st === "down" ? "Down" : "Paused"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }} className="cell-mono">{m.uptime_24h != null ? `${m.uptime_24h}%` : "—"}</td>
                      <td style={{ textAlign: "right" }} className="cell-mono">{m.avg_response_time != null ? `${Math.ceil(m.avg_response_time)}` : "—"}</td>
                      <td style={{ textAlign: "right" }} className="cell-mono">{Math.round(m.interval / 60)}m</td>
                      <td style={{ textAlign: "right" }}>
                        <div className="row-actions">
                          <button
                            className="row-action"
                            title={m.enabled ? "Pause" : "Resume"}
                            disabled={busyId === m.id}
                            onClick={(e) => { e.stopPropagation(); togglePause(m); }}
                          >
                            <Icon name={m.enabled ? "pause" : "play"} size={16} />
                          </button>
                          <button
                            className="row-action"
                            title="Edit"
                            onClick={(e) => { e.stopPropagation(); setEditor(m); }}
                          >
                            <Icon name="edit" size={16} />
                          </button>
                          <button className="row-action" onClick={(e) => { e.stopPropagation(); nav(`/monitor/${m.id}`); }}>
                            <Icon name="chevron-right" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {wizard && (
        <NewMonitorWizard
          onClose={() => setWizard(false)}
          onCreated={() => { setWizard(false); load(); }}
        />
      )}

      {editor !== null && (
        <MonitorEditor
          monitor={editor}
          onClose={() => setEditor(null)}
          onSaved={(m) => { setEditor(null); load(); }}
          onDeleted={() => { setEditor(null); load(); }}
        />
      )}
    </Shell>
  );
}
