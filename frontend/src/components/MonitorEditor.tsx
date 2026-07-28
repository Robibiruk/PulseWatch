import { useEffect, useState } from "react";
import * as api from "../api";
import Icon from "./Icon";

type M = any;

const INTERVALS = [60, 300, 600, 1800];
const IP_VERSIONS = [
  { v: "auto", label: "Default (IPv4 first, then IPv6)" },
  { v: "ipv4", label: "IPv4 only" },
  { v: "ipv6", label: "IPv6 only" },
];

function Switch({ on, onChange, locked }: { on: boolean; onChange: () => void; locked?: boolean }) {
  return (
    <div
      className={`switch ${on ? "on" : ""} ${locked ? "locked" : ""}`}
      onClick={() => !locked && onChange()}
      style={locked ? { pointerEvents: "none", opacity: 0.5 } : undefined}
    />
  );
}

function Upgrade() {
  return <span className="upgrade-pill"><Icon name="lock" size={12} /> Upgrade</span>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="ed-field">
      <label className="field">{label}</label>
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

export default function MonitorEditor({
  monitor,
  onClose,
  onSaved,
  onDeleted,
}: {
  monitor: M | null;
  onClose: () => void;
  onSaved: (m: M) => void;
  onDeleted?: () => void;
}) {
  const isNew = !monitor;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [interval, setInterval] = useState(300);
  const [tags, setTags] = useState("");
  const [requestTimeout, setRequestTimeout] = useState(10);
  const [ipVersion, setIpVersion] = useState("auto");
  const [followRedirects, setFollowRedirects] = useState(true);
  const [checkSsl, setCheckSsl] = useState(true);
  const [sslExpiry, setSslExpiry] = useState(true);
  const [domainExpiry, setDomainExpiry] = useState(false);
  const [httpMethod, setHttpMethod] = useState("GET");
  const [upCodes, setUpCodes] = useState("2xx,3xx");
  const [authType, setAuthType] = useState("none");
  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authBearer, setAuthBearer] = useState("");

  useEffect(() => {
    if (monitor) {
      setName(monitor.name || "");
      setUrl(monitor.url || "");
      setInterval(monitor.interval || 300);
      setTags((monitor.tags as string) || "");
      setRequestTimeout(monitor.request_timeout || 10);
      setIpVersion(monitor.ip_version || "auto");
      setFollowRedirects(monitor.follow_redirects !== false);
      setCheckSsl(monitor.check_ssl !== false);
      setSslExpiry(monitor.ssl_expiry_reminders !== false);
      setDomainExpiry(!!monitor.domain_expiry_reminders);
      setHttpMethod(monitor.http_method || "GET");
      setUpCodes(monitor.up_status_codes || "2xx,3xx");
      setAuthType(monitor.auth_type || "none");
      setAuthUser(monitor.auth_user || "");
      setAuthPass(monitor.auth_pass || "");
      setAuthBearer(monitor.auth_bearer || "");
    } else {
      setName(""); setUrl(""); setInterval(300); setTags("");
      setRequestTimeout(10); setIpVersion("auto"); setFollowRedirects(true);
      setCheckSsl(true); setSslExpiry(true); setDomainExpiry(false);
      setHttpMethod("GET"); setUpCodes("2xx,3xx"); setAuthType("none");
      setAuthUser(""); setAuthPass(""); setAuthBearer("");
    }
    setErr(""); setBusy(false);
  }, [monitor]);

  const submit = async () => {
    setBusy(true); setErr("");
    const body: any = {
      name: name.trim() || url.trim(),
      url: url.trim(),
      interval,
      tags,
      request_timeout: requestTimeout,
      ip_version: ipVersion,
      follow_redirects: followRedirects,
      check_ssl: checkSsl,
      ssl_expiry_reminders: sslExpiry,
      domain_expiry_reminders: domainExpiry,
      http_method: httpMethod,
      up_status_codes: upCodes,
      auth_type: authType,
      auth_user: authType === "basic" ? authUser : null,
      auth_pass: authType === "basic" ? authPass : null,
      auth_bearer: authType === "bearer" ? authBearer : null,
    };
    try {
      const saved = monitor
        ? await api.updateMonitor(monitor.id, body)
        : await api.createMonitor(body);
      onSaved(saved);
    } catch (e: any) {
      setErr(e.message || "Save failed");
      setBusy(false);
    }
  };

  const del = async () => {
    if (!monitor) return;
    if (!confirm(`Delete monitor "${monitor.name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.deleteMonitor(monitor.id);
      onDeleted?.();
    } catch (e: any) {
      setErr(e.message || "Delete failed");
      setBusy(false);
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer glass" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <h2>{isNew ? "New Monitor" : "Edit Monitor"}</h2>
            {!isNew && <div className="step-no">{monitor.url}</div>}
          </div>
          <button className="row-action" onClick={onClose}><Icon name="x" /></button>
        </div>

        <div className="drawer-body">
          <Field label="URL to monitor">
            <input className="inp" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>

          <Field label="Friendly name">
            <input className="inp" placeholder="My service" value={name} onChange={(e) => setName(e.target.value)} />
            {isNew && <div className="field-hint">Defaults to the URL host if left blank.</div>}
          </Field>

          <Field label="Tags" hint="Comma-separated — organise your monitors.">
            <div className="tag-input">
              <Icon name="tag" size={16} />
              <input className="inp bare" placeholder="prod, backend, critical" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
          </Field>

          <div className="ed-section-title">How will we notify you?</div>
          <div className="ed-note">
            Alerts go to your enabled channels (Telegram / Email / Webhooks) set in
            <strong> Settings → Notifications</strong>. No delay, no repeat — incident + recovery pings.
          </div>

          <Field
            label="Monitor interval"
            hint="Checked every interval. 1-minute checks are a paid feature."
          >
            <div className="seg">
              {INTERVALS.map((i) => (
                <button key={i} className={interval === i ? "active" : ""} onClick={() => setInterval(i)}>
                  {i < 60 ? `${i}s` : `${i / 60}m`}
                </button>
              ))}
            </div>
          </Field>

          <div className="ed-section-title">SSL certificate and Domain checks</div>
          <div className="switch-row">
            <div><h4>Check SSL errors</h4><div className="sub">Fail the monitor if the cert is invalid.</div></div>
            <Switch on={checkSsl} onChange={() => setCheckSsl((v) => !v)} />
          </div>
          <div className="switch-row">
            <div><h4>SSL expiry reminders</h4><div className="sub">Warn when the certificate nears expiry.</div></div>
            <Switch on={sslExpiry} onChange={() => setSslExpiry((v) => !v)} />
          </div>
          <div className="switch-row">
            <div><h4>Domain expiry reminders</h4><div className="sub">Warn before the domain registration lapses.</div></div>
            <Switch on={domainExpiry} onChange={() => setDomainExpiry((v) => !v)} />
          </div>

          <div className="ed-section-title">Advanced settings</div>
          <Field label="Request timeout (seconds)" hint="Shorter timeout = marked down sooner. Default 10s.">
            <input className="inp" type="number" min={1} max={60} value={requestTimeout}
              onChange={(e) => setRequestTimeout(Number(e.target.value))} />
          </Field>

          <Field label="Internet Protocol version">
            <select className="inp" value={ipVersion} onChange={(e) => setIpVersion(e.target.value)}>
              {IP_VERSIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </Field>

          <div className="switch-row">
            <div><h4>Follow redirections</h4><div className="sub">If disabled, 3xx codes are returned as-is.</div></div>
            <Switch on={followRedirects} onChange={() => setFollowRedirects((v) => !v)} />
          </div>

          <Field label="Up HTTP status codes" hint="Which codes count as 'up'. 4xx/5xx options are a paid feature.">
            <div className="code-chips">
              {["2xx", "3xx", "4xx", "5xx"].map((c) => {
                const on = upCodes.split(",").includes(c);
                const locked = c === "4xx" || c === "5xx";
                return (
                  <button
                    key={c}
                    className={`chip ${on ? "on" : ""} ${locked ? "locked" : ""}`}
                    disabled={locked}
                    onClick={() => {
                      const set = new Set(upCodes.split(",").filter(Boolean));
                      on ? set.delete(c) : set.add(c);
                      setUpCodes([...set].join(","));
                    }}
                  >
                    {c}{locked && <Upgrade />}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Auth. type" hint="HTTP basic or bearer auth for protected endpoints.">
            <select className="inp" value={authType} onChange={(e) => setAuthType(e.target.value)}>
              <option value="none">None</option>
              <option value="basic">Basic Auth</option>
              <option value="bearer">Bearer Token</option>
            </select>
          </Field>
          {authType === "basic" && (
            <div className="ed-grid-2">
              <input className="inp" placeholder="Username" value={authUser} onChange={(e) => setAuthUser(e.target.value)} />
              <input className="inp" type="password" placeholder="Password" value={authPass} onChange={(e) => setAuthPass(e.target.value)} />
            </div>
          )}
          {authType === "bearer" && (
            <input className="inp" type="password" placeholder="Bearer token" value={authBearer} onChange={(e) => setAuthBearer(e.target.value)} />
          )}

          {/* Paid-tier, shown locked per the free plan */}
          <div className="ed-section-title">Location to monitor from <Upgrade /></div>
          <div className="ed-note locked-note">
            <span className="flag">🌐</span> Default (auto-select by PulseWatch).
            Multiple locations are a paid feature.
          </div>

          <Field label="Slow response time alert" hint="Get notified if response time exceeds a threshold. Paid feature.">
            <div className="locked-row"><Upgrade /> Available only on paid plans</div>
          </Field>

          <Field label="HTTP method" hint="HEAD/POST are available on paid plans.">
            <div className="seg">
              <button className="active">GET</button>
              <button disabled>HEAD <Upgrade /></button>
              <button disabled>POST <Upgrade /></button>
            </div>
          </Field>

          <Field label="Request body" hint="Custom payload. Paid feature.">
            <div className="locked-row"><Upgrade /> Available only on paid plans</div>
          </Field>

          <Field label="Request headers" hint="Custom headers. Paid feature.">
            <div className="locked-row"><Upgrade /> Available only on paid plans</div>
          </Field>

          <Field label="Meta fields" hint="Custom key-value metadata for routing. Paid feature.">
            <div className="locked-row"><Upgrade /> Available only on paid plans</div>
          </Field>

          {err && <div className="error">{err}</div>}
        </div>

        <div className="drawer-foot">
          {!isNew && onDeleted && (
            <button className="btn btn-danger" onClick={del} disabled={busy}><Icon name="trash" size={16} /> Delete</button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={submit} disabled={busy || url.trim().length < 4}>
            {busy ? "…" : isNew ? "Create Monitor" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
