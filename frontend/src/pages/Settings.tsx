import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import * as api from "../api";
import Icon from "../components/Icon";
import BrandIcon from "../components/BrandIcon";
import { Shell, Topbar } from "../components/Layout";
import { IosSwitch } from "../components/IosSwitch";

function Row({ icon, brand, title, desc, children, style }: any) {
  return (
    <div className="set-row" style={style}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1 }}>
        <span className="ic" style={{ background: "rgba(255,255,255,0.1)", color: "var(--primary)", width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center" }}>
          {brand ? <BrandIcon name={brand} size={19} /> : <Icon name={icon} size={19} />}
        </span>
        <div className="k">{title}<small>{desc}</small></div>
      </div>
      {children}
    </div>
  );
}

function HealthDot({ status }: { status: string }) {
  const color = status === "operational" || status === "connected" || status === "running" || status === "healthy"
    ? "var(--success, #34C759)" : "var(--warn, #ff9f0a)";
  return <span style={{ width: 9, height: 9, borderRadius: 9, background: color, boxShadow: `0 0 8px ${color}`, display: "inline-block" }} />;
}

function ComingSoonModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>What&apos;s New</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ textAlign: "center", padding: "18px 4px" }}>
          <div style={{ fontSize: 38, marginBottom: 8 }}>🚀</div>
          <h4 style={{ margin: "0 0 6px" }}>Coming soon</h4>
          <p style={{ margin: 0, opacity: 0.72, fontSize: 13 }}>
            Public status page themes, Slack workflows, API v2, keyboard shortcuts, and more.
          </p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Keyboard Shortcuts</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ opacity: 0.7, margin: "0 0 14px", fontSize: 13 }}>Navigate faster without touching the mouse.</p>
          <table className="shortcuts-table">
            <thead><tr><th>Keys</th><th>Action</th></tr></thead>
            <tbody>
              <tr><td><code>G then D</code></td><td>Go to Dashboard</td></tr>
              <tr><td><code>G then S</code></td><td>Go to Settings</td></tr>
              <tr><td><code>G then M</code></td><td>Go to Monitors</td></tr>
              <tr><td><code>G then I</code></td><td>Go to Incidents</td></tr>
              <tr><td><code>⌘ / Ctrl + K</code></td><td>Command palette <span style={{ opacity: 0.7 }}>(coming soon)</span></td></tr>
              <tr><td><code>?</code></td><td>Show shortcuts</td></tr>
            </tbody>
          </table>
          <p style={{ opacity: 0.65, marginTop: 14, fontSize: 12 }}>Press <code>Esc</code> or click outside to close.</p>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [ntelegram, setNTelegram] = useState(true);
  const [nemail, setNEmail] = useState(true);
  const [copied, setCopied] = useState(false);
  const [tgLinked, setTgLinked] = useState(!!user?.telegram_linked);
  const [paused, setPaused] = useState(!!user?.alerts_paused);
  const [link, setLink] = useState<string | null>(null);
  const [tgBusy, setTgBusy] = useState(false);
  const [comingOpen, setComingOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

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

  // Account
  const [displayName, setDisplayName] = useState(user?.full_name || "");
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  // API & Security
  const [tokens, setTokens] = useState<any[]>([]);
  const [tokenName, setTokenName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any>(null);

  // System Health
  const [health, setHealth] = useState<any>(null);
  // About
  const [about, setAbout] = useState<any>(null);
  // Support / Feedback
  const [supportSubj, setSupportSubj] = useState("");
  const [supportMsg, setSupportMsg] = useState("");
  const [supportDone, setSupportDone] = useState(false);
  const [supportErr, setSupportErr] = useState("");
  const [regenMsg, setRegenMsg] = useState("");
  const [rating, setRating] = useState(0);
  const [fbMsg, setFbMsg] = useState("");
  const [fbDone, setFbDone] = useState(false);
  const [fbErr, setFbErr] = useState("");
  // Formspree (optional: set VITE_FORMSPREE_ENDPOINT in .env)
  const FORMSPREE = import.meta.env.VITE_FORMSPREE_ENDPOINT as string | undefined;

  const pubUrl = user?.status_slug
    ? `${window.location.origin}/status/slug/${user.status_slug}`
    : `${window.location.origin}/status/${user?.id}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(pubUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* clipboard blocked */ }
  };
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: "PulseWatch Status", url: pubUrl }); }
      else { await copy(); }
    } catch { /* user cancelled */ }
  };
  const regen = async () => {
    try {
      const r = await api.regenerateStatusSlug();
      setCopied(false); setSupportErr("");
      setRegenMsg(window.location.origin + r.url);
      setSupportDone(true);
      setTimeout(() => { setSupportDone(false); setRegenMsg(""); }, 2500);
      loadPlatform();
    }
    catch (e: any) { setSupportDone(false); setRegenMsg(""); setSupportErr(e.message || "Failed"); }
  };

  const connect = async () => {
    setTgBusy(true);
    try {
      const r = await api.tgLink();
      setLink(r.link);
      setTgLinked(false);
      const u = r.bot_username;
      const tok = r.token;
      const httpsLink = r.link;
      const w = (u && tok) ? window.open(`tg://resolve?domain=${u}&start=${tok}`, "_blank") : null;
      if (!w) { window.open(httpsLink, "_blank"); }
      else {
        setTimeout(() => {
          try {
            if (w.closed === false && (!w.location || w.location.href === "about:blank")) { window.open(httpsLink, "_blank"); }
          } catch { /* cross-origin; assume tg:// worked */ }
        }, 800);
      }
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
      setLink(null);
      setTgLinked(false);
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
      setSupportErr(e.message || "Failed to save channels");
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
      setSupportErr(e.message || "Failed to save status page");
    } finally { setSpSaving(false); }
  };

  // Load platform data
  const loadPlatform = async () => {
    try { setHealth(await api.systemHealth()); } catch { /* ignore */ }
    try { setTokens(await api.listTokens()); } catch { /* ignore */ }
    try { setSessions(await api.listSessions()); } catch { /* ignore */ }
    try { setAbout(await api.about()); } catch { /* ignore */ }
  };
  useEffect(() => { loadPlatform(); }, []);

  const makeToken = async () => {
    try {
      const r = await api.createToken(tokenName || "New token");
      setNewToken(r.token);
      setTokenName("");
      loadPlatform();
    } catch (e: any) {
      setSupportErr(e.message || "Failed to create token");
    }
  };
  const revoke = async (id: number) => {
    try { await api.revokeToken(id); loadPlatform(); } catch (e: any) { setSupportErr(e.message || "Failed"); }
  };
  const doPw = async () => {
    setPwMsg("");
    try { await api.changePassword(curPw, newPw); setPwMsg("Password updated ✓"); setCurPw(""); setNewPw(""); }
    catch (e: any) { setPwMsg(e.message || "Failed"); }
  };
  const doName = async () => {
    try { await api.changeDisplayName(displayName); setPwMsg("Display name updated ✓"); }
    catch (e: any) { setPwMsg(e.message || "Failed"); }
  };
  const doExport = async () => {
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "pulsewatch-export.json";
      a.click();
    } catch (e: any) { setSupportErr(e.message || "Export failed"); }
  };
  const doDelete = async () => {
    if (!confirm("Delete your account and all monitors? This cannot be undone.")) return;
    const pw = prompt("Type your password to confirm:");
    if (!pw) return;
    try { await api.deleteAccount(pw); localStorage.removeItem("pw_token"); window.location.href = "/login"; }
    catch (e: any) { setSupportErr(e.message || "Failed"); }
  };
  const sendSupport = async () => {
    try {
      if (FORMSPREE) {
        await fetch(FORMSPREE, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ subject: supportSubj, message: supportMsg, _subject: supportSubj || "PulseWatch Support" }) });
      } else {
        await api.submitSupport({ subject: supportSubj, message: supportMsg });
      }
      setSupportDone(true); setTimeout(() => setSupportDone(false), 2500); setSupportSubj(""); setSupportMsg(""); setSupportErr("");
    } catch (e: any) { setSupportErr(e.message || "Failed"); }
  };
  const sendFb = async () => {
    try {
      if (FORMSPREE) {
        await fetch(FORMSPREE, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ message: fbMsg, _subject: `PulseWatch Feedback ${rating}/5` }) });
      } else {
        await api.submitFeedback({ rating, message: fbMsg });
      }
      setFbDone(true); setTimeout(() => setFbDone(false), 2500); setFbMsg(""); setRating(0); setFbErr("");
    } catch (e: any) { setFbErr(e.message || "Failed"); }
  };

  return (
    <Shell>
      <Topbar title="Settings" sub="Manage notifications, security, and your public status page" />
      <div className="content">
        {/* ── Notifications ── */}
        <div className="set-card glass-2">
          <h3>Telegram</h3>
          <p>Link your account to the PulseWatch bot for instant outage pings.</p>
          {tgLinked ? (
            <>
              <Row brand="telegram" title="Connected" desc="Your Telegram chat is linked">
                <button className="btn btn-ghost btn-sm" onClick={unlink} disabled={tgBusy}>Unlink</button>
              </Row>
              <Row brand="telegram" title={paused ? "Alerts paused" : "Alerts active"} desc={paused ? "You won't get pings until resumed" : "PulseWatch will ping you on incidents"}>
                <button className={`btn btn-sm ${paused ? "btn-primary" : "btn-ghost"}`} onClick={togglePause} disabled={tgBusy}>
                  {paused ? "Resume" : "Pause"}
                </button>
              </Row>
            </>
          ) : link ? (
            <Row brand="telegram" title="Open Telegram to finish" desc="Tap below and press start in the bot">
              <a className="btn btn-primary btn-sm" href={link} target="_blank" rel="noreferrer">Open ↗</a>
            </Row>
          ) : (
            <Row brand="telegram" title="Not connected" desc="Generate a secure link, then open it in Telegram">
              <button className="btn btn-primary btn-sm" onClick={connect} disabled={tgBusy}>Connect</button>
            </Row>
          )}
        </div>

        <div className="set-card glass-2">
          <h3>Alert Channels</h3>
          <p>Choose where PulseWatch sends downtime &amp; recovery alerts.</p>
          <Row brand="telegram" title="Telegram" desc="Instant pings to your linked chat"><IosSwitch on={channels.telegram} onChange={(v: boolean) => setChannels((c) => ({ ...c, telegram: v }))} /></Row>
          <Row brand="gmail" title="Email" desc="Resend incident reports to your email"><IosSwitch on={channels.email} onChange={(v: boolean) => setChannels((c) => ({ ...c, email: v }))} /></Row>
          <Row brand="discord" title="Discord" desc="Post to a Discord webhook"><IosSwitch on={channels.discord} onChange={(v: boolean) => setChannels((c) => ({ ...c, discord: v }))} /></Row>
          <Row brand="slack" title="Slack" desc="Post to a Slack incoming webhook"><IosSwitch on={channels.slack} onChange={(v: boolean) => setChannels((c) => ({ ...c, slack: v }))} /></Row>
          <Row icon="link" title="Webhook" desc="Generic JSON webhook (Zapier/Make/custom)"><IosSwitch on={channels.webhook} onChange={(v: boolean) => setChannels((c) => ({ ...c, webhook: v }))} /></Row>
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

        {/* ── Status Pages ── */}
        <div className="set-card glass-2">
          <h3>Status Pages</h3>
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
          {regenMsg && <div style={{ marginTop: 8, fontSize: 12, color: "var(--primary)" }}>{regenMsg}</div>}
          <Row icon="link" title="Public page" desc="Preview your public monitor board" style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <a className="btn btn-ghost btn-sm" href={pubUrl} target="_blank" rel="noreferrer">Open ↗</a>
              <button className="btn btn-ghost btn-sm" onClick={copy}>{copied ? "Copied ✓" : "Copy link"}</button>
              <button className="btn btn-ghost btn-sm" onClick={share}>Share</button>
              <button className="btn btn-ghost btn-sm" onClick={regen}>Regenerate</button>
            </div>
          </Row>
        </div>

        {/* ── Account ── */}
        <div className="set-card glass-2">
          <h3>Account</h3>
          <p>Manage your profile and sign-in.</p>
          <input className="inp" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={doName}>Save name</button>
          <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
            <input className="inp" type="password" placeholder="Current password" value={curPw} onChange={(e) => setCurPw(e.target.value)} />
            <input className="inp" type="password" placeholder="New password (min 8)" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={doPw}>Change password</button>
            {pwMsg && <div style={{ fontSize: 12, marginTop: 6, color: "var(--primary)" }}>{pwMsg}</div>}
          </div>
          <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14, display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={doExport}>Export data</button>
            <button className="btn btn-ghost btn-sm" style={{ color: "#ff453a" }} onClick={doDelete}>Delete account</button>
          </div>
        </div>

        {/* ── API & Security ── */}
        <div className="set-card glass-2">
          <h3>API &amp; Security</h3>
          <p>Personal access tokens help you integrate PulseWatch into scripts and CI.</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input className="inp" placeholder="Token name" value={tokenName} onChange={(e) => setTokenName(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={makeToken}>Generate</button>
          </div>
          {newToken && (
            <div className="token-box" style={{ background: "rgba(52,199,89,0.12)", border: "1px solid #34C759", borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 12 }}>
              <div style={{ opacity: 0.8, marginBottom: 4 }}>Copy this token now — it won't be shown again:</div>
              <code style={{ wordBreak: "break-all" }}>{newToken}</code>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => { navigator.clipboard.writeText(newToken); }}>Copy</button>
            </div>
          )}
          {tokens.map((t) => (
            <Row key={t.id} icon="key" title={t.name} desc={`${t.preview}${t.last_used_at ? ` · used ${new Date(t.last_used_at).toLocaleDateString()}` : ""}`}>
              <button className="btn btn-ghost btn-sm" onClick={() => revoke(t.id)}>Revoke</button>
            </Row>
          ))}
          <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
            <Row icon="shield" title="Two-Factor Authentication" desc="Coming soon">
              <span className="upgrade-pill">Soon</span>
            </Row>
            {sessions && (
              <Row icon="users" title="Sessions" desc={`${sessions.current?.device || "This device"} · current`}>
                <button className="btn btn-ghost btn-sm" disabled>Log out others (soon)</button>
              </Row>
            )}
          </div>
        </div>

        {/* ── System Health ── */}
        <div className="set-card glass-2">
          <h3>System Health</h3>
          <p>Live status of PulseWatch&apos;s own infrastructure.</p>
          {health ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["api", "PulseWatch API"],
                ["worker", "Worker"],
                ["database", "Database"],
                ["telegram", "Telegram"],
                ["queue", "Queue"],
              ].map(([k, label]) => {
                const h = health[k];
                if (!h) return null;
                return (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <HealthDot status={h.status} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
                      <div style={{ fontSize: 11, opacity: 0.7, textTransform: "capitalize" }}>{h.status}{h.seconds_ago != null ? ` · ${h.seconds_ago}s ago` : ""}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <div style={{ opacity: 0.6, fontSize: 13 }}>Loading…</div>}
        </div>

        {/* ── About PulseWatch ── */}
        <div className="set-card glass-2">
          <h3>About PulseWatch</h3>
          <Row icon="heart-pulse" title="Version" desc={about?.version || "2.4.0"} />
          <Row icon="server" title="Built by" desc={about?.developer || "Robel Biruk"} />
          <Row icon="settings" title="Tech stack" desc={(about?.tech_stack || ["React", "FastAPI", "PostgreSQL", "Neon"]).join(" · ")} />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {about?.github && <a className="btn btn-ghost btn-sm" href={about.github} target="_blank" rel="noreferrer"><BrandIcon name="github" size={14} /> GitHub</a>}
            <button className="btn btn-ghost btn-sm" onClick={() => nav("/docs")}><Icon name="link" size={14} /> Docs</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowShortcuts(true)}>
              <Icon name="terminal" size={14} /> Shortcuts
            </button>
          </div>
        </div>

        {/* ── Support ── */}
        <div className="set-card glass-2">
          <h3>Support</h3>
          <p>Need help? Reach out — we usually respond within 24 hours.</p>
          <input className="inp" placeholder="Subject" value={supportSubj} onChange={(e) => setSupportSubj(e.target.value)} />
          <textarea className="inp" placeholder="Message" rows={3} value={supportMsg} onChange={(e) => setSupportMsg(e.target.value)} style={{ resize: "vertical" }} />
          <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn btn-primary btn-sm" onClick={sendSupport}>Send message</button>
            {supportDone && <span style={{ fontSize: 12, color: "var(--primary)" }}>Sent ✓</span>}
            {supportErr && !comingOpen && <span style={{ fontSize: 12, color: "#ff6b6b" }}>{supportErr}</span>}
          </div>
          <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
            <h4 style={{ margin: "0 0 8px" }}>Feedback</h4>
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: n <= rating ? "#ffd60a" : "rgba(255,255,255,0.3)" }}>★</button>
              ))}
            </div>
            <textarea className="inp" placeholder="What can we improve?" rows={2} value={fbMsg} onChange={(e) => setFbMsg(e.target.value)} style={{ resize: "vertical" }} />
            <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn btn-ghost btn-sm" onClick={sendFb}>Submit feedback</button>
              {fbDone && <span style={{ fontSize: 12, color: "var(--primary)" }}>Thanks! ✓</span>}
              {fbErr && <span style={{ fontSize: 12, color: "#ff6b6b" }}>{fbErr}</span>}
            </div>
          </div>
        </div>
      </div>

      {comingOpen && <ComingSoonModal onClose={() => setComingOpen(false)} />}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </Shell>
  );
}
