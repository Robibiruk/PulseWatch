import { useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import Icon from "../components/Icon";
import BrandIcon from "../components/BrandIcon";
import Threads from "../components/Threads";
import { gsap, ScrollTrigger, countUp, prefersReduced } from "../hooks/useMotion";
import { DOCS_API_URL, DOCS_HOME_URL } from "../docsSite";

const AI_NOTE = "Three 503s after steady 200s. The service is reachable but cannot serve requests. Likely overload or a failed dependency.";

const FEATURES = [
  { ic: "globe", t: "Websites and APIs", d: "HTTP checks with status-code rules, redirects, timeouts and auth.", wide: true },
  { ic: "heart", t: "Cron heartbeats", d: "Your job pings us. If it goes quiet, you hear about it." },
  { ic: "lock", t: "SSL expiry", d: "Warnings before a certificate lapses." },
  { ic: "sparkles", t: "Incidents, explained", d: "When something fails, an AI note reads the evidence and suggests likely causes. It never claims a root cause it cannot see.", wide: true },
  { ic: "link", t: "Public status page", d: "Three themes, no login for your visitors." },
];

const STEPS = [
  { t: "Add a URL", d: "Paste it in. No agent, no install." },
  { t: "We check it", d: "Every interval, from the cloud. Three failures in a row before we call it down." },
  { t: "You hear first", d: "Telegram, email, Discord, Slack or a webhook, plus a recovery note when it is back." },
];

export default function Landing() {
  const nav = useNavigate();
  const { user } = useAuth();
  const root = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  const small = typeof window !== "undefined" && window.innerWidth < 720;
  const go = () => nav(user ? "/dashboard" : "/login");

  useLayoutEffect(() => {
    const reduced = prefersReduced();
    const ctx = gsap.context(() => {
      /* ── Hero: one orchestrated entrance ── */
      if (!reduced) {
        const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
        tl.from(".lp-threads", { autoAlpha: 0, duration: 1.8, ease: "power2.out" }, 0)
          .from(".lp-line > span", { yPercent: 110, duration: 1.1, stagger: 0.12 }, 0.15)
          .from(".lp-lead, .lp-cta > *", { y: 22, autoAlpha: 0, duration: 0.8, stagger: 0.09 }, 0.7)
          .from(".lp-demo", { y: 40, autoAlpha: 0, scale: 0.97, duration: 1 }, 0.9)
          .from(".lp-nav", { y: -24, autoAlpha: 0, duration: 0.8 }, 0.3);
      }

      /* ── Hero demo: an incident, start to finish, on loop ── */
      const demo = root.current!.querySelector<HTMLElement>(".lp-demo");
      if (demo && !reduced) {
        const q = gsap.utils.selector(demo);
        const set = (sel: string, txt: string) => { const e = q(sel)[0] as HTMLElement; if (e) e.textContent = txt; };
        const typed = { n: 0 };
        const loop = gsap.timeline({ repeat: -1, delay: 2.4 });
        loop
          .call(() => { demo.dataset.state = "up"; set(".dm-label", "Operational"); set(".dm-code", "200"); set(".dm-ms", "118 ms"); set(".dm-ai", ""); }, [], 0)
          .to({}, { duration: 2.2 })
          .call(() => { demo.dataset.state = "down"; set(".dm-label", "Down"); set(".dm-code", "503"); set(".dm-ms", "2.8 s"); })
          .fromTo(demo, { x: -4 }, { x: 0, duration: 0.5, ease: "elastic.out(1, 0.25)" }, "<")
          .set(typed, { n: 0 })
          .to(typed, { n: AI_NOTE.length, duration: 2.4, ease: "none", onUpdate: () => set(".dm-ai", AI_NOTE.slice(0, Math.floor(typed.n))) })
          .to({}, { duration: 1.6 })
          .call(() => { demo.dataset.state = "up"; set(".dm-label", "Recovered after 4 min"); set(".dm-code", "200"); set(".dm-ms", "131 ms"); set(".dm-ai", ""); })
          .to({}, { duration: 2.4 });
      } else if (demo) {
        demo.dataset.state = "up";
      }

      /* ── Counters (only when scrolled into view) ── */
      root.current!.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
        const to = Number(el.dataset.count);
        if (reduced) { el.textContent = String(to); return; }
        ScrollTrigger.create({ trigger: el, start: "top 90%", once: true, onEnter: () => countUp(el, to) });
      });

      /* ── Feature cards: spotlight follows the pointer ── */
      root.current!.querySelectorAll<HTMLElement>(".lp-card").forEach((card) => {
        card.addEventListener("pointermove", (e) => {
          const r = card.getBoundingClientRect();
          card.style.setProperty("--mx", `${e.clientX - r.left}px`);
          card.style.setProperty("--my", `${e.clientY - r.top}px`);
        });
      });

      /* ── Scroll reveals (short, once) ── */
      if (!reduced) {
        gsap.utils.toArray<HTMLElement>(".lp-reveal").forEach((el) => {
          gsap.from(el.children.length > 1 ? el.children : el, {
            y: 28, autoAlpha: 0, duration: 0.8, ease: "power3.out", stagger: 0.1,
            scrollTrigger: { trigger: el, start: "top 85%", once: true },
          });
        });
        /* Steps: the connecting line draws as you scroll — this one IS a sequence */
        gsap.fromTo(".lp-rail-fill", { scaleY: 0 }, {
          scaleY: 1, ease: "none", transformOrigin: "top",
          scrollTrigger: { trigger: ".lp-steps", start: "top 70%", end: "bottom 60%", scrub: true },
        });
        gsap.utils.toArray<HTMLElement>(".lp-step").forEach((s) =>
          ScrollTrigger.create({ trigger: s, start: "top 65%", toggleClass: { targets: s, className: "on" } }));

        /* Nav condenses once you leave the hero */
        ScrollTrigger.create({ start: 40, end: "max", toggleClass: { targets: ".lp-nav", className: "scrolled" } });

        /* Threads drifts slower than the page */
        gsap.to(".lp-threads", { yPercent: 18, ease: "none", scrollTrigger: { trigger: ".lp-hero", start: "top top", end: "bottom top", scrub: true } });
      }

      /* Magnetic primary button (pointer devices only) */
      const mag = root.current!.querySelector<HTMLElement>(".lp-magnet");
      if (mag && !reduced && window.matchMedia("(hover: hover)").matches) {
        const xTo = gsap.quickTo(mag, "x", { duration: 0.4, ease: "power3" });
        const yTo = gsap.quickTo(mag, "y", { duration: 0.4, ease: "power3" });
        mag.addEventListener("pointermove", (e) => {
          const r = mag.getBoundingClientRect();
          xTo((e.clientX - (r.left + r.width / 2)) * 0.25);
          yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
        });
        mag.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
      }
    }, root);
    return () => ctx.revert();
  }, []);

  const jump = (id: string) => {
    setMenu(false);
    document.getElementById(id)?.scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth" });
  };

  return (
    <div className="lp" ref={root}>
      {/* ── Nav ── */}
      <header className="lp-nav">
        <div className="lp-nav-in">
          <a className="lp-brand" href="/" aria-label="PulseWatch home">
            <img src="/favicon/pulsewatch.png" alt="" height={22} /> PulseWatch
          </a>
          <nav className={`lp-links ${menu ? "open" : ""}`}>
            <button onClick={() => jump("features")}>Features</button>
            <button onClick={() => jump("how")}>How it works</button>
            <button onClick={() => jump("pricing")}>Pricing</button>
            <a href={DOCS_HOME_URL} target="_blank" rel="noreferrer">Docs</a>
          </nav>
          <div className="lp-nav-actions">
            <button className="btn btn-sm lp-signin" onClick={go}>{user ? "Dashboard" : "Sign in"}</button>
            <button className="lp-burger" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
              <Icon name={menu ? "x" : "menu"} size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="lp-hero">
        <div className="lp-threads" aria-hidden="true">
          <Threads
            color="#ffffff" accentColor="#34d399"
            lineCount={small ? 44 : 90} thickness={small ? 0.8 : 0.6} softness={1.3}
            amplitude={small ? 1.3 : 1.7} distance={0.4} waves={small ? 0.8 : 1.05} speed={0.6}
            split={0.04} fray={0.5} angle={small ? 62 : 25} taper={0.85} brightness={1.4}
            parting={small ? 0 : 0.5} enableMouseInteraction={!small} opacity={0.9}
          />
        </div>
        <div className="lp-hero-in">
          <h1 className="lp-title">
            <span className="lp-line"><span>Know it is down</span></span>
            <span className="lp-line"><span>before they do.</span></span>
          </h1>
          <p className="lp-lead">
            PulseWatch checks your sites, APIs and cron jobs around the clock, waits for a real failure,
            then tells you on Telegram, email, Discord or Slack. Free and self-hostable.
          </p>
          <div className="lp-cta">
            <button className="btn lp-magnet" onClick={go}>Start monitoring</button>
            <a className="btn btn-ghost" href={DOCS_HOME_URL} target="_blank" rel="noreferrer">Read the docs</a>
          </div>

          <div className="lp-demo" data-state="up" role="img" aria-label="Animated example of an outage being detected and recovered">
            <div className="dm-top">
              <span className="dm-dot" />
              <div className="dm-name">api.example.com<small>GET /health · every 1 min</small></div>
              <span className="dm-label">Operational</span>
            </div>
            <svg className="dm-pulse" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 20 H110 L122 20 L130 5 L140 35 L150 20 H250 L262 20 L270 5 L280 35 L290 20 H400" />
            </svg>
            <div className="dm-meta"><span>HTTP <b className="dm-code">200</b></span><span className="dm-ms">118 ms</span></div>
            <p className="dm-ai" aria-live="off" />
          </div>
        </div>
      </section>

      {/* ── Proof strip ── */}
      <section className="lp-strip lp-reveal">
        <div><b data-count="5">5</b><span>alert channels</span></div>
        <div><b data-count="3">3</b><span>failed checks before an alert</span></div>
        <div><b data-count="3">3</b><span>status page themes</span></div>
        <div><b data-count="0">0</b><span>agents to install</span></div>
      </section>

      {/* ── Features ── */}
      <section className="lp-section" id="features">
        <h2 className="lp-h2 lp-reveal">Everything you would otherwise stitch together</h2>
        <div className="lp-bento lp-reveal">
          {FEATURES.map((f) => (
            <article key={f.t} className={`lp-card ${f.wide ? "wide" : ""}`}>
              <span className="lp-ico"><Icon name={f.ic} size={20} /></span>
              <h3>{f.t}</h3>
              <p>{f.d}</p>
            </article>
          ))}
          <article className="lp-card wide lp-channels">
            <h3>Alerts land where you already are</h3>
            <div>
              {["telegram", "gmail", "discord", "slack"].map((b) => <span key={b}><BrandIcon name={b} size={22} /></span>)}
              <span><Icon name="webhook" size={22} /></span>
            </div>
          </article>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="lp-section" id="how">
        <h2 className="lp-h2 lp-reveal">Three steps, no setup tax</h2>
        <ol className="lp-steps">
          <div className="lp-rail"><i className="lp-rail-fill" /></div>
          {STEPS.map((s, i) => (
            <li key={s.t} className="lp-step">
              <span className="lp-step-n">{i + 1}</span>
              <div><h3>{s.t}</h3><p>{s.d}</p></div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Pricing ── */}
      <section className="lp-section" id="pricing">
        <h2 className="lp-h2 lp-reveal">Pay with Telegram Stars, or stay free</h2>
        <div className="lp-prices lp-reveal">
          {[
            { n: "Free", p: "$0", per: "forever", f: ["10 monitors", "5-minute checks", "Telegram alerts", "Basic history"], cta: "Get started", href: "/login", ghost: true },
            { n: "Pro", p: "$5", per: "/month · 50 Stars", f: ["100 monitors", "1-minute checks", "Status pages", "SSL monitoring", "AI explanations", "Multi-channel alerts"], cta: "Get Pro", href: "/login?plan=pro", pop: true },
            { n: "Team", p: "$15", per: "/month · 150 Stars", f: ["Unlimited monitors", "30-second checks", "Everything in Pro", "Team accounts", "API access", "Priority support"], cta: "Get Team", href: "/login?plan=team", ghost: true },
          ].map((p) => (
            <div key={p.n} className={`lp-price ${p.pop ? "pop" : ""}`}>
              {p.pop && <span className="lp-pop">Most popular</span>}
              <h3>{p.n}</h3>
              <div className="lp-amt">{p.p}<small>{p.per}</small></div>
              <ul>{p.f.map((x) => <li key={x}><Icon name="check" size={16} />{x}</li>)}</ul>
              <a className={`btn ${p.ghost ? "btn-ghost" : ""}`} href={p.href}>{p.cta}</a>
            </div>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="lp-final lp-reveal">
        <h2>Your next outage is already scheduled. Hear about it first.</h2>
        <button className="btn" onClick={go}>Start monitoring</button>
      </section>

      <footer className="lp-footer">
        <div className="lp-foot-in">
          <div>
            <a className="lp-brand" href="/"><img src="/favicon/pulsewatch.png" alt="" height={20} /> PulseWatch</a>
            <p>Uptime monitoring for websites, APIs, SSL and heartbeat jobs. Built by Robel Biruk.</p>
          </div>
          <div><h4>Product</h4><button onClick={() => jump("features")}>Features</button><button onClick={() => jump("pricing")}>Pricing</button><a href="/status">System status</a></div>
          <div><h4>Developers</h4><a href={DOCS_HOME_URL} target="_blank" rel="noreferrer">Documentation</a><a href={DOCS_API_URL} target="_blank" rel="noreferrer">API</a><a href="https://github.com/Robibiruk/PulseWatch" target="_blank" rel="noreferrer">GitHub</a></div>
          <div><h4>Company</h4><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="mailto:robekmedia@gmail.com">Contact</a></div>
        </div>
        <div className="lp-foot-bot"><span>© {new Date().getFullYear()} PulseWatch</span><span>v2.5.0</span></div>
      </footer>
    </div>
  );
}
