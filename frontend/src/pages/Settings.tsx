import { useState, useEffect } from "react";
import { useAuth } from "../auth";
import * as api from "../api";
import Icon from "../components/Icon";
import { Shell, Topbar } from "../components/Layout";

function Row({ icon, title, desc, children }: any) {
  return (
    <div className="set-row">
      <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1 }}>
        <span className="ic" style={{ background: "rgba(255,255,255,0.1)", color: "var(--primary)", width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center" }}>
          <Icon name={icon} size={19} />
        </span>
        <div className="k">{title}<small>{desc}</small></div>
      </div>
      {children}
    </div>
  );
}
function Switch({ on, set }: any) {
  return <div className={`switch ${on ? "on" : ""}`} onClick={() => set(!on)} />;
}

export default function Settings() {
  const { user } = useAuth();
  const [ntelegram, setNTelegram] = useState(true);
  const [nemail, setNEmail] = useState(true);
  const [copied, setCopied] = useState(false);
  const [tgLinked, setTgLinked] = useState(!!user?.telegram_linked);
  const [paused, setPaused] = useState(!!user?.alerts_paused);
  const [link, setLink] = useState<string | null>(null);
  const [tgBusy, setTgBusy] = useState(false);

  // Alert channels
  const [channels, setChannels] = useState({ telegram: true, email: true, discord: false, slack: false, webhook: false });
  const [discord, setDiscord] = useState("");
  const [slack, setSlack] = useState("");
  const [webhook, setWebhook] = useState("");
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Status page builder
  const [spTitle, setSpTitle] = useState("PulseWatch Status");
  const [spDesc, setSpDesc] = useState("");
  const [spTheme, setSpTheme] = useState("neon");
  const [spSaving, setSpSaving] = useState(false);
  const [spSaved, setSpSaved] = useState(false);

  const pubUrl = `${window.location.origin}/status/${user?.id}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(pubUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* clipboard blocked */ }
  };

  const connect = async () => {
    setTgBusy(true);
    try {
      const r = await api.tgLink();
      setLink(r.link);
      setTgLinked(false);
      // Open the native Telegram app via tg:// deep link using the real bot
      // username. If that fails (no app / blocked), fall back to https t.me.
      const u = r.bot_username;
      const tok = r.token;
      const httpsLink = r.link;
      const w = (u && tok) ? window.open(`tg://resolve?domain=${u}&start=${tok}`, "_blank") : null;
      if (!w) {
        window.open(httpsLink, "_blank");
      } else {
        // If the tg:// window didn't actually open/navigate, open the https link.
        setTimeout(() => {
          try {
            if (w.closed === false && (!w.location || w.location.href === "about:blank")) {
              window.open(httpsLink, "_blank");
            }
          } catch { /* cross-origin; assume tg:// worked */ }
        }, 800);
      }
      // Poll for the link completing (user presses Start in the bot -> /connect).
      let tries = 0;
      const iv = setInterval(async () => {
        tries++;
        try {
          const s = await api.tgLink();
          if (s.linked) { setTgLinked(true); setLink(null); clearInterval(iv); }
        } catch { /* ignore */ }
        if (tries >= 10) clearInterval(iv);
      }, 3000);
    } catch (e: any) {
      alert(e.message || "Failed to start Telegram link");
    } finally { setTgBusy(false); }
  };
  const unlink = async () => {
    setTgBusy(true);
    try { await api.tgUnlink(); setTgLinked(false); setLink(null); }
    finally { setTgBusy(false); }
  };
  const togglePause = async () => {
    setTgBusy(true);
    try {
      if (paused) { await api.tgResume(); setPaused(false); }
      else { await api.tgPause(); setPaused(true); }
    } finally { setTgBusy(false); }
  };
  const saveChannels = async () => {
    setTgBusy(true);
    const enabled = Object.entries(channels).filter(([, v]) => v).map(([k]) => k).join(",");
    try {
      await api.tgSetChannels({ enabled_channels: enabled, discord_webhook: discord, slack_webhook: slack, webhook_url: webhook });
      setSaved(true); setTimeout(() => setSaved(false), 1500);
    } catch (e: any) {
      alert(e.message || "Failed to save channels");
    } finally { setTgBusy(false); }
  };
  const testNotify = async () => {
    setTgBusy(true);
    setTestResult(null);
    try {
      const r = await api.testNotification({});
      setTestResult(r);
    } catch (e: any) {
      setTestResult({ results: { error: { ok: false, note: e.message || "Request failed" } } });
    } finally { setTgBusy(false); }
  };

  useEffect(() => {
    api.statusPage().then((r: any) => {
      if (r) { setSpTitle(r.title); setSpDesc(r.description); setSpTheme(r.theme); }
    }).catch(() => {});
  }, []);

  const spSave = async () => {
    setSpSaving(true);
    try {
      await api.saveStatusPage({ title: spTitle, description: spDesc, theme: spTheme });
      setSpSaved(true); setTimeout(() => setSpSaved(false), 1500);
    } catch (e: any) {
      alert(e.message || "Failed to save status page");
    } finally { setSpSaving(false); }
  };

  return (
    <Shell>
      <Topbar title="Settings" sub="Manage notifications and your public status page" />
      <div className="content">
        <div className="set-card glass-2">
          <h3>Telegram</h3>
          <p>Link your account to the PulseWatch bot for instant outage pings.</p>
          {tgLinked ? (
            <>
              <Row icon="check" title="Connected" desc="Your Telegram chat is linked">
                <button className="btn btn-ghost btn-sm" onClick={unlink} disabled={tgBusy}>Unlink</button>
              </Row>
              <Row icon="bell" title={paused ? "Alerts paused" : "Alerts active"} desc={paused ? "You won't get pings until resumed" : "PulseWatch will ping you on incidents"}>
                <button className={`btn btn-sm ${paused ? "btn-primary" : "btn-ghost"}`} onClick={togglePause} disabled={tgBusy}>
                  {paused ? "Resume" : "Pause"}
                </button>
              </Row>
            </>
          ) : link ? (
            <Row icon="send" title="Open Telegram to finish" desc="Tap below and press start in the bot">
              <a className="btn btn-primary btn-sm" href={link} target="_blank" rel="noreferrer">Open ↗</a>
            </Row>
          ) : (
            <Row icon="send" title="Not connected" desc="Generate a secure link, then open it in Telegram">
              <button className="btn btn-primary btn-sm" onClick={connect} disabled={tgBusy}>Connect</button>
            </Row>
          )}
        </div>

        <div className="set-card glass-2">
          <h3>Alert Channels</h3>
          <p>Choose where PulseWatch sends downtime &amp; recovery alerts.</p>
          <Row icon="bell" title="Telegram" desc="Instant pings to your linked chat"><Switch on={channels.telegram} set={(v: boolean) => setChannels((c) => ({ ...c, telegram: v }))} /></Row>
          <Row icon="mail" title="Email" desc="Resend incident reports to your email"><Switch on={channels.email} set={(v: boolean) => setChannels((c) => ({ ...c, email: v }))} /></Row>
          <Row icon="message" title="Discord" desc="Post to a Discord webhook"><Switch on={channels.discord} set={(v: boolean) => setChannels((c) => ({ ...c, discord: v }))} /></Row>
          <Row icon="hash" title="Slack" desc="Post to a Slack incoming webhook"><Switch on={channels.slack} set={(v: boolean) => setChannels((c) => ({ ...c, slack: v }))} /></Row>
          <Row icon="link" title="Webhook" desc="Generic JSON webhook (Zapier/Make/custom)"><Switch on={channels.webhook} set={(v: boolean) => setChannels((c) => ({ ...c, webhook: v }))} /></Row>
          {channels.discord && (
            <input className="inp" placeholder="Discord webhook URL" value={discord} onChange={(e) => setDiscord(e.target.value)} />
          )}
          {channels.slack && (
            <input className="inp" placeholder="Slack webhook URL" value={slack} onChange={(e) => setSlack(e.target.value)} />
          )}
          {channels.webhook && (
            <input className="inp" placeholder="Generic webhook URL" value={webhook} onChange={(e) => setWebhook(e.target.value)} />
          )}
          <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={saveChannels} disabled={tgBusy}>
            {saved ? "Saved ✓" : "Save channels"}
          </button>
          <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
            <Row icon="zap" title="Test notification" desc="Send a sample incident + recovery to verify your channels">
              <button className="btn btn-ghost btn-sm" onClick={testNotify} disabled={tgBusy}>{tgBusy ? "Sending…" : "Send test"}</button>
            </Row>
            {testResult && (
              <div className="test-result" style={{ marginTop: 8, fontSize: 12, lineHeight: 1.5 }}>
                {Object.entries(testResult.results || {}).map(([k, v]: any) => (
                  <div key={k} style={{ opacity: 0.9 }}>
                    {k}: {v.ok ? "✅ sent" : `⚠️ ${v.note || "failed"}`}
                    {v.to ? ` → ${v.to}` : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="set-card glass-2">
          <h3>Public Status Page</h3>
          <p>Share a live status page with your users — no auth required.</p>
          <input className="inp" placeholder="Page title" value={spTitle} onChange={(e) => setSpTitle(e.target.value)} />
          <input className="inp" placeholder="Description (optional)" value={spDesc} onChange={(e) => setSpDesc(e.target.value)} />
          <div className="seg" style={{ marginTop: 10 }}>
            {["neon", "light", "minimal"].map((t) => (
              <button key={t} className={`seg-btn ${spTheme === t ? "active" : ""}`} onClick={() => setSpTheme(t)}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={spSave} disabled={spSaving}>
            {spSaved ? "Saved ✓" : "Save page"}
          </button>
          <Row icon="link" title="Open page" desc="Preview your public monitor board" style={{ marginTop: 12 }}>
            <a className="btn btn-ghost btn-sm" href={pubUrl} target="_blank" rel="noreferrer">Open ↗</a>
          </Row>
        </div>

        <div className="set-card glass-2">
          <h3>Account</h3>
          <p>Signed in as.</p>
          <Row icon="users" title={user?.full_name || "Developer"} desc={user?.email || ""} />
        </div>
      </div>
    </Shell>
  );
}
