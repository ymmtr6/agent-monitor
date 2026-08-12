import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAgentStore } from "../lib/store.js";
import type { MetricsSnapshot, SessionState } from "../lib/types.js";

const ROTATE_MS = 7000;

/** Every line is derived from live state — the mascot never makes numbers up. */
function buildComments(sessions: SessionState[], metrics: MetricsSnapshot | null): string[] {
  const running = sessions.filter((s) => s.status === "running" || s.status === "subagent_active").length;
  const attention = sessions.filter((s) => s.status === "needs_attention").length;
  const waiting = sessions.filter((s) => s.status === "waiting_input").length;
  const subagents = sessions.reduce(
    (sum, s) => sum + Object.values(s.subagents).filter((sub) => sub.status === "running").length,
    0,
  );

  const lines: string[] = [];
  if (attention > 0) lines.push(`${attention}件が要対応です。そろそろ見てあげてください。`);
  if (running > 0) lines.push(`${running}件が自動で進行中。私は見てるだけです。`);
  if (subagents > 0) lines.push(`サブエージェントが${subagents}体、裏で働いています。`);
  if (waiting > 0) lines.push(`${waiting}件が入力待ちです。あなたの番ですね。`);
  if (metrics && metrics.eventsPerMin > 0) {
    lines.push(`直近1分で${metrics.eventsPerMin.toFixed(0)}件のイベントを処理しました。`);
  }
  if (metrics && metrics.completedToday > 0) {
    lines.push(`本日は${metrics.completedToday}セッションが完了しています。`);
  }
  if (lines.length === 0) lines.push("いまは静かです。コーヒーでもどうぞ。");
  return lines;
}

function Face() {
  return (
    <svg width="34" height="30" viewBox="0 0 34 30" aria-hidden>
      <rect x="1" y="1" width="32" height="28" rx="9" fill="var(--bg-surface-raised)" stroke="var(--border-strong)" />
      <g className="mascot-eyes" fill="var(--accent)">
        <circle cx="12" cy="13" r="2.6" />
        <circle cx="22" cy="13" r="2.6" />
      </g>
      <path
        d="M12 20 Q17 24 22 20"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}

export function Mascot() {
  const sessions = useAgentStore((s) => s.sessions);
  const metrics = useAgentStore((s) => s.metrics);
  const [comment, setComment] = useState("");

  // Metrics arrive every 2s; sampling the state only on the rotate tick keeps the
  // bubble from being rebuilt (and re-animated) on every push.
  const latest = useRef({ sessions, metrics });
  latest.current = { sessions, metrics };

  useEffect(() => {
    let index = 0;
    const pick = () => {
      const lines = buildComments(Object.values(latest.current.sessions), latest.current.metrics);
      setComment(lines[index % lines.length]);
      index++;
    };
    pick();
    const id = setInterval(pick, ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        right: 20,
        bottom: 18,
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 6,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: 210,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "8px 10px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "var(--text-faint)",
            marginBottom: 3,
          }}
        >
          MONITOR COMMENT
        </div>
        {/* Keyed remount replays the fade-in; the box itself stays put so the panel never flickers. */}
        <motion.div
          key={comment}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
          style={{ fontSize: 11, lineHeight: 1.5, color: "var(--text-secondary)" }}
        >
          {comment}
        </motion.div>
      </div>

      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        style={{ display: "flex", alignItems: "center", gap: 6 }}
      >
        <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-faint)" }}>
          MONITOR AI
        </span>
        <Face />
      </motion.div>
    </div>
  );
}
