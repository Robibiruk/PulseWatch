import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Icon from "../components/Icon";
import { Shell, Topbar } from "../components/Layout";

type Section = {
  id: string;
  title: string;
  items: { id: string; label: string; tag?: string }[];
};

const SECTIONS: Section[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    items: [
      { id: "signup", label: "Sign up" },
      { id: "add-monitor", label: "Add your first monitor" },
      { id: "channels", label: "Notification channels" },
    ],
  },
  {
    id: "monitoring",
    title: "Monitoring",
    items: [
      { id: "monitor-types", label: "Monitor types", tag: "HTTP · API · TCP · Keyword · Cron" },
      { id: "intervals", label: "Check intervals" },
      { id: "ssl", label: "SSL/TLS monitoring" },
      { id: "heartbeats", label: "Heartbeat monitors (cron jobs)" },
    ],
  },
  {
    id: "alerts",
    title: "Alerts",
    items: [
      { id: "telegram-bot", label: "Telegram bot setup" },
      { id: "email-alerts", label: "Email alerts" },
      { id: "discord-slack", label: "Discord / Slack webhooks" },
      { id: "pausing", label: "Pause & resume" },
    ],
  },
  {
    id: "status-pages",
    title: "Status Pages",
    items: [
      { id: "public-status", label: "Public status pages" },
      { id: "themes", label: "Themes (neon / light / minimal)" },
      { id: "slug", label: "Custom slug & sharing" },
    ],
  },
  {
    id: "api",
    title: "API Reference",
    items: [
      { id: "rest-api", label: "REST API" },
      { id: "auth", label: "Authentication" },
      { id: "tokens", label: "Personal access tokens" },
      { id: "formats", label: "Webhooks & payloads", tag: "JSON" },
    ],
  },
  {
    id: "account",
    title: "Account & Billing",
    items: [
      { id: "profile", label: "Profile & preferences" },
      { id: "exports", label: "Data export" },
      { id: "deletion", label: "Delete account" },
    ],
  },
  {
    id: "legal",
    title: "Legal",
    items: [
      { id: "privacy", label: "Privacy Policy" },
      { id: "terms", label: "Terms of Service" },
      { id: "license", label: "License" },
    ],
  },
];

const CONTENT: Record<string, { headings: string[]; body: string }> = {
  "signup": {
    headings: ["Create an account", "Verify your email"],
    body:
      "Go to the signup page and enter your email + password. No credit card is required. You'll land in the Dashboard where you can add your first monitor.",
  },
  "add-monitor": {
    headings: ["Monitor setup", "Intervals", "Options"],
    body:
      "From the Dashboard, click **Add monitor**. Paste the URL, choose a name and check interval (default: 1 minute). Optional: enable SSL expiry reminders, set a custom HTTP method, or add basic auth.",
  },
  "channels": {
    headings: ["Telegram", "Email", "Discord / Slack / Webhooks"],
    body:
      "Connect Telegram from Settings → Telegram → Connect. For email, make sure Alert Channels → Email is enabled. For webhooks, paste the endpoint URL and choose the channel. Test any channel with **Send test** in Settings.",
  },
  "monitor-types": {
    headings: ["HTTP/HTTPS", "API (JSON)", "TCP", "Keyword", "Heartbeat"],
    body:
      "HTTP — status code + response time. API — validate JSON body shape. TCP — port reachability. Keyword — content must appear on the page. Heartbeat — expect a periodic ping from your server.",
  },
  "intervals": {
    headings: ["Free tier", "Custom intervals"],
    body: "Free tier defaults to 5 minutes. Developer tier supports 1-minute intervals.",
  },
  "ssl": {
    headings: ["Expiry reminders"],
    body: "Enable **SSL expiry reminders** when creating a monitor to get alerts before certificates expire.",
  },
  "heartbeats": {
    headings: ["How it works", "When to use"],
    body: "Heartbeats are great for cron jobs, workers, or scheduled tasks. If PulseWatch doesn't receive a ping within your interval, it triggers an alert.",
  },
  "telegram-bot": {
    headings: ["Link", "Commands", "Notifications"],
    body:
      "From Settings → Telegram, press **Connect**. Open Telegram, tap **Start**, and you're linked. Use commands like /status, /monitors, /incidents, /pause, and /resume.",
  },
  "email-alerts": {
    headings: ["Setup", "Templates"],
    body: "Enable Email in Alert Channels. Email sends incident DOWN, RESOLVED, and periodic check-in digests.",
  },
  "discord-slack": {
    headings: ["Discord webhook", "Slack incoming webhook", "Generic webhook"],
    body:
      "Paste the webhook URL in Settings → Alert Channels. PulseWatch posts { event, message } JSON for generic webhooks.",
  },
  "pausing": {
    headings: ["Pause alerts", "Resume"],
    body: "Toggle pause from Settings or send /pause via Telegram. Alerts are quiet — monitors keep running.",
  },
  "public-status": {
    headings: ["URLs", "No auth required", "Regenerate slug"],
    body: "Shareable at `/status/:ownerId` or `/status/slug/:slug`. No login required for visitors.",
  },
  "themes": {
    headings: ["Neon", "Light", "Minimal"],
    body: "Pick a theme from Settings → Status Pages. Your public page updates instantly.",
  },
  "slug": {
    headings: ["Custom slug", "Copy / Share"],
    body: "Regenerate the slug in Settings → Status Pages → Regenerate. Copy or share via native share dialog.",
  },
  "rest-api": {
    headings: ["Base URL", "Auth", "Examples"],
    body:
      "Authenticate with JWT from `/auth/token`. Use `Authorization: Bearer <token>` on every request. See [Monitor CRUD, GitHub repo] for endpoints.",
  },
  "auth": {
    headings: ["Endpoints", "Token storage"],
    body: "`POST /auth/token` returns a JWT. Store it in `localStorage` as `pw_token`. Tokens are refeshed per session.",
  },
  "tokens": {
    headings: ["Personal access tokens", "Scopes", "Security"],
    body:
      "Generate a token in Settings → API & Security. Tokens are **sha256 hashed** and shown once. Use them for API access from scripts or CI.",
  },
  "formats": {
    headings: ["Webhook payload", "Generic webhook"],
    body: "Every notification channel delivers plain-text. Generic webhooks receive `{ event: 'pulsewatch.alert', message: string }`.",
  },
  "profile": {
    headings: ["Profile", "Display name"],
    body: "Change your display name in Settings → Account. Email is the login identity; password change is available under the same card.",
  },
  "exports": {
    headings: ["Export", "Format"],
    body: "Click **Export data** in Settings → Account to download a JSON snapshot of your account and monitors.",
  },
  "deletion": {
    headings: ["Delete account", "What's deleted"],
    body: "Deleting your account removes your user, monitors, incidents, tokens, and sessions permanently.",
  },
  "privacy": {
    headings: ["Privacy Policy"],
    body:
      "PulseWatch collects account, monitor, and notification data solely to deliver the service. We do not sell personal data. Data may be stored in the US; contact `robekmedia@gmail.com` for deletion requests.",
  },
  "terms": {
    headings: ["Terms of Service"],
    body:
      "Service is provided 'as is' without warranty. Users are responsible for monitors they configure and alerts they enable. Abusive usage may result in suspension.",
  },
  "license": {
    headings: ["License"],
    body: "PulseWatch is proprietary software. All rights reserved by Robel Biruk. See the LICENSE file in the repository for specifics.",
  },
};

export default function Docs() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [active, setActive] = useState<string>(slug || "getting-started");
  const [modal, setModal] = useState<string | null>(null);

  return (
    <Shell>
      <Topbar title="Documentation" sub="Guides, references, and legal" />
      <div className="content docs-layout">
        <aside className="docs-sidebar glass-2">
          {SECTIONS.map((s) => (
            <div key={s.id} className="doc-group">
              <div className="doc-group-title">{s.title}</div>
              {s.items.map((it) => (
                <button key={it.id} className={"doc-link" + (active === it.id ? " active" : "")} onClick={() => { setActive(it.id); nav(`/docs/${s.id}/${it.id}`, { replace: true }); }}>
                  {it.label}
                  {it.tag && <span className="doc-tag">{it.tag}</span>}
                </button>
              ))}
            </div>
          ))}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 14, paddingTop: 14 }}>
            <button className="doc-link" onClick={() => setModal("shortcuts")}>⌨️ Keyboard shortcuts</button>
          </div>
        </aside>
        <main className="docs-main">
          {(active in CONTENT) && (
            <article className="glass-2 doc-article">
              <h2>{SECTIONS.flatMap(s => s.items).find(i => i.id === active)?.label}</h2>
              <div className="doc-body" dangerouslySetInnerHTML={{
                __html: (CONTENT as any)[active].body.split("\n").map((p: string) => p ? `<p>${p}</p>` : "").join("")
              }} />
              <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {active === "rest-api" && <Link className="btn btn-ghost btn-sm" to="/login">Try the API →</Link>}
                {active === "telegram-bot" && <Link className="btn btn-ghost btn-sm" to="/settings">Open Settings →</Link>}
                {active === "public-status" && <Link className="btn btn-ghost btn-sm" to="/dashboard">Go to Dashboard →</Link>}
              </div>
            </article>
          )}
          {!(active in CONTENT) && <article className="glass-2 doc-article"><h2>Coming soon</h2><p>This page is being written. Check back shortly.</p></article>}
        </main>
      </div>
    </Shell>
  );
}
