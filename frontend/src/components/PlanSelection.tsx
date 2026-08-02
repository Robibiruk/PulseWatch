import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../api";
import Icon from "../components/Icon";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:8000";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "/forever",
    features: ["10 monitors", "5-minute checks", "Telegram alerts", "Basic history"],
    cta: "Get Started",
    style: "btn-ghost",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$5",
    period: "/month",
    features: ["100 monitors", "1-minute checks", "Status pages", "SSL monitoring", "AI explanations", "Multi-channel alerts"],
    cta: "Upgrade to Pro",
    style: "btn",
    featured: true,
    stars: 50,
  },
  {
    id: "team",
    name: "Team",
    price: "$15",
    period: "/month",
    features: ["Unlimited monitors", "30-second checks", "Everything in Pro", "Team accounts", "API access", "Priority support"],
    cta: "Upgrade to Team",
    style: "btn-ghost",
    stars: 150,
  },
];

export default function PlanSelection({ onComplete, defaultPlan, trialExpired }: { onComplete: () => void; defaultPlan?: string; trialExpired?: boolean }) {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(defaultPlan || null);

  const choosePlan = async (planId: string) => {
    if (planId === "free") {
      setBusy(true);
      try {
        await api.setPlan("free");
        onComplete();
        nav("/dashboard", { replace: true });
      } catch {
        onComplete();
        nav("/dashboard", { replace: true });
      } finally {
        setBusy(false);
      }
      return;
    }

    // Paid plan — open Telegram directly (one click)
    setSelected(planId);
    try {
      const status = await api.tgLink();
      const bot = status.bot_username || "Pulse_WatchBot";
      // Open Telegram with plan param — bot handles linking + payment
      window.location.href = `https://t.me/${bot}?start=plan_${planId}`;
    } catch {
      // Fallback — try direct Telegram link
      window.location.href = `https://t.me/Pulse_WatchBot?start=plan_${planId}`;
    }
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 200 }}>
      <div className="modal-card modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>{trialExpired ? "Your trial has ended" : "Choose your plan"}</h3>
            <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
              {trialExpired
                ? "Upgrade to keep monitoring. Pay with Telegram Stars."
                : "Start free, upgrade anytime. Pay with Telegram Stars."}
            </p>
          </div>
        </div>
        <div className="modal-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 8 }}>
            {PLANS.map((p) => (
              <div
                key={p.id}
                className={`glass-2 ${selected === p.id ? "selected" : ""}`}
                style={{
                  padding: "20px 16px",
                  borderRadius: 14,
                  border: selected === p.id ? "2px solid var(--primary)" : "1px solid var(--outline)",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.2s",
                  position: "relative",
                }}
                onClick={() => choosePlan(p.id)}
              >
                {p.featured && (
                  <div style={{
                    position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
                    background: "var(--primary)", color: "var(--on-primary)",
                    fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 999,
                    letterSpacing: "0.05em",
                  }}>
                    POPULAR
                  </div>
                )}
                <h4 style={{ margin: "0 0 8px", fontSize: 16 }}>{p.name}</h4>
                <div style={{ fontSize: 28, fontWeight: 700 }}>
                  {p.price}<span style={{ fontSize: 13, fontWeight: 400, color: "var(--on-surface-muted)" }}>{p.period}</span>
                </div>
                {p.stars && (
                  <div style={{ fontSize: 11, color: "var(--on-surface-muted)", marginTop: 4 }}>
                    or {p.stars} Telegram Stars
                  </div>
                )}
                <ul style={{ listStyle: "none", padding: 0, margin: "14px 0", textAlign: "left" }}>
                  {p.features.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "3px 0", color: "var(--on-surface-variant)" }}>
                      <Icon name="check" size={13} /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  className={`btn ${p.style} btn-sm`}
                  style={{ width: "100%" }}
                  disabled={busy && selected === p.id}
                >
                  {busy && selected === p.id ? "..." : p.cta}
                </button>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 14 }}>
            <button
              className="btn-ghost"
              style={{ background: "none", border: "none", color: "var(--on-surface-muted)", cursor: "pointer", fontSize: 13 }}
              onClick={() => { onComplete(); nav("/dashboard", { replace: true }); }}
            >
              Skip for now →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
