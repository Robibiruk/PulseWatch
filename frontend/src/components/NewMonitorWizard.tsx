import { useState } from "react";
import { createMonitor } from "../api";
import Icon from "./Icon";
import BrandIcon from "./BrandIcon";
import { IosSwitch } from "./IosSwitch";

type Type = "website" | "api" | "server" | "cron";
const TYPES: Record<Type, { icon: string; title: string; desc: string; ph: string }> = {
  website: { icon: "globe", title: "Website", desc: "HTTP(s) status & content checks", ph: "https://example.com" },
  api: { icon: "webhook", title: "API", desc: "Validate JSON + REST availability", ph: "https://api.example.com/health" },
  server: { icon: "server", title: "Server", desc: "TCP/UDP port & host monitoring", ph: "https://10.0.0.1:443" },
  cron: { icon: "timer", title: "Cron Job", desc: "Heartbeat pings for scheduled tasks", ph: "https://example.com/ping" },
};

const INTERVALS = [60, 300, 600, 1800];

export default function NewMonitorWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<Type>("website");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [interval, setInterval] = useState(300);
  const [ntelegram, setNTelegram] = useState(true);
  const [nemail, setNEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const canNext = step === 0 ? !!type : step === 1 ? url.trim().length > 4 : true;

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      await createMonitor({ name: name.trim() || TYPES[type].title, url: url.trim(), interval });
      onCreated();
    } catch (e: any) {
      setErr(e.message || "Failed to create monitor");
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="wizard glass" onClick={(e) => e.stopPropagation()}>
        <div className="wizard-head">
          <div>
            <h2>New Monitor</h2>
            <div className="step-no">Step {step + 1} of 4</div>
          </div>
          <button className="row-action" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="wizard-progress"><i style={{ width: `${((step + 1) / 4) * 100}%` }} /></div>

        <div className="wizard-body">
          {step === 0 && (
            <>
              <label className="field">What do you want to monitor?</label>
              <div className="type-grid">
                {(Object.keys(TYPES) as Type[]).map((k) => (
                  <div key={k} className={`type-card ${type === k ? "sel" : ""}`} onClick={() => setType(k)}>
                    <div className="ico"><Icon name={TYPES[k].icon} /></div>
                    <h4>{TYPES[k].title}</h4>
                    <p>{TYPES[k].desc}</p>
                    <span className="check"><Icon name="check-circle" /></span>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <label className="field">Monitor name</label>
              <input placeholder={TYPES[type].title} value={name} onChange={(e) => setName(e.target.value)}
                style={{ marginBottom: 14 }} />
              <label className="field">URL to monitor</label>
              <input placeholder={TYPES[type].ph} value={url} onChange={(e) => setUrl(e.target.value)} />
              <div className="info-note">
                <Icon name="shield" />
                We probe from the cloud every interval. No agent install required.
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <label className="field">Check interval</label>
              <div className="slider-box">
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
                  <div style={{ fontSize: 30, fontWeight: 700, color: "var(--primary)" }}>{interval < 60 ? interval : Math.round(interval / 60)}</div>
                  <div className="muted">{interval < 60 ? "seconds" : "minutes"}</div>
                </div>
                <input type="range" min={60} max={1800} step={60} value={interval}
                  onChange={(e) => setInterval(Number(e.target.value))} style={{ width: "100%" }} />
                <div className="slider-scale">
                  {INTERVALS.map((i) => <span key={i} className={interval === i ? "mono" : ""} style={interval === i ? { color: "var(--primary)" } : {}}>{i / 60}m</span>)}
                </div>
              </div>
              <div className="info-note">
                <Icon name="zap" />
                Free tier: up to 10 monitors at 5-minute intervals.
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <label className="field">Notifications</label>
              <div className="switch-row">
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span className="ic" style={{ background: "rgba(255,255,255,0.12)", color: "var(--primary)" }}><BrandIcon name="telegram" size={18} /></span>
                  <div><h4>Telegram alerts</h4><div className="sub">Instant outage pings to your chat</div></div>
                </div>
                <IosSwitch on={ntelegram} onChange={() => setNTelegram((v) => !v)} />
              </div>
              <div className="switch-row">
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span className="ic" style={{ background: "rgba(255,255,255,0.10)", color: "var(--purple-soft)" }}><BrandIcon name="gmail" size={18} /></span>
                  <div><h4>Email reports</h4><div className="sub">Daily summary + incident digests</div></div>
                </div>
                <IosSwitch on={nemail} onChange={() => setNEmail((v) => !v)} />
              </div>
            </>
          )}

          {err && <div className="error">{err}</div>}
        </div>

        <div className="wizard-foot">
          <button className="btn btn-ghost" onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>
            {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < 3 ? (
            <button className="btn" disabled={!canNext} onClick={() => setStep(step + 1)}>Continue →</button>
          ) : (
            <button className="btn" disabled={busy} onClick={submit}>{busy ? "…" : "Create Monitor"}</button>
          )}
        </div>
      </div>
    </div>
  );
}
