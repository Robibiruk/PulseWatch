import { useState } from "react";
import { useAuth } from "../auth";
import * as api from "../api";
import Icon from "../components/Icon";
import { Shell, Topbar } from "../components/Layout";

function Row({ icon, title, desc, children }: any) {
  return (
    <div className="set-row">
      <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1 }}>
        <span className="ic" style={{ background: "rgba(0,242,255,0.1)", color: "var(--primary)", width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center" }}>
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
          <h3>Notifications</h3>
          <p>Choose how PulseWatch reaches you when a monitor changes state.</p>
          <Row icon="bell" title="Telegram alerts" desc="Instant outage pings to your linked chat">
            <Switch on={ntelegram} set={setNTelegram} />
          </Row>
          <Row icon="mail" title="Email summaries" desc="Daily digest + incident reports">
            <Switch on={nemail} set={setNEmail} />
          </Row>
        </div>

        <div className="set-card glass-2">
          <h3>Public Status Page</h3>
          <p>Share a live status page with your users — no auth required.</p>
          <Row icon="globe" title="Status URL" desc="Anyone with the link can view it">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--primary)" }}>{pubUrl.replace(/^https?:\/\//, "")}</span>
              <button className="btn btn-ghost btn-sm" onClick={copy}>
                <Icon name={copied ? "check" : "copy"} size={16} /> {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </Row>
          <Row icon="link" title="Open page" desc="Preview your public monitor board">
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
