import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import * as api from "../api";
import BrandIcon from "../components/BrandIcon";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:8000";

export default function Login() {
  const { login, register, user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Handle GitHub OAuth callback — token arrives as ?token=... in the URL
  useEffect(() => {
    const token = params.get("token");
    if (token) {
      localStorage.setItem("pw_token", token);
      // Fetch user then redirect to dashboard
      api.me().then(() => nav("/dashboard", { replace: true })).catch(() => {});
    }
    const authErr = params.get("error");
    if (authErr) setErr("GitHub authentication failed. Try again or use email.");
  }, [params, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, name);
      nav("/");
    } catch (e: any) {
      setErr(e.message || "Something went wrong");
    } finally { setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-glow" />
      <form className="auth-card glass" onSubmit={submit}>
        <div className="auth-logo">
          <img src="/favicon/pulsewatch.png" alt="PulseWatch" className="auth-logo-img" />
          <span className="auth-logo-word">PulseWatch</span>
        </div>
        <h2 style={{ margin: "0 0 4px", fontSize: 26, textAlign: "center" }}>
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h2>
        <p className="muted" style={{ textAlign: "center", margin: "0 0 22px" }}>
          Infrastructure monitoring at the speed of light.
        </p>

        <button type="button" className="github-btn" onClick={() => window.location.href = `${API_BASE}/auth/github/login`}>
        <BrandIcon name="github" size={18} /> Continue with GitHub
        </button>
        <div className="divider">or email</div>

        {mode === "register" && (
          <div style={{ marginBottom: 14 }}>
            <label className="field">Full name</label>
            <input placeholder="Dev Ops" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <label className="field">Work email</label>
        <input type="email" placeholder="name@company.com" value={email} required
          onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 14 }} />
        <label className="field">Password</label>
        <input type="password" placeholder="••••••••" value={password} required minLength={6}
          onChange={(e) => setPassword(e.target.value)} />

        {err && <div className="error">{err}</div>}
        <button className="btn" disabled={busy} style={{ width: "100%", marginTop: 14 }}>
          {busy ? "…" : mode === "login" ? "Sign In" : "Sign Up"}
        </button>

        <p className="muted" style={{ textAlign: "center", marginTop: 22, fontSize: 14 }}>
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button type="button" className="btn-ghost" style={{ background: "none", border: "none", padding: 0, color: "var(--primary)", cursor: "pointer", font: "inherit", fontWeight: 700 }}
            onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </form>

      <div style={{ position: "absolute", bottom: 28, display: "flex", gap: 14, alignItems: "center" }}>
        <span className="status-pill"><span className="pulse-dot" /> All Systems Operational</span>
        <span className="mono" style={{ color: "var(--on-surface-muted)", fontSize: 11 }}>v2.4.0-stable</span>
      </div>
    </div>
  );
}
