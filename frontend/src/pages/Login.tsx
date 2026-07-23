import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function Login() {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

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
    <div className="center-screen">
      <form className="card" onSubmit={submit}>
        <div className="brand" style={{ marginBottom: 16 }}>
          <span className="logo">❤</span> PulseWatch
        </div>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="sub muted">Developer-first uptime monitoring. Free, forever.</p>

        {mode === "register" && (
          <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input type="email" placeholder="Email" value={email} required
          onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" value={password} required minLength={6}
          onChange={(e) => setPassword(e.target.value)} />
        {err && <div className="error">{err}</div>}
        <button disabled={busy}>{busy ? "..." : mode === "login" ? "Sign in" : "Sign up"}</button>
        <button type="button" className="ghost" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
