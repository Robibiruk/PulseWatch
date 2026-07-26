import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import * as api from "../api";
import Icon from "../components/Icon";

export default function PublicStatus() {
  const { ownerId } = useParams();
  const [services, setServices] = useState<any[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.publicStatus(Number(ownerId))
      .then(setServices)
      .catch((e) => setErr(e.message));
  }, [ownerId]);

  if (err) return (
    <div className="status-page">
      <div className="auth-logo" style={{ justifyContent: "center", marginBottom: 14 }}>
        <span className="mark"><Icon name="heart-pulse" /></span>
        <h1 style={{ color: "var(--primary)" }}>PulseWatch</h1>
      </div>
      <div className="empty">{err}</div>
    </div>
  );
  if (!services) return (
    <div className="status-page"><span className="spinner" /></div>
  );

  const allUp = services.length > 0 && services.every((s) => s.status === "up");

  return (
    <div className="status-page">
      <div className="auth-logo" style={{ justifyContent: "center", marginBottom: 18 }}>
        <span className="mark"><Icon name="heart-pulse" /></span>
        <h1 style={{ color: "var(--on-surface)" }}>PulseWatch</h1>
      </div>

      <div className={`status-banner ${allUp ? "" : "down"}`}>
        <div className="ring" />
        <div className="ring r2" />
        <h1>{allUp ? "All Systems Operational" : "Some Systems Disrupted"}</h1>
        <p>{allUp
          ? "All monitored services are running normally."
          : "We are investigating issues with some services."}</p>
      </div>

      {services.length === 0 && (
        <p className="muted" style={{ textAlign: "center", marginTop: 24 }}>No public monitors.</p>
      )}

      {services.map((s) => {
        const down = s.status === "down";
        return (
          <div className="pub-row glass-2" key={s.name}>
            <div className="top">
              <div className="name">
                <span className="svc-ico"><Icon name={s.url?.includes("api") ? "webhook" : "globe"} size={18} /></span>
                {s.name}
                <span className="svc-url">{s.url}</span>
              </div>
              <div className="val down" style={down ? undefined : { color: "var(--green)" }}>
                <span className={`pulse-dot ${down ? "down" : ""}`} />
                {s.status === "up" ? "Operational" : down ? "Down" : "Paused"}
              </div>
            </div>
            <div className="mini-spark" style={{ marginTop: 14 }}>
              {(s.spark || []).slice(0, 40).map((st: string, i: number) => (
                <i key={i} className={st === "down" ? "down" : st === "paused" ? "paused" : ""} />
              ))}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              {s.uptime_24h}% uptime · {s.avg_response_time != null ? `${Math.ceil(s.avg_response_time)}ms avg` : "—"}
            </div>
          </div>
        );
      })}

      <p className="muted" style={{ textAlign: "center", fontSize: 12, marginTop: 32 }}>
        Powered by PulseWatch · monitored free on GitHub Actions
      </p>
    </div>
  );
}
