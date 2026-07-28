import { NavLink, useNavigate } from "react-router-dom";
import { createContext, useContext, useState, useRef, useEffect } from "react";
import { useAuth } from "../auth";
import Icon from "./Icon";

const SidebarCtx = createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null);

const NAV = [
  { to: "/dashboard", label: "Monitors", icon: "server", end: true },
  { to: "/incidents", label: "Incidents", icon: "alert" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const initial = (user?.full_name || user?.email || "U").toString().charAt(0).toUpperCase();
  const [menuOpen, setMenuOpen] = useState(false);
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
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} onClick={onNavigate}>
              <Icon name={n.icon} /> {n.label}
            </NavLink>
          ))}
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
                <button className="um-item" onClick={() => { setMenuOpen(false); nav("/settings"); }}>My Profile</button>
                <button className="um-item" onClick={() => { setMenuOpen(false); nav("/settings"); }}>Settings</button>
                <a className="um-item" href="/docs" target="_blank" rel="noreferrer">Documentation</a>
                <button className="um-item" onClick={() => alert("Keyboard shortcuts — coming soon")}>Keyboard Shortcuts</button>
                <button className="um-item" onClick={() => alert("What's New — v2.4.0: API & Security, System Health, richer Incidents")}>What's New</button>
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
          <a href="/status/health" target="_blank" rel="noreferrer">System Status</a>
        </div>
      </aside>
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
  return (
    <SidebarCtx.Provider value={{ open, setOpen }}>
      <div className="app-shell">
        <Sidebar open={open} onNavigate={() => setOpen(false)} />
        <main className="main">{children}</main>
      </div>
    </SidebarCtx.Provider>
  );
}
