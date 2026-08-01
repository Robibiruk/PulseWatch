import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth";
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

/* ── Profile page ── */
export default function PageProfile() {
  const { user } = useAuth();
  const [open, setOpen] = useState<string | null>(null);
  const name = user?.full_name || user?.email?.split("@")[0] || "User";
  const initials = (user?.full_name || "U").split(" ").map((s: string) => s[0]?.toUpperCase()).slice(0, 2).join("") || "U";

  return (
    <Shell>
      <Topbar title="My Profile" sub={user?.email || ""} />
      <div className="content">
        <div className="profile-card">
          <div className="pulse-trace">
            <svg width="100%" height="20" viewBox="0 0 400 20" preserveAspectRatio="none">
              <polyline points="0,10 130,10 145,10 155,2 165,18 175,10 190,10 400,10" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" style={{ opacity: 0.7 }} />
              <circle r="3" fill="var(--primary)">
                <animateMotion dur="3.5s" repeatCount="indefinite" path="M0,10 L130,10 L145,10 L155,2 L165,18 L175,10 L190,10 L400,10" />
              </circle>
            </svg>
          </div>

          <div className="profile-header">
            <div className="avatar-wrap">
              <div className="avatar">{initials}</div>
              <div className="status-dot"></div>
            </div>
            <div className="identity">
              <p className="name">{name}</p>
              <p className="email">{user?.email}{user?.telegram_chat_id ? " · Telegram linked" : ""}
              </p>
            </div>
          </div>

          {user?.telegram_chat_id && (
            <div className="telegram-badge">
              <i className="ti ti-brand-telegram"></i> Telegram linked
            </div>
          )}

          <div className="section">
            <p className="section-label">Account</p>
            <table className="field-table">
              <tr><td><i className="ti ti-hash"></i>User ID</td><td className="mono">{user?.id ?? "—"}</td></tr>
              <tr><td><i className="ti ti-user"></i>Display name</td><td>{user?.full_name || "—"}</td></tr>
              <tr><td><i className="ti ti-mail"></i>Email</td><td>{user?.email || "—"}</td></tr>
              <tr><td><i className="ti ti-calendar"></i>Created</td><td className="mono">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</td></tr>
            </table>
          </div>

          <div className="section">
            <p className="section-label">Monitoring</p>
            <table className="field-table">
              <tr>
                <td><i className="ti ti-activity"></i>Status</td>
                <td><span className="status-active"><span className="status-bullet"></span>{user?.alerts_paused ? "Paused" : "Active"}</span></td>
              </tr>
              <tr>
                <td><i className="ti ti-bell"></i>Channels</td>
                <td><span className="pill">telegram</span><span className="pill">email</span></td>
              </tr>
              <tr>
                <td><i className="ti ti-brand-telegram"></i>Telegram</td>
                <td className={user?.telegram_chat_id ? "linked" : ""}><i className="ti ti-check"></i>{user?.telegram_chat_id ? "Linked" : "Not linked"}</td>
              </tr>
            </table>
          </div>
        </div>

        <div className="profile-actions" style={{ marginTop: 18, display: "flex", gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setOpen("shortcuts")}>
            <Icon name="keyboard" size={16} /> Shortcuts
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen("soon")}>
            <Icon name="sparkles" size={16} /> What&apos;s New
          </button>
        </div>
      </div>

      {open === "shortcuts" && <KeyboardShortcutsModal onClose={() => setOpen(null)} />}
      {open === "soon" && <ComingSoonModal onClose={() => setOpen(null)} />}
    </Shell>
  );
}