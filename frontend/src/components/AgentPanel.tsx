import { AnimatePresence, motion } from "framer-motion";
import { useAgentStore } from "../lib/store.js";
import { STATUS_META } from "../lib/statusMeta.js";
import type { SessionState } from "../lib/types.js";
import { formatElapsed, useNow } from "../lib/useNow.js";
import { formatTokens } from "../lib/formatTokens.js";
import { Sparkline } from "./Sparkline.js";
import { TokenPanel } from "./TokenPanel.js";

const AGENT_COLOR: Record<SessionState["agentType"], string> = {
  claude: "#ff9830",
  codex: "#3ecfb2",
};

function AgentRow({ session, now }: { session: SessionState; now: number }) {
  const meta = STATUS_META[session.status];
  const color = AGENT_COLOR[session.agentType];
  const initial = session.projectLabel.slice(0, 1).toUpperCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: session.status === "ended" ? 0.45 : 1, x: 0 }}
      exit={{ opacity: 0, x: -6 }}
      transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
      style={{ display: "flex", gap: 8, padding: "7px 10px", alignItems: "center" }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          flexShrink: 0,
          borderRadius: "50%",
          background: `${color}22`,
          color,
          border: `1px solid ${color}55`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {initial}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={session.projectPath}
          >
            {session.projectLabel}
          </span>
          <span
            className={meta.pulse ? "pulse-dot" : undefined}
            style={{ width: 5, height: 5, borderRadius: "50%", background: meta.color, color: meta.color, flexShrink: 0 }}
          />
        </div>
        <div
          style={{
            fontSize: 10.5,
            color: "var(--text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {meta.label}
          {session.currentActivity ? ` — ${session.currentActivity}` : ""}
        </div>
      </div>

      <div
        className="mono"
        style={{ fontSize: 10, color: "var(--text-faint)", flexShrink: 0, textAlign: "right", lineHeight: 1.4 }}
      >
        <div>{formatElapsed(session.startedAt, now)}</div>
        <div>{formatTokens(session.tokens.total)}</div>
      </div>
    </motion.div>
  );
}

function Gauge({ label, percent, color }: { label: string; percent: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 10.5, color: "var(--text-muted)", width: 34, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 4, borderRadius: 999, background: "var(--bg-surface-raised)", overflow: "hidden" }}>
        <motion.div
          animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
          style={{ height: "100%", background: color, borderRadius: 999 }}
        />
      </div>
      <span className="mono" style={{ fontSize: 10.5, color: "var(--text-secondary)", width: 30, textAlign: "right" }}>
        {Math.round(percent)}%
      </span>
    </div>
  );
}

export function AgentPanel() {
  const sessions = useAgentStore((s) => s.sessions);
  const metrics = useAgentStore((s) => s.metrics);
  const now = useNow();

  const list = Object.values(sessions).sort((a, b) => b.lastEventAt - a.lastEventAt);
  const activeCount = list.filter((s) => s.status !== "ended").length;

  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.04em" }}>
          エージェント
        </span>
        <span
          style={{
            fontSize: 10,
            color: "var(--status-running)",
            background: "var(--status-running-dim)",
            borderRadius: 999,
            padding: "1px 7px",
          }}
        >
          <span className="mono">{activeCount}</span> 稼働中
        </span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "4px 0" }}>
        <AnimatePresence initial={false}>
          {list.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ fontSize: 11, color: "var(--text-faint)", padding: "10px 12px" }}
            >
              検出されたセッションはありません
            </motion.div>
          )}
          {list.map((session) => (
            <AgentRow key={session.id} session={session} now={now} />
          ))}
        </AnimatePresence>
      </div>

      <TokenPanel />

      <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "10px 12px", flexShrink: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "var(--text-muted)",
            letterSpacing: "0.06em",
            marginBottom: 8,
          }}
        >
          システム状態
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <Gauge label="CPU" percent={metrics?.cpu ?? 0} color="var(--status-waiting)" />
          <Gauge label="メモリ" percent={metrics?.mem ?? 0} color="var(--status-subagent)" />
        </div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>
          <Sparkline values={metrics?.history.map((h) => h.cpu) ?? []} color="var(--status-waiting)" height={22} />
        </div>
      </div>
    </aside>
  );
}
