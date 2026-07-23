import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import * as api from "../api";

export default function PublicStatus() {
  const { ownerId } = useParams();
  const [services, setServices] = useState<any[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.publicStatus(Number(ownerId))
      .then(setServices)
      .catch((e) => setErr(e.message));
  }, [ownerId]);

  if (err) return <div className="status-page"><h2>Status</h2><p className="muted">{err}</p></div>;
  if (!services) return <div className="status-page"><span className="spinner" /></div>;

  const allUp = services.every((s) => s.status === "up");

  return (
    <div className="status-page">
      <div className="brand" style={{ justifyContent: "center", marginBottom: 6 }}>
        <span className="logo">❤</span> PulseWatch
      </div>
      <h2 style={{ textAlign: "center", margin: "0 0 4px" }}>System Status</h2>
      <p className="muted" style={{ textAlign: "center", marginTop: 0 }}>
        {allUp ? "✅ All systems operational" : "🚨 Some systems experiencing issues"}
      </p>

      {services.length === 0 && <p className="muted" style={{ textAlign: "center" }}>No public monitors.</p>}

      {services.map((s) => (
        <div className="public-row" key={s.name}>
          <div>
            <div style={{ fontWeight: 600 }}>{s.name}</div>
            <div className="muted" style={{ fontSize: 12 }}>{s.url}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span className="pill" style={{ justifyContent: "flex-end", gap: 8 }}>
              <span className={`dot ${s.status}`} />
              <strong style={{
                color: s.status === "up" ? "var(--green)" : s.status === "down" ? "var(--red)" : "var(--muted)",
              }}>
                {s.status === "up" ? "Operational" : s.status === "down" ? "Down" : "Paused"}
              </strong>
            </span>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {s.uptime_24h}% uptime · {s.avg_response_time != null ? `${Math.ceil(s.avg_response_time)}ms avg` : "—"}
            </div>
          </div>
        </div>
      ))}

      <p className="muted" style={{ textAlign: "center", fontSize: 12, marginTop: 24 }}>
        Powered by PulseWatch · monitored free on GitHub Actions
      </p>
    </div>
  );
}
