import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import Icon from "../components/Icon";
import { DOCS_API_URL, DOCS_HOME_URL } from "../docsSite";

export default function Landing() {
  const nav = useNavigate();
  const { user } = useAuth();
  const go = () => nav(user ? "/" : "/login");

  return (
    <div className="land">

      <div className="land-nav">
        <div className="auth-logo" style={{ margin: 0 }}>
          <img src="/favicon/pulsewatch.png" alt="PulseWatch" className="auth-logo-img" style={{ height: 24 }} />
          <span className="auth-logo-word" style={{ color: "var(--on-surface)" }}>PulseWatch</span>
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
        </div>

        <div className="land-stats">
          <div className="land-stat"><div className="v">99.99%</div><div className="l">🌐 Uptime</div></div>
          <div className="land-stat"><div className="v">120ms</div><div className="l">⚡ Avg response</div></div>
          <div className="land-stat"><div className="v">Instant</div><div className="l">🔔 Alerts</div></div>
        </div>

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
        <p style={{ textAlign: "center", color: "var(--on-surface-muted)", fontSize: 14, marginTop: 8 }}>
          Pay with Telegram Stars — no credit card needed
        </p>
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
            <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: "var(--primary)", color: "var(--on-primary)", fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 999, letterSpacing: "0.05em" }}>POPULAR</div>
            <h3>Pro</h3>
            <div className="p">$5<span> /month</span></div>
            <div style={{ fontSize: 12, color: "var(--on-surface-muted)", marginTop: 2 }}>or 50 Telegram Stars</div>
            <ul>
              <li><Icon name="check" /> 100 monitors</li>
              <li><Icon name="check" /> 1-minute checks</li>
              <li><Icon name="check" /> Status pages</li>
              <li><Icon name="check" /> SSL monitoring</li>
              <li><Icon name="check" /> AI explanations</li>
              <li><Icon name="check" /> Multi-channel alerts</li>
            </ul>
            <a href="https://t.me/PulseWatchBot?start=plan_pro" className="btn" style={{ width: "100%", textAlign: "center" }}>Get Pro</a>
          </div>
          <div className="price glass-2">
            <h3>Team</h3>
            <div className="p">$15<span> /month</span></div>
            <div style={{ fontSize: 12, color: "var(--on-surface-muted)", marginTop: 2 }}>or 150 Telegram Stars</div>
            <ul>
              <li><Icon name="check" /> Unlimited monitors</li>
              <li><Icon name="check" /> 30-second checks</li>
              <li><Icon name="check" /> Everything in Pro</li>
              <li><Icon name="check" /> Team accounts</li>
              <li><Icon name="check" /> API access</li>
              <li><Icon name="check" /> Priority support</li>
            </ul>
            <a href="/login?plan=team" className="btn btn-ghost" style={{ width: "100%", textAlign: "center" }}>Get Team</a>
          </div>
        </div>
      </div>

      <footer className="land-footer">
        <div className="lf-cols">
          <div className="lf-brand">
            <div className="auth-logo" style={{ margin: 0 }}>
              <img src="/favicon/pulsewatch.png" alt="PulseWatch" className="auth-logo-img" style={{ height: 22 }} />
              <span className="auth-logo-word" style={{ color: "var(--on-surface)" }}>PulseWatch</span>
            </div>
            <p className="muted" style={{ marginTop: 10, maxWidth: 260, fontSize: 13 }}>
              Developer-first uptime monitoring for websites, APIs, SSL certificates, and heartbeat jobs. Free, forever.
            </p>
          </div>
          <div className="lf-col">
            <h4>Product</h4>
            <a href="/login">Features</a>
            <a href="/login">Pricing</a>
            <a href="/login">Status Pages</a>
            <a href="/login">Roadmap</a>
          </div>
          <div className="lf-col">
            <h4>Developers</h4>
            <a href={DOCS_HOME_URL} target="_blank" rel="noreferrer">Documentation</a>
            <a href={DOCS_API_URL} target="_blank" rel="noreferrer">API</a>

            <a href="https://github.com/Robibiruk" target="_blank" rel="noreferrer">GitHub</a>
          </div>
          <div className="lf-col">
            <h4>Company</h4>
            <a href="/login">About</a>
            <a href="/login">Privacy</a>
            <a href="/login">Terms</a>
            <a href="mailto:robekmedia@gmail.com">Contact</a>
          </div>
        </div>
        <div className="lf-bottom">
          <span>© {new Date().getFullYear()} PulseWatch · Built by Robel Biruk</span>
          <span>v2.4.0</span>
        </div>
      </footer>
    </div>
  );
}
