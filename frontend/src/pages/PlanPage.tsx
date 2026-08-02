import { Shell, Topbar } from "../components/Layout";
import PlanSelection from "../components/PlanSelection";
import { useState } from "react";

export default function PlanPage() {
  const [done, setDone] = useState(false);

  return (
    <Shell>
      <Topbar title="Plan" sub="Choose or change your plan" />
      <div className="content">
        {done ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <h3>Plan updated</h3>
            <p style={{ color: "var(--on-surface-muted)", marginTop: 8 }}>Your changes are saved. Refresh to see them in the sidebar.</p>
          </div>
        ) : (
          <PlanSelection onComplete={() => setDone(true)} />
        )}
      </div>
    </Shell>
  );
}
