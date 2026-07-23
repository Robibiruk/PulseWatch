// Compact last-24h uptime bar built from recent checks (no chart lib).
export default function UptimeBar({ checks }: { checks: any[] }) {
  const MAX = 48;
  const cols = (checks || []).slice(-MAX).reverse();
  if (cols.length === 0) {
    return <div className="bar"><div className="col" style={{ opacity: .25 }} /></div>;
  }
  return (
    <div className="bar">
      {cols.map((c, i) => (
        <div
          key={i}
          className={`col ${c.status === "down" ? "down" : ""}`}
          title={`${c.status} · ${c.checked_at?.slice(11, 16)}`}
        />
      ))}
    </div>
  );
}
