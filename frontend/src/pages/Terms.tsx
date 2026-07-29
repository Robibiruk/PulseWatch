import { Shell } from "../components/Layout";

export default function PageTerms() {
  return (
    <Shell>
      <div className="content">
        <article className="glass-2 doc-article" style={{ maxWidth: 760, margin: "0 auto", padding: 32 }}>
          <h1>Terms of Service</h1>
          <p><strong>Effective:</strong> {new Date().getFullYear()}</p>
          <h3>Acceptance of terms</h3>
          <p>By using PulseWatch you agree to these terms. If you do not agree, discontinue use.</p>
          <h3>Service scope</h3>
          <p>
            PulseWatch provides uptime monitoring, alerting, and status-page hosting as described on
            the product pages and documentation. We may update features over time.
          </p>
          <h3>User responsibilities</h3>
          <p>
            Users are responsible for the monitors they configure, the channels they enable, and any
            content pushed into payloads. Do not configure PulseWatch to probe targets you do not own
            or have explicit permission to check.
          </p>
          <h3>Suspension</h3>
          <p>
            We reserve the right to suspend accounts in case of abusive usage (e.g., aggressive
            targeting, excessive request rates, or reported violations).
          </p>
          <h3>Limitation of liability</h3>
          <p>
            PulseWatch is provided 'as is' without warranties. We are not liable for lost revenue,
            downtime, or indirect damages arising from monitoring delays, missed alerts, or errors.
          </p>
        </article>
      </div>
    </Shell>
  );
}
