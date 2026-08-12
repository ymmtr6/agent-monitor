import { useAgentStore } from "../lib/store.js";
import { formatTime } from "../lib/useNow.js";
import { Sparkline } from "./Sparkline.js";

/** Per-sample event deltas, so the chart shows activity rate rather than a rising total. */
function deltas(values: number[]): number[] {
  return values.slice(1).map((v, i) => Math.max(0, v - values[i]));
}

export function ThroughputChart() {
  const metrics = useAgentStore((s) => s.metrics);
  const history = metrics?.history ?? [];
  const values = deltas(history.map((h) => h.events));

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        padding: "8px 12px 10px 12px",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-secondary)" }}>処理スループット</span>
          <span style={{ fontSize: 10, color: "var(--text-faint)" }}>イベント/分</span>
        </div>
        <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
          {(metrics?.eventsPerMin ?? 0).toFixed(1)}
        </span>
      </div>

      <div style={{ marginLeft: -12, marginRight: -12, marginTop: 2 }}>
        <Sparkline values={values} color="var(--accent)" height={48} />
      </div>

      <div
        className="mono"
        style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-faint)" }}
      >
        <span>{history.length > 0 ? formatTime(history[0].ts) : ""}</span>
        <span>{history.length > 0 ? formatTime(history[history.length - 1].ts) : ""}</span>
      </div>
    </div>
  );
}
