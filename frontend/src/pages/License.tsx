import { Shell } from "../components/Layout";

export default function PageLicense() {
  return (
    <Shell>
      <div className="content">
        <article className="glass-2 doc-article" style={{ maxWidth: 760, margin: "0 auto", padding: 32 }}>
          <h1>License</h1>
          <p>
            PulseWatch platform and product names are proprietary to <strong>Robel Biruk</strong>.
            All rights reserved.
          </p>
          <h3>General license</h3>
          <p>
            Use of the service is governed by the PulseWatch Terms of Service. Repository source code,
            where released, carries its own license notice in the repo root.
          </p>
          <h3>Trademarks</h3>
          <p>
            PulseWatch, ▰PulseWatch, and associated logos are trademarks of Robel Biruk.
          </p>
          <h3>Third-party notices</h3>
          <p>
            PulseWatch is built with open-source software. See repository `LICENSE-THIRD-PARTY` for
            attributions.
          </p>
        </article>
      </div>
    </Shell>
  );
}
