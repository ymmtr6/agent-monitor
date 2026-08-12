import { Pulse, WifiHigh, WifiSlash } from "@phosphor-icons/react";
import { useAgentStore } from "../lib/store.js";
import { formatClock, formatUptime, useNow } from "../lib/useNow.js";

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 10.5,
        color,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 999,
        padding: "2px 9px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function Header() {
  const sessions = useAgentStore((s) => s.sessions);
  const connection = useAgentStore((s) => s.connection);
  const metrics = useAgentStore((s) => s.metrics);
  const now = useNow();

  const values = Object.values(sessions);
  const attention = values.filter((s) => s.status === "needs_attention").length;
  const connected = connection === "open";

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "0 16px",
        height: 48,
        flexShrink: 0,
        background: "var(--bg-surface-raised)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "var(--radius-sm)",
            background: "var(--accent-dim)",
            color: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Pulse size={14} weight="bold" />
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>AgentMonitor</span>
        <span style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: "0.08em" }}>
          AUTONOMOUS OPS CONSOLE
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 6 }}>
          <Badge color="var(--status-running)">
            <span
              className="pulse-dot"
              style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }}
            />
            local
          </Badge>
          <Badge color="var(--text-secondary)">ClaudeCode / Codex</Badge>
          {attention > 0 && (
            <Badge color="var(--status-attention)">
              <span className="mono">{attention}</span> 要対応
            </Badge>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--text-muted)" }}>
          連続稼働
          <span className="mono" style={{ color: "var(--text-secondary)" }}>
            {metrics ? formatUptime(metrics.serverStartedAt, now) : "--:--:--"}
          </span>
        </div>

        <span className="mono" style={{ fontSize: 15, fontWeight: 600, letterSpacing: "0.02em" }}>
          {formatClock(now)}
        </span>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 10.5,
            color: connected ? "var(--status-running)" : "var(--text-faint)",
          }}
        >
          {connected ? <WifiHigh size={14} /> : <WifiSlash size={14} />}
          {connected ? "接続中" : connection === "connecting" ? "接続試行中..." : "切断"}
        </div>
      </div>
    </header>
  );
}
