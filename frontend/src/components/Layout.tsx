import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import Icon from "./Icon";

const NAV = [
  { to: "/dashboard", label: "Monitors", icon: "server", end: true },
  { to: "/incidents", label: "Incidents", icon: "alert" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const initial = (user?.full_name || user?.email || "U").toString().charAt(0).toUpperCase();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="mark" style={{ width: 38, height: 38, borderRadius: 11, background: "var(--primary)", display: "grid", placeItems: "center", color: "var(--on-primary)" }}>
          <Icon name="heart-pulse" />
        </span>
        <div>
          <h1>PulseWatch</h1>
          <div className="plan">v2.4.0</div>
        </div>
      </div>

      <nav className="nav">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <Icon name={n.icon} /> {n.label}
          </NavLink>
        ))}
        <a className="nav-item" href={`/status/${user?.id}`} target="_blank" rel="noreferrer">
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
  );
}

export function Topbar({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <header className="topbar">
      <div>
        <h2>{title}</h2>
        {sub && <p className="sub">{sub}</p>}
      </div>
      <div className="topbar-actions">{actions}</div>
    </header>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">{children}</main>
    </div>
  );
}
