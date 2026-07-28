import { NavLink, useNavigate } from "react-router-dom";
import { createContext, useContext, useState } from "react";
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
          <a className="nav-item" href={`/status/${user?.id}`} target="_blank" rel="noreferrer" onClick={onNavigate}>
            <Icon name="globe" /> Public Status
          </a>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">{initial}</div>
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
