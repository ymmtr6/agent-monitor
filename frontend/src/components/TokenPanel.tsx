import { motion } from "framer-motion";
import { useAgentStore } from "../lib/store.js";
import { formatTokens } from "../lib/formatTokens.js";
import type { TokenUsage } from "../lib/types.js";
import { Sparkline } from "./Sparkline.js";

const BREAKDOWN: { key: keyof Omit<TokenUsage, "total">; label: string; color: string }[] = [
  { key: "input", label: "入力", color: "var(--status-waiting)" },
  { key: "output", label: "出力", color: "var(--accent)" },
  { key: "cacheWrite", label: "キャッシュ書込", color: "var(--status-subagent)" },
  { key: "cacheRead", label: "キャッシュ読取", color: "var(--status-running)" },
];

export function TokenPanel() {
  const metrics = useAgentStore((s) => s.metrics);
  const tokens = metrics?.tokens;
  const total = tokens?.total ?? 0;

  return (
    <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "10px 12px", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.06em" }}>
          トークン使用量
        </span>
        <span style={{ fontSize: 9, color: "var(--text-faint)" }}>監視開始以降</span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 3 }}>
        <span className="mono" style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>
          {formatTokens(total)}
        </span>
        <span className="mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
          {formatTokens(metrics?.tokensPerMin ?? 0)}/分
        </span>
      </div>

      {/* Single stacked bar: cache reads usually dwarf everything, so shares read better than counts. */}
      <div
        style={{
          display: "flex",
          height: 4,
          borderRadius: 999,
          overflow: "hidden",
          background: "var(--bg-surface-raised)",
          marginTop: 6,
        }}
      >
        {tokens &&
          total > 0 &&
          BREAKDOWN.map((part) => (
            <motion.div
              key={part.key}
              animate={{ width: `${(tokens[part.key] / total) * 100}%` }}
              transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
              style={{ background: part.color }}
            />
          ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 7 }}>
        {BREAKDOWN.map((part) => (
          <div key={part.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: part.color, flexShrink: 0 }} />
            <span style={{ color: "var(--text-muted)", flex: 1 }}>{part.label}</span>
            <span className="mono" style={{ color: "var(--text-secondary)" }}>
              {formatTokens(tokens?.[part.key] ?? 0)}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 6, opacity: 0.8 }}>
        <Sparkline values={metrics?.history.map((h) => h.tokens) ?? []} color="var(--accent)" height={20} />
      </div>
    </div>
  );
}
