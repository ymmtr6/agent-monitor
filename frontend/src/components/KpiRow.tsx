import { CaretDown, CaretUp } from "@phosphor-icons/react";
import { useAgentStore } from "../lib/store.js";
import { formatTokens } from "../lib/formatTokens.js";
import type { MetricsSample, MetricsSnapshot } from "../lib/types.js";
import { Sparkline } from "./Sparkline.js";

interface KpiDef {
  label: string;
  unit: string;
  color: string;
  value: (m: MetricsSnapshot) => number;
  series: (s: MetricsSample) => number;
  /** Fraction digits for the headline number; ignored when `format` is set. */
  digits?: number;
  format?: (value: number) => string;
}

const KPIS: KpiDef[] = [
  {
    label: "本日の完了セッション",
    unit: "件",
    color: "var(--accent)",
    value: (m) => m.completedToday,
    series: (s) => s.completed,
  },
  {
    label: "本日の稼働時間",
    unit: "h",
    color: "var(--status-running)",
    value: (m) => m.automatedH,
    series: (s) => s.automatedH,
    digits: 1,
  },
  {
    label: "処理イベント数",
    unit: "件",
    color: "var(--status-subagent)",
    value: (m) => m.eventsToday,
    series: (s) => s.events,
  },
  {
    label: "消費トークン",
    unit: "",
    color: "var(--status-waiting)",
    value: (m) => m.tokens.total,
    series: (s) => s.tokens,
    format: formatTokens,
  },
];

function Trend({ delta, format }: { delta: number; format?: (value: number) => string }) {
  if (delta === 0) {
    return <span style={{ fontSize: 11, color: "var(--text-faint)" }}>±0</span>;
  }
  const up = delta > 0;
  const color = up ? "var(--status-running)" : "var(--text-muted)";
  const Icon = up ? CaretUp : CaretDown;
  const magnitude = Math.abs(delta);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 11, color }}>
      <Icon size={10} weight="fill" />
      <span className="mono">{format ? format(magnitude) : Math.round(magnitude * 10) / 10}</span>
    </span>
  );
}

export function KpiRow() {
  const metrics = useAgentStore((s) => s.metrics);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
      {KPIS.map((kpi) => {
        const values = metrics ? metrics.history.map(kpi.series) : [];
        const value = metrics ? kpi.value(metrics) : 0;
        const delta = values.length > 1 ? values[values.length - 1] - values[0] : 0;

        return (
          <div
            key={kpi.label}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: "10px 12px 0 12px",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 10.5, color: "var(--text-muted)", letterSpacing: "0.02em" }}>
                {kpi.label}
              </span>
              <Trend delta={delta} format={kpi.format} />
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginTop: 2 }}>
              <span className="mono" style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>
                {kpi.format ? kpi.format(value) : value.toFixed(kpi.digits ?? 0)}
              </span>
              {kpi.unit && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{kpi.unit}</span>}
            </div>

            <div style={{ marginTop: 4, marginLeft: -12, marginRight: -12 }}>
              <Sparkline values={values} color={kpi.color} height={26} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
