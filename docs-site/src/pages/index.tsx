import React, {type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';
import GitHubStar from '@site/src/components/GitHubStar';
import '../css/home.css';

const I = (d: string) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

const FEATURES = [
  {t: 'Websites and APIs', d: 'HTTP checks with status-code rules, redirects, timeouts, and basic or bearer auth.', to: '/docs/monitors', ic: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z'},
  {t: 'Heartbeat monitors', d: 'Cron jobs and workers ping PulseWatch. If a ping is late, an incident opens.', to: '/docs/core-features', ic: 'M22 12h-4l-3 9L9 3l-3 9H2'},
  {t: 'SSL expiry warnings', d: 'Get a heads-up before a certificate lapses, not after.', to: '/docs/core-features', ic: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4'},
  {t: 'Incidents, explained', d: 'An AI note reads the evidence and lists likely causes without claiming a root cause it cannot see.', to: '/docs/incidents', ic: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z'},
  {t: 'Five alert channels', d: 'Telegram, email, Discord, Slack, or any webhook, with a recovery message when it is back.', to: '/docs/alerts', ic: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0'},
  {t: 'Public status pages', d: 'Share live status with three themes. Visitors do not need an account.', to: '/docs/status-pages', ic: 'M3 4h18v16H3zM3 9h18M8 14h4'},
];

const BARS = (down: number[]) => Array.from({length: 48}, (_, n) => <i key={n} className={down.includes(n) ? 'x' : ''} style={{['--n' as string]: n}} />);

function Hero(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className="pw-hero">
      <div className="pw-hero-bg" aria-hidden="true" />
      <div className="pw-glow" aria-hidden="true" />
      <svg className="pw-beat" viewBox="0 0 1400 90" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 45H430L450 45L462 12L478 78L494 45H900L920 45L932 12L948 78L964 45H1400" />
      </svg>
      <div className="pw-hero-in">
        <Link className="pw-pill" to="/docs/changelog"><i />v2.5.0: plans, Telegram Stars and GitHub sign-in</Link>
        <h1 className="pw-h1">Know when it breaks.<br />Understand why.</h1>
        <p className="pw-sub">{siteConfig.tagline}</p>
        <div className="pw-actions">
          <Link className="pw-btn pw-btn--solid" to="/docs/getting-started">Get started</Link>
          <GitHubStar variant="hero" />
        </div>
        <div className="pw-card" role="img" aria-label="Example status page showing three operational services">
          <span className="pw-scan" aria-hidden="true" />
          <div className="pw-card-top">Example status page <span className="pw-ok"><i />All systems operational</span></div>
          {[['Website', '99.99%', '142 ms', []], ['API', '99.94%', '88 ms', [31]], ['Nightly backup job', '100%', 'on time', []]].map(([n, u, m, d]) => (
            <div className="pw-row" key={n as string}>
              <div className="pw-row-h"><b>{n as string}</b><span>{u as string} · {m as string}</span></div>
              <div className="pw-bars">{BARS(d as number[])}</div>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}

function spot(e: React.PointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
}

export default function Home(): ReactNode {
  return (
    <Layout title="Uptime monitoring with AI-explained incidents" description="Free, self-hostable uptime monitoring for websites, APIs, SSL certificates and heartbeat jobs, with Telegram alerts and public status pages.">
      <Hero />
      <main>
        <section className="pw-sec">
          <h2 data-reveal>What it watches</h2>
          <p data-reveal style={{['--i' as string]: 1}}>Everything you would otherwise stitch together from three tools.</p>
          <div className="pw-grid">
            {FEATURES.map((f, i) => (
              <Link key={f.t} to={f.to} className="pw-feat" data-reveal style={{['--i' as string]: i}} onPointerMove={spot}>
                <span className="pw-feat-ic">{I(f.ic)}</span>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="pw-sec">
          <div className="pw-two">
            <div data-reveal>
              <h2>Self-host in a few commands</h2>
              <p style={{margin: 0, color: 'var(--pw-muted)'}}>Python 3.12, Node 18 and a PostgreSQL URL are all you need. SQLite works for local development.</p>
              <div className="pw-links">
                <Link className="pw-btn pw-btn--solid" to="/docs/getting-started">Read the guide</Link>
                <Link className="pw-btn pw-btn--ghost" to="/docs/architecture">See the architecture</Link>
              </div>
            </div>
            <div data-reveal style={{['--i' as string]: 2}}>
              <CodeBlock language="bash" title="terminal">{`git clone https://github.com/Robibiruk/PulseWatch.git
cd PulseWatch/backend && pip install -r requirements.txt
cp .env.example .env   # set DATABASE_URL and SECRET_KEY
uvicorn main:app --port 8000

cd ../frontend && npm install && npm run dev`}</CodeBlock>
            </div>
          </div>
        </section>

        <section className="pw-cta" data-reveal>
          <div className="pw-cta-in">
            <h2>Open source, MIT licensed. Star it if it helps.</h2>
            <div className="pw-actions">
              <Link className="pw-btn pw-btn--solid" to="/docs/getting-started">Get started</Link>
              <GitHubStar variant="hero" />
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
