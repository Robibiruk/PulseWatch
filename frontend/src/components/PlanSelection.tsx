import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../api";
import Icon from "../components/Icon";
import BrandIcon from "../components/BrandIcon";

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
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [link, setLink] = useState<string | null>(null);

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

    // Paid plan — check Telegram link status first
    setSelected(planId);
    try {
      const status = await api.tgLink();
      if (status.linked) {
        setTelegramLinked(true);
      } else {
        setTelegramLinked(false);
        setLink(status.link);
        // Open Telegram for linking
        const u = status.bot_username;
        const tok = status.token;
        if (u && tok) {
          window.open(`tg://resolve?domain=${u}&start=plan_${planId}`, "_blank");
        } else if (status.link) {
          window.open(status.link, "_blank");
        }
      }
    } catch {
      // Telegram not configured — just set the plan directly
      await api.setPlan(planId);
      onComplete();
      nav("/dashboard", { replace: true });
    }
  };

  const checkTelegramAndPay = async () => {
    setBusy(true);
    try {
      const status = await api.tgLink();
      if (status.linked) {
        // User linked — send them to bot to pay
        window.open(`https://t.me/${status.bot_username}?start=plan_${selected}`, "_blank");
        // Poll for plan upgrade
        let tries = 0;
        const iv = setInterval(async () => {
          tries++;
          try {
            const me = await api.me();
            if (me.plan === selected) {
              clearInterval(iv);
              onComplete();
              nav("/dashboard", { replace: true });
            }
          } catch { /* ignore */ }
          if (tries >= 20) clearInterval(iv);
        }, 3000);
      } else {
        // Need to link first
        setLink(status.link);
        const u = status.bot_username;
        const tok = status.token;
        if (u && tok) {
          window.open(`tg://resolve?domain=${u}&start=plan_${selected}`, "_blank");
        } else if (status.link) {
          window.open(status.link, "_blank");
        }
        // Poll for link + payment
        let tries = 0;
        const iv = setInterval(async () => {
          tries++;
          try {
            const st = await api.tgLink();
            if (st.linked) {
              setTelegramLinked(true);
              setLink(null);
              // Now send them to pay
              window.open(`https://t.me/${st.bot_username}?start=plan_${selected}`, "_blank");
            }
            const me = await api.me();
            if (me.plan === selected) {
              clearInterval(iv);
              onComplete();
              nav("/dashboard", { replace: true });
            }
          } catch { /* ignore */ }
          if (tries >= 30) clearInterval(iv);
        }, 3000);
      }
    } catch (e: any) {
      // Fallback: just set plan
      await api.setPlan(selected!);
      onComplete();
      nav("/dashboard", { replace: true });
    } finally {
      setBusy(false);
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

          {selected && selected !== "free" && (
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <button
                className="btn btn-primary"
                onClick={checkTelegramAndPay}
                disabled={busy}
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <BrandIcon name="telegram" size={16} />
                {busy ? "Connecting..." : `Pay with Telegram Stars`}
              </button>
              <p style={{ fontSize: 11, color: "var(--on-surface-muted)", marginTop: 8 }}>
                You'll be redirected to Telegram to complete the payment securely.
              </p>
            </div>
          )}

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
