import { Link, useNavigate } from "react-router-dom";
import { createContext, useContext, useState, useRef, useEffect } from "react";

import { useAuth } from "../auth";
import Icon from "./Icon";
import { API_BASE } from "../api";
import { DOCS_HOME_URL } from "../docsSite";

const SidebarCtx = createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null);

const NAV = [
  { to: "/dashboard", label: "Monitors", icon: "server", end: true },
  { to: "/incidents", label: "Incidents", icon: "alert" },
  { to: "/settings", label: "Settings", icon: "settings" },
  { to: "/profile", label: "My Profile", icon: "users" },
  { href: DOCS_HOME_URL, label: "Documentation", icon: "book", external: true },
];

/* ── Inline modal helpers (no new dependency) ── */
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
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

function UserMenuModals({ showShortcuts, showComing, onCloseShortcuts, onCloseComing }: { showShortcuts: boolean; showComing: boolean; onCloseShortcuts: () => void; onCloseComing: () => void }) {
  return (
    <>
      {showShortcuts && (
        <Modal title="Keyboard Shortcuts" onClose={onCloseShortcuts} wide>
          <p style={{ opacity: 0.7, margin: "0 0 14px", fontSize: 13 }}>Navigate faster without touching the mouse.</p>
          <table className="shortcuts-table">
            <thead><tr><th>Keys</th><th>Action</th></tr></thead>
            <tbody>
              <tr><td><code>G then D</code></td><td>Go to Dashboard</td></tr>
              <tr><td><code>G then S</code></td><td>Go to Settings</td></tr>
              <tr><td><code>G then M</code></td><td>Go to Monitors</td></tr>
              <tr><td><code>G then I</code></td><td>Go to Incidents</td></tr>
              <tr><td><code>⌘ / Ctrl + K</code></td><td>Command palette <span style={{ opacity: 0.7 }}>(coming soon)</span></td></tr>
              <tr><td><code>?</code></td><td>Show shortcuts</td></tr>
            </tbody>
          </table>
          <p style={{ opacity: 0.65, marginTop: 14, fontSize: 12 }}>Press <code>Esc</code> or click outside to close.</p>
        </Modal>
      )}
      {showComing && (
        <Modal title="What's New" onClose={onCloseComing}>
          <div style={{ textAlign: "center", padding: "18px 4px" }}>
            <div style={{ fontSize: 38, marginBottom: 8 }}>🚀</div>
            <h4 style={{ margin: "0 0 6px" }}>Coming soon</h4>
            <p style={{ margin: 0, opacity: 0.72, fontSize: 13 }}>
              We're cooking the next batch — public status page themes, Slack workflows, API v2, and more.
            </p>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={onCloseComing}>Got it</button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const initial = (user?.full_name || user?.email || "U").toString().charAt(0).toUpperCase();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showComing, setShowComing] = useState(false);
  const openShortcuts = () => setShowShortcuts(true);
  const closeShortcuts = () => setShowShortcuts(false);
  const openSoon = () => setShowComing(true);
  const closeSoon = () => setShowComing(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <>
      <div className={`nav-backdrop ${open ? "show" : ""}`} onClick={onNavigate} />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <img src="/favicon/pulsewatch.png" alt="PulseWatch" style={{ height: 28 }} />
          <div>
            <h1>PulseWatch</h1>
            <div className="plan">v2.4.0</div>
          </div>
          <button className="nav-close" onClick={onNavigate} aria-label="Close menu"><Icon name="x" size={18} /></button>
        </div>

        <nav className="nav">
          {NAV.map((n) =>
            n.external ? (
              <a key={n.label} className="nav-item" href={n.href} target="_blank" rel="noreferrer" onClick={onNavigate}>
                <Icon name={n.icon} /> {n.label}
              </a>
            ) : (
              <Link key={n.label} className="nav-item" to={n.to as string} onClick={onNavigate}>
                <Icon name={n.icon} /> {n.label}
              </Link>
            )
          )}
          <a className="nav-item" href={user?.status_slug ? `/status/slug/${user.status_slug}` : `/status/${user?.id}`} target="_blank" rel="noreferrer" onClick={onNavigate}>
            <Icon name="globe" /> Status Pages
          </a>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" style={{ position: "relative" }} ref={menuRef}>
            <button className="avatar-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Account menu">
              <div className="avatar">{initial}</div>
            </button>
            {menuOpen && (
              <div className="user-menu glass-2">
                <div className="um-head">
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{user?.full_name || "Developer"}</div>
                  <div className="email" style={{ fontSize: 11 }}>{user?.email}</div>
                </div>
                <button className="um-item" onClick={() => { setMenuOpen(false); nav("/profile"); }}>My Profile</button>
                <button className="um-item" onClick={() => { setMenuOpen(false); nav("/settings"); }}>Settings</button>
                <a className="um-item" href={DOCS_HOME_URL} target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)}>Documentation</a>
                <div className="um-sep" />
                <button className="um-item" onClick={() => { setMenuOpen(false); setShowShortcuts(true); }}>
                  <Icon name="keyboard" size={16} /> Keyboard Shortcuts
                </button>
                <button className="um-item" onClick={() => { setMenuOpen(false); setShowComing(true); }}>
                  <Icon name="sparkles" size={16} /> What&apos;s New
                </button>
                <div className="um-sep" />
                <button className="um-item danger" onClick={() => { logout(); nav("/login"); }}>Logout</button>
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--on-surface)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.full_name || "Developer"}
              </div>
              <div className="email">{user?.email}</div>
            </div>
          </div>
          <button className="nav-item" onClick={() => { logout(); nav("/login"); }} style={{ borderTop: "1px solid var(--outline)" }}>
            <Icon name="logout" /> Logout
          </button>
        </div>
        <div className="sidebar-foot">
          <span>PulseWatch</span>
          <span>v2.4.0</span>
          <a href={`${API_BASE}/status/health`} target="_blank" rel="noreferrer">System Status</a>
        </div>
      </aside>

      <UserMenuModals
        showShortcuts={showShortcuts}
        showComing={showComing}
        onCloseShortcuts={closeShortcuts}
        onCloseComing={closeSoon}
      />
    </>
  );
}

export function Topbar({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  const ctx = useContext(SidebarCtx);
  const toggle = () => ctx?.setOpen(!ctx.open);
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="nav-toggle" onClick={toggle} aria-label="Toggle menu"><Icon name="menu" size={20} /></button>
        <div>
          <h2>{title}</h2>
          {sub && <p className="sub">{sub}</p>}
        </div>
      </div>
      <div className="topbar-actions">{actions}</div>
    </header>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const sequenceRef = useRef<string>("");
  const sequenceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName);
      const mod = e.metaKey || e.ctrlKey;

      if (e.key === "?") {
        if (!isInput) {
          e.preventDefault();
          setShowShortcuts((v) => !v);
        }
        return;
      }

      if (mod && e.key.toLowerCase() === "k") {
        if (!isInput) {
          e.preventDefault();
          setShowShortcuts(true);
        }
        return;
      }

      if (isInput) return;

      const key = e.key.toLowerCase();
      if (sequenceTimerRef.current) window.clearTimeout(sequenceTimerRef.current);

      if (key === "g") {
        sequenceRef.current = "g";
        sequenceTimerRef.current = window.setTimeout(() => {
          sequenceRef.current = "";
        }, 1200);
        return;
      }

      if (sequenceRef.current === "g") {
        const navMap: Record<string, string> = {
          d: "/dashboard",
          s: "/settings",
          m: "/dashboard",
          i: "/incidents",
        };

        if (navMap[key]) {
          e.preventDefault();
          window.location.href = navMap[key];
        }
        sequenceRef.current = "";
        if (sequenceTimerRef.current) window.clearTimeout(sequenceTimerRef.current);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <SidebarCtx.Provider value={{ open, setOpen }}>
      <div className="app-shell">
        <Sidebar open={open} onNavigate={() => setOpen(false)} />
        <UserMenuModals
          showShortcuts={showShortcuts}
          showComing={false}
          onCloseShortcuts={() => setShowShortcuts(false)}
          onCloseComing={() => {}}
        />
        <main className="main">{children}</main>
      </div>
    </SidebarCtx.Provider>
  );
}
