import { Shell } from "../components/Layout";

export default function PagePrivacy() {
  return (
    <Shell>
      <div className="content">
        <article className="glass-2 doc-article" style={{ maxWidth: 760, margin: "0 auto", padding: 32 }}>
          <h1>Privacy Policy</h1>
          <p><strong>Effective:</strong> {new Date().getFullYear()} · <strong>Controller:</strong> Robel Biruk · <strong>Email:</strong> robekmedia@gmail.com</p>
          <h3>What we collect</h3>
          <p>
            PulseWatch stores account credentials (email, hashed password), monitor configurations
            (URLs, intervals, tags), and operational data (status events, response times, incidents)
            to deliver the service. Chat identifiers from connected Telegram accounts are stored solely
            for notification routing.
          </p>
          <h3>What we don't do</h3>
          <p>
            We do not sell personal data. We do not share data with third-party advertisers. We do not
            use your monitored URLs for any purpose beyond status checks.
          </p>
          <h3>Data retention & deletion</h3>
          <p>
            Data is retained until you delete your account. Account deletion permanently removes user,
            monitor, incident, token, and session records. Contact{" "}
            <a href="mailto:robekmedia@gmail.com">robekmedia@gmail.com</a> for deletion requests
            or GDPR inquiries.
          </p>
          <h3>Security</h3>
          <p>
            Passwords are hashed with bcrypt. API tokens are stored as SHA-256 hashes. All network
            access is over HTTPS.
          </p>
        </article>
      </div>
    </Shell>
  );
}
