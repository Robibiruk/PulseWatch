import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import * as api from "../api";
import UptimeBar from "../components/UptimeBar";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [monitors, setMonitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", interval: 60 });
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    try { setMonitors(await api.listMonitors()); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    try {
      await api.createMonitor(form);
      setForm({ name: "", url: "", interval: 60 }); setShowAdd(false); await load();
    } catch (e: any) { setErr(e.message); }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this monitor?")) return;
    await api.deleteMonitor(id); await load();
  };

  return (
    <>
      <div className="nav">
        <div className="brand"><span className="logo">❤</span> PulseWatch</div>
        <div className="btn-row">
          <span className="badge">{user?.email}</span>
          <button className="ghost" style={{ width: "auto", padding: "8px 14px" }} onClick={() => { logout(); nav("/login"); }}>
            Sign out
          </button>
        </div>
      </div>

      <div className="container">
        <div className="header-row">
          <div>
            <h1 style={{ margin: 0 }}>My Monitors</h1>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Worker runs free on GitHub Actions · checks saved to Neon
            </p>
          </div>
          <button style={{ width: "auto" }} onClick={() => setShowAdd(!showAdd)}>
            + Add monitor
          </button>
        </div>

        {showAdd && (
          <form className="card" style={{ maxWidth: "100%", marginBottom: 18 }} onSubmit={add}>
            <div className="split">
              <input placeholder="Name (e.g. Portfolio)" value={form.name} required
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input placeholder="https://myapp.com" value={form.url} required
                onChange={(e) => setForm({ ...form, url: e.target.value })} />
              <select value={form.interval}
                onChange={(e) => setForm({ ...form, interval: Number(e.target.value) })}
                style={{ maxWidth: 140 }}>
                <option value={60}>1 min</option>
                <option value={300}>5 min</option>
                <option value={600}>10 min</option>
                <option value={1800}>30 min</option>
              </select>
            </div>
            {err && <div className="error">{err}</div>}
            <div className="btn-row">
              <button style={{ maxWidth: 160 }}>Save</button>
              <button type="button" className="ghost" style={{ maxWidth: 160 }} onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </form>
        )}

        {loading ? <p className="muted"><span className="spinner" /> loading…</p> :
          monitors.length === 0 ? (
            <div className="empty">No monitors yet. Add your first website to start watching it.</div>
          ) : (
            <div className="grid">
              {monitors.map((m) => (
                <div key={m.id} className="monitor">
                  <div className="top">
                    <span className="pill">
                      <span className={`dot ${m.enabled ? m.status : "paused"}`} />
                      <span className="mname">{m.name}</span>
                    </span>
                    <span className="badge">{m.interval}s</span>
                  </div>
                  <div className="url">{m.url}</div>
                  <div className="metrics">
                    <div className="metric">
                      <div className="v" style={{ color: m.status === "down" ? "var(--red)" : "var(--green)" }}>
                        {m.status === "up" ? "UP" : m.enabled ? "DOWN" : "PAUSED"}
                      </div>
                      <div className="l">Status</div>
                    </div>
                    <div className="metric">
                      <div className="v">{m.last_checked ? "" : "—"}</div>
                      <div className="l">Last check</div>
                    </div>
                  </div>
                  <UptimeBar checks={m.recent_checks || []} />
                  <div className="btn-row" style={{ marginTop: 14 }}>
                    <button className="ghost" style={{ padding: "8px" }}
                      onClick={() => nav(`/monitor/${m.id}`)}>Details</button>
                    <button className="danger" style={{ padding: "8px", maxWidth: 90 }} onClick={() => remove(m.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </>
  );
}
