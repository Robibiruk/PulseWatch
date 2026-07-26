import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import Icon from "../components/Icon";

// Animated network: nodes + a pulse travelling along the connecting lines.
function NetworkPulse() {
  const nodes = [
    { id: "web", label: "Website A", x: 18, y: 32 },
    { id: "api", label: "API Server", x: 50, y: 18 },
    { id: "db", label: "Database", x: 82, y: 34 },
    { id: "pay", label: "Payment API", x: 64, y: 74 },
  ];
  const links = [
    [0, 1], [1, 2], [2, 3], [1, 3], [0, 3],
  ];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let raf = 0;
    let t = 0;
    const tick = () => {
      t = (t + 0.006) % 1;
      const dots = root.querySelectorAll<HTMLElement>(".net-pulse");
      dots.forEach((d, i) => {
        const phase = (t + i / dots.length) % 1;
        const [a, b] = links[i % links.length];
        const na = nodes[a], nb = nodes[b];
        const x = na.x + (nb.x - na.x) * phase;
        const y = na.y + (nb.y - na.y) * phase;
        d.style.left = `${x}%`;
        d.style.top = `${y}%`;
        d.style.opacity = String(0.2 + 0.8 * Math.sin(phase * Math.PI));
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="net" ref={ref}>
      {links.map((l, i) => {
        const a = nodes[l[0]], b = nodes[l[1]];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        return (
          <div key={i} className="net-line" style={{
            left: `${a.x}%`, top: `${a.y}%`, width: `${len}%`, transform: `rotate(${ang}deg)`,
          }} />
        );
      })}
      {nodes.map((n) => (
        <div key={n.id} className="net-node" style={{ left: `${n.x}%`, top: `${n.y}%` }}>
          <span className="d" /> {n.label}
        </div>
      ))}
      {links.map((_, i) => (
        <div key={`p${i}`} className="net-pulse" />
      ))}
    </div>
  );
}

export default function Landing() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [demo, setDemo] = useState(false);

  const go = () => nav(user ? "/" : "/login");

  return (
    <div className="land">
      <div className="land-grid" />
      <div className="land-glow" />

      <div className="land-nav">
        <div className="auth-logo" style={{ margin: 0 }}>
          <span className="mark"><Icon name="heart-pulse" /></span>
          <h1 style={{ color: "var(--on-surface)" }}>PulseWatch</h1>
        </div>
        <button className="btn-ghost btn btn-sm" onClick={go}>
          {user ? "Dashboard" : "Sign in"}
        </button>
      </div>

      <section className="land-hero">
        <div className="land-eyebrow">Real-time uptime monitoring</div>
        <h1 className="land-title">
          Your websites.<br /><b>Always watched.</b>
        </h1>
        <p className="land-lead">
          Monitor uptime, performance, SSL health, and incidents before your users ever notice.
          Built for developers — free, forever.
        </p>
        <div className="land-cta">
          <button className="btn" onClick={go}>Start Monitoring →</button>
          <button className="btn btn-ghost" onClick={() => setDemo(true)}>View Live Demo</button>
        </div>

        <div className="land-stats">
          <div className="land-stat"><div className="v">99.99%</div><div className="l">🌐 Uptime</div></div>
          <div className="land-stat"><div className="v">120ms</div><div className="l">⚡ Avg response</div></div>
          <div className="land-stat"><div className="v">Instant</div><div className="l">🔔 Alerts</div></div>
        </div>

        <NetworkPulse />
      </section>

      {/* Trust / monitor anything */}
      <div className="feature-row">
        {[
          { ic: "globe", t: "Websites", d: "HTTP/HTTPS status and content checks." },
          { ic: "server", t: "APIs", d: "Validate JSON + REST availability." },
          { ic: "database", t: "Servers", d: "TCP/UDP port & host monitoring." },
          { ic: "heart", t: "Cron Jobs", d: "Heartbeat pings for scheduled tasks." },
        ].map((f) => (
          <div key={f.t} className="feature glass-2">
            <div className="ico" style={{ color: "var(--primary)" }}><Icon name={f.ic} size={26} /></div>
            <h3>{f.t}</h3>
            <p>{f.d}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="section-pad">
        <h2 style={{ textAlign: "center", fontSize: 30, letterSpacing: "-0.02em", margin: 0 }}>How it works</h2>
        <div className="how-grid">
          {[
            { n: 1, t: "Add your website", d: "Paste the URL — no agents, no install." },
            { n: 2, t: "PulseWatch checks it", d: "We probe every minute from the cloud." },
            { n: 3, t: "Get alerted early", d: "Telegram & email before users complain." },
          ].map((s) => (
            <div key={s.n} className="how-step glass-2">
              <div className="n">{s.n}</div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Intelligent alerts example */}
      <div className="section-pad" style={{ paddingTop: 0 }}>
        <h2 style={{ textAlign: "center", fontSize: 30, letterSpacing: "-0.02em" }}>Intelligent alerts</h2>
        <div className="alert-demo">
          <div className="top"><Icon name="alert" /> API outage detected</div>
          <div style={{ fontWeight: 600, marginTop: 6 }}>api.example.com</div>
          <div className="meta">
            HTTP 503 · Response: 2.8s · Detected 14:32 UTC
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="section-pad" style={{ paddingTop: 0 }}>
        <h2 style={{ textAlign: "center", fontSize: 30, letterSpacing: "-0.02em", margin: 0 }}>Simple pricing</h2>
        <div className="price-grid">
          <div className="price glass-2">
            <h3>Free</h3>
            <div className="p">$0<span> /forever</span></div>
            <ul>
              <li><Icon name="check" /> 10 monitors</li>
              <li><Icon name="check" /> 5-minute checks</li>
              <li><Icon name="check" /> Telegram alerts</li>
              <li><Icon name="check" /> Basic history</li>
            </ul>
            <button className="btn btn-ghost" style={{ width: "100%" }} onClick={go}>Get started</button>
          </div>
          <div className="price glass-2 featured">
            <h3>Developer</h3>
            <div className="p">$0<span> /beta</span></div>
            <ul>
              <li><Icon name="check" /> 100 monitors</li>
              <li><Icon name="check" /> 1-minute checks</li>
              <li><Icon name="check" /> Status pages</li>
              <li><Icon name="check" /> SSL monitoring</li>
            </ul>
            <button className="btn" style={{ width: "100%" }} onClick={go}>Start free</button>
          </div>
        </div>
      </div>

      <footer className="land-footer">
        PulseWatch · Free uptime monitoring for developers · Built on GitHub Actions + Neon
      </footer>
    </div>
  );
}
