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
    <Modal title="What's New" onClose={onClose}>
      <div style={{ textAlign: "center", padding: "18px 4px" }}>
        <div style={{ fontSize: 38, marginBottom: 8 }}>🚀</div>
        <h4 style={{ margin: "0 0 6px" }}>Coming soon</h4>
        <p style={{ margin: 0, opacity: 0.72, fontSize: 13 }}>
          We're cooking the next batch of PulseWatch features — public status page themes, Slack workflows, API v2, and more.
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
        <div className="profile-hero glass-2">
          <div className="avatar-lg" style={{ background: "var(--primary)", color: "#04121a", fontSize: 22, fontWeight: 700 }}>{initials}</div>
          <div>
            <h2 style={{ margin: "0 0 4px" }}>{name}</h2>
            <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>{user?.email} {user?.telegram_chat_id ? "· Telegram linked" : ""}</p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setOpen("shortcuts")}>⌨️ Shortcuts</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen("soon")}>✨ What's New</button>
          </div>
        </div>

        <div className="profile-grid" style={{ marginTop: 18 }}>
          <div className="set-card glass-2">
            <h3>Account</h3>
            <Row label="User ID" value={`#${user?.id ?? "—"}`} />
            <Row label="Display name" value={user?.full_name || "—"} />
            <Row label="Email" value={user?.email || "—"} />
            <Row label="Created" value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"} />
          </div>
          <div className="set-card glass-2">
            <h3>Monitoring</h3>
            <Row label="Status" value={user?.alerts_paused ? "Paused" : "Active"} />
            <Row label="Channels" value={(user?.enabled_channels || "telegram,email").split(",").join(", ")} />
            <Row label="Telegram" value={user?.telegram_chat_id ? "Linked" : "Not linked"} />
          </div>
        </div>
      </div>

      {open === "shortcuts" && <KeyboardShortcutsModal onClose={() => setOpen(null)} />}
      {open === "soon" && <ComingSoonModal onClose={() => setOpen(null)} />}
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="set-row">
      <div className="k">{label}</div>
      <div className="v" style={{ fontWeight: 500 }}>{value}</div>
    </div>
  );
}
