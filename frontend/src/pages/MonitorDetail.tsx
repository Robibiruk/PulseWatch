import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as api from "../api";
import Icon from "../components/Icon";
import { Shell, Topbar } from "../components/Layout";
import MonitorEditor from "../components/MonitorEditor";
import Loader from "../components/Loader";

function fmtTime(t?: string) {
  if (!t) return "—";
  return new Date(t).toLocaleString();
}

function Bento({ label, value, sub, color }: any) {
  return (
    <div className="bento-card glass-2">
      <div className="l">{label}</div>
      <div className="v" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function ResponseChart({ checks }: { checks: any[] }) {
  const [range, setRange] = useState<"1h" | "6h" | "24h">("24h");
  const now = Date.now();
  const window = range === "1h" ? 36e5 : range === "6h" ? 21.6e6 : 86.4e6;
  const filtered = checks.filter((c) => new Date(c.checked_at).getTime() >= now - window);
  const data = filtered.length ? filtered : checks;
  const max = Math.max(1, ...data.map((c) => c.response_time || 0));
  const avg = data.filter((c) => c.response_time != null).reduce((a: number, c: any) => a + c.response_time, 0) / Math.max(1, data.filter((c) => c.response_time != null).length);

  return (
    <div className="chart-card glass-2">
      <div className="head">
        <div>
          <div className="kpi-label">Response Time</div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>
            {data.find((c) => c.response_time != null) ? `${Math.round(avg)}ms avg` : "—"}
          </div>
        </div>
        <div className="seg">
          {(["1h", "6h", "24h"] as const).map((r) => (
            <button key={r} className={range === r ? "active" : ""} onClick={() => setRange(r)}>{r}</button>
          ))}
        </div>
      </div>
      <div className="resp-chart">
        {data.map((c, i) => {
          const v = c.response_time != null ? (c.response_time / max) * 100 : 4;
          return (
            <i key={i} className={c.response_time != null && c.response_time === max ? "peak" : ""}
              style={{ height: `${v}%`, background: c.status === "down" ? "var(--red)" : undefined }} />
          );
        })}
      </div>
      <div className="resp-axis">
        <span>{range === "1h" ? "1h ago" : range === "6h" ? "6h ago" : "24h ago"}</span>
        <span>now</span>
      </div>
    </div>
  );
}

function UptimeBar({ checks }: { checks: any[] }) {
  const segs = checks.slice(0, 60);
  return (
    <div>
      <div className="uptime-bar">
        {segs.length === 0 && <div className="muted">No checks yet.</div>}
        {segs.map((c, i) => (
          <i key={i} className={c.status === "down" ? "down" : !c.status ? "paused" : ""}
            title={`${fmtTime(c.checked_at)} · ${c.status}${c.response_time != null ? " · " + Math.ceil(c.response_time) + "ms" : ""}`} />
        ))}
      </div>
    </div>
  );
}

function Timeline({ incidents }: { incidents: any[] }) {
  if (!incidents.length) {
    return (
      <div className="info-card glass-2" style={{ textAlign: "center" }}>
        <div style={{ color: "var(--green)", display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <Icon name="check-circle" size={28} />
        </div>
        <strong>No incidents recorded</strong>
        <p className="muted" style={{ marginTop: 4 }}>This service has a clean history.</p>
      </div>
    );
  }
  return (
    <div className="timeline">
      {incidents.map((inc) => {
        const ongoing = !inc.resolved_at;
        const dot = ongoing ? "red" : "green";
        return (
          <div className="tl-item" key={inc.id}>
            <div className={`tl-dot ${dot}`}><Icon name={ongoing ? "alert" : "check"} /></div>
            <div className="tl-head">
              <span className="tl-title">
                {inc.reason || (ongoing ? "Ongoing incident" : "Resolved incident")}
                {inc.status_code ? <span className="muted" style={{ fontWeight: 400 }}> · HTTP {inc.status_code}</span> : null}
              </span>
              <span className="tl-time">{fmtTime(inc.started_at)}</span>
            </div>
            {inc.recovery_minutes != null && (
              <div className="tl-desc">Recovered in {Math.round(inc.recovery_minutes)} min</div>
            )}
            {inc.ai_explanation && (
              <div className="tl-desc" style={{ color: "var(--on-surface)" }}>{inc.ai_explanation}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function MonitorDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [m, setM] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(false);

  async function load() {
    setLoading(true);
    try { setM(await api.getMonitor(Number(id))); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]);

  if (loading) return <Shell><div className="center-screen"><Loader /></div></Shell>;
  if (!m) return <Shell><div className="content"><p className="muted">Monitor not found.</p><Link to="/">← Back</Link></div></Shell>;

  const st = !m.enabled ? "paused" : m.status;
  const open = m.recent_incidents?.find((i: any) => !i.resolved_at);

  return (
    <Shell>
      <Topbar
        title={m.name}
        sub={m.url}
        actions={
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={async () => { await api.updateMonitor(m.id, { enabled: !m.enabled }); load(); }}>
              <Icon name={m.enabled ? "pause" : "play"} size={16} /> {m.enabled ? "Pause" : "Resume"}
            </button>
            <button className="btn btn-sm" onClick={() => setEditor(true)}>
              <Icon name="edit" size={16} /> Edit settings
            </button>
            <Link className="btn btn-ghost btn-sm" to="/dashboard">← Monitors</Link>
          </div>
        }
      />
      <div className="content">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 22 }}>
          <span className={`status-pill ${st === "down" ? "down" : st === "paused" ? "purple" : ""}`}>
            <span className={`pulse-dot ${st === "down" ? "down" : st === "paused" ? "purple" : ""}`} />
            {st === "up" ? "Operational" : st === "down" ? "Down" : "Paused"}
          </span>
          <span className="badge">every {m.interval < 60 ? `${m.interval}s` : `${Math.round(m.interval / 60)}m`}</span>
        </div>

        {open && (
          <div className="alert-demo" style={{ marginBottom: 22 }}>
            <div className="top"><Icon name="alert" /> Outage in progress</div>
            <div style={{ fontWeight: 600, marginTop: 6 }}>
              Since {fmtTime(open.started_at)}{open.status_code ? ` · HTTP ${open.status_code}` : ""}
              {open.reason ? ` · ${open.reason}` : ""}
            </div>
            {open.ai_explanation && <div className="meta" style={{ marginTop: 8, color: "var(--on-surface-variant)" }}>{open.ai_explanation}</div>}
          </div>
        )}

        <div className="bento">
          <Bento label="Uptime 24h" value={m.uptime_24h != null ? `${m.uptime_24h}%` : "—"} />
          <Bento label="Avg Response" value={m.avg_response_time != null ? `${Math.ceil(m.avg_response_time)}ms` : "—"} />
          <Bento label="Checks 24h" value={m.recent_checks?.length || 0} />
          <Bento label="Incidents" value={m.recent_incidents?.length || 0} color={(m.recent_incidents?.length || 0) ? "var(--red)" : "var(--green)"} sub={open ? "1 active" : "none active"} />
        </div>

        <div className="cols-2">
          <ResponseChart checks={m.recent_checks || []} />
          <div className="info-card glass-2">
            <div className="kpi-label" style={{ marginBottom: 8 }}>Service Details</div>
            <div className="info-row"><span>Status</span><span className="cell-mono" style={{ color: st === "down" ? "var(--red)" : st === "paused" ? "var(--purple-soft)" : "var(--green)" }}>{st}</span></div>
            <div className="info-row"><span>Interval</span><span className="cell-mono">{m.interval}s</span></div>
            <div className="info-row"><span>Last checked</span><span className="cell-mono">{fmtTime(m.last_checked)}</span></div>
            <div className="info-row"><span>Enabled</span><span className="cell-mono">{m.enabled ? "yes" : "no"}</span></div>
          </div>
        </div>

        <div className="section-title">Response over time · last 24 hours</div>
        <UptimeBar checks={m.recent_checks || []} />

        <div className="section-title">Incident history</div>
        <Timeline incidents={m.recent_incidents || []} />

        {editor && (
          <MonitorEditor
            monitor={m}
            onClose={() => setEditor(false)}
            onSaved={(mm) => { setEditor(false); setM(mm); load(); }}
            onDeleted={() => nav("/dashboard")}
          />
        )}
      </div>
    </Shell>
  );
}
