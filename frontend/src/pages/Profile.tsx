import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import * as api from "../api";
import Icon from "../components/Icon";
import BrandIcon from "../components/BrandIcon";
import { Shell, Topbar } from "../components/Layout";

/* ── Inline modal (portal-free, fits project style) ── */
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={"modal-card" + (wide ? " modal-wide" : "")} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ── Keyboard shortcuts table ── */
const SHORTCUTS = [
  ["G then D", "Go to Dashboard"],
  ["G then S", "Go to Settings"],
  ["G then M", "Go to Monitors"],
  ["G then I", "Go to Incidents"],
  ["⌘/Ctrl + K", "Command palette (coming soon)"],
  ["?", "Show shortcuts"],
]; // prettier-ignore

function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard Shortcuts" onClose={onClose} wide>
      <p style={{ opacity: 0.7, margin: "0 0 14px", fontSize: 13 }}>Navigate faster without touching the mouse.</p>
      <table className="shortcuts-table">
        <thead><tr><th>Keys</th><th>Action</th></tr></thead>
        <tbody>
          {SHORTCUTS.map(([k, a]) => (
            <tr key={k}>
              <td><code>{k}</code></td>
              <td>{a}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ opacity: 0.65, marginTop: 14, fontSize: 12 }}>Press <code>Esc</code> or click outside to close.</p>
    </Modal>
  );
}

/* ── Coming Soon modal ── */
function ComingSoonModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="What&apos;s New" onClose={onClose}>
      <div style={{ textAlign: "center", padding: "18px 4px" }}>
        <div style={{ fontSize: 38, marginBottom: 8 }}>🚀</div>
        <h4 style={{ margin: "0 0 6px" }}>Coming soon</h4>
        <p style={{ margin: 0, opacity: 0.72, fontSize: 13 }}>
          We&apos;re cooking the next batch — public status page themes, Slack workflows, API v2, and more.
        </p>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={onClose}>Got it</button>
      </div>
    </Modal>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const h = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return reduced;
}

export default function PageProfile() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState<string | null>(null);
  const [sum, setSum] = useState<any | null>(null);
  const reduced = usePrefersReducedMotion();

  const name = user?.full_name || user?.email?.split("@")[0] || "User";
  const initials = (user?.full_name || "U").split(" ").map((s: string) => s[0]?.toUpperCase()).slice(0, 2).join("") || "U";
  const paused = !!user?.alerts_paused;
  const joined = user?.created_at ? new Date(user.created_at) : null;
  const enabled = (user?.enabled_channels || "telegram,email").split(",").map((s: string) => s.trim()).filter(Boolean);

  useEffect(() => {
    api.monitorSummary().then(setSum).catch(() => setSum(null));
  }, []);

  const stats = [
    { label: "Monitors", value: sum?.total ?? "—", icon: "server" as const, tone: "" },
    { label: "Operational", value: sum?.up ?? "—", icon: "check-circle" as const, tone: "ok" },
    { label: "Down", value: sum?.down ?? "—", icon: "alert" as const, tone: (sum?.down ?? 0) > 0 ? "bad" : "" },
    { label: "Incidents", value: sum?.active_incidents ?? "—", icon: "activity" as const, tone: (sum?.active_incidents ?? 0) > 0 ? "warn" : "" },
  ];

  const chans: { key: string; label: string; brand?: string; icon: string; on: boolean; note: string }[] = [
    { key: "telegram", label: "Telegram", brand: "telegram", icon: "telegram", on: !!user?.telegram_chat_id, note: user?.telegram_chat_id ? "Linked" : "Not linked" },
    { key: "email", label: "Email", brand: "email", icon: "mail", on: true, note: user?.alert_email || "Account email" },
    { key: "slack", label: "Slack", brand: "slack", icon: "slack", on: !!user?.slack_webhook, note: "Webhook" },
    { key: "discord", label: "Discord", brand: "discord", icon: "discord", on: !!user?.discord_webhook, note: "Webhook" },
    { key: "webhook", label: "Webhook", icon: "webhook", on: !!user?.webhook_url, note: "URL" },
  ].filter((c) => enabled.includes(c.key) || c.on);

  // Signal trace: the account read as a monitored service. The pulse is alive
  // while alerts are on; it goes flat when alerts are paused.
  const pulse = paused
    ? "M0 32 H600"
    : "M0 32 H170 L184 32 L192 10 L202 54 L212 32 L232 32 L246 32 L254 14 L266 50 L276 32 H400 L414 32 L422 12 L432 52 L442 32 H600";

  return (
    <Shell>
      <Topbar title="My Profile" sub={user?.email || ""} />
      <div className="content">
        <div className="prf-card">
          <div className="prf-trace">
            <div className="prf-trace-meta">
              <span className="prf-trace-tag"><i className={`prf-live-dot ${paused ? "off" : ""}`} />SIGNAL</span>
              <span className="prf-trace-state">{paused ? "PAUSED" : "LIVE"}</span>
            </div>
            <svg viewBox="0 0 600 64" preserveAspectRatio="none" className="prf-trace-svg" aria-hidden="true">
              <path d={pulse} className="prf-track" />
              <path d={pulse} className="prf-tracer" />
              {!reduced && <circle r="3.2" className="prf-node"><animateMotion dur="3.2s" repeatCount="indefinite" path={pulse} /></circle>}
            </svg>
          </div>

          <div className="prf-body">
            <div className="prf-head">
              <div className="prf-avatar">{initials}</div>
              <div className="prf-ident">
                <div className="prf-name-row">
                  <h1 className="prf-name">{name}</h1>
                  <span className={`prf-status ${paused ? "off" : ""}`}><i />{paused ? "Paused" : "Active"}</span>
                </div>
                <div className="prf-email">{user?.email}</div>
                <div className="prf-meta">
                  Member since {joined ? joined.toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "—"}
                  <span className="prf-meta-sep">·</span>User #{user?.id ?? "—"}
                </div>
              </div>
            </div>

            <div className="prf-stats">
              {stats.map((s) => (
                <div className="prf-stat" key={s.label}>
                  <div className="prf-stat-label"><Icon name={s.icon} size={13} />{s.label}</div>
                  <div className={`prf-stat-value ${s.tone}`}>{s.value}</div>
                </div>
              ))}
            </div>

            <section className="prf-section">
              <h2 className="prf-section-label"><Icon name="terminal" size={14} />Account</h2>
              <div className="prf-rows">
                <div className="prf-row">
                  <span className="prf-k">User ID</span>
                  <span className="prf-v mono">{user?.id ?? "—"}</span>
                </div>
                <div className="prf-row">
                  <span className="prf-k">Email</span>
                  <span className="prf-v mono">{user?.email || "—"}</span>
                </div>
                <div className="prf-row">
                  <span className="prf-k">Alert destination</span>
                  <span className="prf-v mono">{user?.alert_email || user?.email || "—"}</span>
                </div>
                <div className="prf-row">
                  <span className="prf-k">Role</span>
                  <span className="prf-v">Owner</span>
                </div>
              </div>
            </section>

            <section className="prf-section">
              <h2 className="prf-section-label"><Icon name="bell" size={14} />Notification channels</h2>
              <div className="prf-chips">
                {chans.map((c) => (
                  <div className={`prf-chip ${c.on ? "on" : ""}`} key={c.key}>
                    {c.brand ? <BrandIcon name={c.brand} size={15} /> : <Icon name={c.icon} size={15} />}
                    <span className="prf-chip-name">{c.label}</span>
                    <span className="prf-chip-note">{c.on ? c.note : "Off"}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="prf-actions">
            <button className="btn btn-primary btn-sm" onClick={() => nav("/settings")}>
              <Icon name="settings" size={15} /> Edit profile
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen("shortcuts")}>
              <Icon name="keyboard" size={15} /> Shortcuts
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen("soon")}>
              <Icon name="sparkles" size={15} /> What&apos;s New
            </button>
          </div>
        </div>
      </div>

      {open === "shortcuts" && <KeyboardShortcutsModal onClose={() => setOpen(null)} />}
      {open === "soon" && <ComingSoonModal onClose={() => setOpen(null)} />}
    </Shell>
  );
}
